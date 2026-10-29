import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const message = await prisma.message.findUnique({
    where: { id }
  });

  if (!message || message.receiverId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.message.updateMany({
    where: { id, receiverId: userId },
    data: { readAt: new Date() }
  });

  return NextResponse.json({ success: true });
}