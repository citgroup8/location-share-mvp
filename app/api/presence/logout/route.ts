import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getFriendIds, publishRealtime } from '@/lib/realtime';

export async function POST() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isOnline: false,
      lastSeenAt: new Date(),
      latitude: null,
      longitude: null,
      lastLocationAt: null,
      liveLocationMode: 'off',
      shareLocation: false
    }
  });

  await publishRealtime(await getFriendIds(userId), { friendsChanged: true, presenceChanged: true });
  await publishRealtime('all');
  return NextResponse.json({ user });
}
