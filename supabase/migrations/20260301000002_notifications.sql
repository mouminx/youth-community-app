-- ============================================================
-- Notifications:
--   1. user_last_read table for unread tracking
--   2. mark_as_read() security-definer RPC
--   3. toggle_post_reaction updated — reactor +1 XP, author +2 XP
-- ============================================================

-- ── user_last_read ───────────────────────────────────────────────────────────
create table public.user_last_read (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  context_key  text not null,  -- 'feed' or 'channel:{channel_id}'
  last_read_at timestamptz not null default now(),

  primary key (user_id, community_id, context_key)
);

alter table public.user_last_read enable row level security;

create policy "own_reads"
  on public.user_last_read for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── mark_as_read() ───────────────────────────────────────────────────────────
-- Security-definer so the upsert can bypass RLS cleanly from a server action.
create or replace function public.mark_as_read(_community_id uuid, _context_key text)
returns void
language sql security definer
as $$
  insert into public.user_last_read (user_id, community_id, context_key, last_read_at)
  values (auth.uid(), _community_id, _context_key, now())
  on conflict (user_id, community_id, context_key)
  do update set last_read_at = now();
$$;

-- ── toggle_post_reaction — updated XP amounts: reactor +1, author +2 ─────────
create or replace function public.toggle_post_reaction(_post_id uuid, _emoji text)
returns jsonb
language plpgsql security definer
as $$
declare
  _user_id          uuid := auth.uid();
  _community_id     uuid;
  _author_id        uuid;
  _existing_id      uuid;
  _first_from_user  boolean;
  _active_season_id uuid;
begin
  select community_id, author_id
  into _community_id, _author_id
  from public.posts
  where id = _post_id;

  if _community_id is null then
    raise exception 'Post not found';
  end if;

  if not public.is_member(_community_id) then
    raise exception 'Not a member of this community';
  end if;

  -- Block self-reactions
  if _user_id = _author_id then
    return jsonb_build_object('action', 'not_allowed');
  end if;

  select id into _active_season_id
  from public.seasons
  where community_id = _community_id and is_active = true
  limit 1;

  select id into _existing_id
  from public.post_reactions
  where post_id = _post_id and user_id = _user_id and emoji = _emoji;

  if _existing_id is not null then
    delete from public.post_reactions where id = _existing_id;
    return jsonb_build_object('action', 'removed');
  end if;

  -- Check first-time reactor BEFORE insert
  select not exists (
    select 1 from public.post_reactions
    where post_id = _post_id and user_id = _user_id
  ) into _first_from_user;

  insert into public.post_reactions (post_id, community_id, user_id, emoji)
  values (_post_id, _community_id, _user_id, _emoji);

  -- Reactor: +1 XP
  insert into public.pending_xp (community_id, user_id, season_id, amount, reason, reference_id)
  values (_community_id, _user_id, _active_season_id, 1, 'post_reaction', _post_id);

  -- Author: +2 XP on first unique reactor
  if _first_from_user then
    insert into public.pending_xp (community_id, user_id, season_id, amount, reason, reference_id)
    values (_community_id, _author_id, _active_season_id, 2, 'post_reaction', _post_id);
  end if;

  return jsonb_build_object('action', 'added');
end;
$$;
