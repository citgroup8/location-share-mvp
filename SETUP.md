# Hidden Gem MVP Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Ubuntu 22.04+ (or another supported Ubuntu release)
- Git

## Ubuntu Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/rigobertoima05-hash/location-share-mvp.git
cd location-share-mvp
npm install
```

### 2. Install and start PostgreSQL

Install PostgreSQL on the Ubuntu laptop and enable its service:

```sh
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Create a database role and database for the app. Set the role password when prompted:

```sh
sudo -u postgres psql
```

At the `psql` prompt:

```sql
CREATE ROLE hidden_gem_app WITH LOGIN;
\password hidden_gem_app
CREATE DATABASE hidden_gem OWNER hidden_gem_app;
\q
```

### 3. Configure environment variables

Copy the example env file and fill in your database URL:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/hidden_gem?schema=public"
JWT_SECRET="your-secret-key-here-min-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Set `DATABASE_URL` in `.env.local` to this connection string, replacing the password with the one you set above:

```env
DATABASE_URL="postgresql://hidden_gem_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/hidden_gem?schema=public"
```

URL-encode reserved characters in the password (for example, `@` becomes `%40`). Keep `.env.local` private and do not commit it. Because the app and database are on the same laptop, PostgreSQL does not need to be exposed to your network or the internet.

### 4. Apply migrations and generate the Prisma client

```sh
npx prisma migrate deploy
npx prisma generate
```

### 5. Start the development server

```sh
npm run dev
```

Open http://localhost:3000 in your browser.

### 6. (Optional) Seed sample data

```sh
node scripts/seed.js
```

## Default test accounts

If you ran the seed script:

- Email: `maya@example.com` / Password: `password123`
- Email: `alex@example.com` / Password: `password123`
- Email: `nina@example.com` / Password: `password123`

Sign in to these seeded database accounts at `http://localhost:3000/login`. The `/sign-in` route is for Clerk accounts.

## Architecture overview

### Auth flow

1. User signs up with email, username, and password
2. Password is hashed with bcrypt
3. JWT session token is created and stored in HTTP-only cookie
4. Protected routes verify the session token on each request
5. User can log in and out

### Data model

- **User**: Core identity with profile, location, and presence state
- **FriendRequest**: Pending/accepted friend connection requests
- **Friendship**: Established two-way friend relationship
- **Conversation**: Group of messages between users
- **Message**: Individual messages with read receipts
- **Gem**: Public location-based content
- **Spot**: Private location-based content shared with friends
- **Notification**: User notifications and events

### API routes

#### Auth
- `POST /api/auth/signup` — create account
- `POST /api/auth/login` — log in

#### Users
- `GET /api/users/me` — current user profile
- `GET /api/users/search?q=username` — search users by username

#### Friends
- `GET /api/friends/list` — get all friends
- `POST /api/friends/request` — send friend request
- `POST /api/friends/accept` — accept friend request

## Next development steps

1. **Add friend request UI** — create modal to search and send requests
2. **Implement live location** — add geolocation permission flow and location updates
3. **Build map integration** — add Mapbox/Google Maps and render friend markers
4. **Create Gem/Spot flows** — build forms to create and discover content
5. **Implement messaging** — add chat UI and WebSocket backend
6. **Add offline sync** — queue messages and sync on reconnect
7. **Deploy to production** — set up hosting, database, and secrets

## Common issues

### "Connection refused" error

PostgreSQL is not running. Start it:

```bash
# macOS with Homebrew
brew services start postgresql

# Ubuntu/Debian
sudo systemctl start postgresql

# Docker
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

### "No JWT_SECRET" warning

Set a strong random secret in `.env.local`:

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.local
```

### Database migration fails

Reset and re-create the database:

```bash
npx prisma migrate reset
```

## Production checklist

- [ ] Set strong JWT_SECRET in production environment
- [ ] Use managed PostgreSQL (Vercel Postgres, Railway, Supabase)
- [ ] Enable HTTPS only
- [ ] Set secure cookie flags
- [ ] Add rate limiting to auth endpoints
- [ ] Configure CORS and CSP headers
- [ ] Set up error logging and monitoring
- [ ] Add email verification flow
- [ ] Implement password reset
- [ ] Add two-factor authentication

## Support

For issues or questions, open an issue on the GitHub repository.
