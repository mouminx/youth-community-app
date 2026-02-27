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

## File Writing Convention

When writing large TSX or JSX files via Bash, use `.mjs` helper scripts to avoid shell quoting issues with backticks and template literals:

```bash
# Write content to a .mjs file, then run it
node write-something.mjs && rm write-something.mjs
```

---

## Role System

```
owner >= admin >= mentor >= member
```

Check roles with `meetsRole(membership.role, "mentor")` from `src/lib/rbac.ts`.
The DB helper is `has_role(community_id, roles[])` (array-based, security definer).

---

## XP Rules

- Source of truth: `xp_transactions` table (append-only)
- Never UPDATE or DELETE rows in this table (DB trigger will throw)
- Attendance: +50 XP per user per event (de-dup checked before insert)
- Badge award: +25 XP (also writes to `badge_awards` and `audit_log`)
- All leaderboard queries use `SUM(amount)` + `dense_rank()`

---

## Dev Server

```bash
npm run dev          # start on :3000
```

Kill and restart cleanly:
```bash
npx kill-port 3000 && taskkill //F //IM node.exe
rm -rf .next
npm run dev
```

---

## Common Gotchas

- If `supabase db push` fails mid-run, use `supabase migration repair --status reverted <timestamp>` then fix and re-push
- If HMR hangs, check middleware matcher — it must not match `_next/**`
- The `profiles` field from Supabase joins can return an array or object depending on the query; normalize with: `Array.isArray(data.profiles) ? data.profiles[0] ?? null : data.profiles`
- Community creation uses `bootstrap_community(community_id, user_id)` RPC (security definer) to insert the owner membership and default channels, bypassing the member-only RLS on self-insert
