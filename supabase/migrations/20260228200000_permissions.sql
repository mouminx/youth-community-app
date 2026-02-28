-- ============================================================
-- permissions.sql — Role-based permission grants + requests
-- ============================================================

-- ── New enum types ─────────────────────────────────────────────────────────────

create type public.grantable_permission as enum (
  'manage_seasons',   -- create/edit seasons and battle-pass tiers
  'manage_badges',    -- create badges
  'manage_channels',  -- create/rename channels
  'manage_members'    -- view members, change member ↔ mentor roles
);

create type public.permission_request_status as enum (
  'pending',
  'approved',
  'denied'
);

-- ── Extend audit_action enum ───────────────────────────────────────────────────
alter type public.audit_action add value if not exists 'permission_granted';
alter type public.audit_action add value if not exists 'permission_revoked';
alter type public.audit_action add value if not exists 'permission_request_approved';
alter type public.audit_action add value if not exists 'permission_request_denied';
alter type public.audit_action add value if not exists 'role_changed';
alter type public.audit_action add value if not exists 'admin_promoted';
alter type public.audit_action add value if not exists 'admin_demoted';

-- ── community_permissions — granted capabilities ───────────────────────────────
-- Admins+ already have all four permissions by role; grants are meaningful only
-- for mentors (or as future-proofing). Unique constraint makes upsert idempotent.

create table public.community_permissions (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  permission   public.grantable_permission not null,
  granted_by   uuid not null references public.profiles(id),
  granted_at   timestamptz not null default now(),

  constraint uq_community_permission unique (community_id, user_id, permission)
);

create index idx_community_permissions_lookup
  on public.community_permissions(community_id, user_id);

-- ── permission_requests — request / approval workflow ─────────────────────────

create table public.permission_requests (
  id             uuid primary key default gen_random_uuid(),
  community_id   uuid not null references public.communities(id) on delete cascade,
  requester_id   uuid not null references public.profiles(id) on delete cascade,
  permission     public.grantable_permission not null,
  status         public.permission_request_status not null default 'pending',
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  requester_note text not null default '',
  reviewer_note  text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_permission_requests_community
  on public.permission_requests(community_id, status);
create index idx_permission_requests_requester
  on public.permission_requests(community_id, requester_id, permission, status);

-- ── has_permission() helper ───────────────────────────────────────────────────
-- Returns TRUE if the calling user has the given permission either:
--   a) inherently via role (admin+ always has all four), OR
--   b) via an explicit row in community_permissions.
-- "Add / remove admins" is owner-only and is NOT in grantable_permission;
-- check that separately with has_role(..., array['owner']).

create or replace function public.has_permission(
  _community_id uuid,
  _permission   public.grantable_permission
)
returns boolean
language sql stable security definer
as $$
  select (
    public.has_role(_community_id, array['owner','admin']::public.community_role[])
    or exists (
      select 1 from public.community_permissions
      where community_id = _community_id
        and user_id      = auth.uid()
        and permission   = _permission
    )
  );
$$;

-- ── RLS: community_permissions ─────────────────────────────────────────────────
alter table public.community_permissions enable row level security;

-- Users see their own grants; admins+ see all grants in their community.
create policy "community_permissions_select"
  on public.community_permissions for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(community_id, array['owner','admin']::public.community_role[])
  );

-- Admins+ can grant permissions.
create policy "community_permissions_insert"
  on public.community_permissions for insert
  to authenticated
  with check (
    granted_by = auth.uid()
    and public.has_role(community_id, array['owner','admin']::public.community_role[])
  );

-- Admins+ can revoke (delete) permissions.
create policy "community_permissions_delete"
  on public.community_permissions for delete
  to authenticated
  using (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
  );

-- ── RLS: permission_requests ───────────────────────────────────────────────────
alter table public.permission_requests enable row level security;

-- Requesters see their own; admins+ see all in their community.
create policy "permission_requests_select"
  on public.permission_requests for select
  to authenticated
  using (
    requester_id = auth.uid()
    or public.has_role(community_id, array['owner','admin']::public.community_role[])
  );

-- Mentors+ can submit requests.
create policy "permission_requests_insert"
  on public.permission_requests for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and public.has_role(community_id, array['owner','admin','mentor']::public.community_role[])
  );

-- Admins+ can approve / deny (update).
create policy "permission_requests_update"
  on public.permission_requests for update
  to authenticated
  using (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
  )
  with check (
    reviewed_by = auth.uid()
  );

-- ── Update existing RLS policies to accept granted permissions ─────────────────

-- SEASONS
drop policy if exists "seasons_insert" on public.seasons;
drop policy if exists "seasons_update" on public.seasons;

create policy "seasons_insert"
  on public.seasons for insert
  to authenticated
  with check (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
    or public.has_permission(community_id, 'manage_seasons')
  );

create policy "seasons_update"
  on public.seasons for update
  to authenticated
  using (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
    or public.has_permission(community_id, 'manage_seasons')
  );

-- BATTLE PASS TIERS
drop policy if exists "tiers_insert" on public.battle_pass_tiers;
drop policy if exists "tiers_update" on public.battle_pass_tiers;
drop policy if exists "tiers_delete" on public.battle_pass_tiers;

create policy "tiers_insert"
  on public.battle_pass_tiers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and (
          public.has_role(s.community_id, array['owner','admin']::public.community_role[])
          or public.has_permission(s.community_id, 'manage_seasons')
        )
    )
  );

create policy "tiers_update"
  on public.battle_pass_tiers for update
  to authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and (
          public.has_role(s.community_id, array['owner','admin']::public.community_role[])
          or public.has_permission(s.community_id, 'manage_seasons')
        )
    )
  );

create policy "tiers_delete"
  on public.battle_pass_tiers for delete
  to authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and (
          public.has_role(s.community_id, array['owner','admin']::public.community_role[])
          or public.has_permission(s.community_id, 'manage_seasons')
        )
    )
  );

-- BADGES
drop policy if exists "badges_insert" on public.badges;
drop policy if exists "badges_update" on public.badges;

create policy "badges_insert"
  on public.badges for insert
  to authenticated
  with check (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
    or public.has_permission(community_id, 'manage_badges')
  );

create policy "badges_update"
  on public.badges for update
  to authenticated
  using (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
    or public.has_permission(community_id, 'manage_badges')
  );

-- CHANNELS
drop policy if exists "channels_insert" on public.channels;
drop policy if exists "channels_update" on public.channels;

create policy "channels_insert"
  on public.channels for insert
  to authenticated
  with check (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
    or public.has_permission(community_id, 'manage_channels')
  );

create policy "channels_update"
  on public.channels for update
  to authenticated
  using (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
    or public.has_permission(community_id, 'manage_channels')
  );

-- MEMBERSHIPS — allow manage_members grant to change member ↔ mentor only
drop policy if exists "memberships_update" on public.memberships;

create policy "memberships_update"
  on public.memberships for update
  to authenticated
  using (
    public.has_role(community_id, array['owner','admin']::public.community_role[])
    or public.has_permission(community_id, 'manage_members')
  )
  with check (
    -- Nobody can promote to owner through this policy.
    role <> 'owner'
    -- Granted mentors (non-admin) may only toggle member ↔ mentor.
    and (
      public.has_role(community_id, array['owner','admin']::public.community_role[])
      or role = any(array['member','mentor']::public.community_role[])
    )
  );
