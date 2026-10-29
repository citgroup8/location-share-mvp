import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(1).max(100000).default(50000)
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = schema.safeParse({
    latitude: Number(params.get('lat')),
    longitude: Number(params.get('lng')),
    radius: params.has('radius') ? Number(params.get('radius')) : undefined
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });

  const gems = await prisma.gem.findMany({
    where: {
      isPublic: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    include: { creator: { select: { id: true, username: true, displayName: true } } },
    take: 100,
    orderBy: { createdAt: 'desc' }
  });

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const nearby = gems
    .map((gem) => {
      const dLat = radians(gem.latitude - parsed.data.latitude);
      const dLng = radians(gem.longitude - parsed.data.longitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(radians(parsed.data.latitude)) *
          Math.cos(radians(gem.latitude)) *
          Math.sin(dLng / 2) ** 2;
      const distanceMeters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...gem, distanceMeters };
    })
    .filter((gem) => gem.distanceMeters <= parsed.data.radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  return NextResponse.json({ gems: nearby });
}
