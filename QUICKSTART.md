# Hidden Gem - Quick Start Guide

## What is Hidden Gem?

Hidden Gem is a social map app where friends can share their live location, chat in real time, and discover public places (Gems) or share private spots together.

**Final v1 promise:** Users can sign up, add friends, share location, chat, and create public Gems and private Spots on a map.

## Quick Setup (5 minutes)

### 1. Prerequisites

Install these first:
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **PostgreSQL 12+** — [postgresql.org](https://www.postgresql.org/download/) or use Docker
- **Git** — [git-scm.com](https://git-scm.com)

### 2. Start PostgreSQL

If using Homebrew (Mac):
```bash
brew services start postgresql
```

If using Docker:
```bash
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

If using Windows or Linux, start PostgreSQL through your system services.

### 3. Clone the repo

```bash
git clone https://github.com/rigobertoima05-hash/location-share-mvp.git
cd location-share-mvp
```

### 4. Install dependencies

```bash
npm install
```

### 5. Create database

```bash
psql -U postgres
CREATE DATABASE hidden_gem;
\q
```

### 6. Set up environment

Copy the example env file:
```bash
cp .env.example .env.local
```

Edit `.env.local` and replace with your values:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/hidden_gem?schema=public"
JWT_SECRET="your-secret-key-min-32-characters"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 7. Run migrations

```bash
npx prisma migrate dev --name init
```

### 8. (Optional) Seed sample data

```bash
node scripts/seed.js
```

This creates 3 test users:
- maya@example.com / password123
- alex@example.com / password123
- nina@example.com / password123

To sign in with these seeded database accounts, open `http://localhost:3000/login`. The `/sign-in` route is for Clerk accounts.

### 9. Start the app

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## App Features

### Phase 1: Trust + Network ✅
- [x] Sign up and login
- [x] Username creation
- [x] Profile management
- [x] Friend requests
- [x] Online/offline status

### Phase 2: Map + Discovery (In Progress)
- [ ] Live location sharing
- [ ] Map view with friend markers
- [ ] Public Gems creation and discovery
- [ ] Private Spots for friends only

### Phase 3: Messaging + Sync (Next)
- [ ] Direct chat
- [ ] Read receipts
- [ ] Offline message queueing
- [ ] Notifications

## Test Accounts (if you ran seed)

```
maya@example.com / password123
alex@example.com / password123
nina@example.com / password123
```

These users are already friends with each other!

## File Structure

```
hidden-gem/
├── app/
│   ├── (app)/              # Protected app routes
│   │   ├── map/            # Map view
│   │   ├── friends/        # Friends list
│   │   ├── chat/           # Chat view
│   │   ├── profile/        # User profile
│   │   ├── gems/           # Public gems
│   │   └── spots/          # Private spots
│   ├── api/                # Backend API routes
│   │   ├── auth/           # Login/signup
│   │   ├── friends/        # Friend requests
│   │   ├── users/          # User data
│   │   ├── location/       # Location updates
│   │   ├── gems/           # Gem APIs
│   │   ├── spots/          # Spot APIs
│   │   └── messages/       # Chat APIs
│   ├── signin/             # Sign in page
│   ├── signup/             # Sign up page
│   └── layout.tsx          # Root layout
├── lib/
│   ├── auth.ts             # Auth utilities
│   └── prisma.ts           # Prisma client
├── components/
│   ├── mobile-nav.tsx      # Bottom navigation
│   └── logout-button.tsx   # Logout button
├── prisma/
│   └── schema.prisma       # Database schema
├── scripts/
│   └── seed.js             # Database seeding
├── .env.example            # Environment template
├── SETUP.md                # Detailed setup guide
└── README.md               # This file
```

## Key API Endpoints

### Auth
- `POST /api/auth/signup` — Create account
- `POST /api/auth/login` — Log in
- `POST /api/auth/logout` — Log out

### Users
- `GET /api/users/me` — Get current user
- `GET /api/users/search?q=username` — Search users

### Friends
- `GET /api/friends/list` — Get friends
- `POST /api/friends/request` — Send friend request
- `POST /api/friends/accept` — Accept request
- `GET /api/friends/nearby` — Get nearby friends with location
- `GET /api/friends/requests/pending` — Get pending requests

### Location
- `POST /api/location/update` — Update location
- `POST /api/presence/logout` — Mark offline

### Gems & Spots
- `POST /api/gems/create` — Create public gem
- `GET /api/gems/nearby` — Get nearby gems
- `POST /api/spots/create` — Create private spot
- `GET /api/spots/friends` — Get friends' spots

### Messages
- `POST /api/messages/send` — Send message
- `GET /api/messages/[conversationId]` — Get chat history
- `POST /api/messages/[messageId]/read` — Mark as read

## Troubleshooting

### "Connection refused" error

PostgreSQL is not running. Start it:

```bash
# Mac
brew services start postgresql

# Linux/Ubuntu
sudo systemctl start postgresql

# Docker
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

### "Cannot find module '@prisma/client'"

RegeneratePrisma client:

```bash
npx prisma generate
```

### "Error: P3009 failed to create migration engine"

Reset database:

```bash
npx prisma migrate reset
```

### Port 3000 already in use

Run on a different port:

```bash
npm run dev -- -p 3001
```

## Next Steps

1. **Explore the app** — Sign up, add friends, test the UI
2. **Review the code** — Check out the API routes and components
3. **Add features** — Build out live map, messaging, offline sync
4. **Deploy** — Push to Vercel or your hosting platform

## Production Deployment

### Using Vercel (recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Set environment variables (DATABASE_URL, JWT_SECRET)
4. Deploy

### Using Railway or Render

1. Create a PostgreSQL database on the platform
2. Deploy the Next.js app
3. Link the database and set env vars
4. Deploy

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Prisma ORM
- **Database:** PostgreSQL
- **Auth:** JWT sessions with bcrypt password hashing
- **Validation:** Zod schema validation

## Support

For issues or questions:
1. Check the [SETUP.md](./SETUP.md) file for detailed docs
2. Open an issue on GitHub
3. Review the API routes in `app/api/`

## License

MIT - Feel free to use this for your own projects!

## Final Product Vision

**Hidden Gem is the place where your people, your places, and your location come together.**

It helps users share what matters nearby without turning the experience into a public feed or a generic maps app. It's Snapchat-inspired, friend-first, and designed for real-life connection.

---

**Ready to run?** Start with step 1 above, and you'll be up and running in minutes. Enjoy building! 🚀
