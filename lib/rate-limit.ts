import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RateLimitRule = {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
};

let lastCleanupAt = 0;

function clientAddress(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const address = request.headers.get('x-real-ip') ?? forwardedFor?.split(',')[0]?.trim();
  return address || 'unknown';
}

function bucketKey(scope: string, identity: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set in .env');
  const digest = createHmac('sha256', secret).update(identity).digest('hex');
  return `${scope}:${digest}`;
}

async function cleanExpiredBuckets(now: number): Promise<void> {
  if (now - lastCleanupAt < 10 * 60 * 1000) return;
  lastCleanupAt = now;
  await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
}

async function incrementBucket(key: string, now: number, windowMs: number): Promise<number> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = windowStart + windowMs;
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "expiresAt")
    VALUES (${key}, ${new Date(windowStart)}, 1, ${new Date(expiresAt)})
    ON CONFLICT ("key") DO UPDATE
    SET "count" = CASE
          WHEN "RateLimitBucket"."windowStart" = EXCLUDED."windowStart"
            THEN "RateLimitBucket"."count" + 1
          ELSE 1
        END,
        "windowStart" = EXCLUDED."windowStart",
        "expiresAt" = EXCLUDED."expiresAt"
    RETURNING "count"
  `;

  const result = rows[0];
  if (!result) throw new Error('Rate limit counter did not return a result');
  return result.count;
}

export async function enforceRateLimits(
  request: Request,
  rules: RateLimitRule[]
): Promise<NextResponse | null> {
  const now = Date.now();
  const address = clientAddress(request);
  await cleanExpiredBuckets(now);

  for (const rule of rules) {
    const identity = rule.identity === '$ip' ? address : rule.identity;
    const count = await incrementBucket(bucketKey(rule.scope, identity), now, rule.windowMs);
    if (count > rule.limit) {
      const windowEnd = (Math.floor(now / rule.windowMs) + 1) * rule.windowMs;
      const retryAfter = Math.max(1, Math.ceil((windowEnd - now) / 1000));
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
  }

  return null;
}
