-- ============================================================
-- Unread count helper RPCs for sidebar notification badges
-- ============================================================

-- Returns unread message counts per channel for a given user
-- (messages not sent by the user, created after their last_read_at)
create or replace function public.get_channel_unread_counts(
  _community_id uuid,
  _user_id      uuid
)
returns table (channel_id uuid, unread_count int)
language sql security definer
as $$
  select
    m.channel_id,
    count(*)::int as unread_count
  from public.messages m
  left join public.user_last_read r
    on  r.user_id      = _user_id
    and r.community_id = _community_id
    and r.context_key  = 'channel:' || m.channel_id::text
  where m.community_id = _community_id
    and m.user_id      != _user_id
    and m.created_at   > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
  group by m.channel_id;
$$;

-- Returns unread post count for a given user in a community
-- (posts not authored by the user, created after their last_read_at for 'feed')
-- Defaults to now() when no last_read_at exists → 0 unread on first visit.
create or replace function public.get_feed_unread_count(
  _community_id uuid,
  _user_id      uuid
)
returns int
language sql security definer
as $$
  select count(*)::int
  from public.posts p
  left join public.user_last_read r
    on  r.user_id      = _user_id
    and r.community_id = _community_id
    and r.context_key  = 'feed'
  where p.community_id = _community_id
    and p.author_id    != _user_id
    and p.created_at   > coalesce(r.last_read_at, now());
$$;
