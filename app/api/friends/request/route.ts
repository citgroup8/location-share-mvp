import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasBlockBetween } from '@/lib/friend-safety';
import { parseJsonBody } from '@/lib/api-response';
import { publishRealtime } from '@/lib/realtime';

const schema = z.object({ receiverId: z.string().min(1) });

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const receiverId = parsed.data.receiverId;
  if (receiverId === userId) return NextResponse.json({ error: 'Cannot send request to yourself' }, { status: 400 });

  const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } });
  if (!receiver) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (await hasBlockBetween(userId, receiverId)) {
    return NextResponse.json({ error: 'This request cannot be sent.' }, { status: 404 });
  }

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [{ userAId: userId, userBId: receiverId }, { userAId: receiverId, userBId: userId }]
    }
  });
  if (friendship) return NextResponse.json({ error: 'Already friends' }, { status: 409 });

  const existing = await prisma.friendRequest.findFirst({
    where: { OR: [{ senderId: userId, receiverId }, { senderId: receiverId, receiverId: userId }] }
  });
  if (existing?.status === 'pending') {
    return NextResponse.json({ error: 'Friend request already exists' }, { status: 409 });
  }

  const friendRequest = existing
    ? await prisma.friendRequest.update({
        where: { id: existing.id },
        data: { senderId: userId, receiverId, status: 'pending' }
      })
    : await prisma.friendRequest.create({ data: { senderId: userId, receiverId, status: 'pending' } });
  await prisma.notification.upsert({
    where: { friendRequestId: friendRequest.id },
    update: { userId: receiverId, type: 'friend_request', payloadJson: JSON.stringify({ senderId: userId }), isRead: false },
    create: {
      userId: receiverId,
      friendRequestId: friendRequest.id,
      type: 'friend_request',
      payloadJson: JSON.stringify({ senderId: userId })
    }
  });
  await publishRealtime(receiverId, { friendRequestsChanged: true });
  return NextResponse.json({ friendRequest }, { status: existing ? 200 : 201 });
}
