# Database schema

This schema is designed for an MVP social map app with friends, presence, location sharing, messaging, content, notifications, and privacy.

## Core principles

- Each user has one profile and one location state
- Friendship is explicit and bidirectional, with request state tracking
- Live location is time-based and privacy-aware
- Public Gems and private Spots are map-first content
- Messaging is per conversation and read-state aware
- Notifications are lightweight records driven by app events

## Prisma schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String
  username          String    @unique
  displayName       String?
  bio               String?
  profileImageUrl   String?
  isOnline          Boolean   @default(false)
  lastSeenAt        DateTime?
  defaultLocationPrivacy String @default("off")
  liveLocationMode  String    @default("off") // friends_only | public | off
  shareLocation     Boolean   @default(false)
  latitude          Float?
  longitude         Float?
  lastLocationAt    DateTime?
  approximateArea   String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  sentFriendRequests     FriendRequest[] @relation("sentRequests")
  receivedFriendRequests FriendRequest[] @relation("receivedRequests")
  friendshipsA           Friendship[]    @relation("friendshipsUserA")
  friendshipsB           Friendship[]    @relation("friendshipsUserB")
  sentMessages           Message[]      @relation("sentMessages")
  receivedMessages       Message[]      @relation("receivedMessages")
  ownedGems              Gem[]          @relation("ownedGems")
  ownedSpots            Spot[]         @relation("ownedSpots")
  notifications         Notification[]
}

model FriendRequest {
  id         String   @id @default(cuid())
  senderId   String
  receiverId String
  status     String   @default("pending") // pending | accepted | declined | canceled
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  sender   User @relation("sentRequests", fields: [senderId], references: [id])
  receiver User @relation("receivedRequests", fields: [receiverId], references: [id])

  @@unique([senderId, receiverId])
}

model Friendship {
  id          String   @id @default(cuid())
  userAId     String
  userBId     String
  status      String   @default("accepted") // accepted | blocked
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userA User @relation("friendshipsUserA", fields: [userAId], references: [id])
  userB User @relation("friendshipsUserB", fields: [userBId], references: [id])

  @@unique([userAId, userBId])
}

model Conversation {
  id        String    @id @default(cuid())
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  messages  Message[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  receiverId     String?
  text           String
  deliveredAt    DateTime?
  readAt         DateTime?
  isDeleted      Boolean  @default(false)
  createdAt      DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id])
  sender       User         @relation("sentMessages", fields: [senderId], references: [id])
  receiver     User?        @relation("receivedMessages", fields: [receiverId], references: [id])
}

model Gem {
  id          String   @id @default(cuid())
  creatorId   String
  title       String
  description String?
  category    String
  latitude    Float
  longitude   Float
  imageUrl    String?
  expiresAt   DateTime?
  isPublic    Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator User @relation("ownedGems", fields: [creatorId], references: [id])
}

model Spot {
  id          String   @id @default(cuid())
  creatorId   String
  title       String
  description String?
  category    String
  latitude    Float
  longitude   Float
  imageUrl    String?
  visibility  String   @default("friends") // friends | private
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator User @relation("ownedSpots", fields: [creatorId], references: [id])
}

model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        String   // friend_request | message | friend_online | gem_nearby | spot_shared
  payloadJson String
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

model LocationSession {
  id              String   @id @default(cuid())
  userId          String
  isActive        Boolean  @default(false)
  mode            String   @default("friends_only") // friends_only | public | off
  refreshInterval Int      @default(30)
  startedAt       DateTime @default(now())
  stoppedAt       DateTime?
  lastUpdateAt    DateTime?
}
```

## Recommended indexes

- `User.username` unique
- `User.email` unique
- `FriendRequest.senderId + receiverId` unique
- `Friendship.userAId + userBId` unique
- `Gem.latitude + longitude`
- `Spot.latitude + longitude`
- `Message.conversationId` with createdAt sorting
- `Notification.userId + isRead`

## Data model notes

### Friend privacy model

- `defaultLocationPrivacy` defaults to `off`
- `liveLocationMode` can be `off`, `friends_only`, or `public`
- `approximateArea` is used to show a general region instead of exact coordinates if privacy is triggered

### Map content model

- `Gem` is public and discoverable by everyone
- `Spot` is private/friend-only and hidden from public search by default

### Messaging model

- Direct chats can be represented as a conversation with participants tracked in a join table in a production system
- For MVP, a message table with `conversationId` is enough to keep logic simpler
