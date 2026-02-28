-- dev_reset_community: wipes all data for a community by slug.
-- Used only by the local seed script. The SECURITY DEFINER + superuser
-- ownership lets it temporarily disable the xp_no_delete trigger so the
-- cascade delete from communities can proceed.
create or replace function public.dev_reset_community(_slug text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  _community_id uuid;
begin
  select id into _community_id from communities where slug = _slug;
  if _community_id is null then return; end if;

  alter table xp_transactions disable trigger xp_no_delete;
  alter table xp_transactions disable trigger xp_no_update;

  delete from communities where id = _community_id;

  alter table xp_transactions enable trigger xp_no_delete;
  alter table xp_transactions enable trigger xp_no_update;
end;
$$;
