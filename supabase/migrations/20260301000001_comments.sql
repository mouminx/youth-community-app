-- ============================================================
-- Feed improvements:
--   1. post_create xp_reason value
--   2. post_comments table with parent_id threading
--   3. toggle_post_reaction updated to block self-reactions
--   4. award_post_creation_xp() security-definer RPC
-- ============================================================

-- 1. Extend xp_reason enum
alter type public.xp_reason add value if not exists 'post_create';

-- ── post_comments ────────────────────────────────────────────────────────────
create table public.post_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  parent_id    uuid references public.post_comments(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index idx_post_comments_post   on public.post_comments(post_id, created_at);
create index idx_post_comments_parent on public.post_comments(parent_id);

-- ── RLS: post_comments ───────────────────────────────────────────────────────
alter table public.post_comments enable row level security;

create policy "comments_select"
  on public.post_comments for select
  to authenticated
  using (public.is_member(community_id));

create policy "comments_insert"
  on public.post_comments for insert
  to authenticated
  with check (public.is_member(community_id) and author_id = auth.uid());

-- Authors can delete their own; mentors+ can moderate
create policy "comments_delete"
  on public.post_comments for delete
  to authenticated
  using (
    author_id = auth.uid()
    or public.has_role(community_id, array['owner','admin','mentor']::public.community_role[])
  );

-- ── Updated toggle_post_reaction — blocks self-reactions ─────────────────────
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

  -- Reactor +2 XP
  insert into public.pending_xp (community_id, user_id, season_id, amount, reason, reference_id)
  values (_community_id, _user_id, _active_season_id, 2, 'post_reaction', _post_id);

  -- Author +5 XP on first unique reactor
  if _first_from_user then
    insert into public.pending_xp (community_id, user_id, season_id, amount, reason, reference_id)
    values (_community_id, _author_id, _active_season_id, 5, 'post_reaction', _post_id);
  end if;

  return jsonb_build_object('action', 'added');
end;
$$;

-- ── award_post_creation_xp ───────────────────────────────────────────────────
-- Security-definer so members (who can't INSERT into pending_xp directly) can
-- self-award post creation XP. Guards:
--   • caller must be the post author
--   • XP = count of words ≥4 chars, capped at 50
--   • A "hold a key" spam run ("aaaaaaaaaa") counts as 1 word → 1 XP max
create or replace function public.award_post_creation_xp(_post_id uuid)
returns int
language plpgsql security definer
as $$
declare
  _user_id      uuid := auth.uid();
  _community_id uuid;
  _author_id    uuid;
  _body         text;
  _xp           int  := 0;
  _season_id    uuid;
begin
  select community_id, author_id, body
  into _community_id, _author_id, _body
  from public.posts
  where id = _post_id;

  if _author_id is null then raise exception 'Post not found'; end if;
  if _author_id != _user_id then raise exception 'Not the post author'; end if;

  -- Count words with ≥4 chars, cap at 50
  select least(count(*)::int, 50)
  into _xp
  from unnest(regexp_split_to_array(trim(_body), '\s+')) as w
  where char_length(w) >= 4;

  if _xp = 0 then return 0; end if;

  select id into _season_id
  from public.seasons
  where community_id = _community_id and is_active = true
  limit 1;

  insert into public.pending_xp (community_id, user_id, season_id, amount, reason, reference_id)
  values (_community_id, _user_id, _season_id, _xp, 'post_create', _post_id);

  return _xp;
end;
$$;
