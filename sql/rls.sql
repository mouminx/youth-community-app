-- ============================================================
-- rls.sql — Row Level Security policies
-- ============================================================
-- Run AFTER schema.sql.
--
-- Helper functions:
--   is_member(community_id)           → bool  (any membership row exists)
--   has_role(community_id, roles[])   → bool  (user's role is IN the array)

-- ---------- helper: membership check ----------
create or replace function public.is_member(_community_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.memberships
    where community_id = _community_id
      and user_id = auth.uid()
  );
$$;

-- ---------- helper: role array check ----------
-- Pass the set of roles that satisfy the check, e.g.
--   has_role(cid, array['owner','admin'])          → admin+
--   has_role(cid, array['owner','admin','mentor']) → mentor+
create or replace function public.has_role(
  _community_id uuid,
  _roles public.community_role[]
)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.memberships
    where community_id = _community_id
      and user_id = auth.uid()
      and role = any(_roles)
  );
$$;

-- ============================================================
-- Enable RLS on every table
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.communities        enable row level security;
alter table public.memberships        enable row level security;
alter table public.events             enable row level security;
alter table public.event_rsvps        enable row level security;
alter table public.event_attendance   enable row level security;
alter table public.xp_transactions    enable row level security;
alter table public.seasons            enable row level security;
alter table public.battle_pass_tiers  enable row level security;
alter table public.badges             enable row level security;
alter table public.badge_awards       enable row level security;
alter table public.channels           enable row level security;
alter table public.messages           enable row level security;
alter table public.audit_log          enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================
-- Any authenticated user can read profiles (display names in chat, etc.)
create policy "profiles_select"
  on public.profiles for select
  to authenticated using (true);

-- Users can only update their own row.
create policy "profiles_update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Insert handled by the on_auth_user_created trigger.

-- ============================================================
-- COMMUNITIES
-- ============================================================
-- Browsable by all authenticated users (needed to join by slug).
create policy "communities_select"
  on public.communities for select
  to authenticated using (true);

-- Any authenticated user can create a community.
create policy "communities_insert"
  on public.communities for insert
  to authenticated
  with check (created_by = auth.uid());

-- Only owners can update community details.
create policy "communities_update"
  on public.communities for update
  to authenticated
  using  (public.has_role(id, array['owner']::public.community_role[]))
  with check (public.has_role(id, array['owner']::public.community_role[]));

-- ============================================================
-- MEMBERSHIPS
-- ============================================================
-- Members can see other members in their community.
create policy "memberships_select"
  on public.memberships for select
  to authenticated
  using (public.is_member(community_id));

-- Users can self-join as 'member' only.
create policy "memberships_insert"
  on public.memberships for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
  );

-- Admins+ can change roles (but not promote to owner).
create policy "memberships_update"
  on public.memberships for update
  to authenticated
  using  (public.has_role(community_id, array['owner','admin']::public.community_role[]))
  with check (role <> 'owner');

-- Users can leave; admins+ can remove members.
create policy "memberships_delete"
  on public.memberships for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(community_id, array['owner','admin']::public.community_role[])
  );

-- ============================================================
-- EVENTS
-- ============================================================
create policy "events_select"
  on public.events for select
  to authenticated
  using (public.is_member(community_id));

-- Mentors+ can create events.
create policy "events_insert"
  on public.events for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.has_role(community_id, array['owner','admin','mentor']::public.community_role[])
  );

-- Mentors+ can update events.
create policy "events_update"
  on public.events for update
  to authenticated
  using (public.has_role(community_id, array['owner','admin','mentor']::public.community_role[]));

-- ============================================================
-- EVENT RSVPS
-- ============================================================
create policy "rsvps_select"
  on public.event_rsvps for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and public.is_member(e.community_id)
    )
  );

-- Members can RSVP for themselves.
create policy "rsvps_insert"
  on public.event_rsvps for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and public.is_member(e.community_id)
    )
  );

-- Members can un-RSVP themselves.
create policy "rsvps_delete"
  on public.event_rsvps for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- EVENT ATTENDANCE
-- ============================================================
create policy "attendance_select"
  on public.event_attendance for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and public.is_member(e.community_id)
    )
  );

-- Mentors+ can mark attendance.
create policy "attendance_insert"
  on public.event_attendance for insert
  to authenticated
  with check (
    marked_by = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and public.has_role(e.community_id, array['owner','admin','mentor']::public.community_role[])
    )
  );

-- ============================================================
-- XP TRANSACTIONS  (append-only: SELECT + INSERT only)
-- ============================================================
create policy "xp_select"
  on public.xp_transactions for select
  to authenticated
  using (public.is_member(community_id));

-- Mentors+ can insert XP rows.
create policy "xp_insert"
  on public.xp_transactions for insert
  to authenticated
  with check (
    public.has_role(community_id, array['owner','admin','mentor']::public.community_role[])
  );

-- No UPDATE or DELETE policies → append-only at the RLS layer.
-- Also guarded by DB triggers in schema.sql.

-- ============================================================
-- SEASONS
-- ============================================================
create policy "seasons_select"
  on public.seasons for select
  to authenticated
  using (public.is_member(community_id));

-- Admins+ can manage seasons.
create policy "seasons_insert"
  on public.seasons for insert
  to authenticated
  with check (public.has_role(community_id, array['owner','admin']::public.community_role[]));

create policy "seasons_update"
  on public.seasons for update
  to authenticated
  using (public.has_role(community_id, array['owner','admin']::public.community_role[]));

-- ============================================================
-- BATTLE PASS TIERS
-- ============================================================
create policy "tiers_select"
  on public.battle_pass_tiers for select
  to authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and public.is_member(s.community_id)
    )
  );

-- Admins+ can manage tiers.
create policy "tiers_insert"
  on public.battle_pass_tiers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and public.has_role(s.community_id, array['owner','admin']::public.community_role[])
    )
  );

create policy "tiers_update"
  on public.battle_pass_tiers for update
  to authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and public.has_role(s.community_id, array['owner','admin']::public.community_role[])
    )
  );

create policy "tiers_delete"
  on public.battle_pass_tiers for delete
  to authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and public.has_role(s.community_id, array['owner','admin']::public.community_role[])
    )
  );

-- ============================================================
-- BADGES
-- ============================================================
create policy "badges_select"
  on public.badges for select
  to authenticated
  using (public.is_member(community_id));

-- Admins+ can create / edit badges.
create policy "badges_insert"
  on public.badges for insert
  to authenticated
  with check (public.has_role(community_id, array['owner','admin']::public.community_role[]));

create policy "badges_update"
  on public.badges for update
  to authenticated
  using (public.has_role(community_id, array['owner','admin']::public.community_role[]));

-- ============================================================
-- BADGE AWARDS
-- ============================================================
create policy "badge_awards_select"
  on public.badge_awards for select
  to authenticated
  using (public.is_member(community_id));

-- Mentors+ can award badges.
create policy "badge_awards_insert"
  on public.badge_awards for insert
  to authenticated
  with check (
    awarded_by = auth.uid()
    and public.has_role(community_id, array['owner','admin','mentor']::public.community_role[])
  );

-- ============================================================
-- CHANNELS
-- ============================================================
create policy "channels_select"
  on public.channels for select
  to authenticated
  using (public.is_member(community_id));

-- Admins+ can create / update channels.
create policy "channels_insert"
  on public.channels for insert
  to authenticated
  with check (public.has_role(community_id, array['owner','admin']::public.community_role[]));

create policy "channels_update"
  on public.channels for update
  to authenticated
  using (public.has_role(community_id, array['owner','admin']::public.community_role[]));

-- ============================================================
-- MESSAGES
-- ============================================================
-- Members can read messages in their community (uses denormalized community_id).
create policy "messages_select"
  on public.messages for select
  to authenticated
  using (public.is_member(community_id));

-- Members can post messages.
create policy "messages_insert"
  on public.messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(community_id)
  );

-- Authors can delete own messages; mentors+ can delete any.
create policy "messages_delete"
  on public.messages for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(community_id, array['owner','admin','mentor']::public.community_role[])
  );

-- ============================================================
-- AUDIT LOG  (append-only, read by admins+)
-- ============================================================
create policy "audit_select"
  on public.audit_log for select
  to authenticated
  using (public.has_role(community_id, array['owner','admin']::public.community_role[]));

-- Mentors+ can write audit entries.
create policy "audit_insert"
  on public.audit_log for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and public.has_role(community_id, array['owner','admin','mentor']::public.community_role[])
  );

-- No UPDATE / DELETE policies → audit log is immutable.
