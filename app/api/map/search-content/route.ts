import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleSpotWhere } from '@/lib/spot-access';
import { getBlockedUserIds } from '@/lib/friend-safety';

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ error: 'Enter 2-100 characters to search.' }, { status: 400 });
  }

  const textMatch = [
    { title: { contains: query, mode: 'insensitive' as const } },
    { description: { contains: query, mode: 'insensitive' as const } },
    { category: { contains: query, mode: 'insensitive' as const } }
  ];
  const [visibleSpots, blockedIds] = await Promise.all([getVisibleSpotWhere(userId), getBlockedUserIds(userId)]);
  const [gems, spots] = await Promise.all([
    prisma.gem.findMany({
      where: {
        isPublic: true,
        creatorId: { notIn: [userId, ...Array.from(blockedIds)] },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          { OR: textMatch as Prisma.GemWhereInput[] }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        latitude: true,
        longitude: true,
        creator: { select: { username: true, displayName: true } },
        photos: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 }
      },
      orderBy: { updatedAt: 'desc' },
      take: 30
    }),
    prisma.spot.findMany({
      where: {
        AND: [
          visibleSpots,
          { OR: textMatch as Prisma.SpotWhereInput[] }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        latitude: true,
        longitude: true,
        creator: { select: { username: true, displayName: true } },
        photos: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 }
      },
      orderBy: { updatedAt: 'desc' },
      take: 30
    })
  ]);

  const items = [
    ...gems.map((gem) => ({
      id: gem.id,
      kind: 'gem' as const,
      name: gem.title,
      address: `${gem.category} · ${gem.creator.displayName || gem.creator.username}`,
      latitude: gem.latitude,
      longitude: gem.longitude,
      photoUrl: gem.photos[0] ? `/api/gems/${gem.id}/photos/${gem.photos[0].id}` : null
    })),
    ...spots.map((spot) => ({
      id: spot.id,
      kind: 'spot' as const,
      name: spot.title,
      address: `${spot.category} · ${spot.creator.displayName || spot.creator.username}`,
      latitude: spot.latitude,
      longitude: spot.longitude,
      photoUrl: spot.photos[0] ? `/api/spots/${spot.id}/photos/${spot.photos[0].id}` : null
    }))
  ].sort((left, right) => left.name.localeCompare(right.name)).slice(0, 50);

  return NextResponse.json({ items });
}