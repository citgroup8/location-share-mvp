import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRealtimeStats } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness/readiness probe for load balancers and uptime monitors. Contains no user data. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', database: 'up', realtime: getRealtimeStats(), latencyMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Health check failed', error);
    return NextResponse.json(
      { status: 'degraded', database: 'down' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
