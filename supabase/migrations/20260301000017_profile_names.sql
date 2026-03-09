-- Add first_name, last_name, username to profiles.
-- Add name_display_mode to communities (owner-controlled).

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name  text not null default '',
  add column if not exists username   text unique;  -- nullable until explicitly set by user

alter table public.communities
  add column if not exists name_display_mode text not null default 'username'
    check (name_display_mode in ('username', 'full_name', 'first_last_initial', 'custom'));
