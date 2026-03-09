-- Invite codes: admins create shareable links to let people join a community.

create table public.invite_codes (
  id           uuid        primary key default gen_random_uuid(),
  community_id uuid        not null references public.communities(id) on delete cascade,
  code         text        not null unique,
  label        text,                          -- optional human-readable name
  created_by   uuid        not null references auth.users(id),
  created_at   timestamptz not null default now(),
  use_count    int         not null default 0,
  is_active    boolean     not null default true
);

create index idx_invite_codes_code      on public.invite_codes(code);
create index idx_invite_codes_community on public.invite_codes(community_id);

alter table public.invite_codes enable row level security;

-- Admin+ can read all invite codes for their community.
create policy "invite_codes_select"
  on public.invite_codes for select
  to authenticated
  using (public.has_role(community_id, array['admin', 'owner']::public.community_role[]));

-- Admin+ can create invite codes.
create policy "invite_codes_insert"
  on public.invite_codes for insert
  to authenticated
  with check (public.has_role(community_id, array['admin', 'owner']::public.community_role[]));

-- Admin+ can deactivate (update) invite codes.
create policy "invite_codes_update"
  on public.invite_codes for update
  to authenticated
  using (public.has_role(community_id, array['admin', 'owner']::public.community_role[]));

-- ── get_invite_info ──────────────────────────────────────────────────────────
-- Public (callable by anon) — returns community info for a valid active code.
-- Used by the /join/[code] page before the user is authenticated.

create or replace function public.get_invite_info(_code text)
returns jsonb
language plpgsql security definer
as $$
declare
  _invite    public.invite_codes%rowtype;
  _community public.communities%rowtype;
begin
  select * into _invite
  from public.invite_codes
  where code = _code and is_active = true;

  if not found then
    return jsonb_build_object('error', 'Invalid or inactive invite code');
  end if;

  select * into _community
  from public.communities
  where id = _invite.community_id;

  return jsonb_build_object(
    'community_id',          _community.id,
    'community_name',        _community.name,
    'community_slug',        _community.slug,
    'community_description', _community.description
  );
end;
$$;

-- ── use_invite_code ──────────────────────────────────────────────────────────
-- Authenticated only — adds the caller as a member and bumps use_count.
-- Returns { community_slug, already_member } or { error }.

create or replace function public.use_invite_code(_code text)
returns jsonb
language plpgsql security definer
as $$
declare
  _user_id   uuid := auth.uid();
  _invite    public.invite_codes%rowtype;
  _community public.communities%rowtype;
begin
  if _user_id is null then
    return jsonb_build_object('error', 'Authentication required');
  end if;

  select * into _invite
  from public.invite_codes
  where code = _code and is_active = true;

  if not found then
    return jsonb_build_object('error', 'Invalid or inactive invite code');
  end if;

  select * into _community
  from public.communities
  where id = _invite.community_id;

  -- Already a member — just return the slug so the caller can redirect.
  if exists (
    select 1 from public.memberships
    where community_id = _invite.community_id and user_id = _user_id
  ) then
    return jsonb_build_object('community_slug', _community.slug, 'already_member', true);
  end if;

  -- Insert membership.
  insert into public.memberships(community_id, user_id, role)
  values (_invite.community_id, _user_id, 'member');

  -- Ensure a profile row exists.
  insert into public.profiles(id) values (_user_id) on conflict do nothing;

  -- Bump use count.
  update public.invite_codes
  set use_count = use_count + 1
  where id = _invite.id;

  return jsonb_build_object('community_slug', _community.slug, 'already_member', false);
end;
$$;
