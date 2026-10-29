import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }], isDeleted: false },
    include: {
      sender: { select: { id: true, username: true, displayName: true } },
      receiver: { select: { id: true, username: true, displayName: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  const threads = new Map<string, {
    conversationId: string;
    friend: { id: string; username: string; displayName: string | null };
    lastMessage: typeof messages[number];
    unreadCount: number;
  }>();
  for (const message of messages) {
    const friend = message.senderId === userId ? message.receiver : message.sender;
    if (!friend) continue;
    const thread = threads.get(message.conversationId);
    if (thread) {
      if (message.receiverId === userId && !message.readAt) thread.unreadCount += 1;
      continue;
    }
    threads.set(message.conversationId, {
      conversationId: message.conversationId,
      friend,
      lastMessage: message,
      unreadCount: message.receiverId === userId && !message.readAt ? 1 : 0
    });
  }
  return NextResponse.json({ conversations: Array.from(threads.values()) });
}
