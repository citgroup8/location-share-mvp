'use client';

import { realtimeStatusLabel, useRealtimeStatus } from '@/lib/realtime-client';

const shortLabel = { live: 'Live', connecting: 'Connecting', reconnecting: 'Reconnecting', offline: 'Offline' } as const;

export function RealtimeStatusPill() {
  const status = useRealtimeStatus();
  return (
    <span
      className={`rt-pill rt-pill-${status}`}
      role="status"
      aria-live="polite"
      title={realtimeStatusLabel(status)}
    >
      <span className="rt-dot" aria-hidden="true" />
      {shortLabel[status]}
    </span>
  );
}
