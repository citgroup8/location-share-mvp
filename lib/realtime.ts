import { Client } from 'pg';
import { prisma } from '@/lib/prisma';
import { REALTIME_CHANNEL, type RealtimeUpdate } from '@/lib/realtime-types';

export type { RealtimeUpdate } from '@/lib/realtime-types';

/**
 * Wire format on the PostgreSQL channel. `userId`/`userIds` target specific users,
 * `broadcast` reaches every connected user. Database triggers may also emit this shape.
 */
type DatabaseNotification = RealtimeUpdate & { userId?: string; userIds?: string[]; broadcast?: string };
type Subscriber = (update: RealtimeUpdate) => void;
type PresenceEntry = {
  connections: number;
  offlineTimer?: ReturnType<typeof setTimeout>;
  heartbeat?: ReturnType<typeof setInterval>;
};
type RealtimeHub = {
  client?: Client;
  connecting?: Promise<void>;
  connected?: boolean;
  subscribers: Map<string, Set<Subscriber>>;
  presence: Map<string, PresenceEntry>;
  lastLocationPublish: Map<string, number>;
};

const globalForRealtime = globalThis as typeof globalThis & {
  __hiddenGemRealtimeHub?: RealtimeHub;
};
const hub: RealtimeHub = globalForRealtime.__hiddenGemRealtimeHub ?? {
  subscribers: new Map<string, Set<Subscriber>>(),
  presence: new Map<string, PresenceEntry>(),
  lastLocationPublish: new Map<string, number>()
};
// Older hot-reloaded hubs may lack the newer maps.
hub.presence ??= new Map();
hub.lastLocationPublish ??= new Map();
globalForRealtime.__hiddenGemRealtimeHub = hub;

const OFFLINE_GRACE_MS = 20_000; // survives page navigations and brief reconnects
const PRESENCE_REFRESH_MS = 2 * 60_000; // keeps lastSeenAt fresh while a stream is open
const LOCATION_PUBLISH_MIN_INTERVAL_MS = 3_000;
const MAX_TARGETS_PER_NOTIFICATION = 100; // pg_notify payloads are capped at 8000 bytes

function dispatch(notification: DatabaseNotification) {
  const { userId, userIds, broadcast, ...flags } = notification;

  if (broadcast === 'publicLocationsChanged') {
    hub.subscribers.forEach((subscribers) => {
      subscribers.forEach((subscriber) => subscriber({ publicLocationsChanged: true }));
    });
  }

  const targets = [...(userId ? [userId] : []), ...(userIds ?? [])];
  for (const target of targets) {
    hub.subscribers.get(target)?.forEach((subscriber) => subscriber(flags));
  }
}

async function ensureListener() {
  if (hub.connected) return;
  if (hub.connecting) return hub.connecting;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  hub.client = client;
  client.on('notification', (message) => {
    if (!message.payload) return;
    try {
      dispatch(JSON.parse(message.payload) as DatabaseNotification);
    } catch (error) {
      console.error('Could not parse realtime database notification', error);
    }
  });
  const handleLoss = (error?: Error) => {
    if (error) console.error('Realtime PostgreSQL listener failed', error);
    if (hub.client !== client) return;
    hub.client = undefined;
    hub.connected = false;
    hub.connecting = undefined;
    void client.end().catch(() => undefined);
    // Streams close; browsers reconnect with backoff, which re-creates the listener.
    hub.subscribers.forEach((subscribers) => {
      subscribers.forEach((subscriber) => subscriber({ error: 'Realtime service disconnected' }));
    });
  };
  client.on('error', handleLoss);
  client.on('end', () => handleLoss());
  hub.connecting = client.connect()
    .then(() => client.query(`LISTEN ${REALTIME_CHANNEL}`))
    .then(() => {
      hub.connected = true;
    })
    .catch(async (error: unknown) => {
      if (hub.client === client) hub.client = undefined;
      hub.connected = false;
      hub.connecting = undefined;
      await client.end().catch(() => undefined);
      throw error;
    });

  return hub.connecting;
}

export async function subscribeRealtime(userId: string, subscriber: Subscriber) {
  await ensureListener();
  const subscribers = hub.subscribers.get(userId) ?? new Set<Subscriber>();
  subscribers.add(subscriber);
  hub.subscribers.set(userId, subscribers);

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0 && hub.subscribers.get(userId) === subscribers) hub.subscribers.delete(userId);
  };
}

/**
 * Publish an update to specific users (or `'all'` for a public-locations broadcast).
 * Best effort: a failed publish must never fail the request that triggered it.
 */
export async function publishRealtime(
  targets: string | string[] | 'all',
  update: Omit<RealtimeUpdate, 'error'> = {}
) {
  try {
    if (targets === 'all') {
      await notify({ broadcast: 'publicLocationsChanged' });
      return;
    }
    const ids = [...new Set(Array.isArray(targets) ? targets : [targets])].filter(Boolean);
    for (let i = 0; i < ids.length; i += MAX_TARGETS_PER_NOTIFICATION) {
      await notify({ userIds: ids.slice(i, i + MAX_TARGETS_PER_NOTIFICATION), ...update });
    }
  } catch (error) {
    console.error('Could not publish realtime update', error);
  }
}

async function notify(payload: DatabaseNotification) {
  await prisma.$executeRaw`SELECT pg_notify(${REALTIME_CHANNEL}, ${JSON.stringify(payload)})`;
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: 'accepted', OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true }
  });
  return rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId));
}

/** Tell a user's friends (and public maps when relevant) that this user's location changed. */
export async function publishLocationChange(userId: string, mode: 'off' | 'friends_only' | 'public') {
  const now = Date.now();
  const last = hub.lastLocationPublish.get(userId) ?? 0;
  // Always publish transitions to "off"; throttle the steady stream of position updates.
  if (mode !== 'off' && now - last < LOCATION_PUBLISH_MIN_INTERVAL_MS) return;
  hub.lastLocationPublish.set(userId, now);
  if (hub.lastLocationPublish.size > 5000) hub.lastLocationPublish.clear();

  await publishRealtime(await getFriendIds(userId), { friendsChanged: true });
  if (mode !== 'friends_only') await publishRealtime('all');
}

async function setPresence(userId: string, online: boolean) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isOnline: online, lastSeenAt: new Date() },
      select: { liveLocationMode: true }
    });
    await publishRealtime(await getFriendIds(userId), { friendsChanged: true, presenceChanged: true });
    if (user.liveLocationMode === 'public') await publishRealtime('all');
  } catch (error) {
    console.error('Could not update presence', error);
  }
}

async function refreshLastSeen(userId: string) {
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  } catch (error) {
    console.error('Could not refresh presence', error);
  }
}

/**
 * Presence is derived from open realtime streams: the first stream marks the user online,
 * and the user is marked offline only after the last stream has been gone for a grace period.
 * Counts are per server process; with several instances, run presence on a single one or
 * move the counters to a shared store.
 */
export function trackPresence(userId: string) {
  const entry = hub.presence.get(userId) ?? { connections: 0 };
  hub.presence.set(userId, entry);
  if (entry.offlineTimer) {
    clearTimeout(entry.offlineTimer);
    entry.offlineTimer = undefined;
  }
  entry.connections += 1;
  if (!entry.heartbeat) {
    void setPresence(userId, true);
    entry.heartbeat = setInterval(() => void refreshLastSeen(userId), PRESENCE_REFRESH_MS);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.connections -= 1;
    if (entry.connections > 0) return;
    entry.offlineTimer = setTimeout(() => {
      if (entry.connections > 0) return;
      if (entry.heartbeat) clearInterval(entry.heartbeat);
      if (hub.presence.get(userId) === entry) hub.presence.delete(userId);
      void setPresence(userId, false);
    }, OFFLINE_GRACE_MS);
  };
}

export function getRealtimeStats() {
  let streams = 0;
  hub.subscribers.forEach((subscribers) => { streams += subscribers.size; });
  return { listening: !!hub.connected, users: hub.subscribers.size, streams };
}
