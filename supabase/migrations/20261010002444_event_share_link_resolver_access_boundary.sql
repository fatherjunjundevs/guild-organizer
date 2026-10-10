-- Phase 6.3A.5C.1: preserve the resolver, close its direct Data API boundary.
begin;

do $boundary$
begin
  -- Roles are cluster-wide. Even a seemingly compatible existing role is not
  -- proof of ownership. Do not adopt, alter, or drop a colliding role.
  if exists (select 1 from pg_catalog.pg_roles where rolname='go_event_share_resolver') then
    raise exception using errcode='42710',
      message='Internal resolver role already exists; independent ownership review required';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.resolve_event_share_link(text)'::regprocedure
      and p.prosecdef and p.provolatile='s'
      and p.proconfig=array['search_path=""']::text[]
      and pg_catalog.pg_get_userbyid(p.proowner)='postgres'
      and pg_catalog.pg_get_function_result(p.oid)=
        'TABLE(event_name text, event_type_name text, version_number integer, published_at timestamp with time zone)'
  ) then
    raise exception 'Unexpected resolver contract; access migration refused';
  end if;
  create role go_event_share_resolver with
    nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication;
end;
$boundary$;

revoke all on function public.resolve_event_share_link(text)
  from public, anon, authenticated, service_role;
grant usage on schema public to go_event_share_resolver;
grant execute on function public.resolve_event_share_link(text) to go_event_share_resolver;

-- No explicit role memberships, login credentials, direct table access, or
-- management grants. PostgreSQL may automatically give its trusted creator an
-- ADMIN membership; no Data API role receives membership. PUBLIC's ambient
-- privileges remain; audit them before provisioning.
-- There is deliberately no replacement public route in this checkpoint.
commit;
