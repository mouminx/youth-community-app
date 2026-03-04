-- Add avatar customization fields to profiles
alter table public.profiles
  add column if not exists avatar_seed text not null default '',
  add column if not exists avatar_bg   text not null default '0b1020';

-- Allow users to update their own profile avatar fields
create policy "users_update_own_profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
