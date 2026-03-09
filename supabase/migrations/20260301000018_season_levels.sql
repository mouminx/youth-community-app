-- Update claim_pending_xp to award ASCND points based on season levels crossed.
-- For each battle_pass_tier threshold crossed (before → after), award floor(xp_per_level * 1.5)
-- where xp_per_level = xp_required / tier_number (uniform levels).
-- Replaces the previous flat 50%-of-claimed-XP formula.

create or replace function public.claim_pending_xp(_community_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare
  _user_id          uuid := auth.uid();
  _total_amount     int  := 0;
  _currency_award   int  := 0;
  _active_season_id uuid;
  _season_xp_before int  := 0;
  _season_xp_after  int  := 0;
  _tier             record;
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

  -- Find the active season for this community (if any).
  select id into _active_season_id
  from public.seasons
  where community_id = _community_id
    and is_active    = true
  limit 1;

  -- Snapshot season XP before claiming (only counts committed xp_transactions).
  if _active_season_id is not null then
    select coalesce(sum(amount), 0)
    into _season_xp_before
    from public.xp_transactions
    where community_id = _community_id
      and user_id      = _user_id
      and season_id    = _active_season_id;
  end if;

  -- Move all pending XP rows into xp_transactions.
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

  -- Determine level crossings and award currency (if active season exists).
  if _active_season_id is not null then
    select coalesce(sum(amount), 0)
    into _season_xp_after
    from public.xp_transactions
    where community_id = _community_id
      and user_id      = _user_id
      and season_id    = _active_season_id;

    -- For each tier threshold crossed, award floor(xp_per_level * 1.5) ASCND points.
    -- xp_per_level = xp_required / tier_number (tiers are uniform: xp_required = N * xp_per_level).
    for _tier in
      select tier_number, xp_required
      from public.battle_pass_tiers
      where season_id  = _active_season_id
        and xp_required > _season_xp_before
        and xp_required <= _season_xp_after
    loop
      _currency_award := _currency_award
        + floor((_tier.xp_required::float / _tier.tier_number) * 1.5)::int;
    end loop;
  end if;

  if _currency_award > 0 then
    insert into public.currency_transactions(community_id, user_id, amount, reason)
    values (_community_id, _user_id, _currency_award, 'level_up');
  end if;

  return jsonb_build_object('claimed', _total_amount, 'currency_awarded', _currency_award);
end;
$$;
