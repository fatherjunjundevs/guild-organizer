-- Isolated HTTP privacy only; the owner was independently installed/verified.
begin;
set local search_path = pg_catalog, pg_temp;
do $check$
begin
  if session_user <> 'supabase_admin' or current_user <> 'supabase_admin'
    or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
    or pg_catalog.current_database() !~ '^go_share_test_[a-f0-9]{32}$'
    or (select pg_catalog.shobj_description(oid,'pg_database') from pg_catalog.pg_database where datname=pg_catalog.current_database())
       is distinct from 'go-disposable:' || pg_catalog.substr(pg_catalog.current_database(),15)
    or not exists(select 1 from pg_catalog.pg_roles where rolname='go_test_preload_reader'
      and not rolcanlogin and not rolsuper and not rolbypassrls)
    or exists(select 1 from pg_catalog.pg_namespace where nspname='go_test_privacy') then
    raise exception 'Isolated privacy helper installation refused';
  end if;
end;
$check$;
create schema go_test_privacy authorization go_test_preload_reader;
revoke all on schema go_test_privacy from public,authenticator,anon,authenticated,service_role;
do $definition$
begin
  execute pg_catalog.format($sql$
    create function go_test_privacy.preloads_safe()
    returns boolean language plpgsql stable security definer
    set search_path = pg_catalog, pg_temp as $body$
    begin
      if session_user <> 'authenticator' or current_user <> 'go_test_preload_reader'
        or pg_catalog.current_setting('role',true) not in ('none','anon','authenticated','service_role')
        or pg_catalog.current_database() is distinct from %L
        or (select pg_catalog.shobj_description(oid,'pg_database') from pg_catalog.pg_database where datname=pg_catalog.current_database())
           is distinct from %L then return false; end if;
      return coalesce(
        pg_catalog.current_setting('session_preload_libraries')=''
        and pg_catalog.current_setting('local_preload_libraries')=''
        and pg_catalog.current_setting('shared_preload_libraries') !~ '(pgaudit|auto_explain)'
        and pg_catalog.current_setting('logging_collector')='off'
        and pg_catalog.current_setting('log_destination')='stderr'
        -- The administrative prerequisite checks pg_current_logfile() IS NULL;
        -- it is restricted to pg_monitor and does not need to run in pool roles.
        and not exists(select 1 from pg_catalog.pg_settings where name like 'pgaudit.%%' or name like 'auto_explain.%%'),
        false);
    exception when others then return false;
    end;
    $body$;
  $sql$,pg_catalog.current_database(),
    (select pg_catalog.shobj_description(oid,'pg_database') from pg_catalog.pg_database where datname=pg_catalog.current_database()));
end;
$definition$;
alter function go_test_privacy.preloads_safe() owner to go_test_preload_reader;
revoke all on function go_test_privacy.preloads_safe() from public,authenticator,anon,authenticated,service_role;
grant usage on schema go_test_privacy to authenticator,anon,authenticated,service_role;
grant execute on function go_test_privacy.preloads_safe() to authenticator,anon,authenticated,service_role;
do $permissions$
declare
  r text;
  o oid := 'go_test_preload_reader'::pg_catalog.regrole;
  n oid := 'go_test_privacy'::pg_catalog.regnamespace;
  f oid := 'go_test_privacy.preloads_safe()'::pg_catalog.regprocedure;
  a oid[] := array['authenticator'::pg_catalog.regrole,'anon'::pg_catalog.regrole,'authenticated'::pg_catalog.regrole,'service_role'::pg_catalog.regrole]::oid[];
begin
  if not exists(select 1 from pg_catalog.pg_namespace where oid=n and nspowner=o)
    or (select count(*) from pg_catalog.pg_proc where pronamespace=n)<>1
    or not exists(select 1 from pg_catalog.pg_proc where oid=f and proowner=o and prosecdef
      and prorettype='pg_catalog.bool'::pg_catalog.regtype and pronargs=0 and not proretset
      and proconfig=array['search_path=pg_catalog, pg_temp']::text[])
    or exists(select 1 from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x
      where p.oid=f and (x.grantee=0 or (x.grantee<>o and (x.grantee<>all(a) or x.is_grantable))))
    or exists(select 1 from pg_catalog.pg_namespace s
      cross join lateral pg_catalog.aclexplode(coalesce(s.nspacl,pg_catalog.acldefault('n',s.nspowner))) x
      where s.oid=n and (x.grantee=0 or (x.grantee<>o and (x.grantee<>all(a) or x.privilege_type<>'USAGE' or x.is_grantable)))) then
    raise exception 'Isolated privacy permissions refused';
  end if;
  foreach r in array array['authenticator','anon','authenticated','service_role'] loop
    if pg_catalog.has_schema_privilege(r,n,'USAGE') is distinct from true
      or pg_catalog.has_schema_privilege(r,n,'CREATE') is distinct from false
      or pg_catalog.has_function_privilege(r,f,'EXECUTE') is distinct from true
      or pg_catalog.pg_has_role(r,o,'MEMBER') is distinct from false
      or pg_catalog.pg_has_role(r,'pg_read_all_settings','MEMBER') is distinct from false then
      raise exception 'Application privacy authority refused';
    end if;
  end loop;
end;
$permissions$;
commit;
