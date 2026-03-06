-- Add read_only flag to channels
alter table public.channels
  add column if not exists read_only boolean not null default false;

-- Mark all existing "announcements" channels as read-only
update public.channels set read_only = true where name = 'announcements';

-- Tighten messages_insert: block posting to read-only channels for non-admin/owner
drop policy if exists "messages_insert" on public.messages;

create policy "messages_insert"
  on public.messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(community_id)
    and (
      -- channel is not read-only
      not exists (
        select 1 from public.channels
        where id = channel_id and read_only = true
      )
      -- OR user is admin/owner
      or public.has_role(community_id, array['owner','admin']::public.community_role[])
    )
  );

-- Update bootstrap_community so new communities get announcements as read-only
create or replace function public.bootstrap_community(
  _community_id uuid,
  _user_id uuid
)
returns void
language plpgsql security definer
as $$
begin
  -- Owner membership
  insert into public.memberships (community_id, user_id, role)
  values (_community_id, _user_id, 'owner');

  -- Default channels: announcements is read-only
  insert into public.channels (community_id, name, read_only)
  values
    (_community_id, 'announcements', true),
    (_community_id, 'general',       false);
end;
$$;
