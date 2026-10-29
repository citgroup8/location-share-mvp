import { prisma } from '@/lib/prisma';

export async function getBlockedUserIds(userId: string) {
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] },
    select: { blockerId: true, blockedUserId: true }
  });
  return new Set(blocks.map((block) => block.blockerId === userId ? block.blockedUserId : block.blockerId));
}

export async function hasBlockBetween(userId: string, otherUserId: string) {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedUserId: otherUserId },
        { blockerId: otherUserId, blockedUserId: userId }
      ]
    },
    select: { blockerId: true }
  });
  return !!block;
}
