import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MAX_POST_PHOTOS, parsePostPhotos } from '@/lib/post-photos';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const gem = await prisma.gem.findFirst({ where: { id, creatorId: userId }, select: { id: true } });
  if (!gem) return NextResponse.json({ error: 'Gem not found' }, { status: 404 });

  try {
    const photos = await parsePostPhotos(await request.formData());
    const existingCount = await prisma.gemPhoto.count({ where: { gemId: id } });
    if (existingCount + photos.length > MAX_POST_PHOTOS) {
      return NextResponse.json({ error: `A Gem can have up to ${MAX_POST_PHOTOS} photos.` }, { status: 400 });
    }
    const created = [];
    for (const photo of photos) {
      created.push(await prisma.gemPhoto.create({
        data: { gemId: id, mimeType: photo.mimeType, data: photo.data },
        select: { id: true, mimeType: true }
      }));
    }
    return NextResponse.json({ photos: created.map((photo) => ({ ...photo, url: `/api/gems/${id}/photos/${photo.id}` })) }, { status: 201 });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Could not upload photos.' }, { status: 400 });
  }
}
