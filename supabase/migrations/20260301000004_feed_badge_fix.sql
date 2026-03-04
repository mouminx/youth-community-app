-- Fix get_feed_unread_count: use a 7-day lookback as default instead of now()
-- Previously coalesce(last_read_at, now()) meant first-time visitors always saw 0
-- because no posts are created in the future. Now we show posts from the last 7
-- days as "unread" until the user explicitly visits the feed.
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
    and p.created_at   > coalesce(r.last_read_at, now() - interval '7 days');
$$;
