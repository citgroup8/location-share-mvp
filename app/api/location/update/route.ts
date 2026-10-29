import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api-response';
import { publishLocationChange } from '@/lib/realtime';

const schema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  mode: z.enum(['off', 'friends_only', 'public'])
}).refine((data) => data.mode === 'off' || (data.latitude !== undefined && data.longitude !== undefined));

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid location or privacy setting' }, { status: 400 });

  const sharing = parsed.data.mode !== 'off';
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      latitude: sharing ? parsed.data.latitude : null,
      longitude: sharing ? parsed.data.longitude : null,
      liveLocationMode: parsed.data.mode,
      shareLocation: sharing,
      lastLocationAt: sharing ? new Date() : null,
      isOnline: true,
      lastSeenAt: new Date()
    },
    select: { id: true, latitude: true, longitude: true, liveLocationMode: true }
  });
  await publishLocationChange(userId, parsed.data.mode);
  return NextResponse.json({ user });
}
