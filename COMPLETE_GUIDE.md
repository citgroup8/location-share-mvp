# Hidden Gem - Complete Setup & Deployment Guide

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Local Development Setup](#local-development-setup)
3. [Database Configuration](#database-configuration)
4. [Environment Variables](#environment-variables)
5. [Running the App](#running-the-app)
6. [Testing & Verification](#testing--verification)
7. [Troubleshooting](#troubleshooting)
8. [Production Deployment](#production-deployment)
9. [Architecture & APIs](#architecture--apis)

## System Requirements

### Required
- **Node.js:** 18.0.0 or higher
- **npm:** 9.0.0 or higher
- **PostgreSQL:** 12 or higher
- **Git:** Latest version

### Recommended
- **RAM:** 4GB minimum
- **Disk Space:** 2GB minimum
- **Internet Connection:** For npm package installation

### Optional but Helpful
- **Docker:** For easy PostgreSQL setup
- **Postman or Insomnia:** For API testing
- **VS Code:** With Prisma and TypeScript extensions

## Local Development Setup

### Step 1: Clone Repository

```bash
# Clone the repo
git clone https://github.com/rigobertoima05-hash/location-share-mvp.git
cd location-share-mvp

# Verify you're in the right directory
pwd  # should end with /location-share-mvp
```

### Step 2: Install Dependencies

```bash
# Install npm packages
npm install

# Verify installation
npm list | head -20
```

### Step 3: Set Up PostgreSQL

#### Option A: Using Homebrew (macOS)

```bash
# Install PostgreSQL
brew install postgresql

# Start the service
brew services start postgresql

# Verify it's running
pg_isready
# Output: accepting connections
```

#### Option B: Using Docker

```bash
# Pull and run PostgreSQL image
docker run --name hidden_gem_postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=hidden_gem \
  -p 5432:5432 \
  -d postgres:15

# Verify it's running
docker logs hidden_gem_postgres
```

#### Option C: Using apt (Linux/Ubuntu)

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start the service
sudo systemctl start postgresql

# Verify
sudo systemctl status postgresql
```

#### Option D: Using Windows

1. Download PostgreSQL installer from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer
3. Remember the password you set for the `postgres` user
4. PostgreSQL will start automatically

### Step 4: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE hidden_gem;

# Verify creation
\l
# You should see hidden_gem in the list

# Exit psql
\q
```

## Environment Variables

### Step 1: Copy Example File

```bash
# Copy the template
cp .env.example .env.local
```

### Step 2: Edit .env.local

Open `.env.local` and set these values:

```env
# Database connection URL
# Format: postgresql://[user]:[password]@[host]:[port]/[database]
DATABASE_URL="postgresql://postgres:password@localhost:5432/hidden_gem?schema=public"

# JWT secret for session tokens (must be at least 32 characters)
# Generate with: openssl rand -base64 32
JWT_SECRET="replace-with-a-secure-random-string-at-least-32-chars"

# App URL (used for links and redirects)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Environment Variables Explained

- **DATABASE_URL:** Connection string to your PostgreSQL database
  - If using Docker, it's `postgresql://postgres:password@localhost:5432/hidden_gem?schema=public`
  - Change `password` to what you set in Docker
  - Change `postgres` user if different
  - Change `localhost` if database is on another machine

- **JWT_SECRET:** Secret key for signing session tokens
  - Must be at least 32 characters long
  - Generate with: `openssl rand -base64 32`
  - Keep it secret! Never commit to version control

- **NEXT_PUBLIC_APP_URL:** Public URL where app is accessible
  - For local dev: `http://localhost:3000`
  - For production: your domain (e.g., `https://hiddengem.app`)
  - The `NEXT_PUBLIC_` prefix means it's exposed to the browser

## Running the App

### Step 1: Generate Prisma Client

```bash
# This generates the type-safe database client
npx prisma generate
```

### Step 2: Run Database Migrations

```bash
# This creates all database tables
npx prisma migrate dev --name init

# The CLI will ask if you want to name the migration "init"
# Press Enter or type 'init'
```

### Step 3: Seed Sample Data (Optional)

```bash
# This creates 3 test users and sample data
node scripts/seed.js

# Output:
# ✅ Database seeded successfully!
# 📝 Test accounts:
#   maya@example.com / password123
#   alex@example.com / password123
#   nina@example.com / password123
```

### Step 4: Start Development Server

```bash
# Start the Next.js dev server
npm run dev

# Output:
# ▲ Next.js 14.2.15
# - Local:        http://localhost:3000
# - Environments: .env.local
#
# ✓ Ready in 2.5s
```

### Step 5: Open in Browser

Go to http://localhost:3000 in your browser.

You should see the Hidden Gem landing page.

## Testing & Verification

### Test the Sign-Up Flow

1. Click "Get started" or go to http://localhost:3000/signup
2. Fill in the form:
   - Full name: Your name
   - Email: any-email@example.com
   - Username: your-username
   - Password: any-password-6+ chars
3. Click "Create account"
4. You should be redirected to the map page
5. Check the database:

```bash
psql -U postgres -d hidden_gem
SELECT id, username, email FROM "User" LIMIT 5;
\q
```

### Test the Sign-In Flow

1. Go to http://localhost:3000/signin
2. Use credentials from above or from seed data (if you ran it)
3. You should be logged in

### Test Friend System

1. Create 2+ test accounts
2. Log in as one user
3. Go to Friends page
4. Click "Add friend"
5. Search for another user
6. Click "Add"
7. Friend request sent!
8. Log in as the other user
9. Check Friend Requests
10. Accept or decline

### Test Database Connection

```bash
# Connect to the database
psql -U postgres -d hidden_gem

# List all tables
\dt

# View users
SELECT id, username, email, "isOnline" FROM "User";

# View friendships
SELECT * FROM "Friendship";

# Count messages
SELECT COUNT(*) FROM "Message";

# Exit
\q
```

## Troubleshooting

### "Connection refused to database"

**Problem:** App can't connect to PostgreSQL

**Solutions:**
```bash
# Check if PostgreSQL is running
pg_isready
# Expected output: accepting connections

# If not running:
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux

# Check DATABASE_URL in .env.local
echo $DATABASE_URL

# Test connection directly
psql postgres://postgres:password@localhost:5432/hidden_gem
```

### "Cannot find module '@prisma/client'"

**Problem:** Prisma client not generated

**Solution:**
```bash
# Regenerate Prisma client
npx prisma generate

# Or reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "P3009: Failed to create migration engine"

**Problem:** Migration database setup issue

**Solution:**
```bash
# Reset migrations (careful - deletes all data!)
npx prisma migrate reset

# Then run migrations again
npx prisma migrate dev --name init
```

### "Port 3000 is already in use"

**Problem:** Another app is using port 3000

**Solution:**
```bash
# Run on different port
npm run dev -- -p 3001
# App will be at http://localhost:3001

# Or find and kill the process using 3000
lsof -ti:3000 | xargs kill -9  # macOS/Linux
```

### "No JWT_SECRET provided"

**Problem:** JWT_SECRET is missing or too short

**Solution:**
```bash
# Generate a strong secret
openssl rand -base64 32

# Copy the output and add to .env.local
echo "JWT_SECRET=<paste-output-here>" >> .env.local
```

### "localStorage is not defined"

**Problem:** Component is trying to access localStorage on server

**Solution:**
- Wrap localStorage usage in `'use client'` component
- Check if code runs in browser: `typeof window !== 'undefined'`

### "Username already exists"

**Problem:** Username is taken

**Solution:**
- Try a different username
- Or delete the user from database:
  ```bash
  psql -U postgres -d hidden_gem
  DELETE FROM "User" WHERE username = 'taken-username';
  \q
  ```

## Production Deployment

### Option A: Deploy to Vercel (Recommended)

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Go to [vercel.com](https://vercel.com)**
   - Click "New Project"
   - Import your GitHub repository

3. **Set environment variables**
   - DATABASE_URL: Use Vercel Postgres or external database
   - JWT_SECRET: Strong random string
   - NEXT_PUBLIC_APP_URL: Your production domain

4. **Deploy**
   - Vercel will automatically build and deploy
   - Runs migrations automatically

5. **Database Setup**
   - Option 1: Use Vercel Postgres (easiest)
   - Option 2: Use external service (Railway, Supabase, PlanetScale)

### Option B: Deploy to Railway

1. **Go to [railway.app](https://railway.app)**
2. **Create new project**
   - Add PostgreSQL
   - Add GitHub repo
3. **Set environment variables** in Railway dashboard
4. **Deploy**

### Option C: Deploy to Render

1. **Go to [render.com](https://render.com)**
2. **Create new Web Service**
   - Connect GitHub
   - Select repository
3. **Create PostgreSQL database** in same project
4. **Set DATABASE_URL** from database service
5. **Deploy**

### Production Checklist

- [ ] Use a strong JWT_SECRET (32+ characters, random)
- [ ] Set NODE_ENV=production
- [ ] Use a managed PostgreSQL service (Vercel, Railway, Supabase)
- [ ] Enable HTTPS only
- [ ] Set secure cookie flags (done by default in production)
- [ ] Configure CORS if frontend and backend are separate domains
- [ ] Set up error logging (Sentry, LogRocket, etc.)
- [ ] Enable database backups
- [ ] Set up monitoring and alerts
- [ ] Create admin user for production
- [ ] Test complete flow end-to-end
- [ ] Set up SSL/TLS certificates

## Architecture & APIs

### Database Schema

```
User
├── FriendRequest (sent/received)
├── Friendship (bidirectional)
├── Message (sent/received)
├── Gem (created)
└── Spot (created)

Conversation
└── Message

Notification
���── User
```

### API Routes

#### Auth
```
POST   /api/auth/signup       - Create account
POST   /api/auth/login        - Sign in
POST   /api/auth/logout       - Sign out
```

#### Users
```
GET    /api/users/me          - Current user
GET    /api/users/search      - Search by username
```

#### Friends
```
GET    /api/friends/list                - All friends
POST   /api/friends/request            - Send request
POST   /api/friends/accept             - Accept request
DELETE /api/friends/requests/[id]      - Decline request
GET    /api/friends/nearby             - Friends with location
GET    /api/friends/requests/pending   - Pending requests
```

#### Location
```
POST   /api/location/update   - Update my location
POST   /api/presence/logout   - Mark offline
```

#### Gems
```
POST   /api/gems/create       - Create public gem
GET    /api/gems/nearby       - Gems near coordinates
```

#### Spots
```
POST   /api/spots/create      - Create private spot
GET    /api/spots/friends     - Friends' spots
```

#### Messages
```
POST   /api/messages/send                    - Send message
GET    /api/messages/[conversationId]        - Chat history
POST   /api/messages/[messageId]/read        - Mark as read
```

## Next Steps

1. Explore the app locally
2. Review the code in `app/api/` and `app/(app)/`
3. Add features like live map, WebSocket chat, offline sync
4. Deploy to production
5. Scale and iterate based on user feedback

## Support

- **Documentation:** See README.md and QUICKSTART.md
- **Issues:** Open a GitHub issue
- **Questions:** Comment on issues or create a discussion

---

**Happy building! 🚀**
