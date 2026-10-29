import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST() {
  const userId = await getSessionUserId();
  if (userId) {
    await prisma.user.update({
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
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete('hidden-gem-session');
  return response;
}
