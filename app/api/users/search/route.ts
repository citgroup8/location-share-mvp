import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getBlockedUserIds } from '@/lib/friend-safety';

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const blockedIds = await getBlockedUserIds(userId);

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: { id: { notIn: [userId, ...Array.from(blockedIds)] }, username: { contains: query, mode: 'insensitive' } },
    select: { id: true, username: true, displayName: true, isOnline: true },
    take: 20,
    orderBy: { username: 'asc' }
  });
  return NextResponse.json({ users });
}
