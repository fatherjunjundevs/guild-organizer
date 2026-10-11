-- Diagnostic-only; install through the verified owned disposable-cluster API.
begin;
set local search_path = pg_catalog, pg_temp;
do $install$
declare
  d text := pg_catalog.current_database();
  m text;
begin
  select pg_catalog.shobj_description(oid,'pg_database') into m
    from pg_catalog.pg_database where datname=d;
  if session_user <> 'supabase_admin' or current_user <> 'supabase_admin'
    or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user
      and rolsuper and rolcreaterole and rolcanlogin)
    or pg_catalog.current_setting('role',true) is distinct from 'none'
    or pg_catalog.current_setting('server_version_num')::int/10000 <> 17
    or d !~ '^go_share_test_[a-f0-9]{32}$'
    or m is distinct from 'go-disposable:' || pg_catalog.substr(d,15)
    or exists(select 1 from pg_catalog.pg_roles where rolname='go_test_preload_reader')
    or exists(select 1 from pg_catalog.pg_namespace where nspname='go_test_diagnostics') then
    raise exception 'Isolated preload diagnostic installation refused';
  end if;
end;
$install$;
create role go_test_preload_reader nologin inherit nosuperuser nocreatedb
  nocreaterole noreplication nobypassrls;
grant pg_read_all_settings to go_test_preload_reader
  with inherit true, set false, admin false;
create schema go_test_diagnostics authorization go_test_preload_reader;
revoke all on schema go_test_diagnostics from public,authenticator,anon,authenticated,service_role;
do $definition$
begin
  execute pg_catalog.format($sql$
    create function go_test_diagnostics.preloads_empty()
    returns boolean language plpgsql stable security definer
    set search_path = pg_catalog, pg_temp as $body$
    begin
      if session_user <> 'authenticator' or current_user <> 'go_test_preload_reader'
        or pg_catalog.current_setting('role',true) is distinct from 'none'
        or pg_catalog.current_database() is distinct from %L
        or (select pg_catalog.shobj_description(oid,'pg_database')
            from pg_catalog.pg_database where datname=pg_catalog.current_database())
          is distinct from %L then
        return false;
      end if;
      return coalesce(pg_catalog.current_setting('session_preload_libraries',true)=''
        and pg_catalog.current_setting('local_preload_libraries',true)='',false);
    exception when others then
      return false;
    end;
    $body$;
  $sql$,pg_catalog.current_database(),
    (select pg_catalog.shobj_description(oid,'pg_database')
     from pg_catalog.pg_database where datname=pg_catalog.current_database()));
end;
$definition$;
alter function go_test_diagnostics.preloads_empty() owner to go_test_preload_reader;
revoke all on function go_test_diagnostics.preloads_empty()
  from public,authenticator,anon,authenticated,service_role;
grant usage on schema go_test_diagnostics to authenticator;
grant execute on function go_test_diagnostics.preloads_empty() to authenticator;
do $permissions$
declare
  o oid := 'go_test_preload_reader'::pg_catalog.regrole;
  a oid := 'authenticator'::pg_catalog.regrole;
  q oid := 'pg_read_all_settings'::pg_catalog.regrole;
  n oid := 'go_test_diagnostics'::pg_catalog.regnamespace;
  f oid := 'go_test_diagnostics.preloads_empty()'::pg_catalog.regprocedure;
  r text;
begin
  if not exists(select 1 from pg_catalog.pg_authid where oid=o and not rolcanlogin
      and rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolreplication and not rolbypassrls and rolpassword is null)
    or exists(select 1 from pg_catalog.pg_auth_members where roleid=o)
    or (select count(*) from pg_catalog.pg_auth_members where member=o)<>1
    or not exists(select 1 from pg_catalog.pg_auth_members where member=o and roleid=q
      and inherit_option and not set_option and not admin_option)
    or not exists(select 1 from pg_catalog.pg_namespace where oid=n and nspowner=o)
    or (select count(*) from pg_catalog.pg_proc where pronamespace=n)<>1
    or not exists(select 1 from pg_catalog.pg_proc where oid=f and pronamespace=n and proowner=o
      and prosecdef and prorettype='pg_catalog.bool'::pg_catalog.regtype and pronargs=0
      and prokind='f' and not proretset and provolatile='s' and not proleakproof
      and proconfig=array['search_path=pg_catalog, pg_temp']::text[])
    or exists(select 1 from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x
      where p.oid=f and (x.grantee=0 or x.grantee not in (o,a)
        or (x.grantee=a and (x.privilege_type<>'EXECUTE' or x.is_grantable))))
    or exists(select 1 from pg_catalog.pg_namespace s
      cross join lateral pg_catalog.aclexplode(coalesce(s.nspacl,pg_catalog.acldefault('n',s.nspowner))) x
      where s.oid=n and (x.grantee=0 or x.grantee not in (o,a)
        or (x.grantee=a and (x.privilege_type<>'USAGE' or x.is_grantable)))) then
    raise exception 'Isolated preload diagnostic permissions refused';
  end if;
  foreach r in array array['authenticator','anon','authenticated','service_role'] loop
    if not exists(select 1 from pg_catalog.pg_roles where rolname=r and not rolsuper)
      or pg_catalog.has_schema_privilege(r,n,'USAGE') is distinct from (r='authenticator')
      or pg_catalog.has_schema_privilege(r,n,'CREATE') is distinct from false
      or pg_catalog.has_function_privilege(r,f,'EXECUTE') is distinct from (r='authenticator')
      or pg_catalog.pg_has_role(r,q,'MEMBER') is distinct from false
      or pg_catalog.pg_has_role(r,q,'USAGE') is distinct from false
      or pg_catalog.pg_has_role(r,q,'SET') is distinct from false
      or pg_catalog.pg_has_role(r,o,'MEMBER') is distinct from false
      or pg_catalog.pg_has_role(r,o,'USAGE') is distinct from false
      or pg_catalog.pg_has_role(r,o,'SET') is distinct from false then
      raise exception 'Application diagnostic authority refused';
    end if;
  end loop;
end;
$permissions$;
commit;
