import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseJsonBody } from '@/lib/api-response';

const schema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(40).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
}).refine((data) => Object.keys(data).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Gem details' }, { status: 400 });

  const existingGem = await prisma.gem.findUnique({ where: { id }, select: { creatorId: true } });
  if (!existingGem || existingGem.creatorId !== userId) {
    return NextResponse.json({ error: 'Gem not found' }, { status: 404 });
  }

  const gem = await prisma.gem.update({
    where: { id },
    data: parsed.data,
    include: { creator: { select: { id: true, username: true, displayName: true } } }
  });
  return NextResponse.json({ gem });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const deleted = await prisma.gem.deleteMany({ where: { id, creatorId: userId } });
  if (!deleted.count) return NextResponse.json({ error: 'Gem not found' }, { status: 404 });

  return NextResponse.json({ deleted: true, id });
}
