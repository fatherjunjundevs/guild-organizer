-- Test-only, applied as supabase_admin exclusively inside a verified owned cluster.
begin;
do $check$
begin
  if current_user <> 'supabase_admin' or current_setting('server_version_num')::int/10000 <> 17
    or current_database() !~ '^go_share_test_[a-f0-9]{32}$'
    or not exists(select 1 from pg_roles where rolname='authenticator' and rolcanlogin
      and not rolsuper and not rolbypassrls and not rolinherit and not rolcreaterole and not rolcreatedb and not rolreplication) then
    raise exception 'HTTP isolated bootstrap authority mismatch';
  end if;
end;
$check$;
grant anon, authenticated, service_role to authenticator with inherit false, set true;
do $membership$
begin
  if exists(select 1 from pg_roles r where r.rolname not in ('authenticator','anon','authenticated','service_role')
    and pg_has_role('authenticator',r.oid,'SET')) then
    raise exception 'Unexpected authenticator role-switch authority';
  end if;
end;
$membership$;
do $logging$
declare r text;
begin
  perform pg_catalog.set_config('session_preload_libraries', '', true);
  perform pg_catalog.set_config('local_preload_libraries', '', true);
  foreach r in array array['authenticator','anon','authenticated','service_role'] loop
    execute format('alter role %I set log_statement = %L',r,'none');
    execute format('alter role %I set log_min_messages = %L',r,'fatal');
    execute format('alter role %I set log_min_error_statement = %L',r,'panic');
    execute format('alter role %I set log_duration = %L',r,'off');
    execute format('alter role %I set log_min_duration_statement = %L',r,'-1');
    execute format('alter role %I set log_min_duration_sample = %L',r,'-1');
    execute format('alter role %I set log_statement_sample_rate = %L',r,'0');
    execute format('alter role %I set log_transaction_sample_rate = %L',r,'0');
    execute format('alter role %I set log_parameter_max_length = %L',r,'0');
    execute format('alter role %I set log_parameter_max_length_on_error = %L',r,'0');
    execute format('alter role %I set session_preload_libraries from current', r);
    execute format('alter role %I set local_preload_libraries from current', r);
    execute format('alter role %I set pg_stat_statements.track = %L',r,'none');
    execute format('alter role %I set statement_timeout = %L',r,'5s');
    execute format('alter role %I set idle_in_transaction_session_timeout = %L',r,'5s');
  end loop;
end;
$logging$;

create function public.go_http_test_identity(p_hold_ms integer default 0)
returns table("session_user" name,request_role name,uid uuid,backend_pid integer,logging_safe boolean)
language plpgsql stable security invoker set search_path='' as $identity$
begin
  if p_hold_ms < 0 or p_hold_ms > 200 then raise exception 'Invalid identity hold'; end if;
  perform pg_catalog.pg_sleep(p_hold_ms / 1000.0);
  return query select session_user,current_user,auth.uid(),pg_catalog.pg_backend_pid(),
    current_setting('log_statement')='none'
    and current_setting('log_min_messages')='fatal'
    and current_setting('log_min_error_statement')='panic'
    and current_setting('log_duration')='off'
    and current_setting('log_min_duration_statement')='-1'
    and current_setting('log_min_duration_sample')='-1'
    and current_setting('log_statement_sample_rate')::numeric=0
    and current_setting('log_transaction_sample_rate')::numeric=0
    and current_setting('log_parameter_max_length')='0'
    and current_setting('log_parameter_max_length_on_error')='0'
    and go_test_privacy.preloads_safe() is true
    and current_setting('pg_stat_statements.track',true)='none';
end;
$identity$;
revoke all on function public.go_http_test_identity(integer) from public,anon,authenticated,service_role;
grant execute on function public.go_http_test_identity(integer) to anon,authenticated,service_role;
commit;
