-- ============================================================
-- schema.sql — Youth Community App (Multi-tenant, Gamification)
-- ============================================================
-- Run this FIRST, then rls.sql.
-- Uses gen_random_uuid() which is built into Postgres 13+.

-- ============================================================
-- 1. PROFILES  (1-to-1 with auth.users, minimal PII)
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url   text not null default '',
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. COMMUNITIES
-- ============================================================
create table public.communities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- slug is already unique-indexed; add explicit btree for fast lookups
create index idx_communities_slug on public.communities(slug);

-- ============================================================
-- 3. MEMBERSHIPS  (user ↔ community, with role)
-- ============================================================
create type public.community_role as enum ('owner', 'admin', 'mentor', 'member');

create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.community_role not null default 'member',
  joined_at    timestamptz not null default now(),

  constraint uq_memberships unique (community_id, user_id)
);

create index idx_memberships_community on public.memberships(community_id);
create index idx_memberships_user      on public.memberships(user_id);

-- ============================================================
-- 4. SEASONS  (defined before xp_transactions so FK is valid)
-- ============================================================
create table public.seasons (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name         text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  is_active    boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint ck_season_dates check (ends_at > starts_at)
);

create index idx_seasons_community on public.seasons(community_id);

-- Enforce at most ONE active season per community.
create unique index idx_seasons_one_active
  on public.seasons(community_id) where (is_active = true);

-- ============================================================
-- 5. BATTLE PASS TIERS
-- ============================================================
create table public.battle_pass_tiers (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.seasons(id) on delete cascade,
  tier_number  int not null check (tier_number > 0),
  xp_required  int not null check (xp_required >= 0),
  reward_label text not null default '',
  created_at   timestamptz not null default now(),

  constraint uq_tier unique (season_id, tier_number)
);

-- ============================================================
-- 6. EVENTS + RSVPS + ATTENDANCE
-- ============================================================
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  location     text not null default '',
  start_time   timestamptz not null,
  end_time     timestamptz,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index idx_events_community on public.events(community_id, start_time desc);

create table public.event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint uq_rsvp unique (event_id, user_id)
);

create table public.event_attendance (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  marked_by  uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),

  constraint uq_attendance unique (event_id, user_id)
);

-- ============================================================
-- 7. XP TRANSACTIONS  (append-only ledger)
-- ============================================================
create type public.xp_reason as enum ('attendance', 'badge_award', 'manual');

create table public.xp_transactions (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  season_id    uuid references public.seasons(id) on delete set null,
  amount       int not null check (amount <> 0),
  reason       public.xp_reason not null,
  reference_id uuid,           -- points to event_attendance.id or badge_awards.id
  created_at   timestamptz not null default now()
);

-- Prevent mutating existing rows — append-only safety net on top of RLS.
create or replace function public.deny_xp_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'xp_transactions is append-only';
end;
$$;

create trigger xp_no_update
  before update on public.xp_transactions
  for each row execute function public.deny_xp_mutation();

create trigger xp_no_delete
  before delete on public.xp_transactions
  for each row execute function public.deny_xp_mutation();

-- Leaderboard: SUM(amount) per user in a community
create index idx_xp_community_user on public.xp_transactions(community_id, user_id, created_at desc);
-- Season-scoped leaderboard
create index idx_xp_community_season on public.xp_transactions(community_id, season_id);

-- ============================================================
-- 8. BADGES + BADGE AWARDS
-- ============================================================
create table public.badges (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  icon_url     text not null default '',
  created_at   timestamptz not null default now()
);

create table public.badge_awards (
  id           uuid primary key default gen_random_uuid(),
  badge_id     uuid not null references public.badges(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  awarded_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),

  constraint uq_badge_award unique (badge_id, user_id)
);

-- ============================================================
-- 9. CHANNELS + MESSAGES  (no DMs, channel-only)
-- ============================================================
create table public.channels (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now()
);

create index idx_channels_community on public.channels(community_id);

create table public.messages (2
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references public.channels(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade, -- denormalized for RLS + index
  user_id      uuid not null references public.profiles(id) on delete cascade,
  content      text not null,
  created_at   timestamptz not null default now()
);

-- Chat queries: fetch latest messages for a channel within a community
create index idx_messages_channel on public.messages(community_id, channel_id, created_at desc);

-- ============================================================
-- 10. AUDIT LOG
-- ============================================================
create type public.audit_action as enum (
  'attendance_marked',
  'badge_awarded'
);

create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  community_id   uuid not null references public.communities(id) on delete cascade,
  actor_id       uuid not null references public.profiles(id),
  action         public.audit_action not null,
  target_user_id uuid references public.profiles(id),
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index idx_audit_community on public.audit_log(community_id, created_at desc);

-- ============================================================
-- 11. RPC: bootstrap_community
-- ============================================================
-- Called after inserting a community row. Sets the creator as owner
-- and creates default channels. Runs as SECURITY DEFINER to bypass
-- the membership insert policy (which only allows role='member').
create or replace function public.bootstrap_community(
  _community_id uuid,
  _user_id uuid
)
returns void
language plpgsql security definer
as $$
begin
  -- Owner membership
  insert into public.memberships (community_id, user_id, role)
  values (_community_id, _user_id, 'owner');

  -- Default channels
  insert into public.channels (community_id, name)
  values
    (_community_id, 'announcements'),
    (_community_id, 'general');
end;
$$;

-- ============================================================
-- 12. RPCs: Leaderboards (dense_rank — tied users share rank, no gaps)
-- ============================================================

-- Weekly: top N by XP earned since a given timestamp.
create or replace function public.leaderboard_weekly(
  _community_id uuid,
  _since timestamptz,
  _limit int default 10
)
returns table(user_id uuid, display_name text, avatar_url text, xp_total bigint, rank bigint)
language sql stable security definer
as $$
  select
    x.user_id,
    p.display_name,
    p.avatar_url,
    sum(x.amount)::bigint as xp_total,
    dense_rank() over (order by sum(x.amount) desc)::bigint as rank
  from public.xp_transactions x
  join public.profiles p on p.id = x.user_id
  where x.community_id = _community_id
    and x.created_at >= _since
  group by x.user_id, p.display_name, p.avatar_url
  order by xp_total desc
  limit _limit;
$$;

-- Season: top N by XP for a specific season.
create or replace function public.leaderboard_season(
  _community_id uuid,
  _season_id uuid,
  _limit int default 10
)
returns table(user_id uuid, display_name text, avatar_url text, xp_total bigint, rank bigint)
language sql stable security definer
as $$
  select
    x.user_id,
    p.display_name,
    p.avatar_url,
    sum(x.amount)::bigint as xp_total,
    dense_rank() over (order by sum(x.amount) desc)::bigint as rank
  from public.xp_transactions x
  join public.profiles p on p.id = x.user_id
  where x.community_id = _community_id
    and x.season_id = _season_id
  group by x.user_id, p.display_name, p.avatar_url
  order by xp_total desc
  limit _limit;
$$;

-- My rank (weekly) — returns a single row for the specified user.
create or replace function public.my_rank_weekly(
  _community_id uuid,
  _user_id uuid,
  _since timestamptz
)
returns table(user_id uuid, display_name text, avatar_url text, xp_total bigint, rank bigint)
language sql stable security definer
as $$
  with ranked as (
    select
      x.user_id,
      p.display_name,
      p.avatar_url,
      sum(x.amount)::bigint as xp_total,
      dense_rank() over (order by sum(x.amount) desc)::bigint as rank
    from public.xp_transactions x
    join public.profiles p on p.id = x.user_id
    where x.community_id = _community_id
      and x.created_at >= _since
    group by x.user_id, p.display_name, p.avatar_url
  )
  select * from ranked where ranked.user_id = _user_id;
$$;

-- My rank (season).
create or replace function public.my_rank_season(
  _community_id uuid,
  _user_id uuid,
  _season_id uuid
)
returns table(user_id uuid, display_name text, avatar_url text, xp_total bigint, rank bigint)
language sql stable security definer
as $$
  with ranked as (
    select
      x.user_id,
      p.display_name,
      p.avatar_url,
      sum(x.amount)::bigint as xp_total,
      dense_rank() over (order by sum(x.amount) desc)::bigint as rank
    from public.xp_transactions x
    join public.profiles p on p.id = x.user_id
    where x.community_id = _community_id
      and x.season_id = _season_id
    group by x.user_id, p.display_name, p.avatar_url
  )
  select * from ranked where ranked.user_id = _user_id;
$$;
