import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { issueEmailOtp, OtpDeliveryError, OtpRateLimitError } from '@/lib/otp';
import { parseJsonBody } from '@/lib/api-response';
import { enforceRateLimits } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const schema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/)
});

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, schema);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name, email, username } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const normalizedUsername = username.toLowerCase();
  const limited = await enforceRateLimits(request, [
    { scope: 'auth-signup-ip', identity: '$ip', limit: 10, windowMs: SIGNUP_WINDOW_MS },
    { scope: 'auth-otp-email', identity: normalizedEmail, limit: 5, windowMs: SIGNUP_WINDOW_MS },
    { scope: 'auth-otp-ip', identity: '$ip', limit: 20, windowMs: SIGNUP_WINDOW_MS }
  ]);
  if (limited) return limited;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { username: { equals: normalizedUsername, mode: 'insensitive' } }]
    }
  });

  if (existingUser) {
    return NextResponse.json({ error: 'User with that email or username already exists' }, { status: 409 });
  }

  try {
    await issueEmailOtp({
      email: normalizedEmail,
      purpose: 'signup',
      username: normalizedUsername,
      displayName: name
    });
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof OtpDeliveryError) {
      console.error('Failed to send signup verification code', error.cause);
      return NextResponse.json({
        error: 'Could not send a verification code. Please try again later.'
      }, { status: 503 });
    }
    throw error;
  }

  return NextResponse.json({ success: true }, { status: 202 });
}
