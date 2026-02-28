# CLAUDE.md — Youth Community App

This file gives Claude Code (and any AI agent) context about this project so it can work effectively without re-exploring the codebase from scratch.

---

## Project Overview

Multi-tenant youth community web app with gamification.
- **Framework**: Next.js 15 App Router (Server Components + Server Actions)
- **Styling**: Tailwind CSS v3 (NOT v4 — incompatible with Node 18 on this machine)
- **Backend**: Supabase (Postgres + Auth + Realtime)
- **Node version**: 18.18.0 — do not use Next.js 16+ or Tailwind v4

---

## Key Constraints

- Use `gen_random_uuid()` not `uuid_generate_v4()` in all SQL
- Tailwind v3 only — v4 breaks on Node 18 due to native bindings
- Next.js 15 (not 16+) — Node 18 requirement
- Middleware matcher must exclude `_next/**` to avoid HMR hang
- No `API routes` — all mutations use Server Actions (`"use server"`)
- Never add UPDATE or DELETE policies on `xp_transactions` — it's append-only by design
- Never add mutable `xp_total` columns — always compute with `SUM(amount)`
- XP is NOT written directly to `xp_transactions` on attendance/badge — it goes to `pending_xp` first, users claim it via `claim_pending_xp()` RPC

---

## Supabase

- Project URL: see `.env.local` (not committed)
- Migrations: `supabase/migrations/` using timestamp format `YYYYMMDDHHMMSS_name.sql`
- Run: `supabase db push` after linking with `supabase link --project-ref <ref>`
- Repair failed migrations: `supabase migration repair --status reverted <timestamp>`

---

## Design System

All base styles live in `src/app/globals.css` under `@layer components`.

**CSS component classes (use these, don't re-invent):**
- `.card` — `rounded-xl border border-white/[0.07] bg-[#111119]`
- `.btn` — base button styles (flex, gap, rounded, disabled states)
- `.btn-primary` — indigo filled button (extends `.btn`)
- `.btn-ghost` — outlined button (extends `.btn`)
- `.btn-sm` — size modifier: `px-3 py-1.5 text-xs`
- `.input` — dark styled input with focus ring
- `.label` — `text-xs font-medium text-gray-400 mb-1.5`
- `.badge`, `.badge-indigo`, `.badge-green`, `.badge-gray`, `.badge-amber` — status pills

**XP bar / gamification animations (in `globals.css`, outside `@layer`):**
- `.xp-bar-fill` — gradient fill with shimmer animation
- `.xp-bar-tip` — glowing dot at the bar tip
- `.xp-float` — floating "+XP" label animation
- `.xp-claim-card` — animated gradient border on the claim card
- `.xp-claim-btn` — pulsing glow on the claim button
- `.tier-newly-unlocked` — golden flash on newly-unlocked tier rows

**Color tokens:**
- Page background: `#0b0b12`
- Card surface: `#111119`
- Sidebar: `#0e0e18`
- Input bg: `#18181f`
- Accent: `indigo-600` (#6366f1)
- Text primary: `#e8e8f0` (gray-100)
- Text muted: `gray-500` / `gray-600`
- Borders: `border-white/[0.07]`

---

## Page Layout Pattern

Every community page (inside `c/[slug]/layout.tsx`) should:
1. Use `flex-1 overflow-y-auto` as the root element so it scrolls within the fixed sidebar layout
2. Start with a sticky page header: `border-b border-white/[0.06] px-8 py-5`
3. Put scrollable content in `px-8 py-6 space-y-6` below the header

The chat page is an exception — it uses `flex h-full overflow-hidden` to create a fixed-height chat layout.

---

## Role System

```
owner >= admin >= mentor >= member
```

Check roles with `meetsRole(membership.role, "mentor")` from `src/lib/rbac.ts`.
The DB helper is `has_role(community_id, roles[])` (array-based, security definer).

### Grantable Permissions

Mentors can be granted individual capabilities without a full admin role. Admins+ have all four inherently.

| Permission | What it controls |
|---|---|
| `manage_seasons` | Create/edit seasons and battle pass tiers |
| `manage_badges` | Create badges |
| `manage_channels` | Create/rename channels |
| `manage_members` | View members, toggle member ↔ mentor roles |

- `community_permissions` table — explicit grants (unique per community+user+permission)
- `permission_requests` table — pending/approved/denied requests from mentors
- DB helper: `has_permission(community_id, permission)` — checks role OR explicit grant (security definer)
- TS helper: `requirePermission(supabase, communityId, userId, permission)` — throws if no access
- TS helper: `getUserPermissions(supabase, communityId, userId)` — returns `GrantablePermission[]`

**Note**: `manage_admins` is intentionally NOT grantable. Only owners can promote/demote admins.

---

## XP / Pending XP Flow

1. **Earn**: Attendance and badge awards write to `pending_xp` (NOT directly to `xp_transactions`)
2. **Claim**: User visits Battle Pass and clicks "Claim". This calls `claim_pending_xp(_community_id)` RPC.
3. **Settle**: The security-definer RPC atomically moves `pending_xp` rows → `xp_transactions` and returns the total claimed.
4. **Reason codes**: `attendance`, `badge_award`, `manual`

The `pending_xp` table has a `reference_id` column (nullable) pointing to the source record (event_attendance.id or badge_awards.id).

---

## XP Rules

- Source of truth: `xp_transactions` table (append-only)
- Never UPDATE or DELETE rows in this table (DB trigger will throw)
- Attendance: +50 XP per user per event (de-dup checked before insert to pending_xp)
- Badge award: +25 XP (also writes to `badge_awards` and `audit_log`)
- All leaderboard queries use `SUM(amount)` + `dense_rank()`

---

## Dev Server

```bash
npm run dev          # start on :3000
```

Kill and restart cleanly:
```bash
kill -9 $(lsof -ti :3000) 2>/dev/null
rm -rf .next
npm run dev
```

### Seed Script (test data)

```bash
npm run seed                # seed dev-club community + 5 test users
npm run seed -- --reset     # wipe and re-seed (uses dev_reset_community RPC)
```

Creates community `dev-club` with:
- 5 users (all password: `Test1234!`): `owner@test.dev`, `admin@test.dev`, `mentor@test.dev`, `member@test.dev`, `member2@test.dev`
- Spring 2026 season with 5 tiers
- 3 badges, 2 past events, 1 upcoming event
- Mix of claimed and pending XP per user

### Dev User Switcher

A floating panel (bottom-right, dev-only) in `src/components/DevUserSwitcher.tsx` lets you instantly sign in as any test account without the login form. Only rendered when `NODE_ENV === "development"`.

---

## Common Gotchas

- If `supabase db push` fails mid-run, use `supabase migration repair --status reverted <timestamp>` then fix and re-push
- If HMR hangs, check middleware matcher — it must not match `_next/**`
- The `profiles` field from Supabase joins can return an array or object depending on the query; normalize with: `Array.isArray(data.profiles) ? data.profiles[0] ?? null : data.profiles`
- Community creation uses `bootstrap_community(community_id, user_id)` RPC (security definer) to insert the owner membership and default channels, bypassing the member-only RLS on self-insert
- `dev_reset_community(slug)` RPC temporarily disables `xp_no_delete` + `xp_no_update` triggers to allow cascade delete during seed reset
- Supabase union type narrowing: TypeScript doesn't always narrow `res.error` from `{ error: string } | { data: ... }` — use `(res as { error: string }).error` inside `if ("error" in res)` blocks
- Supabase profiles join returns an array in the inferred TypeScript type when using embedded selects — cast through `unknown` if needed: `data as unknown as MyType[]`

---

## File Structure

```
supabase/migrations/
  20260227000000_cleanup.sql         Drop-if-exists for clean re-run
  20260227000001_schema.sql          Full schema: tables, indexes, triggers, RPCs
  20260227000002_rls.sql             RLS enable + all policies + helper functions
  20260228190000_pending_xp.sql      pending_xp table + claim_pending_xp() RPC
  20260228190001_dev_reset.sql       dev_reset_community() RPC for seed --reset
  20260228200000_permissions.sql     community_permissions + permission_requests tables,
                                     has_permission() RPC, updated RLS policies

scripts/
  seed-test-users.mjs                Seed script (npm run seed)

src/
  middleware.ts                      Session refresh + auth route gating
  components/
    DevUserSwitcher.tsx              Dev-only floating account switcher panel
  lib/
    supabaseClient.ts                Browser Supabase client
    supabaseServer.ts                Server Supabase client (cookies)
    rbac.ts                          getMembership, meetsRole, requireRole,
                                     requirePermission, getUserPermissions,
                                     canAccess, getCommunityBySlug
    gamification.ts                  computeUnlockedTiers, getNextTier
  actions/
    community.ts                     createCommunity
    events.ts                        createEvent, rsvpEvent, listEvents
    attendance.ts                    markAttendance, listAttendeesForEvent
                                     (writes +50 XP to pending_xp, not xp_transactions)
    leaderboard.ts                   getWeeklyLeaderboard, getSeasonLeaderboard, getMyRank
    battlepass.ts                    getActiveSeason, listTiers, getUserSeasonXp,
                                     createSeason (requires manage_seasons),
                                     setActiveSeason (requires manage_seasons),
                                     createBattlePassTier (requires manage_seasons)
    badges.ts                        createBadge (requires manage_badges),
                                     awardBadge, listBadges
                                     (awardBadge writes +25 XP to pending_xp)
    chat.ts                          listChannels, postMessage, listMessages, deleteMessage
    xp.ts                            getPendingXp, claimPendingXp
    management.ts                    requestPermission, reviewPermissionRequest,
                                     revokePermission, changeMemberRole,
                                     promoteToAdmin, demoteAdmin, createChannel
  app/
    login/                           Email/password auth
    communities/                     Community list + create form
    c/[slug]/
      layout.tsx                     Sidebar (Management link shown for mentor+)
      page.tsx                       Dashboard
      events/                        Event list, RSVP, attendance modal, create form
      chat/[channelId]/              Realtime channel chat
      leaderboard/                   Weekly and season leaderboard tabs
      battlepass/
        page.tsx                     Server component — fetches season, tiers, pending XP
        xp-claim.tsx                 Client component — animated XP bar + claim flow
      admin/
        page.tsx                     Server component — fetches all management data
                                     (gate: mentor+, fetches permissions + all tab data)
        admin-panel.tsx              ManagementPanel client component:
                                     4 tabs: Seasons | Badges | Members | Controls
                                     PermissionGate for locked mentor sections
                                     Controls tab: request review, grant revocation,
                                     admin promote/demote (owner only)
      profile/[userId]/              User profile, XP stats, badges grid
```
