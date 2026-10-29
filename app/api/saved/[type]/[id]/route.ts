import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleSpotWhere } from '@/lib/spot-access';

type ItemType = 'gem' | 'spot';

export async function POST(_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, id } = await params;
  if (type !== 'gem' && type !== 'spot') return NextResponse.json({ error: 'Unknown saved item type' }, { status: 404 });

  if (type === 'gem') {
    const gem = await prisma.gem.findFirst({
      where: { id, isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { id: true }
    });
    if (!gem) return NextResponse.json({ error: 'Gem not found' }, { status: 404 });
    await prisma.savedGem.upsert({
      where: { userId_gemId: { userId, gemId: id } },
      update: {},
      create: { userId, gemId: id }
    });
  } else {
    const visibleSpot = await getVisibleSpotWhere(userId);
    const spot = await prisma.spot.findFirst({ where: { AND: [visibleSpot, { id }] }, select: { id: true } });
    if (!spot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 });
    await prisma.savedSpot.upsert({
      where: { userId_spotId: { userId, spotId: id } },
      update: {},
      create: { userId, spotId: id }
    });
  }

  return NextResponse.json({ saved: true, type: type as ItemType, id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, id } = await params;
  if (type === 'gem') {
    await prisma.savedGem.deleteMany({ where: { userId, gemId: id } });
  } else if (type === 'spot') {
    await prisma.savedSpot.deleteMany({ where: { userId, spotId: id } });
  } else {
    return NextResponse.json({ error: 'Unknown saved item type' }, { status: 404 });
  }

  return NextResponse.json({ saved: false, type: type as ItemType, id });
}
