import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseJsonBody } from '@/lib/api-response';

const schema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(40).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  friendIds: z.array(z.string().min(1)).max(100).optional()
}).refine((data) => Object.keys(data).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Spot details' }, { status: 400 });

  const existingSpot = await prisma.spot.findFirst({
    where: { id, creatorId: userId },
    select: { id: true }
  });
  if (!existingSpot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 });

  const friendIds = parsed.data.friendIds === undefined ? undefined : Array.from(new Set(parsed.data.friendIds));
  if (friendIds?.length) {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [
          { userAId: userId, userBId: { in: friendIds } },
          { userBId: userId, userAId: { in: friendIds } }
        ]
      },
      select: { userAId: true, userBId: true }
    });
    const validFriendIds = new Set(friendships.map((friendship) =>
      friendship.userAId === userId ? friendship.userBId : friendship.userAId
    ));
    if (friendIds.some((friendId) => !validFriendIds.has(friendId))) {
      return NextResponse.json({ error: 'Spots can only be shared with friends' }, { status: 400 });
    }
  }

  const data = {
    ...(parsed.data.title === undefined ? {} : { title: parsed.data.title }),
    ...(parsed.data.description === undefined ? {} : { description: parsed.data.description }),
    ...(parsed.data.category === undefined ? {} : { category: parsed.data.category }),
    ...(parsed.data.latitude === undefined ? {} : { latitude: parsed.data.latitude }),
    ...(parsed.data.longitude === undefined ? {} : { longitude: parsed.data.longitude })
  };
  const spot = await prisma.$transaction(async (tx) => {
    if (friendIds !== undefined) {
      await tx.spotShare.deleteMany({ where: { spotId: id } });
      if (friendIds.length) {
        await tx.spotShare.createMany({ data: friendIds.map((friendId) => ({ spotId: id, userId: friendId })) });
      }
    }
    return tx.spot.update({
      where: { id },
      data: {
        ...data,
        ...(friendIds === undefined ? {} : { visibility: friendIds.length ? 'selected' : 'private' })
      },
      include: {
        creator: { select: { id: true, username: true, displayName: true } },
        shares: { select: { userId: true } }
      }
    });
  });

  return NextResponse.json({ spot });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const deleted = await prisma.spot.deleteMany({ where: { id, creatorId: userId } });
  if (!deleted.count) return NextResponse.json({ error: 'Spot not found' }, { status: 404 });

  return NextResponse.json({ deleted: true, id });
}
