import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const usernameSchema = z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/);

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const username = new URL(request.url).searchParams.get('username') ?? '';
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return NextResponse.json({ available: false, error: 'Use 3-24 letters, numbers, or underscores.' });

  const normalizedUsername = parsed.data.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { usernameNormalized: normalizedUsername },
    select: { id: true }
  });

  return NextResponse.json({ available: !existingUser || existingUser.id === userId });
}