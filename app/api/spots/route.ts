import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getBlockedUserIds } from '@/lib/friend-safety';
import { prisma } from '@/lib/prisma';
import { getVisibleSpotWhere } from '@/lib/spot-access';

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const scope = params.get('scope') ?? 'all';
  if (!['all', 'mine', 'saved'].includes(scope)) {
    return NextResponse.json({ error: 'Invalid Spot scope' }, { status: 400 });
  }

  const visibleSpots = await getVisibleSpotWhere(userId);
  const scopeFilter: Prisma.SpotWhereInput = scope === 'mine'
    ? { creatorId: userId }
    : scope === 'saved'
      ? { savedBy: { some: { userId } } }
      : {};
  const blockedUserIds = [...await getBlockedUserIds(userId)];
  const commentFilter = { authorId: { notIn: blockedUserIds } };
  const spots = await prisma.spot.findMany({
    where: { AND: [visibleSpots, scopeFilter] },
    include: {
      creator: { select: { id: true, username: true, displayName: true } },
      shares: { select: { userId: true } },
      savedBy: { where: { userId }, select: { userId: true } },
      photos: { select: { id: true, mimeType: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      comments: {
        where: commentFilter,
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { author: { select: { id: true, username: true, displayName: true } } }
      },
      _count: { select: { comments: { where: commentFilter } } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({
    spots: spots.map(({ savedBy, ...spot }) => ({
      ...spot,
      photos: spot.photos.map((photo) => ({ ...photo, url: `/api/spots/${spot.id}/photos/${photo.id}` })),
      isSaved: savedBy.length > 0,
      isMine: spot.creatorId === userId,
      commentCount: spot._count.comments
    }))
  });
}
