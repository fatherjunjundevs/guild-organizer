-- TEST BOOTSTRAP ONLY. Never applied by the application migration mechanism.
-- Base roles/Auth tables come from the digest-pinned Supabase PostgreSQL image.
-- Auth function body pinned to supabase/auth v2.197.0:
-- migrations/20220224000811_update_auth_functions.up.sql, namespace rendered auth.
begin;
do $authority$
begin
  if current_user <> 'supabase_admin' or current_database() <> 'postgres'
    or current_setting('server_version_num')::int / 10000 <> 17 then
    raise exception 'Unexpected isolated bootstrap authority/version';
  end if;
end;
$authority$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;

do $bootstrap$
begin
  if current_user <> 'supabase_admin' or current_database() <> 'postgres'
    or current_setting('server_version_num')::int / 10000 <> 17 then
    raise exception 'Unexpected isolated bootstrap authority/version';
  end if;
  if not exists(select 1 from pg_roles where rolname='supabase_admin' and rolsuper and rolcreaterole)
    or not exists(select 1 from pg_roles where rolname='postgres' and not rolsuper and rolcreaterole
      and rolcreatedb and rolcanlogin and rolbypassrls and rolinherit)
    or not exists(select 1 from pg_roles where rolname='authenticator' and not rolsuper and not rolinherit
      and not rolbypassrls and rolcanlogin)
    or (select count(*) from pg_roles where rolname in ('anon','authenticated') and not rolsuper
      and not rolcanlogin and not rolbypassrls and rolinherit) <> 2
    or not exists(select 1 from pg_roles where rolname='service_role' and not rolsuper
      and not rolcanlogin and rolbypassrls and rolinherit)
    or exists(select 1 from pg_roles where rolname='go_event_share_resolver') then
    raise exception 'Supabase bootstrap role contract mismatch';
  end if;
  if not pg_has_role('authenticator','anon','MEMBER')
    or not pg_has_role('authenticator','authenticated','MEMBER')
    or not pg_has_role('authenticator','service_role','MEMBER')
    or (select count(*) from pg_available_extensions where name in ('pgcrypto','pgtap','dblink')) <> 3
    or not exists(select 1 from pg_class where oid='auth.users'::regclass
      and pg_get_userbyid(relowner)='supabase_auth_admin')
    or exists(select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
      where not has_table_privilege('postgres','auth.users',p))
    or not exists(select 1 from pg_proc where oid='auth.uid()'::regprocedure
      and provolatile='s' and not prosecdef and prorettype='uuid'::regtype) then
    raise exception 'Supabase Auth/extension bootstrap mismatch';
  end if;
  perform set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001"}',true);
  perform set_config('request.jwt.claim.sub','',true);
  if auth.uid() <> '60000000-0000-4000-8000-000000000001'::uuid then raise exception 'Current JWT claims incompatible'; end if;
  perform set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
  if auth.uid() <> '60000000-0000-4000-8000-000000000002'::uuid then raise exception 'Legacy JWT claims incompatible'; end if;
end;
$bootstrap$;
commit;
