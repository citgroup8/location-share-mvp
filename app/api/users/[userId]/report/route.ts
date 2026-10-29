import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseJsonBody } from '@/lib/api-response';

const reportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'impersonation', 'inappropriate_content', 'other']),
  details: z.string().trim().max(1000).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const reporterId = await getSessionUserId();
  if (!reporterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: reportedUserId } = await params;
  if (reporterId === reportedUserId) return NextResponse.json({ error: 'You cannot report yourself.' }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id: reportedUserId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  const parsed = await parseJsonBody(request, reportSchema);
  if (!parsed.success) return NextResponse.json({ error: 'Choose a report reason and keep details under 1000 characters.' }, { status: 400 });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReports = await prisma.userReport.count({ where: { reporterId, createdAt: { gte: dayAgo } } });
  if (recentReports >= 10) return NextResponse.json({ error: 'You have reached the daily report limit.' }, { status: 429 });

  await prisma.userReport.create({
    data: { reporterId, reportedUserId, reason: parsed.data.reason, details: parsed.data.details || null }
  });
  return NextResponse.json({ submitted: true }, { status: 201 });
}
