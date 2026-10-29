# Technical architecture

## Product direction

This app combines social graph features, map-based location data, chat, and background sync. The architecture should prioritize simple API boundaries, live updates, and good mobile performance.

## Recommended stack

- Frontend: Next.js 14 App Router + TypeScript
- Styling: Tailwind CSS
- Backend: Next.js route handlers / server actions
- Database: PostgreSQL
- ORM: Prisma
- Real-time: WebSockets or Socket.IO
- Cache / presence: Redis
- Geolocation: PostGIS for spatial exploration
- Hosting: Vercel + managed Postgres + Redis
- Offline queue: IndexedDB on client, sync worker on reconnect

## High-level architecture

```text
Client app
  ├─ mobile web / PWA shell
  ├─ local IndexedDB for offline queue
  ├─ geolocation and map UI
  └─ socket connection for live presence/chat

API layer
  ├─ auth and profile endpoints
  ├─ friend request endpoints
  ├─ location update endpoints
  ├─ gem/spot CRUD endpoints
  ├─ message endpoints
  └─ notification endpoints

Services
  ├─ Prisma + Postgres
  ├─ Redis presence cache
  ├─ PostGIS geo queries
  ├─ WebSocket room system
  └─ background sync workers
```

## Core domain responsibilities

### Auth and user identity

Use email/password authentication and optional social login later. Keep user profile data separate from auth and allow username uniqueness checks on create/update.

### Friends and social graph

Store social relationships explicitly. Model the relationship as a `FriendRequest` and a `Friendship` resource so you can support accept/decline, blocking, and removal cleanly.

### Presence and location

Presence should be live but lightweight. Update `isOnline` and `lastSeenAt` on socket events or heartbeat. Store a `_lastLocationAt` timestamp and avoid writing precise coordinates unless the user has consented.

### Map data

Public content (Gems) should be stored with latitude/longitude and indexed for nearby search. Private Spots should be permission-filtered by friendship and not indexed in public search.

### Messaging

Support real-time direct messaging over WebSockets while persisting outgoing messages to PostgreSQL. Use conversation state for read receipts, last message preview, and unread counts.

### Offline support

For offline-first behavior, queue writes to IndexedDB and replay them when the client reconnects. Messages, friend requests, and content creation should all survive brief network loss.

## Suggested API folders

```text
app/
  api/
    auth/
    users/
    friends/
    locations/
    gems/
    spots/
    messages/
    notifications/
```

## Real-time channels

- `presence:user:<id>`
- `chat:conversation:<id>`
- `friend:location:<userId>`
- `notification:<userId>`

## Safety and privacy design

- Default user location mode should be `off`
- Allow approximate area when privacy is enabled
- Require explicit user consent before enabling live sharing
- Hide exact coordinates from public views unless the user chooses public mode
- Block/report flows should be separate from friendship lifecycle and obey moderation rules

## Recommended MVP backend data flows

### Friend request flow

1. A user sends a request
2. Store `FriendRequest` with status `pending`
3. Notify recipient
4. On accept, create `Friendship` row and mark request accepted
5. On decline, mark the request declined and do not establish friendship

### Live location flow

1. User toggles live share
2. Client starts location watch
3. Location is sent to backend on interval
4. Backend updates current location + lastUpdateAt
5. Friends receive location updates over WebSockets
6. If offline, cache last-known location and show a stale state indicator

### Messaging flow

1. User sends message from client
2. Message is stored immediately in DB
3. Outgoing message enters a local unsynced queue if offline
4. Recipient receives via socket or polling fallback
5. Read receipt updates message state when opened

## MVP monitoring and analytics

Track:
- daily active users
- friend requests sent / accepted
- messages sent
- active location sessions
- Gems created
- Spots created
- 7-day retention

## Recommended launch hosting

- Frontend: Vercel
- Database: Neon or managed Postgres
- Redis: Upstash or managed Redis
- Map provider: Mapbox or Google Maps
- Auth: Supabase Auth or custom Next auth flow

## Why this architecture works for the MVP

It balances flexibility and speed:
- easy to build in a single codebase
- enough real-time infrastructure for onboarding and retention
- room to add admin tools and analytics later
- can support mobile-first UX and offline contingency
