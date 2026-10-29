import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { verifyOtpHash } from '@/lib/otp';
import { parseJsonBody } from '@/lib/api-response';
import { enforceRateLimits } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{6}$/)
});
const MAX_ATTEMPTS = 5;

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email and six-digit code' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const limited = await enforceRateLimits(request, [
    { scope: 'auth-verify-otp-ip', identity: '$ip', limit: 20, windowMs: VERIFY_WINDOW_MS }
  ]);
  if (limited) return limited;

  const otp = await prisma.emailOtp.findUnique({ where: { email } });
  if (!otp || otp.expiresAt.getTime() <= Date.now()) {
    if (otp) await prisma.emailOtp.deleteMany({ where: { email, codeHash: otp.codeHash } });
    return NextResponse.json({ error: 'That code is invalid or expired. Request a new one.' }, { status: 400 });
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
  }

  if (!(await verifyOtpHash(email, parsed.data.code, otp.codeHash))) {
    await prisma.emailOtp.updateMany({
      where: { email, codeHash: otp.codeHash, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } }
    });
    return NextResponse.json({ error: 'That code is invalid or expired. Check it and try again.' }, { status: 400 });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailOtp.deleteMany({
        where: {
          email,
          codeHash: otp.codeHash,
          expiresAt: { gt: new Date() },
          attempts: { lt: MAX_ATTEMPTS }
        }
      });
      if (consumed.count !== 1) throw new Error('OTP_ALREADY_USED');

      if (otp.purpose === 'signup') {
        if (!otp.username || !otp.displayName) throw new Error('OTP_SIGNUP_DETAILS_MISSING');
        return tx.user.create({
          data: {
            email,
            username: otp.username,
            usernameNormalized: otp.username.toLowerCase(),
            displayName: otp.displayName,
            emailVerifiedAt: new Date(),
            isOnline: true,
            lastSeenAt: new Date()
          },
          select: { id: true, email: true, username: true, displayName: true }
        });
      }

      const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (!existingUser) throw new Error('OTP_USER_NOT_FOUND');
      return tx.user.update({
        where: { id: existingUser.id },
        data: { emailVerifiedAt: new Date(), isOnline: true, lastSeenAt: new Date() },
        select: { id: true, email: true, username: true, displayName: true }
      });
    });

    const response = NextResponse.json({ user });
    await setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'An account with that email or username already exists' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'OTP_ALREADY_USED') {
      return NextResponse.json({ error: 'That code is invalid or expired. Request a new one.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'OTP_USER_NOT_FOUND') {
      return NextResponse.json({ error: 'No account found for that email' }, { status: 404 });
    }
    throw error;
  }
}
