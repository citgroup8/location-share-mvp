import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleSpotWhere } from '@/lib/spot-access';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, photoId } = await params;
  const visibleSpot = await getVisibleSpotWhere(userId);
  const photo = await prisma.spotPhoto.findFirst({
    where: { id: photoId, spotId: id, spot: visibleSpot },
    select: { mimeType: true, data: true }
  });
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      'Content-Type': photo.mimeType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, photoId } = await params;
  const result = await prisma.spotPhoto.deleteMany({ where: { id: photoId, spotId: id, spot: { creatorId: userId } } });
  if (!result.count) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
