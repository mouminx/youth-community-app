-- Add theme_key to communities table.
-- Allowed values: ascnd | sky-high | high-tide | ruby | evergreen | saffron | bloom | tangerine
alter table public.communities
  add column if not exists theme_key text not null default 'ascnd'
    check (theme_key in ('ascnd','sky-high','high-tide','ruby','evergreen','saffron','bloom','tangerine'));

-- Owner can update the theme of their community.
-- Existing RLS on communities allows owners to update; just ensure the policy covers theme_key.
-- (The original update policy "communities_update" already allows owner to update any column.)
