import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      type: 'friend_request',
      isRead: false,
      friendRequest: { status: 'pending' }
    },
    include: {
      friendRequest: {
        select: {
          id: true,
          createdAt: true,
          sender: { select: { id: true, username: true, displayName: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  return NextResponse.json({
    count: notifications.length,
    notifications: notifications.flatMap((notification) => notification.friendRequest ? [{
      id: notification.id,
      type: notification.type,
      createdAt: notification.createdAt,
      request: notification.friendRequest,
      senderName: notification.friendRequest.sender.displayName || notification.friendRequest.sender.username
    }] : [])
  });
}

export async function PATCH() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.notification.updateMany({
    where: {
      userId,
      type: 'friend_request',
      isRead: false,
      friendRequest: { status: 'pending' }
    },
    data: { isRead: true }
  });
  return NextResponse.json({ markedRead: true });
}
