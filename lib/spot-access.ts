import { prisma } from '@/lib/prisma';
import { getBlockedUserIds } from '@/lib/friend-safety';

export async function getVisibleSpotWhere(userId: string) {
  const [friendships, blockedIds] = await Promise.all([prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ userAId: userId }, { userBId: userId }]
    },
    select: { userAId: true, userBId: true }
  }), getBlockedUserIds(userId)]);
  const friendIds = friendships.map((friendship) =>
    friendship.userAId === userId ? friendship.userBId : friendship.userAId
  ).filter((friendId) => !blockedIds.has(friendId));

  return {
    OR: [
      { creatorId: userId },
      { shares: { some: { userId } } },
      ...(friendIds.length ? [{ creatorId: { in: friendIds }, visibility: 'friends' }] : [])
    ]
  };
}
