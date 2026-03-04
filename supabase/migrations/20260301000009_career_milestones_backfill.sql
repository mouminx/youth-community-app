-- Retroactively award career milestone badges to all users who are already eligible.
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
where floor(xp.total_xp::float / 100)::int + 1 >= cm.level_required
  and not exists (
    select 1 from public.career_milestone_awards cma
    where cma.user_id = p.id
      and cma.milestone_id = cm.id
  )
on conflict (user_id, milestone_id) do nothing;
