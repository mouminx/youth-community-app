# Youth Community App

A multi-tenant community platform built for youth organizations. Think Discord meets a gamified attendance tracker — each community gets its own space with channels, events, XP, leaderboards, and a battle pass.

Built with **Next.js 15 App Router**, **Tailwind CSS v3**, and **Supabase** (Auth + Postgres + Realtime).

---

## Features

| Feature | Description |
|---|---|
| **Multi-tenancy** | Isolated communities with their own members, channels, events, and seasons |
| **Role system** | owner → admin → mentor → member with cascading permissions + grantable per-feature access |
| **Events + RSVP** | Create events, RSVP, and mark attendance (mentor+) |
| **Claimable XP** | XP earned via attendance/badges sits in a pending queue — users claim it on the Battle Pass page for a dopamine hit |
| **XP Ledger** | Append-only `xp_transactions` ledger — attendance (+50), badge awards (+25) |
| **Leaderboards** | Weekly and season-scoped, computed with `dense_rank()` for tie handling |
| **Battle Pass** | Animated XP bar, tier unlock animations, floating "+XP" labels on claim |
| **Channel Chat** | Real-time messaging via Supabase Postgres Changes |
| **Management Panel** | Tabbed management UI visible to mentor+ with permission-gated sections |
| **Permission requests** | Mentors can request granular capabilities; admins approve/deny |
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

Go to [supabase.com](https://supabase.com) and create a new project. Copy your **Project URL**, **anon key**, and **service role key** from **Settings → API**.

### 3. Environment variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service role key is only used by the local seed script — it is never sent to the browser.

### 4. Run migrations

With the Supabase CLI:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

### 5. Enable Realtime

Dashboard → **Database → Replication → Supabase Realtime** → enable for the `messages` table.

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Development

### Seed test data

```bash
npm run seed              # create dev-club community + 5 test accounts
npm run seed -- --reset   # wipe and re-seed from scratch
```

Creates a `dev-club` community with 5 pre-configured users (password: `Test1234!`):

| Email | Role |
|---|---|
| `owner@test.dev` | owner |
| `admin@test.dev` | admin |
| `mentor@test.dev` | mentor |
| `member@test.dev` | member |
| `member2@test.dev` | member |

### Dev user switcher

A floating panel in the bottom-right corner (dev mode only) lets you instantly sign in as any test account — no login form needed. Implemented in `src/components/DevUserSwitcher.tsx`.

---

## Architecture

### Multi-tenancy

Every row is scoped to a `community_id`. RLS is enforced at the database level via security-definer helpers:

```sql
is_member(community_id uuid) → boolean
has_role(community_id uuid, roles community_role[]) → boolean
has_permission(community_id uuid, permission grantable_permission) → boolean
```

### Role Hierarchy

```
owner   — full control, created the community
admin   — all four grantable permissions by role
mentor  — mark attendance, award badges, delete messages; can request extra permissions
member  — RSVP, chat, view leaderboards and battle pass
```

### Grantable Permissions

Admins can grant individual capabilities to mentors without promoting them to admin:

| Permission | What it unlocks |
|---|---|
| `manage_seasons` | Create/edit seasons and battle pass tiers |
| `manage_badges` | Create new badges |
| `manage_channels` | Create/rename channels |
| `manage_members` | View member list, toggle member ↔ mentor roles |

Mentors can request permissions from the Management page. Admins approve or deny from the Controls tab.

### XP Flow

XP uses a two-stage system to give users a satisfying claim moment:

1. **Earn**: Attendance and badge awards write to `pending_xp`
2. **Claim**: User visits Battle Pass → clicks "Claim X XP" → animated bar fill + tier unlock
3. **Settle**: `claim_pending_xp()` RPC atomically moves pending rows to the append-only `xp_transactions` ledger

The `xp_transactions` table is protected by DB triggers that block UPDATE and DELETE — it is immutable by design.

### Battle Pass

- Admins (or mentors with `manage_seasons`) create seasons with start/end dates
- Tiers are defined at XP thresholds with a reward label
- Only one active season per community (partial unique index on `WHERE is_active = true`)
- The Battle Pass page shows an animated XP bar, floating "+XP" labels on claim, and a tier list with unlock flash effects

### Management Panel

The `/c/[slug]/admin` page is visible to mentor+ and has four tabs:

| Tab | Permission required | Content |
|---|---|---|
| **Seasons** | `manage_seasons` | Create seasons, add tiers, set active season |
| **Badges** | `manage_badges` | Create badges, view badge list |
| **Members** | `manage_members` | Member list with role toggle (member ↔ mentor) |
| **Controls** | admin+ only | Pending permission requests (approve/deny), active grants (revoke), admin promote/demote (owner only) |

Mentors without a permission see a locked section with a "Request Permission" button. After requesting, it shows "Request pending review…".

### Chat

Channel-only (no DMs). `messages.community_id` is **denormalized** onto the messages table so RLS can filter without a join through channels. Realtime uses Supabase Postgres Changes with a `channel_id=eq.{id}` filter.

---

## Project Structure

```
supabase/migrations/         Timestamped migration files (run in order)
scripts/
  seed-test-users.mjs        Local dev seed script
src/
  middleware.ts               Session refresh + auth route gating
  components/
    DevUserSwitcher.tsx       Dev-only floating account switcher
  lib/
    rbac.ts                   Role + permission helpers
    gamification.ts           Tier unlock helpers
  actions/                    Server Actions (no API routes)
    community.ts
    events.ts
    attendance.ts             Writes pending XP on attendance
    leaderboard.ts
    battlepass.ts             Season/tier management (requires manage_seasons)
    badges.ts                 Badge creation (requires manage_badges) + award
    chat.ts
    xp.ts                     getPendingXp, claimPendingXp
    management.ts             Permission requests, grants, role changes, admin promote/demote
  app/
    login/
    communities/
    c/[slug]/
      layout.tsx              Sidebar — Management shown for mentor+
      page.tsx                Dashboard
      events/
      chat/[channelId]/
      leaderboard/
      battlepass/             Animated XP bar + claim flow
      admin/                  Management panel (mentor+ gate)
      profile/[userId]/
```

---

## Known Constraints

- **Node.js 18+** required. Node 20+ recommended for production.
- **Tailwind v3** — v4 requires native bindings incompatible with some environments.
- Supabase Realtime must be enabled per-table in the dashboard.
- `uuid_generate_v4()` is not used — all UUIDs use `gen_random_uuid()` (Postgres 13+).
- The `SUPABASE_SERVICE_ROLE_KEY` env var is only needed for the local seed script, never for the app itself.
