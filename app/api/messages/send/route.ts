import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasBlockBetween } from '@/lib/friend-safety';
import { parseJsonBody } from '@/lib/api-response';
import { publishRealtime } from '@/lib/realtime';

const schema = z.object({
  conversationId: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(4000),
  receiverId: z.string().min(1)
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody(request, schema);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (parsed.data.receiverId === userId) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
  }
  if (await hasBlockBetween(userId, parsed.data.receiverId)) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { userAId: userId, userBId: parsed.data.receiverId },
        { userAId: parsed.data.receiverId, userBId: userId }
      ]
    }
  });
  if (!friendship) return NextResponse.json({ error: 'Messages are available to friends only' }, { status: 403 });

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const existingMessage = await prisma.message.findFirst({
      where: {
        conversationId,
        OR: [
          { senderId: userId, receiverId: parsed.data.receiverId },
          { senderId: parsed.data.receiverId, receiverId: userId }
        ]
      },
      select: { id: true }
    });
    if (!existingMessage) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  } else {
    const lastMessage = await prisma.message.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: parsed.data.receiverId },
          { senderId: parsed.data.receiverId, receiverId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      select: { conversationId: true }
    });
    conversationId = lastMessage?.conversationId ?? (await prisma.conversation.create({ data: {} })).id;
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      receiverId: parsed.data.receiverId,
      text: parsed.data.text,
      deliveredAt: new Date()
    }
  });
  await publishRealtime([parsed.data.receiverId, userId], { messagesChanged: true });
  return NextResponse.json({ message, conversationId }, { status: 201 });
}
