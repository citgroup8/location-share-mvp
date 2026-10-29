import { prisma } from '@/lib/prisma';
import { parseJsonBody } from '@/lib/api-response';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(1).max(40),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  friendIds: z.array(z.string().min(1)).max(100).default([])
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Spot details' }, { status: 400 });
  const friendIds = Array.from(new Set(parsed.data.friendIds));
  if (friendIds.length) {
    const friends = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [
          { userAId: userId, userBId: { in: friendIds } },
          { userBId: userId, userAId: { in: friendIds } }
        ]
      },
      select: { userAId: true, userBId: true }
    });
    const allowedIds = new Set(friends.map((friendship) =>
      friendship.userAId === userId ? friendship.userBId : friendship.userAId
    ));
    if (friendIds.some((friendId) => !allowedIds.has(friendId))) {
      return NextResponse.json({ error: 'Spots can only be shared with friends' }, { status: 400 });
    }
  }

  const spot = await prisma.spot.create({
    data: {
      creatorId: userId,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      visibility: friendIds.length ? 'selected' : 'private',
      shares: { create: friendIds.map((friendId) => ({ userId: friendId })) }
    },
    include: { shares: { select: { userId: true } } }
  });
  return NextResponse.json({ spot }, { status: 201 });
}
