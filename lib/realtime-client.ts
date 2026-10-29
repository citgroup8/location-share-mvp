'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { parseJsonMessage } from '@/lib/api-response';
import {
  REALTIME_STREAM_URL,
  type RealtimeStatus,
  type RealtimeUpdate
} from '@/lib/realtime-types';

/**
 * One shared EventSource per browser tab. Pages subscribe instead of opening their own
 * stream, which keeps us well under the browser's per-origin connection limit.
 */
type Listener = (update: RealtimeUpdate) => void;

const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();
let source: EventSource | null = null;
let status: RealtimeStatus = 'connecting';
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
let environmentHooked = false;

function setStatus(next: RealtimeStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

function scheduleReconnect() {
  if (retryTimer || listeners.size === 0) return;
  const delay = Math.min(30_000, 1000 * 2 ** attempts) + Math.random() * 500;
  attempts += 1;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    connect();
  }, delay);
}

function connect() {
  if (source || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  setStatus(navigator.onLine ? (attempts > 0 ? 'reconnecting' : 'connecting') : 'offline');

  const stream = new EventSource(REALTIME_STREAM_URL);
  source = stream;
  stream.onopen = () => {
    attempts = 0;
    setStatus('live');
  };
  stream.onerror = () => {
    setStatus(navigator.onLine ? 'reconnecting' : 'offline');
    // The browser retries on its own unless the server answered with an error status or closed us.
    if (stream.readyState === EventSource.CLOSED) {
      stream.close();
      if (source === stream) source = null;
      scheduleReconnect();
    }
  };
  stream.addEventListener('update', (event) => {
    const update = parseJsonMessage<RealtimeUpdate>((event as MessageEvent<string>).data);
    if (update) listeners.forEach((listener) => listener(update));
  });
}

function disconnect() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = undefined;
  source?.close();
  source = null;
  attempts = 0;
  setStatus('connecting');
}

function hookEnvironment() {
  if (environmentHooked || typeof window === 'undefined') return;
  environmentHooked = true;
  window.addEventListener('online', () => {
    if (listeners.size === 0) return;
    attempts = 0;
    if (source?.readyState === EventSource.OPEN) return;
    source?.close();
    source = null;
    connect();
  });
  window.addEventListener('offline', () => {
    if (listeners.size > 0) setStatus('offline');
  });
  document.addEventListener('visibilitychange', () => {
    // Phones suspend background tabs; reconnect immediately when the user returns.
    if (document.visibilityState !== 'visible' || listeners.size === 0) return;
    if (source?.readyState === EventSource.OPEN) return;
    attempts = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    source?.close();
    source = null;
    connect();
  });
}

/** Subscribe to realtime updates; returns an unsubscribe function. */
export function subscribeRealtime(listener: Listener) {
  hookEnvironment();
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      // Delay so a route change (unmount then mount) keeps the same connection.
      idleTimer = setTimeout(() => {
        if (listeners.size === 0) disconnect();
      }, 1500);
    }
  };
}

function subscribeStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(subscribeStatus, () => status, () => 'connecting' as RealtimeStatus);
}

/** Calls `handler` for every realtime update while the component is mounted. */
export function useRealtime(handler: Listener) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => subscribeRealtime((update) => handlerRef.current(update)), []);
}

export function realtimeStatusLabel(value: RealtimeStatus) {
  switch (value) {
    case 'live': return 'Live updates connected';
    case 'reconnecting': return 'Reconnecting live updates...';
    case 'offline': return 'Offline - updates resume when you reconnect';
    default: return 'Connecting live updates...';
  }
}
