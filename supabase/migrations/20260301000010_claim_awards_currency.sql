-- Update claim_pending_xp to also award 50% of claimed XP as ascnd points (currency).
-- The insert is done inside a security-definer function so no admin role is needed.
create or replace function public.claim_pending_xp(_community_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare
  _user_id        uuid := auth.uid();
  _total_amount   int  := 0;
  _currency_award int  := 0;
begin
  if not public.is_member(_community_id) then
    raise exception 'Not a member of this community';
  end if;

  select coalesce(sum(amount), 0)
  into _total_amount
  from public.pending_xp
  where community_id = _community_id
    and user_id      = _user_id;

  if _total_amount = 0 then
    return jsonb_build_object('claimed', 0, 'currency_awarded', 0);
  end if;

  -- Move pending XP rows into xp_transactions.
  insert into public.xp_transactions
    (community_id, user_id, season_id, amount, reason, reference_id, created_at)
  select
    community_id, user_id, season_id, amount, reason, reference_id, created_at
  from public.pending_xp
  where community_id = _community_id
    and user_id      = _user_id;

  -- Delete claimed rows.
  delete from public.pending_xp
  where community_id = _community_id
    and user_id      = _user_id;

  -- Award 50% of claimed XP as ascnd points, rounded down.
  _currency_award := floor(_total_amount::float / 2)::int;
  if _currency_award > 0 then
    insert into public.currency_transactions(community_id, user_id, amount, reason)
    values (_community_id, _user_id, _currency_award, 'xp_claim');
  end if;

  return jsonb_build_object('claimed', _total_amount, 'currency_awarded', _currency_award);
end;
$$;
