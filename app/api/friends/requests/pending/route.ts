import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getBlockedUserIds } from '@/lib/friend-safety';

export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const blockedIds = await getBlockedUserIds(userId);

  const requests = await prisma.friendRequest.findMany({
    where: {
      receiverId: userId,
      status: 'pending',
      senderId: { notIn: Array.from(blockedIds) }
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const formatted = requests.map((req) => ({
    id: req.id,
    senderId: req.senderId,
    senderName: req.sender.displayName || req.sender.username,
    senderUsername: req.sender.username
  }));

  return NextResponse.json({ requests: formatted, count: formatted.length });
}
