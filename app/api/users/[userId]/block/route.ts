import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { publishRealtime } from '@/lib/realtime';

export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: blockedUserId } = await params;
  if (blockedUserId === userId) return NextResponse.json({ error: 'You cannot block yourself.' }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id: blockedUserId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.userBlock.upsert({
      where: { blockerId_blockedUserId: { blockerId: userId, blockedUserId } },
      update: {},
      create: { blockerId: userId, blockedUserId }
    });
    await tx.friendship.deleteMany({
      where: { OR: [{ userAId: userId, userBId: blockedUserId }, { userAId: blockedUserId, userBId: userId }] }
    });
    await tx.friendRequest.deleteMany({
      where: { OR: [{ senderId: userId, receiverId: blockedUserId }, { senderId: blockedUserId, receiverId: userId }] }
    });
    await tx.spotShare.deleteMany({
      where: {
        OR: [
          { userId: blockedUserId, spot: { creatorId: userId } },
          { userId, spot: { creatorId: blockedUserId } }
        ]
      }
    });
  });

  await publishRealtime([userId, blockedUserId], { friendsChanged: true, friendRequestsChanged: true, messagesChanged: true });
  await publishRealtime('all');
  return NextResponse.json({ blocked: true, userId: blockedUserId });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId: blockedUserId } = await params;
  const result = await prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedUserId } });
  if (!result.count) return NextResponse.json({ error: 'Block not found.' }, { status: 404 });
  return NextResponse.json({ blocked: false, userId: blockedUserId });
}
