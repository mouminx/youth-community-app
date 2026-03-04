-- Update career level formula: round(25 × (n−1)^1.8)
-- Previous: round(17 × (n−1)^1.7)
-- Key thresholds: L2=25, L10=1305, L20=5008, L30=10722, L50=27561

create or replace function public.compute_career_level(_total_xp bigint)
returns int
language sql
immutable
as $$
  select coalesce(
    (
      select max(n)
      from generate_series(1, 500) n
      where round(25.0 * power((n - 1)::float8, 1.8)) <= _total_xp
    ),
    1
  );
$$;

-- Re-run backfill with updated formula so existing users get correct milestones.
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
