import { getSessionUserId } from '@/lib/auth';
import { subscribeRealtime, trackPresence } from '@/lib/realtime';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000; // keeps proxies and load balancers from dropping an idle stream
const RETRY_MS = 3_000;

function encodeEvent(event: string, value: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
}

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | undefined;
  let releasePresence: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        releasePresence?.();
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      request.signal.addEventListener('abort', cleanup);

      send(`retry: ${RETRY_MS}\n\n`);
      heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

      void subscribeRealtime(userId, (update) => {
        if (closed) return;
        if (update.error) {
          send(encodeEvent('error', { message: update.error }));
          cleanup();
          return;
        }
        send(encodeEvent('update', update));
      })
        .then((stop) => {
          unsubscribe = stop;
          if (closed) {
            stop();
            return;
          }
          releasePresence = trackPresence(userId);
          // Sent on every (re)connect so clients resync anything they missed while disconnected.
          send(encodeEvent('update', {
            friendsChanged: true,
            messagesChanged: true,
            publicLocationsChanged: true,
            friendRequestsChanged: true
          }));
        })
        .catch((error: unknown) => {
          console.error('Could not open realtime stream', error);
          send(encodeEvent('error', { message: 'Realtime service is unavailable.' }));
          cleanup();
        });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
      releasePresence?.();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
