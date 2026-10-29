import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';

const STATE_COOKIE = 'hidden-gem-google-state';
const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean(),
  name: z.string().optional(),
  picture: z.string().url().optional()
});

function errorRedirect(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const response = NextResponse.redirect(new URL('/signin?error=google_auth_failed', baseUrl));
  response.cookies.delete(STATE_COOKIE);
  return response;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function usernameBase(email: string): string {
  const base = email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  return (base.length < 3 ? `user_${base}` : base).slice(0, 18);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const savedState = request.cookies.get(STATE_COOKIE)?.value;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!code || !state || !savedState || state !== savedState || !clientId || !clientSecret) {
    return errorRedirect(request);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri = new URL('/api/auth/google/callback', baseUrl).toString();

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }),
      cache: 'no-store'
    });
    if (!tokenResponse.ok) throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
    const tokenData: unknown = await tokenResponse.json();
    const accessToken = z.object({ access_token: z.string().min(1) }).parse(tokenData).access_token;

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    });
    if (!profileResponse.ok) throw new Error(`Google profile request failed: ${profileResponse.status}`);
    const profile = googleProfileSchema.parse(await profileResponse.json());
    if (!profile.email_verified) throw new Error('Google returned an unverified email address');

    const email = profile.email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });
    if (!user) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing?.googleId && existing.googleId !== profile.sub) {
        throw new Error('Google account does not match the linked account');
      }
      if (existing) {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { googleId: profile.sub, emailVerifiedAt: new Date(), isOnline: true, lastSeenAt: new Date() }
        });
      } else {
        const base = usernameBase(email);
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const random = crypto.getRandomValues(new Uint32Array(1))[0]!;
          const username = `${base}_${String(random % 10_000).padStart(4, '0')}`.slice(0, 24);
          if (await prisma.user.findUnique({ where: { usernameNormalized: username.toLowerCase() } })) continue;
          user = await prisma.user.create({
            data: {
              email,
              googleId: profile.sub,
              username,
              usernameNormalized: username.toLowerCase(),
              displayName: profile.name ?? null,
              profileImageUrl: profile.picture ?? null,
              emailVerifiedAt: new Date(),
              isOnline: true,
              lastSeenAt: new Date()
            }
          });
          break;
        }
        if (!user) throw new Error('Could not generate a unique username for the Google account');
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), isOnline: true, lastSeenAt: new Date() }
      });
    }

    const response = NextResponse.redirect(new URL('/map', baseUrl));
    response.cookies.delete(STATE_COOKIE);
    await setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error('Google sign-in failed', error);
    if (isUniqueConstraintError(error)) return errorRedirect(request);
    return errorRedirect(request);
  }
}
