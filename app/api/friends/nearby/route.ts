import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getBlockedUserIds } from '@/lib/friend-safety';

export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const blockedIds = await getBlockedUserIds(userId);

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      status: 'accepted',
      userAId: { notIn: [userId, ...Array.from(blockedIds)] },
      userBId: { notIn: [userId, ...Array.from(blockedIds)] }
    },
    include: {
      userA: {
        select: {
          id: true,
          username: true,
          displayName: true,
          isOnline: true,
          lastSeenAt: true,
          latitude: true,
          longitude: true,
          liveLocationMode: true,
          lastLocationAt: true
        }
      },
      userB: {
        select: {
          id: true,
          username: true,
          displayName: true,
          isOnline: true,
          lastSeenAt: true,
          latitude: true,
          longitude: true,
          liveLocationMode: true,
          lastLocationAt: true
        }
      }
    }
  });

  const friends = friendships.map((friendship) => {
    const friend = friendship.userAId === userId ? friendship.userB : friendship.userA;
    const isLocationFresh = !!friend.lastLocationAt && Date.now() - friend.lastLocationAt.getTime() <= 5 * 60 * 1000;
    const isLocationShared =
      friend.liveLocationMode !== 'off' &&
      friend.latitude !== null &&
      friend.longitude !== null &&
      isLocationFresh &&
      (friend.liveLocationMode === 'public' || friendship.status === 'accepted');

    return {
      id: friend.id,
      username: friend.username,
      displayName: friend.displayName,
      status: friend.isOnline ? 'online' : 'offline',
      lastSeen: friend.lastSeenAt,
      location: isLocationShared
        ? {
            latitude: friend.latitude,
            longitude: friend.longitude,
            lastUpdate: friend.lastLocationAt
          }
        : null
    };
  });

  return NextResponse.json({ friends });
}
