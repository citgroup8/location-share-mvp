import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, photoId } = await params;
  const photo = await prisma.gemPhoto.findFirst({
    where: { id: photoId, gemId: id, gem: { isPublic: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } },
    select: { mimeType: true, data: true }
  });
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      'Content-Type': photo.mimeType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, photoId } = await params;
  const result = await prisma.gemPhoto.deleteMany({ where: { id: photoId, gemId: id, gem: { creatorId: userId } } });
  if (!result.count) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
