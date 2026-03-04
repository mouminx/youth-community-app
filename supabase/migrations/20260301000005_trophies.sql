-- ============================================================
-- Trophies system:
--   1. Extend xp_reason enum with trophy_award
--   2. Make xp_transactions.season_id nullable (career-only XP)
--   3. trophies table + trophy_awards table
--   4. create_trophy() and award_trophy() security-definer RPCs
-- ============================================================

-- ── Extend enum ───────────────────────────────────────────────────────────────
alter type public.xp_reason add value if not exists 'trophy_award';

-- ── Allow career-only XP (no season) ─────────────────────────────────────────
-- Trophy awards and badge awards both bypass the active season.
alter table public.xp_transactions alter column season_id drop not null;

-- ── trophies ──────────────────────────────────────────────────────────────────
create table public.trophies (
  id            uuid        primary key default gen_random_uuid(),
  community_id  uuid        not null references public.communities(id) on delete cascade,
  name          text        not null,
  description   text,
  icon_url      text,
  xp_award      int         not null default 100,
  created_by    uuid        references public.profiles(id),
  created_at    timestamptz default now()
);

alter table public.trophies enable row level security;

create policy "members_read_trophies"
  on public.trophies for select
  to authenticated
  using (public.is_member(community_id));

-- ── trophy_awards ─────────────────────────────────────────────────────────────
create table public.trophy_awards (
  id            uuid        primary key default gen_random_uuid(),
  trophy_id     uuid        not null references public.trophies(id) on delete cascade,
  community_id  uuid        not null references public.communities(id) on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  awarded_by    uuid        references public.profiles(id),
  awarded_at    timestamptz default now(),
  notes         text,

  unique (trophy_id, user_id)
);

alter table public.trophy_awards enable row level security;

create policy "members_read_trophy_awards"
  on public.trophy_awards for select
  to authenticated
  using (public.is_member(community_id));

-- ── create_trophy() ───────────────────────────────────────────────────────────
create or replace function public.create_trophy(
  _community_id uuid,
  _name         text,
  _description  text    default null,
  _icon_url     text    default null,
  _xp_award     int     default 100
)
returns uuid
language plpgsql security definer
as $$
declare
  _trophy_id uuid;
begin
  if not public.has_role(_community_id, array['admin', 'owner']::text[]) then
    raise exception 'Requires admin or owner role';
  end if;

  insert into public.trophies (community_id, name, description, icon_url, xp_award, created_by)
  values (_community_id, _name, _description, _icon_url, _xp_award, auth.uid())
  returning id into _trophy_id;

  return _trophy_id;
end;
$$;

-- ── award_trophy() ────────────────────────────────────────────────────────────
-- Inserts a trophy_award and writes career XP directly to xp_transactions
-- with season_id = NULL so it never counts toward any ladder season.
create or replace function public.award_trophy(
  _trophy_id    uuid,
  _recipient_id uuid,
  _notes        text default null
)
returns void
language plpgsql security definer
as $$
declare
  _community_id uuid;
  _xp_award     int;
begin
  select community_id, xp_award
  into   _community_id, _xp_award
  from   public.trophies
  where  id = _trophy_id;

  if _community_id is null then
    raise exception 'Trophy not found';
  end if;

  if not public.has_role(_community_id, array['admin', 'owner']::text[]) then
    raise exception 'Requires admin or owner role';
  end if;

  insert into public.trophy_awards (trophy_id, community_id, user_id, awarded_by, notes)
  values (_trophy_id, _community_id, _recipient_id, auth.uid(), _notes);

  -- Career XP: season_id = NULL so it's excluded from ladder season totals
  insert into public.xp_transactions (community_id, user_id, season_id, amount, reason)
  values (_community_id, _recipient_id, null, _xp_award, 'trophy_award');
end;
$$;
