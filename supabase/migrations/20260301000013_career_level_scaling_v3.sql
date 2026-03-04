-- Update career level formula: round(90 × (n−1)^1.8)
-- Scaled for communities earning ~500 XP/week.
-- Key thresholds: L2=90, L5=1091, L10=4698, L20=18030, L30=38597, L50=99219

create or replace function public.compute_career_level(_total_xp bigint)
returns int
language sql
immutable
as $$
  select coalesce(
    (
      select max(n)
      from generate_series(1, 500) n
      where round(90.0 * power((n - 1)::float8, 1.8)) <= _total_xp
    ),
    1
  );
$$;

-- Re-run backfill with updated formula.
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
    where cma.user_id      = p.id
      and cma.milestone_id = cm.id
  )
on conflict (user_id, milestone_id) do nothing;
