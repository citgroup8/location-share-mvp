import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getBlockedUserIds } from '@/lib/friend-safety';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const blockedIds = await getBlockedUserIds(userId);

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }], status: 'accepted' },
    include: {
      userA: { select: { id: true, username: true, displayName: true, bio: true, profileImageUrl: true, isOnline: true, lastSeenAt: true } },
      userB: { select: { id: true, username: true, displayName: true, bio: true, profileImageUrl: true, isOnline: true, lastSeenAt: true } }
    }
  });
  const friends = friendships.map((friendship) => {
    const friend = friendship.userAId === userId ? friendship.userB : friendship.userA;
    return {
      id: friend.id,
      username: friend.username,
      displayName: friend.displayName,
      bio: friend.bio,
      profileImageUrl: friend.profileImageUrl,
      status: friend.isOnline && friend.lastSeenAt && Date.now() - friend.lastSeenAt.getTime() <= 5 * 60 * 1000 ? 'online' : 'offline',
      lastSeenAt: friend.lastSeenAt
    };
  }).filter((friend) => !blockedIds.has(friend.id));
  return NextResponse.json({ friends });
}
