-- Migration: lock the database to the owner's GitHub account (run once).
--
-- Before running: enable the GitHub provider in Supabase (Authentication ->
-- Sign In / Providers -> GitHub). See README "Sign in with GitHub".
--
-- Access is granted by GitHub's numeric account id (not username), read from
-- Supabase's own auth.identities table, which users cannot edit. Anyone else
-- who signs in with GitHub gets an account but can read and write nothing.
-- To change the owner, edit the id below and re-run this file.

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.identities i
    where i.user_id = auth.uid()
      and i.provider = 'github'
      and i.provider_id = '31107239'   -- github.com/liretpye
  );
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['settings','lifts','program_days','logs','accessories','cycles'] loop
    execute format('drop policy if exists anon_all on %I', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format(
      'create policy owner_all on %I for all to authenticated using (public.is_owner()) with check (public.is_owner())',
      t
    );
  end loop;
end $$;
