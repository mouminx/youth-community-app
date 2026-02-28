-- ============================================================
-- pending_xp: XP earned but not yet claimed by the user.
-- Mentors/admins write here; users claim by calling the RPC.
-- ============================================================

create table public.pending_xp (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  season_id    uuid references public.seasons(id) on delete set null,
  amount       int not null check (amount > 0),
  reason       public.xp_reason not null,
  reference_id uuid,
  created_at   timestamptz not null default now()
);

create index idx_pending_xp_user on public.pending_xp(community_id, user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────
alter table public.pending_xp enable row level security;

-- Users can view their own pending XP.
create policy "pending_xp_select"
  on public.pending_xp for select
  to authenticated
  using (user_id = auth.uid());

-- Mentors+ can insert pending XP rewards.
create policy "pending_xp_insert"
  on public.pending_xp for insert
  to authenticated
  with check (
    public.has_role(community_id, array['owner','admin','mentor']::public.community_role[])
  );

-- No direct DELETE policy — users claim via the RPC below (security definer).

-- ── RPC: claim_pending_xp ──────────────────────────────────────────────────────
-- Atomically moves all pending_xp rows for the caller into xp_transactions.
-- Runs as security definer so a regular member can write to xp_transactions.
-- Returns the total XP amount claimed.
create or replace function public.claim_pending_xp(_community_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare
  _user_id      uuid := auth.uid();
  _total_amount int  := 0;
begin
  -- Guard: caller must be a member of the community.
  if not public.is_member(_community_id) then
    raise exception 'Not a member of this community';
  end if;

  -- Sum pending amount.
  select coalesce(sum(amount), 0)
  into _total_amount
  from public.pending_xp
  where community_id = _community_id
    and user_id      = _user_id;

  if _total_amount = 0 then
    return jsonb_build_object('claimed', 0);
  end if;

  -- Move rows into xp_transactions.
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

  return jsonb_build_object('claimed', _total_amount);
end;
$$;
