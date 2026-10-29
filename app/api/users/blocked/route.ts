import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    include: { blockedUser: { select: { id: true, username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ users: blocks.map((block) => ({ ...block.blockedUser, blockedAt: block.createdAt })) });
}
