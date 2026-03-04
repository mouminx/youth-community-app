-- Add structured avatar options (per-feature customization) to profiles
alter table public.profiles
  add column if not exists avatar_options jsonb not null default '{}';
