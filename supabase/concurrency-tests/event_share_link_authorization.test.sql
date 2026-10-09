-- Only the ownership-verified disposable runner may execute committed fixtures.
begin;
do $$ begin perform test_runner.assert_target(); end; $$;
select no_plan();
select ok((select provolatile='v' and prosecdef and proowner='postgres'::regrole
  from pg_proc where oid='private.lock_event_share_link_authority(uuid)'::regprocedure),
  'authority guard is VOLATILE SECURITY DEFINER and owned by postgres');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid='private.lock_event_share_link_authority(uuid)'::regprocedure),'authority guard has empty search path');
select ok(not has_function_privilege('authenticated','private.lock_event_share_link_authority(uuid)','EXECUTE')
  and not has_function_privilege('anon','private.lock_event_share_link_authority(uuid)','EXECUTE')
  and not has_function_privilege('service_role','private.lock_event_share_link_authority(uuid)','EXECUTE'),
  'authority guard cannot be called by application roles');
select is((select count(*) from pg_proc where oid in ('public.create_event_share_link(uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea)'::regprocedure,
  'public.rotate_event_share_link(uuid,uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea)'::regprocedure,
  'public.revoke_event_share_link(uuid,uuid,uuid)'::regprocedure) and provolatile='v'),3::bigint,
  'all three existing mutation signatures remain VOLATILE');

-- Generate valid actor/scope-bound provisioning proofs in the trusted test
-- session. Production TypeScript AES/HMAC interoperability runs separately in
-- this same guarded workflow. No raw bearer token is needed by these races.
create function pg_temp.authority_call(p_operation text,
  p_event uuid default '6f500000-0000-4000-8000-000000000001',
  p_link uuid default '6f800000-0000-4000-8000-000000000002',
  p_expiry bigint default null,
  p_actor uuid default '6f000000-0000-4000-8000-000000000002')
returns text language plpgsql volatile as $$
declare
  v_guild uuid := '6f100000-0000-4000-8000-000000000001';
  v_old uuid := '6f800000-0000-4000-8000-000000000001';
  v_expiry bigint := coalesce(p_expiry,floor(extract(epoch from clock_timestamp()))::bigint+60);
  v_digest text := encode(extensions.digest(p_link::text,'sha256'),'hex');
  v_cipher text := repeat('ab',32);
  v_nonce text := repeat('ef',12);
  v_tag text := repeat('cd',16);
  v_mac bytea;
  v_args text;
begin
  perform test_runner.assert_target();
  if p_operation='revoke' then
    return format('select public.revoke_event_share_link(%L::uuid,%L::uuid,%L::uuid)',v_guild,p_event,v_old);
  end if;
  if p_operation not in ('create','rotate') then raise exception 'invalid test operation'; end if;
  select extensions.hmac(convert_to(array_to_string(array['go.share.provision.v1',p_operation,p_actor::text,
    v_guild::text,p_event::text,p_link::text,case when p_operation='rotate' then v_old::text else '-' end,
    v_digest,v_cipher,v_nonce,v_tag,'test_key','concurrency_test',v_expiry::text],E'\n'),'UTF8'),k.key_material,'sha256')
  into v_mac from private.event_share_link_provisioning_keys k where k.id='concurrency_test';
  v_args := format('%L::uuid,%L::uuid,',v_guild,p_event);
  if p_operation='rotate' then v_args:=v_args||format('%L::uuid,',v_old); end if;
  return format('select public.%I(%s%L::uuid,%L,%L::bytea,%L::bytea,%L::bytea,%L,%L,%L::bigint,%L::bytea)',
    p_operation||'_event_share_link',v_args,p_link,v_digest,'\x'||v_cipher,'\x'||v_nonce,'\x'||v_tag,
    'test_key','concurrency_test',v_expiry,'\x'||encode(v_mac,'hex'));
end;
$$;

create function pg_temp.authority_snapshot() returns jsonb language sql volatile as $$
  select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb)
  from private.event_share_links l where l.guild_id='6f100000-0000-4000-8000-000000000001';
$$;

create function pg_temp.authority_result(p_connection text,p_query text) returns text language plpgsql volatile as $$
declare v_result text;
begin
  select r.result into v_result from extensions.dblink(p_connection,
    format('select pg_temp.capture_mutation(%L)',p_query)) as r(result text);
  return v_result;
end;
$$;

create function pg_temp.authority_waits(p_waiter integer,p_blocker integer) returns boolean language plpgsql volatile as $$
begin
  for i in 1..300 loop
    if p_blocker=any(pg_blocking_pids(p_waiter)) then return true; end if;
    perform pg_sleep(0.01);
  end loop;
  return false;
end;
$$;

create function pg_temp.authority_finish(p_connection text) returns text language plpgsql volatile as $$
declare v_result text;
begin
  select r.result into v_result from extensions.dblink_get_result(p_connection) as r(result text);
  -- Drain libpq's terminal result before the next command.
  perform r.result from extensions.dblink_get_result(p_connection) as r(result text);
  return v_result;
end;
$$;

create function pg_temp.authority_reset(p_seed boolean) returns void language plpgsql volatile as $$
begin
  perform test_runner.assert_target();
  perform extensions.dblink_exec('authority_setup',$q$
    delete from private.event_share_links where guild_id='6f100000-0000-4000-8000-000000000001';
    update public.guilds set status='active' where id='6f100000-0000-4000-8000-000000000001';
    update public.capability_definitions set is_active=true where capability_key='publish.manage';
    update public.guild_memberships set role='officer',status='active' where id='6f110000-0000-4000-8000-000000000002';
    insert into public.guild_officer_capabilities(guild_id,membership_id,capability_key)
    values('6f100000-0000-4000-8000-000000000001','6f110000-0000-4000-8000-000000000002','publish.manage') on conflict do nothing;
  $q$);
  if p_seed then
    if pg_temp.authority_result('authority_mutator',pg_temp.authority_call('create',p_link=>'6f800000-0000-4000-8000-000000000001'))<>'ok' then
      raise exception 'authorization seed failed';
    end if;
  end if;
end;
$$;

create function pg_temp.share_authority_concurrency() returns setof text language plpgsql volatile as $$
declare
  v_conn text := current_setting('test.share_dblink_server');
  v_name text;
  v_change text;
  v_operation text;
  v_query text;
  v_snapshot jsonb;
  v_blocker integer;
  v_mutator integer;
  v_revoker integer;
  v_result text;
  v_expiry bigint;
  v_release text;
  v_isolation text;
  v_owns boolean := false;
begin
  perform test_runner.assert_target();
  foreach v_name in array array['authority_setup','authority_blocker','authority_mutator','authority_revoker'] loop
    perform extensions.dblink_connect(v_name,v_conn);
    perform r.result from extensions.dblink(v_name,'select test_runner.assert_target()') as r(result text);
    perform extensions.dblink_exec(v_name,$q$
      set log_statement='none'; set log_min_error_statement='panic';
      set log_parameter_max_length=0; set log_parameter_max_length_on_error=0;
      set statement_timeout='15s';
      create function pg_temp.capture_mutation(p_sql text) returns text language plpgsql volatile as $capture$
      begin execute p_sql; return 'ok'; exception when others then return SQLSTATE; end; $capture$;
    $q$);
  end loop;
  if exists(select 1 from public.guilds where id='6f100000-0000-4000-8000-000000000001')
    or exists(select 1 from auth.users where id in ('6f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000002')) then
    raise exception 'authorization fixture collision';
  end if;
  perform extensions.dblink_exec('authority_setup',$q$
    begin;
    insert into auth.users(id,email) values('6f000000-0000-4000-8000-000000000001','authority-owner@test.local'),
      ('6f000000-0000-4000-8000-000000000002','authority-officer@test.local');
    insert into public.guilds(id,name,created_by) values('6f100000-0000-4000-8000-000000000001','Authority fixture','6f000000-0000-4000-8000-000000000001');
    insert into public.guild_memberships(id,guild_id,user_id,role) values
      ('6f110000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001','owner'),
      ('6f110000-0000-4000-8000-000000000002','6f100000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000002','officer');
    insert into public.event_types(id,guild_id,name,status) values('6f300000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','League','active');
    insert into public.event_templates(id,guild_id,event_type_id,name,status) values('6f400000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f300000-0000-4000-8000-000000000001','Template','active');
    insert into public.events(id,guild_id,event_type_id,source_template_id,name) values
      ('6f500000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f300000-0000-4000-8000-000000000001','6f400000-0000-4000-8000-000000000001','First'),
      ('6f500000-0000-4000-8000-000000000002','6f100000-0000-4000-8000-000000000001','6f300000-0000-4000-8000-000000000001','6f400000-0000-4000-8000-000000000001','Second');
    commit;
  $q$);
  v_owns:=true;
  perform extensions.dblink_exec('authority_mutator',$q$set role authenticated; set request.jwt.claim.sub='6f000000-0000-4000-8000-000000000002';$q$);
  perform extensions.dblink_exec('authority_revoker',$q$set role authenticated; set request.jwt.claim.sub='6f000000-0000-4000-8000-000000000001';$q$);
  select r.pid into v_blocker from extensions.dblink('authority_blocker','select pg_backend_pid()') as r(pid integer);
  select r.pid into v_mutator from extensions.dblink('authority_mutator','select pg_backend_pid()') as r(pid integer);
  select r.pid into v_revoker from extensions.dblink('authority_revoker','select pg_backend_pid()') as r(pid integer);

  foreach v_operation in array array['create','rotate','revoke'] loop
    foreach v_change in array array['capability','membership status','membership role','Guild status','capability definition'] loop
      perform pg_temp.authority_reset(v_operation<>'create');
      v_query:=pg_temp.authority_call(v_operation); v_snapshot:=pg_temp.authority_snapshot();
      perform extensions.dblink_exec('authority_blocker','begin');
      perform r.id from extensions.dblink('authority_blocker',$q$select id from public.events where id='6f500000-0000-4000-8000-000000000001' for update$q$) as r(id uuid);
      perform extensions.dblink_send_query('authority_mutator',format('select pg_temp.capture_mutation(%L)',v_query));
      return next ok(pg_temp.authority_waits(v_mutator,v_blocker),v_operation||' waits for Event before '||v_change||' revocation');
      if v_change='capability' then
        v_query:=$q$select public.revoke_officer_capability('6f110000-0000-4000-8000-000000000002','publish.manage')$q$;
      elsif v_change='membership status' then
        v_query:=$q$select public.set_guild_membership_status('6f110000-0000-4000-8000-000000000002','inactive')$q$;
      elsif v_change='membership role' then
        v_query:=$q$select public.set_guild_membership_role('6f110000-0000-4000-8000-000000000002','member')$q$;
      elsif v_change='Guild status' then
        v_query:=$q$update public.guilds set status='archived' where id='6f100000-0000-4000-8000-000000000001'$q$;
      else
        v_query:=$q$update public.capability_definitions set is_active=false where capability_key='publish.manage'$q$;
      end if;
      -- Guild/catalog changes have no ordinary management RPC; exercise their
      -- actual privileged UPDATE in session C, not in the mutator transaction.
      if v_change in ('Guild status','capability definition') then perform extensions.dblink_exec('authority_revoker','reset role'); end if;
      return next is(pg_temp.authority_result('authority_revoker',v_query),'ok',v_change||' revocation commits while '||v_operation||' waits');
      perform extensions.dblink_exec('authority_revoker','set role authenticated');
      perform extensions.dblink_exec('authority_blocker','commit');
      return next is(pg_temp.authority_finish('authority_mutator'),case when v_change='Guild status' then '55000' else '42501' end,
        v_operation||' rejects committed '||v_change||' revocation after Event wait');
      return next is(pg_temp.authority_snapshot(),v_snapshot,v_operation||' leaves every link field unchanged after '||v_change||' denial');
    end loop;
  end loop;

  foreach v_operation in array array['create','rotate','revoke'] loop
    perform pg_temp.authority_reset(v_operation<>'create'); v_snapshot:=pg_temp.authority_snapshot();
    perform extensions.dblink_exec('authority_revoker','begin');
    return next is(pg_temp.authority_result('authority_revoker',$q$select public.revoke_officer_capability('6f110000-0000-4000-8000-000000000002','publish.manage')$q$),'ok',v_operation||' setup revocation holds authority lock');
    return next is(pg_temp.authority_result('authority_mutator',pg_temp.authority_call(v_operation)),'55P03',v_operation||' fails closed without waiting behind revocation');
    return next is(pg_temp.authority_snapshot(),v_snapshot,v_operation||' contention leaves link unchanged');
    perform extensions.dblink_exec('authority_revoker','rollback');
    return next ok(exists(select 1 from public.guild_officer_capabilities where membership_id='6f110000-0000-4000-8000-000000000002' and capability_key='publish.manage'),v_operation||' rolled-back revocation retains capability');
  end loop;

  foreach v_query in array array[
    $q$select id from public.guilds where id='6f100000-0000-4000-8000-000000000001' for update$q$,
    $q$select capability_key from public.capability_definitions where capability_key='publish.manage' for update$q$,
    $q$select id from public.profiles where id='6f000000-0000-4000-8000-000000000002' for update$q$,
    $q$select capability_key from public.guild_officer_capabilities where membership_id='6f110000-0000-4000-8000-000000000002' for update$q$
  ] loop
    perform pg_temp.authority_reset(false); v_snapshot:=pg_temp.authority_snapshot();
    perform extensions.dblink_exec('authority_blocker','begin');
    perform r.value from extensions.dblink('authority_blocker',v_query) as r(value text);
    return next is(pg_temp.authority_result('authority_mutator',pg_temp.authority_call('create')),'55P03','Guild/catalog/profile/direct-grant contention fails closed');
    return next is(pg_temp.authority_snapshot(),v_snapshot,'contending authority record causes no write');
    perform extensions.dblink_exec('authority_blocker','rollback');
  end loop;

  foreach v_operation in array array['create','rotate','revoke'] loop
   foreach v_release in array array['commit','rollback'] loop
    perform pg_temp.authority_reset(v_operation<>'create'); v_snapshot:=pg_temp.authority_snapshot();
    perform extensions.dblink_exec('authority_mutator','begin');
    return next is(pg_temp.authority_result('authority_mutator',pg_temp.authority_call(v_operation)),'ok','READ COMMITTED '||v_operation||' retains authority locks until '||v_release);
    perform extensions.dblink_send_query('authority_revoker',$q$select pg_temp.capture_mutation('select public.revoke_officer_capability(''6f110000-0000-4000-8000-000000000002'',''publish.manage'')')$q$);
    return next ok(pg_temp.authority_waits(v_revoker,v_mutator),'revocation waits behind '||v_operation||' authority locks before '||v_release);
    perform extensions.dblink_exec('authority_mutator',v_release);
    return next is(pg_temp.authority_finish('authority_revoker'),'ok','revocation proceeds after mutation '||v_release);
    return next is(pg_temp.authority_snapshot() is distinct from v_snapshot,v_release='commit',v_operation||' '||v_release||' has the expected durable link change');
   end loop;
  end loop;

  perform pg_temp.authority_reset(false);
  perform extensions.dblink_exec('authority_mutator','begin');
  return next is(pg_temp.authority_result('authority_mutator',pg_temp.authority_call('create')),'ok','first Event mutation holds compatible shared authority locks');
  perform extensions.dblink_exec('authority_revoker',$q$set request.jwt.claim.sub='6f000000-0000-4000-8000-000000000002';$q$);
  return next is(pg_temp.authority_result('authority_revoker',pg_temp.authority_call('create',p_event=>'6f500000-0000-4000-8000-000000000002',p_link=>'6f800000-0000-4000-8000-000000000003')),'ok','same Officer different Event mutation succeeds while first remains uncommitted');
  perform extensions.dblink_exec('authority_revoker',$q$set request.jwt.claim.sub='6f000000-0000-4000-8000-000000000001';$q$);
  return next is(cardinality(pg_blocking_pids(v_revoker)),0,'different Event caller has no database blockers');
  perform extensions.dblink_exec('authority_mutator','commit');
  return next is((select count(*) from private.event_share_links where guild_id='6f100000-0000-4000-8000-000000000001' and revoked_at is null),2::bigint,'both Events retain active links');

  foreach v_isolation in array array['repeatable read','serializable'] loop
    foreach v_operation in array array['create','rotate','revoke'] loop
      perform pg_temp.authority_reset(v_operation<>'create'); v_snapshot:=pg_temp.authority_snapshot();
      perform extensions.dblink_exec('authority_mutator','begin isolation level '||v_isolation);
      return next is(pg_temp.authority_result('authority_mutator',pg_temp.authority_call(v_operation)),'0A000',v_operation||' fails closed under '||v_isolation);
      perform extensions.dblink_exec('authority_mutator','rollback');
      return next is(pg_temp.authority_snapshot(),v_snapshot,v_operation||' unsupported isolation preserves link');
    end loop;
  end loop;

  foreach v_operation in array array['create','rotate'] loop
    perform pg_temp.authority_reset(v_operation<>'create'); v_snapshot:=pg_temp.authority_snapshot();
    v_expiry:=floor(extract(epoch from clock_timestamp()))::bigint+1;
    v_query:=pg_temp.authority_call(v_operation,p_expiry=>v_expiry);
    perform extensions.dblink_exec('authority_blocker','begin');
    perform r.id from extensions.dblink('authority_blocker',$q$select id from public.events where id='6f500000-0000-4000-8000-000000000001' for update$q$) as r(id uuid);
    perform extensions.dblink_send_query('authority_mutator',format('select pg_temp.capture_mutation(%L)',v_query));
    return next ok(pg_temp.authority_waits(v_mutator,v_blocker),v_operation||' valid proof reaches Event wait before expiry');
    -- Observe actual database time crossing the existing five-second tolerance.
    while extract(epoch from clock_timestamp())<=v_expiry+5 loop perform pg_sleep(0.02); end loop;
    perform extensions.dblink_exec('authority_blocker','commit');
    return next is(pg_temp.authority_finish('authority_mutator'),'42501',v_operation||' expired proof rejected after Event wait');
    return next is(pg_temp.authority_snapshot(),v_snapshot,v_operation||' expired proof leaves link unchanged');
  end loop;

  -- Committed fixture teardown is exact-ID only, in the verified disposable DB.
  perform extensions.dblink_exec('authority_setup',$q$
    update public.capability_definitions set is_active=true where capability_key='publish.manage';
    delete from public.guilds where id='6f100000-0000-4000-8000-000000000001';
    delete from auth.users where id in ('6f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000002');
  $q$);
  foreach v_name in array array['authority_setup','authority_blocker','authority_mutator','authority_revoker'] loop
    perform extensions.dblink_disconnect(v_name);
  end loop;
exception when others then
  -- Any failed/suspended session is disconnected before exact fixture cleanup.
  foreach v_name in array array['authority_blocker','authority_mutator','authority_revoker'] loop
    if v_name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      begin perform extensions.dblink_disconnect(v_name); exception when others then null; end;
    end if;
  end loop;
  if v_owns and 'authority_setup'=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
    begin perform extensions.dblink_exec('authority_setup',$q$
      update public.capability_definitions set is_active=true where capability_key='publish.manage';
      delete from public.guilds where id='6f100000-0000-4000-8000-000000000001';
      delete from auth.users where id in ('6f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000002');
    $q$); exception when others then null; end;
  end if;
  raise;
end;
$$;
select * from pg_temp.share_authority_concurrency();
select * from finish();
rollback;
