import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ userAId: userId }, { userBId: userId }]
    },
    select: { userAId: true, userBId: true }
  });
  const friendIds = friendships.map((friendship) =>
    friendship.userAId === userId ? friendship.userBId : friendship.userAId
  );

  const spots = await prisma.spot.findMany({
    where: {
      OR: [
        { creatorId: userId },
        { shares: { some: { userId } } },
        { creatorId: { in: friendIds }, visibility: 'friends' }
      ]
    },
    include: {
      creator: { select: { id: true, username: true, displayName: true } },
      shares: { select: { userId: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ spots });
}
