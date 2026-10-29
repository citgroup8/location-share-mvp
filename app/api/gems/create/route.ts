import { prisma } from '@/lib/prisma';
import { parseJsonBody } from '@/lib/api-response';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(1).max(40),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody(request, schema);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const gem = await prisma.gem.create({
    data: {
      creatorId: userId,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      isPublic: true
    }
  });

  return NextResponse.json({ gem }, { status: 201 });
}
