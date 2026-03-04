-- Currency transactions (append-only ledger, similar to xp_transactions)
create table if not exists public.currency_transactions (
  id           uuid        primary key default gen_random_uuid(),
  community_id uuid        not null references public.communities(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  amount       int         not null,
  reason       text        not null,
  reference_id uuid,
  created_at   timestamptz not null default now()
);

create index if not exists currency_transactions_community_user
  on public.currency_transactions(community_id, user_id);

alter table public.currency_transactions enable row level security;

-- Members can read their own transactions
create policy "members_read_own_currency"
  on public.currency_transactions for select
  using (auth.uid() = user_id);

-- Admins/owners can read all currency transactions in their community
create policy "admins_read_community_currency"
  on public.currency_transactions for select
  using (has_role(community_id, array['admin', 'owner']::public.community_role[]));

-- award_currency: admin/owner only, security definer bypasses RLS for insert
create or replace function public.award_currency(
  _community_id uuid,
  _user_id      uuid,
  _amount       int,
  _reason       text
)
returns void language plpgsql security definer as $$
begin
  if not has_role(_community_id, array['admin', 'owner']::public.community_role[]) then
    raise exception 'permission denied: admin or owner role required';
  end if;

  insert into public.currency_transactions(community_id, user_id, amount, reason)
  values (_community_id, _user_id, _amount, _reason);
end;
$$;
