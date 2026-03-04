-- ============================================================
-- posts: Community post feed with emoji reactions + XP rewards
-- ============================================================

-- Extend xp_reason enum with post_reaction
alter type public.xp_reason add value if not exists 'post_reaction';

-- ── Posts ────────────────────────────────────────────────────────────────────
create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  body         text not null check (char_length(body) >= 10),
  created_at   timestamptz not null default now()
);

create index idx_posts_community on public.posts(community_id, created_at desc);

-- ── Post reactions ───────────────────────────────────────────────────────────
create table public.post_reactions (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  emoji        text not null,
  created_at   timestamptz not null default now(),

  constraint uq_post_reaction unique (post_id, user_id, emoji)
);

create index idx_post_reactions_post on public.post_reactions(post_id);

-- ── RLS: posts ───────────────────────────────────────────────────────────────
alter table public.posts enable row level security;

create policy "posts_select"
  on public.posts for select
  to authenticated
  using (public.is_member(community_id));

create policy "posts_insert"
  on public.posts for insert
  to authenticated
  with check (public.is_member(community_id) and author_id = auth.uid());

-- ── RLS: post_reactions ──────────────────────────────────────────────────────
alter table public.post_reactions enable row level security;

create policy "reactions_select"
  on public.post_reactions for select
  to authenticated
  using (public.is_member(community_id));

create policy "reactions_insert"
  on public.post_reactions for insert
  to authenticated
  with check (public.is_member(community_id) and user_id = auth.uid());

create policy "reactions_delete"
  on public.post_reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- ── RPC: toggle_post_reaction ────────────────────────────────────────────────
-- Atomically toggles a reaction and awards XP.
-- XP rules:
--   Reactor: +2 XP when adding (not on own post)
--   Author:  +5 XP on first unique user reaction (not self)
--   Removal: no XP change
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
  -- Get post info
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

  -- Get active season (nullable)
  select id into _active_season_id
  from public.seasons
  where community_id = _community_id and is_active = true
  limit 1;

  -- Check if this exact reaction already exists
  select id into _existing_id
  from public.post_reactions
  where post_id = _post_id and user_id = _user_id and emoji = _emoji;

  if _existing_id is not null then
    -- Remove reaction (no XP change on removal)
    delete from public.post_reactions where id = _existing_id;
    return jsonb_build_object('action', 'removed');
  end if;

  -- Check if this is the first reaction from this user on this post (before insert)
  select not exists (
    select 1 from public.post_reactions
    where post_id = _post_id and user_id = _user_id
  ) into _first_from_user;

  -- Add reaction
  insert into public.post_reactions (post_id, community_id, user_id, emoji)
  values (_post_id, _community_id, _user_id, _emoji);

  -- Award XP (skip if reacting to own post)
  if _user_id != _author_id then
    -- Reactor gets +2 XP
    insert into public.pending_xp (community_id, user_id, season_id, amount, reason, reference_id)
    values (_community_id, _user_id, _active_season_id, 2, 'post_reaction', _post_id);

    -- Author gets +5 XP on first unique reactor
    if _first_from_user then
      insert into public.pending_xp (community_id, user_id, season_id, amount, reason, reference_id)
      values (_community_id, _author_id, _active_season_id, 5, 'post_reaction', _post_id);
    end if;
  end if;

  return jsonb_build_object('action', 'added');
end;
$$;
