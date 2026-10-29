import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBlockedUserIds } from '@/lib/friend-safety';

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(1).max(100000).default(50000)
});

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const blockedIds = await getBlockedUserIds(userId);

  const params = new URL(request.url).searchParams;
  if (!params.has('lat') || !params.has('lng')) {
    return NextResponse.json({ error: 'Missing latitude and longitude' }, { status: 400 });
  }
  const parsed = coordinatesSchema.safeParse({
    latitude: Number(params.get('lat')),
    longitude: Number(params.get('lng')),
    radius: params.has('radius') ? Number(params.get('radius')) : undefined
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: [userId, ...Array.from(blockedIds)] },
      isOnline: true,
      liveLocationMode: 'public',
      latitude: { not: null },
      longitude: { not: null },
      lastLocationAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      latitude: true,
      longitude: true,
      lastLocationAt: true
    },
    take: 200
  });

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const nearby = users
    .map((user) => {
      const latitude = user.latitude ?? 0;
      const longitude = user.longitude ?? 0;
      const dLat = radians(latitude - parsed.data.latitude);
      const dLng = radians(longitude - parsed.data.longitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(radians(parsed.data.latitude)) *
          Math.cos(radians(latitude)) *
          Math.sin(dLng / 2) ** 2;
      const distanceMeters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...user, distanceMeters };
    })
    .filter((user) => user.distanceMeters <= parsed.data.radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  return NextResponse.json({ users: nearby });
}
