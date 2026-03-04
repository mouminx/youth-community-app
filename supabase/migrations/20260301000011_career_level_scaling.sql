-- ============================================================
-- Progressive career level scaling
-- Formula: cumulative XP to reach level n = round(17 × (n−1)^1.7)
-- Mirrors src/lib/gamification.ts → cumulativeXpForCareerLevel
-- ============================================================

-- Helper: compute career level from total XP using the power-curve formula.
-- Finds the largest n where round(17 * power(n-1, 1.7)) <= _total_xp.
create or replace function public.compute_career_level(_total_xp bigint)
returns int
language sql
immutable
as $$
  select coalesce(
    (
      select max(n)
      from generate_series(1, 500) n
      where round(17.0 * power((n - 1)::float8, 1.7)) <= _total_xp
    ),
    1
  );
$$;

-- Update check_career_milestones to use the new formula.
create or replace function public.check_career_milestones()
returns jsonb
language plpgsql security definer
as $$
declare
  _user_id      uuid := auth.uid();
  _total_xp     bigint;
  _career_level int;
  _new_awards   jsonb;
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(sum(amount), 0)
  into _total_xp
  from public.xp_transactions
  where user_id = _user_id;

  _career_level := public.compute_career_level(_total_xp);

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

-- Re-run the backfill using the new formula so existing users receive any
-- milestones they are eligible for under progressive scaling.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
insert into public.career_milestone_awards (user_id, milestone_id)
select
  p.id,
  cm.id
from public.profiles p
cross join public.career_milestones cm
cross join lateral (
  select coalesce(sum(amount), 0) as total_xp
  from public.xp_transactions
  where user_id = p.id
) xp
where public.compute_career_level(xp.total_xp) >= cm.level_required
  and not exists (
    select 1 from public.career_milestone_awards cma
    where cma.user_id     = p.id
      and cma.milestone_id = cm.id
  )
on conflict (user_id, milestone_id) do nothing;
