-- Cleanup partial state from previously failed migration.
-- Drop everything in reverse dependency order so the schema migration can start fresh.

-- Drop functions first (they may reference types)
drop function if exists public.bootstrap_community cascade;
drop function if exists public.leaderboard_weekly cascade;
drop function if exists public.leaderboard_season cascade;
drop function if exists public.my_rank_weekly cascade;
drop function if exists public.my_rank_season cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.deny_xp_mutation cascade;
drop function if exists public.is_member cascade;
drop function if exists public.has_role cascade;

-- Drop tables in reverse dependency order
drop table if exists public.audit_log cascade;
drop table if exists public.messages cascade;
drop table if exists public.channels cascade;
drop table if exists public.badge_awards cascade;
drop table if exists public.badges cascade;
drop table if exists public.battle_pass_tiers cascade;
drop table if exists public.xp_transactions cascade;
drop table if exists public.event_attendance cascade;
drop table if exists public.event_rsvps cascade;
drop table if exists public.events cascade;
drop table if exists public.seasons cascade;
drop table if exists public.memberships cascade;
drop table if exists public.communities cascade;
drop table if exists public.profiles cascade;

-- Drop custom types
drop type if exists public.community_role cascade;
drop type if exists public.xp_reason cascade;
drop type if exists public.audit_action cascade;
