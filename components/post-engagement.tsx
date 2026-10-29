'use client';

import { useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Send, Share2 } from 'lucide-react';
import { readApiResponse } from '@/lib/api-response';

export type PostComment = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null };
};

type Props = {
  type: 'gems' | 'spots';
  postId: string;
  title: string;
  comments: PostComment[];
  commentCount: number;
};

export function PostEngagement({ type, postId, title, comments: initialComments, commentCount: initialCount }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [commentCount, setCommentCount] = useState(initialCount);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(initialCount > initialComments.length);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const commentInput = useRef<HTMLTextAreaElement>(null);

  async function loadAllComments() {
    setLoadingComments(true);
    setError('');
    try {
      const response = await fetch(`/api/posts/${type}/${postId}/comments`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not load comments');
      setComments(data.comments);
      setHasMore(data.hasMore);
      setExpanded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load comments');
    } finally {
      setLoadingComments(false);
    }
  }

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/posts/${type}/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not post comment');
      setComments((current) => [data.comment, ...current].slice(0, 50));
      setCommentCount((current) => current + 1);
      setText('');
      setNotice('Comment posted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function sharePost() {
    const url = `${window.location.origin}/${type === 'gems' ? 'gems' : 'spots'}#${type === 'gems' ? 'gem' : 'spot'}-${postId}`;
    const accessNote = type === 'spots' ? ' Only people who already have access can view this Spot.' : '';
    const shareData = { title, text: `Take a look at ${title} on Hidden Gem.${accessNote}`, url };
    setError('');
    setNotice('');
    try {
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (cause) {
          if (cause instanceof Error && cause.name === 'AbortError') return;
        }
      }
      if (!navigator.clipboard) throw new Error('Sharing and clipboard are not available in this browser.');
      await navigator.clipboard.writeText(url);
      setNotice(`Post link copied.${accessNote}`);
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Could not share this post');
    }
  }

  return (
    <section className="mt-4 border-t border-[var(--line)] pt-4" aria-label={`Comments on ${title}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--green-soft)] px-4 py-2 text-sm font-bold text-[var(--green)] transition hover:brightness-95"
          onClick={() => {
            if (hasMore && !expanded) void loadAllComments();
            commentInput.current?.focus();
          }}
          aria-label={`Comment on ${title}`}
        >
          <MessageCircle size={16} />
          {`Comment${commentCount ? ` · ${commentCount}` : ''}`}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--green-soft)]"
          onClick={() => void sharePost()}
        >
          <Share2 size={16} />
          Share
        </button>
      </div>

      {(comments.length > 0 || expanded) && (
        <div className="mt-4 space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-xs font-extrabold uppercase text-[var(--green)]">
                {(comment.author.displayName || comment.author.username).slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-extrabold">{comment.author.displayName || comment.author.username}</span>
                  <span className="text-xs text-[var(--muted)]">@{comment.author.username}</span>
                  <time className="ml-auto text-xs text-[var(--muted)]" dateTime={comment.createdAt}>
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </time>
                </div>
                <p className="mt-1 break-words text-sm">{comment.text}</p>
              </div>
            </div>
          ))}
          {hasMore && (
            <button type="button" className="text-sm font-bold text-[var(--green)] underline" onClick={() => void loadAllComments()} disabled={loadingComments}>
              {loadingComments ? 'Loading comments...' : 'Load recent comments'}
            </button>
          )}
        </div>
      )}

      <form className="mt-4 flex items-start gap-2" onSubmit={addComment}>
        <textarea
          className="min-h-11 min-w-0 flex-1 resize-y rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm outline-none transition focus:border-[var(--green)]"
          placeholder="Write a comment..."
          aria-label={`Write a comment on ${title}`}
          maxLength={500}
          rows={1}
          ref={commentInput}
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--green)] px-4 py-3 text-sm font-bold text-[var(--green-contrast)] transition hover:brightness-110 disabled:opacity-50"
          disabled={submitting || !text.trim()}
        >
          <Send size={15} />
          <span className="hidden sm:inline">{submitting ? 'Posting...' : 'Post'}</span>
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      {notice && <p role="status" className="mt-2 text-sm text-[var(--green)]">{notice}</p>}
      {hasMore && <p className="mt-2 text-xs text-[var(--muted)]">{expanded ? `Showing the latest 50 of ${commentCount} comments.` : 'Showing the latest 3 comments. Use Comment to view the thread.'}</p>}
    </section>
  );
}
