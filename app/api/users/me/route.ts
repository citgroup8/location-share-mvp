import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api-response';

const profileSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  profileImageUrl: z.string().url().max(2048).nullable().optional(),
  defaultLocationPrivacy: z.enum(['off', 'friends_only', 'public']).optional()
}).refine((profile) => Object.keys(profile).length > 0);

const profileSelect = {
  id: true,
  username: true,
  profileComplete: true,
  email: true,
  displayName: true,
  bio: true,
  profileImageUrl: true,
  defaultLocationPrivacy: true,
  liveLocationMode: true,
  isOnline: true,
  lastSeenAt: true
} as const;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody(request, profileSchema);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile details' }, { status: 400 });

  const username = parsed.data.username;
  if (username) {
    const existingUsername = await prisma.user.findUnique({
      where: { usernameNormalized: username },
      select: { id: true }
    });
    if (existingUsername && existingUsername.id !== userId) {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 });
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...parsed.data,
        ...(username ? { usernameNormalized: username, profileComplete: true } : {})
      },
      select: profileSelect
    });
    return NextResponse.json({ user });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 });
    }
    throw error;
  }
}
