import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasBlockBetween } from '@/lib/friend-safety';
import { parseJsonBody } from '@/lib/api-response';
import { publishRealtime } from '@/lib/realtime';

const schema = z.object({ requestId: z.string().min(1) });

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const friendRequest = await prisma.friendRequest.findUnique({ where: { id: parsed.data.requestId } });
  if (!friendRequest || friendRequest.receiverId !== userId || friendRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (await hasBlockBetween(userId, friendRequest.senderId)) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const [updatedRequest, friendship] = await prisma.$transaction(async (tx) => {
    const updated = await tx.friendRequest.update({
      where: { id: friendRequest.id },
      data: { status: 'accepted' }
    });
    const relation = await tx.friendship.upsert({
      where: { userAId_userBId: { userAId: friendRequest.senderId, userBId: userId } },
      create: { userAId: friendRequest.senderId, userBId: userId, status: 'accepted' },
      update: { status: 'accepted' }
    });
    await tx.notification.updateMany({
      where: { friendRequestId: friendRequest.id },
      data: { isRead: true }
    });
    return [updated, relation] as const;
  });

  await publishRealtime([friendRequest.senderId, userId], { friendsChanged: true, friendRequestsChanged: true });
  return NextResponse.json({ friendRequest: updatedRequest, friendship });
}
