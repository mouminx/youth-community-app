# CLAUDE.md — Youth Community App

This file gives Claude Code (and any AI agent) context about this project so it can work effectively without re-exploring the codebase from scratch.

---

## Project Overview

Multi-tenant youth community web app with gamification.
- **Framework**: Next.js 15 App Router (Server Components + Server Actions)
- **Styling**: Tailwind CSS v3 (NOT v4 — incompatible with Node 18 on this machine)
- **Backend**: Supabase (Postgres + Auth + Realtime)
- **Node version**: 18.18.0 — do not use Next.js 16+ or Tailwind v4
- **Deployment**: Vercel (https://ascnd-gg.vercel.app)

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

**Color tokens (theme-aware via CSS vars):**
- Page background: `var(--bg-1)` (default `#0b0b12`)
- Card surface: `var(--surface-1)` (default `#111119`)
- Sidebar: `var(--sidebar-bg)` (default `#0e0e18`)
- Accent: `indigo-600` (#6366f1)
- Text primary: `var(--text-1)` (default `#e8e8f0`)
- Text muted: `gray-500` / `gray-600`
- Borders: `border-white/[0.07]`

---

## Theme System

- `communities.theme_key` column: `text not null default 'ascnd'`
- 8 themes: `ascnd` (default), `sky-high`, `high-tide`, `ruby`, `evergreen`, `saffron`, `bloom`, `tangerine`
- CSS classes `.theme-[key]` in `globals.css` override ALL CSS vars: `--neon-*`, `--bg-*`, `--surface-*`, `--text-*`, `--line-0`, `--glow-1`, `--glow-2`, `--sidebar-bg`, `--nav-active-bg`, `--nav-hover-bg`
- Applied on `<html>` element via `ThemeApplier` client component (useEffect)
- Body background glows read `--glow-1` and `--glow-2`
- Sidebar bg: `bg-[var(--sidebar-bg)]` in layout.tsx aside
- Server action: `updateCommunityTheme(communityId, themeKey)` in `src/actions/theme.ts` — owner-only
- "Theme" tab in admin panel (owner-only) — `ThemeSection` + `THEME_META` in admin-panel.tsx

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
2. **Claim**: User visits The Ladder and clicks "Claim". This calls `claim_pending_xp(_community_id)` RPC.
3. **Settle**: The security-definer RPC atomically moves `pending_xp` rows → `xp_transactions`, detects newly crossed season tiers, and awards ASCND points (currency) at `floor(xp_per_level * 1.5)` per tier crossed.
4. **Reason codes**: `attendance`, `badge_award`, `manual`, `post_reaction`

The `pending_xp` table has a `reference_id` column (nullable) pointing to the source record (event_attendance.id or badge_awards.id).

---

## XP Rules

- Source of truth: `xp_transactions` table (append-only)
- Never UPDATE or DELETE rows in this table (DB trigger will throw)
- Attendance: +50 XP per user per event (de-dup checked before insert to pending_xp)
- Badge award: +25 XP (also writes to `badge_awards` and `audit_log`)
- Post reaction (reactor): +2 XP per reaction added (not on own post)
- Post reaction (author): +5 XP on first unique user reaction per post
- All leaderboard queries use `SUM(amount)` + `dense_rank()`

---

## Season Levels (The Ladder)

- Seasons have uniform levels: level N requires `N * xp_per_level` XP
- Levels are auto-numbered (Level 1, 2, 3…) — no custom names
- **Append-only**: once `xp_per_level` is set for a season it cannot change; owner can only increase `max_level`
- Completing a level awards **ASCND Points** = `floor(xp_per_level * 1.5)` per tier crossed on claim
- Admin panel: `SeasonCard` has edit mode (name/dates) + "Configure Levels" form
- Server actions: `updateSeason`, `configureSeasonLevels` in `src/actions/battlepass.ts`
- Nav label: "Ladder" (URL stays `/battlepass`, page header says "The Ladder")

---

## Currency (ASCND Points)

- `currency_transactions` table: append-only ledger (mirrors xp_transactions design)
- `award_currency(_community_id, _user_id, _amount, _reason)` — security-definer RPC, admin/owner only
- `src/actions/currency.ts`: `getCurrencyBalance(communityId)`, `awardCurrency(communityId, userId, amount, reason)`
- Balance shown in sidebar as "Credits"
- Admin panel has "Award Credits" form in Members section
- Currency reason codes: `level_up` (automatic on claim), `manual` (admin award)

---

## Feed Feature (`/c/[slug]/feed`)

- `posts` table: id, community_id, author_id, title, body, created_at
- `post_reactions` table: id, post_id, community_id, user_id, emoji, created_at; UNIQUE(post_id, user_id, emoji)
- `toggle_post_reaction(_post_id, _emoji)` — security-definer RPC handles XP atomically
- Server actions in `src/actions/posts.ts`: `createPost`, `listPosts`, `getPost`, `listComments`, `toggleReaction`
- `listPosts` / `getPost` / `listComments` accept `displayMode` param for name resolution
- Feed pages: `src/app/c/[slug]/feed/page.tsx` (list) + `[postId]/page.tsx` (single post)
- Client components: `feed-client.tsx` (list + new post form), `[postId]/post-reactions.tsx`
- Anti-paste: `onPaste={(e) => e.preventDefault()}` on body textarea
- Reaction emojis: `['👍', '❤️', '🔥', '💡', '✨']`
- "(you)" label shown next to author name on own posts in feed and post detail

---

## Profile Names & Display Mode

- `profiles` table has: `first_name`, `last_name`, `username` (unique, set on first setup), `display_name`
- `communities.name_display_mode`: `'username'` (default) | `'full_name'` | `'first_last_initial'` | `'custom'`
- Name resolution via `resolveDisplayName(profile, mode)` helper in `src/actions/posts.ts`
- **Profile completion gate**: new users without a `username` are redirected to their profile (`?setup=1`) before accessing any community page (enforced in layout.tsx via `x-pathname` header from middleware)
- Own profile shows `<ProfileEditor>` with username/name fields + privacy notice
- Privacy notice: "Your real name stays private. Only shown if owner selects Full Name or First + Last Initial display setting."
- Server action: `updateProfileInfo(firstName, lastName, username, displayName)` in `src/actions/profile.ts`
- Display mode setting in admin panel → owner-only "Controls" section

---

## Trophies (`/c/[slug]/trophies`)

- Separate from badges — `trophies` + `trophy_awards` tables
- `src/actions/trophies.ts`: `listTrophiesWithAwards`, `createTrophy`, `awardTrophy`
- Trophy page shows all community trophies with gold glow on awarded ones, recipient list
- `create_trophy` and `award_trophy` are security-definer RPCs (admin/owner only)

---

## Invite Codes

- `invite_codes` table: id, community_id, code (unique 8-char), label, created_by, created_at, use_count, is_active
- RLS: admin+ can read/create/update codes for their community
- `get_invite_info(_code)`: security-definer, callable by anon — returns community name/slug/description
- `use_invite_code(_code)`: requires auth.uid() — inserts membership + bumps use_count, returns community_slug + already_member flag
- Server actions in `src/actions/invites.ts`: `createInviteCode`, `listInviteCodes`, `deactivateInviteCode`, `getInviteInfo`, `useInviteCode`
- Join page: `src/app/join/[code]/page.tsx` — works without auth (shows community info), requires login to join
- Admin panel: "Invites" tab visible to admin+

---

## Sidebar (`sidebar-nav.tsx`)

- Icon colors use CSS vars: Dashboard `var(--neon-cyan)`, Events/Feed `var(--neon-lime)`, Channels `var(--neon-cyan)`, Leaderboard/Ladder/Trophies `var(--neon-amber)`, Badges/Profile `var(--neon-pink)`, Management `var(--text-1)`
- Active state: `bg-[var(--nav-active-bg)]` + text glow via `textShadow`
- Hover state: `hover:bg-[var(--nav-hover-bg)]`
- Section labels: (none), "Channels", "Ladder", "Management"
- Credits widget in sidebar using `var(--neon-cyan)` color
- `currencyBalance: number` prop passed from layout.tsx via `getCurrencyBalance(community.id)`
- Sign out button in sidebar footer

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
- `x-pathname` header set in middleware so layout.tsx can read the current path for the profile completion gate

---

## File Structure

```
supabase/migrations/
  20260227000000_cleanup.sql              Drop-if-exists for clean re-run
  20260227000001_schema.sql               Full schema: tables, indexes, triggers, RPCs
  20260227000002_rls.sql                  RLS enable + all policies + helper functions
  20260228190000_pending_xp.sql           pending_xp table + claim_pending_xp() RPC
  20260228190001_dev_reset.sql            dev_reset_community() RPC for seed --reset
  20260228200000_permissions.sql          community_permissions + permission_requests,
                                          has_permission() RPC, updated RLS policies
  20260301000000_posts.sql                posts + post_reactions + toggle_post_reaction RPC
  20260301000001_comments.sql             post_comments table
  20260301000002_notifications.sql        notifications table + unread counts
  20260301000003_unread_rpcs.sql          get_feed_unread_count, get_chat_unread_count RPCs
  20260301000004_feed_badge_fix.sql       Fix unread badge for new users (coalesce 7-day window)
  20260301000005_trophies.sql             trophies + trophy_awards tables + RPCs
  20260301000006_currency.sql             currency_transactions + award_currency RPC
  20260301000007_avatar_seed.sql          avatar_seed column on profiles
  20260301000008_career_milestones.sql    career_milestones table
  20260301000009_career_milestones_backfill.sql  Backfill existing users
  20260301000010_claim_awards_currency.sql  claim_pending_xp updated for level-up currency
  20260301000011_career_level_scaling.sql   Career level scaling v1
  20260301000012_career_level_scaling_v2.sql  v2
  20260301000013_career_level_scaling_v3.sql  v3
  20260301000014_theme.sql                communities.theme_key column
  20260301000015_name_display.sql         profiles name columns + communities.name_display_mode
  20260301000016_invite_codes.sql         invite_codes table + get_invite_info/use_invite_code RPCs
  20260301000017_profile_names.sql        Profile first_name, last_name, username columns
  20260301000018_season_levels.sql        Revised claim_pending_xp with tier-crossing currency
  20260301000019_invite_codes.sql         Invite codes (final)

scripts/
  seed-test-users.mjs                Seed script (npm run seed)

src/
  middleware.ts                      Session refresh + auth route gating + x-pathname header
  components/
    DevUserSwitcher.tsx              Dev-only floating account switcher panel
    ServiceWorkerRegistrar.tsx       Self-unregistering SW cleanup (no-op, kept for cleanup)
  lib/
    supabaseClient.ts                Browser Supabase client
    supabaseServer.ts                Server Supabase client (cookies)
    rbac.ts                          getMembership, meetsRole, requireRole,
                                     requirePermission, getUserPermissions,
                                     canAccess, getCommunityBySlug (includes theme_key, name_display_mode)
    gamification.ts                  computeUnlockedTiers, getNextTier
    dicebear.ts                      Avatar seed/URL generation
  actions/
    community.ts                     createCommunity
    events.ts                        createEvent, rsvpEvent, listEvents
    attendance.ts                    markAttendance, listAttendeesForEvent
                                     (writes +50 XP to pending_xp, not xp_transactions)
    leaderboard.ts                   getWeeklyLeaderboard, getSeasonLeaderboard, getMyRank
    battlepass.ts                    getActiveSeason, listTiers, getUserSeasonXp,
                                     createSeason, setActiveSeason, updateSeason,
                                     configureSeasonLevels (all require manage_seasons)
    badges.ts                        createBadge (requires manage_badges),
                                     awardBadge, listBadges
                                     (awardBadge writes +25 XP to pending_xp)
    chat.ts                          listChannels, postMessage, listMessages, deleteMessage
    xp.ts                            getPendingXp, claimPendingXp
    posts.ts                         createPost, listPosts, getPost, listComments,
                                     toggleReaction, resolveDisplayName
    profile.ts                       updateProfileInfo, getProfile
    currency.ts                      getCurrencyBalance, awardCurrency
    trophies.ts                      listTrophiesWithAwards, createTrophy, awardTrophy
    notifications.ts                 getUnreadCounts
    invites.ts                       createInviteCode, listInviteCodes, deactivateInviteCode,
                                     getInviteInfo, useInviteCode
    career-milestones.ts             Career milestone tracking
    management.ts                    requestPermission, reviewPermissionRequest,
                                     revokePermission, changeMemberRole,
                                     promoteToAdmin, demoteAdmin, createChannel,
                                     updateNameDisplayMode
  app/
    login/                           Email/password auth
    join/[code]/                     Invite code join page (works without auth)
    communities/                     Community list + create form
    c/[slug]/
      layout.tsx                     Sidebar + profile completion gate
      sidebar-nav.tsx                Client nav component with theme-aware icons
      page.tsx                       Dashboard
      events/                        Event list, RSVP, attendance modal, create form
      chat/[channelId]/              Realtime channel chat
      leaderboard/                   Weekly and season leaderboard tabs
      battlepass/
        page.tsx                     Server component — fetches season, tiers, pending XP
        xp-claim.tsx                 Client component — animated XP bar + claim flow
      feed/
        page.tsx                     Server component — post list
        feed-client.tsx              Client component — list + new post form + "(you)" label
        [postId]/
          page.tsx                   Post detail with comments + "(you)" on own posts
          post-reactions.tsx         Client reaction bar
      badges/                        Badge list page
      trophies/                      Trophy showcase page
      profile/[userId]/
        page.tsx                     User profile, XP stats, badges grid
        profile-editor.tsx           Edit username/names (own profile only) + privacy notice
        avatar-customizer.tsx        DiceBear avatar picker
      admin/
        page.tsx                     Server component — fetches all management data
                                     (gate: mentor+)
        admin-panel.tsx              ManagementPanel client component:
                                     Tabs: Seasons | Badges | Members | Controls | Theme | Invites
                                     PermissionGate for locked mentor sections
                                     Controls tab: permission review, admin promote/demote (owner),
                                       name display mode setting (owner)
                                     Theme tab: 8 theme options (owner only)
                                     Invites tab: create/copy/deactivate codes (admin+)
  auth/
    reset-callback/route.ts          OAuth code exchange → redirect (uses x-forwarded-host for Vercel)
```
