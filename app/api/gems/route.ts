import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getBlockedUserIds } from '@/lib/friend-safety';
import { prisma } from '@/lib/prisma';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const scope = params.get('scope') ?? 'all';
  if (!['all', 'mine', 'saved', 'nearby'].includes(scope)) {
    return NextResponse.json({ error: 'Invalid Gem scope' }, { status: 400 });
  }

  const hasLatitude = params.has('lat');
  const hasLongitude = params.has('lng');
  const latitude = hasLatitude ? Number(params.get('lat')) : undefined;
  const longitude = hasLongitude ? Number(params.get('lng')) : undefined;
  const radius = params.has('radius') ? Number(params.get('radius')) : 50000;
  if ((hasLatitude !== hasLongitude) || (hasLatitude && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude! < -90 || latitude! > 90 || longitude! < -180 || longitude! > 180))) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }
  if (scope === 'nearby' && !hasLatitude) return NextResponse.json({ error: 'Location is required for nearby Gems' }, { status: 400 });
  if (!Number.isFinite(radius) || radius < 1 || radius > 100000) {
    return NextResponse.json({ error: 'Invalid search radius' }, { status: 400 });
  }

  const where: Prisma.GemWhereInput = {
    isPublic: true,
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ...(scope === 'mine' ? [{ creatorId: userId }] : []),
      ...(scope === 'saved' ? [{ savedBy: { some: { userId } } }] : [])
    ]
  };

  const blockedUserIds = [...await getBlockedUserIds(userId)];
  const commentFilter = { authorId: { notIn: blockedUserIds } };
  const gems = await prisma.gem.findMany({
    where,
    include: {
      creator: { select: { id: true, username: true, displayName: true } },
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

  const results = gems.map(({ savedBy, ...gem }) => {
    const distanceMeters = latitude === undefined || longitude === undefined ? null : (() => {
      const dLat = radians(gem.latitude - latitude);
      const dLng = radians(gem.longitude - longitude);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(radians(latitude)) * Math.cos(radians(gem.latitude)) * Math.sin(dLng / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    })();
    return {
      ...gem,
      photos: gem.photos.map((photo) => ({ ...photo, url: `/api/gems/${gem.id}/photos/${photo.id}` })),
      comments: gem.comments,
      commentCount: gem._count.comments,
      distanceMeters,
      isSaved: savedBy.length > 0,
      isMine: gem.creatorId === userId
    };
  }).filter((gem) => scope !== 'nearby' || (gem.distanceMeters !== null && gem.distanceMeters <= radius));

  return NextResponse.json({ gems: results });
}
