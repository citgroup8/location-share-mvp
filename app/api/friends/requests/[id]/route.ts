import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { publishRealtime } from '@/lib/realtime';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id }
  });

  if (!friendRequest || friendRequest.receiverId !== userId || friendRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.friendRequest.delete({ where: { id } });
  await publishRealtime(userId, { friendRequestsChanged: true });

  return NextResponse.json({ success: true });
}
