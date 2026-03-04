-- ============================================================
-- career_milestones: global (non-community) career level badges
-- Awarded automatically when a user reaches a career level milestone.
-- ============================================================

create table public.career_milestones (
  id             uuid primary key default gen_random_uuid(),
  level_required int  not null unique check (level_required >= 1),
  name           text not null,
  description    text not null default '',
  icon           text not null default '⭐'
);

-- Seed the 17 milestone levels (1–10, 15, 20, 25, 30, 40, 50)
insert into public.career_milestones (level_required, name, description, icon) values
  (1,  'First Step',   'Claimed your first XP and started your career.',  '🌱'),
  (2,  'Rising',       'Reached Career Level 2.',                          '⚡'),
  (3,  'Grinder',      'Reached Career Level 3.',                          '💪'),
  (4,  'Dedicated',    'Reached Career Level 4.',                          '🎯'),
  (5,  'On Fire',      'Reached Career Level 5.',                          '🔥'),
  (6,  'Hustler',      'Reached Career Level 6.',                          '🚀'),
  (7,  'Consistent',   'Reached Career Level 7.',                          '✨'),
  (8,  'All-Star',     'Reached Career Level 8.',                          '🏅'),
  (9,  'Elite',        'Reached Career Level 9.',                          '⚔️'),
  (10, 'Veteran',      'Reached Career Level 10.',                         '🏆'),
  (15, 'Trailblazer',  'Reached Career Level 15.',                         '🌟'),
  (20, 'Legend',       'Reached Career Level 20.',                         '👑'),
  (25, 'Champion',     'Reached Career Level 25.',                         '💎'),
  (30, 'Master',       'Reached Career Level 30.',                         '🎖️'),
  (40, 'Grand Master', 'Reached Career Level 40.',                         '🌠'),
  (50, 'Ascendant',    'Reached Career Level 50. The pinnacle of ascnd.',  '⬆️');

-- ── career_milestone_awards ────────────────────────────────────────────────────

create table public.career_milestone_awards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  milestone_id uuid not null references public.career_milestones(id) on delete cascade,
  awarded_at   timestamptz not null default now(),
  unique(user_id, milestone_id)
);

create index idx_career_milestone_awards_user on public.career_milestone_awards(user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────

alter table public.career_milestones enable row level security;
alter table public.career_milestone_awards enable row level security;

-- Anyone can read milestone definitions
create policy "career_milestones_read_all"
  on public.career_milestones for select
  using (true);

-- Authenticated users can read any user's milestone awards (public achievements)
create policy "career_milestone_awards_read_all"
  on public.career_milestone_awards for select
  to authenticated
  using (true);

-- ── RPC: check_career_milestones ───────────────────────────────────────────────
-- Called after claiming XP. Awards any newly eligible milestones and returns them.
-- Security definer bypasses RLS so the user can write to career_milestone_awards.
create or replace function public.check_career_milestones()
returns jsonb
language plpgsql security definer
as $$
declare
  _user_id      uuid := auth.uid();
  _total_xp     int;
  _career_level int;
  _new_awards   jsonb;
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Career XP = all-time XP across all communities
  select coalesce(sum(amount), 0)
  into _total_xp
  from public.xp_transactions
  where user_id = _user_id;

  _career_level := floor(_total_xp::float / 100)::int + 1;

  -- Insert any newly eligible milestones; ignore conflicts (already awarded)
  with newly_awarded as (
    insert into public.career_milestone_awards (user_id, milestone_id)
    select _user_id, cm.id
    from public.career_milestones cm
    where cm.level_required <= _career_level
      and not exists (
        select 1 from public.career_milestone_awards cma
        where cma.user_id      = _user_id
          and cma.milestone_id = cm.id
      )
    returning milestone_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',             cm.id,
        'level_required', cm.level_required,
        'name',           cm.name,
        'icon',           cm.icon
      )
      order by cm.level_required
    ),
    '[]'::jsonb
  )
  into _new_awards
  from newly_awarded na
  join public.career_milestones cm on cm.id = na.milestone_id;

  return jsonb_build_object(
    'career_level', _career_level,
    'new_awards',   _new_awards
  );
end;
$$;
