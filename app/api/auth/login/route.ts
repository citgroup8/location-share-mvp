import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSessionToken } from '@/lib/auth';
import { parseJsonBody } from '@/lib/api-response';
import { enforceRateLimits } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6)
});

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, schema);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { password } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const limited = await enforceRateLimits(request, [
    { scope: 'auth-login-ip', identity: '$ip', limit: 20, windowMs: LOGIN_WINDOW_MS },
    { scope: 'auth-login-email', identity: email, limit: 10, windowMs: LOGIN_WINDOW_MS }
  ]);
  if (limited) return limited;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      passwordHash: true
    }
  });

  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isOnline: true, lastSeenAt: new Date() }
  });

  const safeUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName
  };

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({ user: safeUser }, { status: 200 });

  response.cookies.set('hidden-gem-session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  return response;
}
