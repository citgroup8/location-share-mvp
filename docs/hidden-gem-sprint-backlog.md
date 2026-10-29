# Hidden Gem Sprint Backlog

## Mission
Build the v1 product in a way that gets the highest-value social features launched quickly without overbuilding the system.

## Recommended release definition

Users can sign up, add friends, share location, chat, and create public Gems and private Spots on a map.

## Phase 1: Foundation and trust

### Sprint 1: Auth + profile baseline
- Sign up with email/password
- Login/logout flow
- Reset password
- Username creation
- Username uniqueness validation
- Profile photo upload
- Profile bio
- Basic profile card

### Sprint 2: Friends and presence
- Search users by username
- Send friend request
- Cancel sent request
- Accept/decline request
- Friend list view
- Pending request list
- Remove friend and block user
- Online/offline status
- Last seen state
- Basic notification for new request

## Phase 2: Live location and map

### Sprint 3: Location and privacy
- Geolocation permission handling
- Toggle live location share
- Pause location sharing
- Choose modes: off, friends only, public
- Show last known location
- Timestamp each update
- Approximate area view for privacy
- Default privacy is off
- Consent popup before enabling location sharing

### Sprint 4: Map experience and markers
- Display map
- Center map on current location
- Show friends as markers
- Show public Gems as markers
- Show private Spots for allowed friends only
- Marker detail screens
- Search nearby places
- Zoom controls
- Map style toggle
- Distance indicator to friend or Gem

## Phase 3: Community content

### Sprint 5: Public Gems
- Create a Gem
- Add title, description, category
- Set location
- Save public Gem
- View Gems on map
- Open Gem details
- View creator and timestamp
- Optional image upload
- Search public Gems
- Save as favorite
- Delete own Gem
- Report inappropriate Gem

### Sprint 6: Private Spots
- Create a Spot
- Add title, description, category
- Set location
- Set visibility to friends only
- Share with selected friends or all friends
- View private Spot on map
- View Spot details
- See creator and timestamp
- Optional photo upload
- Edit or delete own Spot
- Hidden from public search

## Phase 4: Messaging and stickiness

### Sprint 7: Direct messaging
- Open direct chat with friend
- Send text message
- Receive text message
- Message history
- Timestamps
- Read receipts
- Unread badges
- Typing indicator
- Delete own message

### Sprint 8: Notifications + reliability
- Friend request notification
- New message notification
- Friend online notification
- Nearby Gem notification
- Spot shared notification
- Notification center
- Mark notifications as read
- Clear all notifications
- Offline banner
- Unsynced message state

## Phase 5: Offline sync and launch polish

### Sprint 9: Offline sync
- Store chat locally
- Store pending outgoing messages
- Sync pending messages when back online
- Cache last known location
- Queue Gem or Spot creation when offline
- Retry sync automatically
- Show offline status
- Sync friend data when online

### Sprint 10: Launch polish
- Onboarding flow
- Empty states
- Error states
- Loading spinner states
- Mobile responsiveness
- Basic accessibility
- Terms/privacy notices
- Simple analytics instrumentation
- Launch QA and edge-case testing

## Best MVP subset to ship first

Build in this exact order:
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

## Product-level definition of done

A feature is done when:
- the UI works on mobile
- the API flow is complete
- errors are handled clearly
- privacy and consent rules are respected
- offline behavior is considered
- the user can complete the task without confusion

## Final launch checklist

Before launch, confirm every item below:
- users can sign up and create a profile
- users can add and manage friends
- live sharing can be toggled safely
- users can see friends on a map
- users can send and receive chat messages
- users can create and view public Gems
- users can create and view private Spots
- offline sync works reliably
- notifications and privacy states are clear
