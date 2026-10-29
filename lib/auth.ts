import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

export const SESSION_COOKIE = 'hidden-gem-session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const enc = new TextEncoder();

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? enc.encode(input) : new Uint8Array(input);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

async function hmacKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set in .env');
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(userId: string): Promise<string> {
  const payload = b64url(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })
  );
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function setSessionCookie(response: NextResponse, userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
    path: '/'
  });
}

export async function verifySessionToken(token?: string | null): Promise<{ userId: string } | null> {
  try {
    if (!token) return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(payload));
    if (b64url(expected) !== sig) return null;
    const data = JSON.parse(fromB64url(payload));
    if (!data.sub || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: data.sub as string };
  } catch {
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (session) return session.userId;

  const { userId: clerkUserId } = await auth();
  if (clerkUserId) {
    const { prisma } = await import('@/lib/prisma');
    const linkedUser = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });
    if (linkedUser) return linkedUser.id;

    const clerkProfile = await currentUser();
    const primaryEmail = clerkProfile?.primaryEmailAddress;
    if (!clerkProfile || !primaryEmail || primaryEmail.verification?.status !== 'verified') return null;

    const existingUser = await prisma.user.findUnique({ where: { email: primaryEmail.emailAddress } });
    if (existingUser) {
      if (existingUser.clerkUserId && existingUser.clerkUserId !== clerkUserId) return null;
      const linked = await prisma.user.update({
        where: { id: existingUser.id },
        data: { clerkUserId, emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date() },
        select: { id: true }
      });
      return linked.id;
    }

    const usernameBase = (clerkProfile.username || `user_${clerkUserId.replace(/[^a-z0-9]/gi, '').slice(-12)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 24);
    let username = usernameBase;
    let usernameNormalized = username.toLowerCase();
    if (await prisma.user.findUnique({ where: { usernameNormalized }, select: { id: true } })) {
      username = `${usernameBase.slice(0, 15)}_${clerkUserId.slice(-8).toLowerCase()}`;
      usernameNormalized = username.toLowerCase();
    }
    const user = await prisma.user.upsert({
      where: { clerkUserId },
      update: {},
      create: {
        clerkUserId,
        email: primaryEmail.emailAddress,
        username,
        usernameNormalized,
        displayName: clerkProfile.fullName || clerkProfile.username || primaryEmail.emailAddress.split('@')[0],
        profileImageUrl: clerkProfile.hasImage ? clerkProfile.imageUrl : null,
        emailVerifiedAt: new Date()
      },
      select: { id: true }
    });
    return user.id;
  }

  return null;
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const { prisma } = await import('@/lib/prisma');
  return prisma.user.findUnique({ where: { id: userId } });
}