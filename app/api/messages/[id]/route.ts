import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      messages: {
        some: { OR: [{ senderId: userId }, { receiverId: userId }] }
      }
    },
    select: { id: true }
  });
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      isDeleted: false
    },
    include: { sender: { select: { id: true, username: true, displayName: true } } },
    orderBy: { createdAt: 'asc' },
    take: 50
  });

  return NextResponse.json({ messages });
}