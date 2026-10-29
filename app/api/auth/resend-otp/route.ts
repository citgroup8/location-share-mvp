import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { issueEmailOtp, OtpDeliveryError, OtpRateLimitError } from '@/lib/otp';
import { parseJsonBody } from '@/lib/api-response';
import { enforceRateLimits } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const OTP_WINDOW_MS = 60 * 60 * 1000;
const schema = z.object({ email: z.string().trim().email() });

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const limited = await enforceRateLimits(request, [
    { scope: 'auth-otp-email', identity: email, limit: 5, windowMs: OTP_WINDOW_MS },
    { scope: 'auth-otp-ip', identity: '$ip', limit: 20, windowMs: OTP_WINDOW_MS }
  ]);
  if (limited) return limited;

  const pending = await prisma.emailOtp.findUnique({ where: { email } });
  if (!pending) return NextResponse.json({ error: 'Request a new verification code first' }, { status: 404 });

  if (pending.purpose === 'login') {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'Request a new verification code first' }, { status: 404 });
  }

  try {
    await issueEmailOtp({
      email,
      purpose: pending.purpose === 'signup' ? 'signup' : 'login',
      username: pending.username ?? undefined,
      displayName: pending.displayName ?? undefined
    });
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof OtpDeliveryError) {
      console.error('Failed to resend verification code', error.cause);
      return NextResponse.json({
        error: 'Could not send a verification code. Please try again later.'
      }, { status: 503 });
    }
    throw error;
  }

  return NextResponse.json({ success: true }, { status: 202 });
}
