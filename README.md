# Youth Community App

A multi-tenant community platform built for youth organizations. Think Discord meets a gamified attendance tracker — each community gets its own space with channels, events, XP, leaderboards, and a battle pass.

Built with **Next.js 15 App Router**, **Tailwind CSS v3**, and **Supabase** (Auth + Postgres + Realtime).

---

## Features

| Feature | Description |
|---|---|
| **Multi-tenancy** | Isolated communities with their own members, channels, events, and seasons |
| **Role system** | owner → admin → mentor → member with cascading permissions |
| **Events + RSVP** | Create events, RSVP, and mark attendance (mentor+) |
| **XP Ledger** | Append-only XP transactions — attendance (+50), badge awards (+25) |
| **Leaderboards** | Weekly and season-scoped, computed with `dense_rank()` for tie handling |
| **Battle Pass** | Season-based tier progression unlocked by XP thresholds |
| **Channel Chat** | Real-time messaging via Supabase Postgres Changes |
| **Admin Panel** | Season, tier, and badge management for admins |
| **Profiles** | Per-user profile with total XP and earned badges |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Server Components, Server Actions, streaming |
| Styling | Tailwind CSS v3 | Utility-first; v3 required for Node 18 compatibility |
| Database | Supabase Postgres | RLS, Realtime, and Auth in one service |
| Auth | Supabase Auth (email/password) | Session managed via `@supabase/ssr` cookies |
| Deployment | Vercel (recommended) | Zero-config Next.js hosting |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/mouminx/youth-community-app
cd youth-community-app
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project. Copy your **Project URL** and **anon key** from **Settings → API**.

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run migrations

With the Supabase CLI:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

Or paste `sql/schema.sql` then `sql/rls.sql` into the **Supabase SQL Editor** (in that order).

### 5. Enable Realtime

Dashboard → **Database → Replication → Supabase Realtime** → enable for the `messages` table.

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

### Multi-tenancy

Every row is scoped to a `community_id`. RLS is enforced at the database level via two security-definer helpers:

```sql
is_member(community_id uuid) → boolean
has_role(community_id uuid, roles community_role[]) → boolean
```

### Role Hierarchy

```
owner   — full control, created the community
admin   — manage seasons, tiers, badges, channels
mentor  — mark attendance, award badges, delete messages
member  — RSVP, chat, view leaderboards
```

Checks use "meets or exceeds" semantics: a mentor can do everything a member can.

### XP System

XP is an **append-only ledger** (`xp_transactions` table). There is no mutable `xp_total` column — totals are always computed with `SUM(amount)`. Database triggers block `UPDATE` and `DELETE` on this table.

| Action | XP |
|---|---|
| Event attendance | +50 |
| Badge awarded | +25 |

### Leaderboards

Computed via Supabase RPC using `dense_rank() OVER (ORDER BY SUM(amount) DESC)`. Two scopes:
- **Weekly** — current calendar week
- **Season** — filtered by active `season_id`

### Battle Pass

Admins create seasons with start/end dates and add tiers at XP thresholds. Only one season can be active per community (enforced by a partial unique index `WHERE is_active = true`). Tier unlock is computed from the user's season XP total.

### Chat

Channel-only (no DMs). `messages.community_id` is **denormalized** onto the messages table so RLS can filter without a join through channels. Realtime uses Supabase Postgres Changes with a `channel_id=eq.{id}` filter.

---

## Project Structure

```
sql/
  schema.sql            Tables, indexes, triggers, RPC functions
  rls.sql               Helper functions + all RLS policies

supabase/
  migrations/           Timestamped migration files for the Supabase CLI

src/
  middleware.ts          Session refresh + auth route gating
  lib/
    supabaseClient.ts    Browser Supabase client
    supabaseServer.ts    Server Supabase client (cookies)
    rbac.ts              getMembership, meetsRole, getCommunityBySlug
    gamification.ts      computeUnlockedTiers, getNextTier
  actions/              Server Actions (no API routes)
    community.ts         createCommunity
    events.ts            createEvent, rsvpEvent, listEvents
    attendance.ts        markAttendance, listAttendeesForEvent
    leaderboard.ts       getWeeklyLeaderboard, getSeasonLeaderboard, getMyRank
    battlepass.ts        getActiveSeason, listTiers, getUserSeasonXp, createSeason, createBattlePassTier
    badges.ts            createBadge, awardBadge, listBadges
    chat.ts              listChannels, postMessage, listMessages, deleteMessage
  app/
    login/               Email/password auth
    communities/         Community list + create form
    c/[slug]/
      layout.tsx         Discord-style sidebar (240px)
      page.tsx           Dashboard: stats, upcoming events, quick links
      events/            Event list, RSVP, attendance modal, create form
      chat/[channelId]/  Realtime channel chat
      leaderboard/       Weekly and season leaderboard tabs
      battlepass/        Tier progress display
      admin/             Season, tier, and badge management
      profile/[userId]/  User profile, XP stats, badges grid
```

---

## Design System

Dark theme with a Tailwind component layer:

| Class | Purpose |
|---|---|
| `.card` | Rounded card with subtle border |
| `.btn-primary` | Indigo filled button |
| `.btn-ghost` | Outlined ghost button |
| `.btn-sm` | Size modifier |
| `.input` | Styled text/date input |
| `.label` | Form field label |
| `.badge-{color}` | Role or status pill |

Background `#0b0b12`, card surface `#111119`, input `#18181f`, accent `indigo-600 (#6366f1)`.

---

## Known Constraints

- **Node.js 18+** required. Node 20+ recommended for production (Supabase JS shows a deprecation warning on Node 18).
- **Tailwind v3** — v4 requires native bindings that are incompatible with some environments.
- Supabase Realtime must be enabled per-table in the dashboard.
- The `uuid_generate_v4()` extension is not used — all UUIDs use `gen_random_uuid()` (built into Postgres 13+).
