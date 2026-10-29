# Hidden Gem Product Requirements Document (PRD)

## 1. Product vision

Hidden Gem is a social map app that helps friends share where they are, chat in real time, and create geotagged moments worth revisiting. It blends social trust, map discovery, and private sharing into a single, mobile-first experience.

## 2. Product statement

Hidden Gem is a social map product that allows users to sign up, add friends, share live location, chat, and create public Gems and private Spots tied to a map.

## 3. Core user value

Users want to:
- know where their friends are
- stay in touch without leaving the map
- create and discover places with meaning
- share private experiences with trusted people
- find a useful local network, not just random check-ins

## 4. Top-level goal for v1

The first release should enable the full MVP flow:

Users can sign up, add friends, share location, chat, and create public Gems and private Spots on a map.

## 5. Target audience

### Primary persona: Social planner
- Wants to coordinate with friends quickly
- Values presence and location context
- Needs low-friction communication and place sharing

### Secondary persona: Local explorer
- Likes discovering places and sharing recommendations
- Loves public Gems as a local social layer
- Wants a lightweight discovery map without feed noise

## 6. MVP scope

### Included in v1
- Authentication: sign up, login, logout, password reset
- Profiles: username, avatar, bio, privacy defaults
- Friends: search by username, send requests, accept/decline, block, remove
- Presence: online/offline status, last active time
- Location sharing: friends-only, public, off modes
- Map: view friends on map, markers, location refresh
- Public Gems: create, edit, view, save, report, search
- Private Spots: create, share with friends, hide from public search
- Messaging: direct chat, timestamps, read receipts, notifications
- Offline support: queue sends and sync automatically when back online

### Not in v1
- admin console
- moderation analytics dashboard
- advanced analytics platform
- massive public marketplace or event directory
- multi-language support
- Apple/Google sign-in from day one

## 7. Product requirements

### 7.1 Authentication
- Users can sign up with email and password
- Users can log in and log out
- Users can reset password
- Username is required and must be unique
- Profile image and bio are optional at first

### 7.2 User profile
- Users can view their own profile
- Users can edit profile data
- Users can adjust default privacy mode
- Users can set online/offline preference
- Users can see last active time and friend count

### 7.3 Friends
- Users can search others by username
- Users can send, cancel, accept, and decline requests
- Users can remove friends or block users
- Users can view pending requests and current friends
- Users receive friend request notifications

### 7.4 Presence and live location
- Users can share location in three modes: off, friends only, public
- Users can pause or toggle live location
- Users can see current or last known friend location on map
- Users can view a timestamp for last update
- Users can choose approximate location privacy when needed
- Users are asked for explicit permission before live sharing is enabled

### 7.5 Map experience
- Users can see the map and center on their location
- Friends appear as live markers
- Public Gems appear as map markers
- Private Spots are visible only to allowed friends
- Users can open marker details and see creator info
- Users can search nearby places
- Users can zoom and switch map styles

### 7.6 Public Gems
- Users can create a Gem with title, description, category, location, and optional photo
- Gems can optionally expire
- Gems are visible on map and searchable
- Users can open Gem details
- Users can save a Gem
- Users can delete their own Gem
- Users can report inappropriate Gems

### 7.7 Private Spots
- Users can create a Spot with title, description, category, and location
- Spots can be shared with all friends or selected friends
- Spots are visible only to friends and hidden from public search
- Users can edit or delete their own Spots
- Users can see creator and timestamp for each Spot

### 7.8 Messaging
- Users can open a direct chat with a friend
- Users can send and receive text messages
- Messages show timestamps and read receipts
- Typing indicators and unread badges are available
- Users can delete own messages and keep message history
- Messages queue offline and sync when reconnecting

### 7.9 Offline support
- Messages and content sync while coming back online
- Local cache stores chat history and last known location
- Outgoing messages marked unsynced until successful sync
- Offline banner is shown when disconnected

### 7.10 Notifications
- Users see friend request notifications
- Users see new message notifications
- Users see friend online notifications
- Users see nearby Gem and shared Spot notifications
- Users can mark notifications as read or clear them

## 8. Success metrics

### Adoption metrics
- sign-up conversion rate
- number of users who complete username setup
- number of friend requests sent
- percentage of users with at least one active friend

### Engagement metrics
- daily active users
- messages sent per active user
- live location sessions per day
- number of Gems and Spots created

### Retention metrics
- 7-day retention rate
- 30-day retention rate
- active friend network depth

### Product quality metrics
- first-run completion rate
- map permission consent completion rate
- offline sync recovery rate
- notification open rate

## 9. Non-goals for v1
- full social feed
- viral creator features
- advanced moderation admin tooling
- giant public map with geospatial search beyond local area
- full event or commerce features

## 10. Launch requirement

The product should feel polished enough that a user can do the following without confusion:
- create an account
- add a friend
- toggle live location
- open a map and see a friend
- open direct chat
- create a public Gem or private Spot

That is the minimum complete launch experience.
