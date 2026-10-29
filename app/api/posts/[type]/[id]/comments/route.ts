import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getBlockedUserIds, hasBlockBetween } from '@/lib/friend-safety';
import { parseJsonBody } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { getVisibleSpotWhere } from '@/lib/spot-access';
import { z } from 'zod';

const commentSchema = z.object({
  text: z.string().trim().min(1).max(500)
}).strict();

type PostType = 'gems' | 'spots';

async function getCommentablePost(type: string, id: string, userId: string) {
  if (type === 'gems') {
    return prisma.gem.findFirst({
      where: {
        id,
        isPublic: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      select: { id: true, creatorId: true }
    });
  }
  if (type === 'spots') {
    const visibleSpots = await getVisibleSpotWhere(userId);
    return prisma.spot.findFirst({
      where: { id, AND: [visibleSpots] },
      select: { id: true, creatorId: true }
    });
  }
  return null;
}

function commentPostWhere(type: PostType, id: string) {
  return type === 'gems' ? { gemId: id } : { spotId: id };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, id } = await params;
  if (type !== 'gems' && type !== 'spots') {
    return NextResponse.json({ error: 'Invalid post type' }, { status: 400 });
  }

  const post = await getCommentablePost(type, id, userId);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const blockedUserIds = [...await getBlockedUserIds(userId)];
  const where = {
    ...commentPostWhere(type, id),
    authorId: { notIn: blockedUserIds }
  };
  const [comments, commentCount] = await Promise.all([
    prisma.postComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: { select: { id: true, username: true, displayName: true } }
      }
    }),
    prisma.postComment.count({ where })
  ]);

  return NextResponse.json({ comments, hasMore: commentCount > comments.length });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, id } = await params;
  if (type !== 'gems' && type !== 'spots') {
    return NextResponse.json({ error: 'Invalid post type' }, { status: 400 });
  }

  const parsed = await parseJsonBody(request, commentSchema);
  if (!parsed.success) return NextResponse.json({ error: 'Enter a comment of up to 500 characters.' }, { status: 400 });

  const post = await getCommentablePost(type, id, userId);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (await hasBlockBetween(userId, post.creatorId)) {
    return NextResponse.json({ error: 'You cannot comment on this post.' }, { status: 403 });
  }

  const comment = await prisma.postComment.create({
    data: {
      ...commentPostWhere(type, id),
      authorId: userId,
      text: parsed.data.text
    },
    include: {
      author: { select: { id: true, username: true, displayName: true } }
    }
  });

  return NextResponse.json({ comment }, { status: 201 });
}
