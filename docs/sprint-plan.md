# Sprint plan

## Goal
Build the first version of a social map app that feels lightweight, social, and useful: users can sign up, add friends, share location, chat, and create map-based content.

## Recommended product phases

### Phase 1 — Foundation and trust (Weeks 1-2)

Primary delivery:
- Sign up / login / logout
- Username creation and uniqueness check
- Basic profile with photo and bio
- Friend requests and pending list
- Online/offline presence
- Friend status and last active time

Why first:
This is the social graph layer. Without it, the app has no trust or network.

### Phase 2 — Map + presence (Weeks 3-4)

Primary delivery:
- Live location sharing toggle
- Share modes: friends-only, public, off
- Permission handling and geolocation UX
- View friends on map
- Store last known location and timestamps
- Show approximate area rather than exact pins on privacy mode

Why second:
This is the core differentiator. The map makes the app feel alive.

### Phase 3 — Content creation (Weeks 5-6)

Primary delivery:
- Public Gem creation and discovery
- Private Spot creation with friend-only visibility
- Saved locations on map
- Marker details and creator attribution
- Search nearby places

Why third:
Map content creates retention and reason to revisit the product.

### Phase 4 — Messaging + engagement (Weeks 7-8)

Primary delivery:
- Direct chat with friends
- Read receipts and timestamps
- Message notifications and unread badges
- Offline syncing and pending message queue
- Typing indicator and chat history

Why fourth:
Messaging adds deep social behavior and increases stickiness once the social graph is working.

### Phase 5 — Reliability + launch polish (Weeks 9-10)

Primary delivery:
- Offline support for sync queue
- Notification center and better UX states
- Bug fixes and edge-case handling
- Basic accessibility and responsive mobile polish
- Terms/privacy and launch-ready onboarding

## Best MVP subset to build first

This is the exact order to reduce risk and launch value quickly:

1. login/signup
2. username
3. friend requests
4. online/offline status
5. live location sharing
6. direct messaging
7. public Gem
8. private Spot
9. map markers
10. offline sync

## Strategic release definition

Release version 1 should be:

Users can sign up, add friends, share location, chat, and create public Gems and private Spots on a map.

That is the smallest complete product and the clearest sellable story.
