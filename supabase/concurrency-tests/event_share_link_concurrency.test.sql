-- Real sessions ONLY in a runner-owned empty disposable database. No DSN/credentials here.
begin;
do $$ begin perform test_runner.assert_target(); end; $$;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(16);
select lives_ok('select test_runner.assert_target()','runner-owned target verified');
select throws_ok($$update test_runner.ownership set run_id=repeat('0',32); select test_runner.assert_target();$$,'P0001',null,'wrong test-run ownership fails closed');
select throws_ok($$update test_runner.ownership set database_name='postgres'; select test_runner.assert_target();$$,'P0001',null,'development database identity rejected');
select throws_ok($$alter server share_concurrency options(set dbname 'postgres'); select test_runner.assert_target();$$,'P0001',null,'foreign connection target mismatch rejected');

create function pg_temp.share_link_concurrency()
returns setof text
language plpgsql
as $$
declare
  v_conn text := current_setting('test.share_dblink_server', true);
  v_create text := $q$select public.create_event_share_link(
    '6d100000-0000-4000-8000-000000000001', '6d500000-0000-4000-8000-000000000001',
    '6d800000-0000-4000-8000-000000000001', repeat('1',64),
    decode(repeat('ab',32),'hex'), decode(repeat('ef',12),'hex'),
    decode(repeat('cd',16),'hex'), 'test_key', 'concurrency_test', current_setting('test.share_expiry')::bigint,
 decode(current_setting('test.share_create_mac'),'hex'))$q$;
  v_rotate text := $q$select public.rotate_event_share_link(
    '6d100000-0000-4000-8000-000000000001', '6d500000-0000-4000-8000-000000000001',
    '6d800000-0000-4000-8000-000000000001', '6d800000-0000-4000-8000-000000000002',
    repeat('2',64), decode(repeat('ab',32),'hex'), decode(repeat('ed',12),'hex'),
    decode(repeat('cd',16),'hex'), 'test_key', 'concurrency_test', current_setting('test.share_expiry')::bigint,
 decode(current_setting('test.share_rotate_mac'),'hex'))$q$;
  v_cleanup text := $q$
    delete from public.guilds where id='6d100000-0000-4000-8000-000000000001';
    delete from auth.users where id='6d000000-0000-4000-8000-000000000001';
  $q$;
  v_id uuid;
  v_pid integer;
  v_error text;
  v_connection text;
  v_owns_fixture boolean := false;
begin
  perform test_runner.assert_target();
  perform extensions.dblink_connect('share_setup',v_conn);
  perform r.result from extensions.dblink('share_setup','select test_runner.assert_target()') as r(result text);
  -- Refuse to delete preexisting data even if a fixture identifier collides.
  if exists(select 1 from auth.users where id='6d000000-0000-4000-8000-000000000001')
    or exists(select 1 from public.guilds where id='6d100000-0000-4000-8000-000000000001') then
    raise exception 'concurrency fixture identity already exists';
  end if;
  perform extensions.dblink_exec('share_setup',$q$
    begin;
    insert into auth.users(id,email) values('6d000000-0000-4000-8000-000000000001','share-concurrency@test.local');
    insert into public.guilds(id,name,created_by) values('6d100000-0000-4000-8000-000000000001','Share concurrency fixture','6d000000-0000-4000-8000-000000000001');
    insert into public.guild_memberships(id,guild_id,user_id,role) values('6d110000-0000-4000-8000-000000000001','6d100000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000001','owner');
    insert into public.event_types(id,guild_id,name,status) values('6d300000-0000-4000-8000-000000000001','6d100000-0000-4000-8000-000000000001','League','active');
    insert into public.event_templates(id,guild_id,event_type_id,name,status) values('6d400000-0000-4000-8000-000000000001','6d100000-0000-4000-8000-000000000001','6d300000-0000-4000-8000-000000000001','League template','active');
    insert into public.events(id,guild_id,event_type_id,source_template_id,name) values('6d500000-0000-4000-8000-000000000001','6d100000-0000-4000-8000-000000000001','6d300000-0000-4000-8000-000000000001','6d400000-0000-4000-8000-000000000001','League Event');
    commit;
  $q$);
  v_owns_fixture := true;
  perform extensions.dblink_connect('share_a',v_conn);
  perform extensions.dblink_connect('share_b',v_conn);
  perform r.result from extensions.dblink('share_a','select test_runner.assert_target()') as r(result text);
  perform r.result from extensions.dblink('share_b','select test_runner.assert_target()') as r(result text);
  -- Settings contain test proofs, never connection secrets.
  perform extensions.dblink_exec('share_a',current_setting('test.share_proof_settings'));
  perform extensions.dblink_exec('share_b',current_setting('test.share_proof_settings'));
  perform extensions.dblink_exec('share_a',$q$set role authenticated; set request.jwt.claim.sub='6d000000-0000-4000-8000-000000000001'; set statement_timeout='5s';$q$);
  perform extensions.dblink_exec('share_b',$q$set role authenticated; set request.jwt.claim.sub='6d000000-0000-4000-8000-000000000001'; set statement_timeout='5s';$q$);
  select r.pid into v_pid from extensions.dblink('share_b','select pg_backend_pid()') as r(pid integer);

  perform extensions.dblink_exec('share_a','begin');
  select r.id into v_id from extensions.dblink('share_a',v_create) as r(id uuid);
  return next is(v_id,'6d800000-0000-4000-8000-000000000001'::uuid,'first concurrent creator succeeds');
  perform extensions.dblink_send_query('share_b',replace(replace(v_create,'6d800000-0000-4000-8000-000000000001','6d800000-0000-4000-8000-000000000009'),'test.share_create_mac','test.share_competing_create_mac'));
  for i in 1..200 loop
    exit when exists(select 1 from pg_stat_activity where pid=v_pid and wait_event_type='Lock');
    perform pg_sleep(0.01);
  end loop;
  return next ok(exists(select 1 from pg_stat_activity where pid=v_pid and wait_event_type='Lock'),'competing creator waits for Event transaction');
  perform extensions.dblink_exec('share_a','commit');
  perform r.id from extensions.dblink_get_result('share_b',false) as r(id uuid);
  v_error := extensions.dblink_error_message('share_b');
  perform r.id from extensions.dblink_get_result('share_b',false) as r(id uuid);
  return next ok(strpos(v_error,'Event already has an active share link')>0,'losing creator rejects committed winner');
  return next is((select count(*) from private.event_share_links where event_id='6d500000-0000-4000-8000-000000000001' and revoked_at is null),1::bigint,'concurrent creation leaves one active link');

  perform extensions.dblink_exec('share_a','begin');
  select r.id into v_id from extensions.dblink('share_a',v_rotate) as r(id uuid);
  return next is(v_id,'6d800000-0000-4000-8000-000000000002'::uuid,'first concurrent rotation succeeds');
  perform extensions.dblink_send_query('share_b',replace(replace(v_rotate,'6d800000-0000-4000-8000-000000000002','6d800000-0000-4000-8000-000000000003'),'test.share_rotate_mac','test.share_competing_rotate_mac'));
  for i in 1..200 loop
    exit when exists(select 1 from pg_stat_activity where pid=v_pid and wait_event_type='Lock');
    perform pg_sleep(0.01);
  end loop;
  return next ok(exists(select 1 from pg_stat_activity where pid=v_pid and wait_event_type='Lock'),'competing rotation waits for Event transaction');
  perform extensions.dblink_exec('share_a','commit');
  perform r.id from extensions.dblink_get_result('share_b',false) as r(id uuid);
  v_error := extensions.dblink_error_message('share_b');
  perform r.id from extensions.dblink_get_result('share_b',false) as r(id uuid);
  return next ok(strpos(v_error,'expected active share link is unavailable')>0,'losing rotation rejects stale expected link');
  return next is((select count(*) from private.event_share_links where event_id='6d500000-0000-4000-8000-000000000001' and revoked_at is null),1::bigint,'concurrent rotation leaves one active link');
  return next is((select count(*) from private.event_share_links where event_id='6d500000-0000-4000-8000-000000000001'),2::bigint,'losing rotation adds no partial link');
  perform r.result from extensions.dblink('share_b',$q$select public.revoke_event_share_link('6d100000-0000-4000-8000-000000000001','6d500000-0000-4000-8000-000000000001','6d800000-0000-4000-8000-000000000001')$q$) as r(result text);
  return next is((select id from private.event_share_links where event_id='6d500000-0000-4000-8000-000000000001' and revoked_at is null),'6d800000-0000-4000-8000-000000000002'::uuid,'late revocation of old link preserves replacement');

  perform extensions.dblink_exec('share_setup',v_cleanup);
  return next is((select count(*) from private.event_share_links where guild_id='6d100000-0000-4000-8000-000000000001'),0::bigint,'Guild deletion cascades active/revoked link records');
  return next is((select count(*) from auth.users where id='6d000000-0000-4000-8000-000000000001'),0::bigint,'committed concurrency fixture cleaned');
  foreach v_connection in array array['share_a','share_b','share_setup'] loop
    perform extensions.dblink_disconnect(v_connection);
  end loop;
exception when others then
  -- Every cleanup step is independent. The runner drops its verified database
  -- even if COMMIT succeeded without acknowledgement or cleanup cannot connect.
  if 'share_a'=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
    begin perform extensions.dblink_exec('share_a','rollback',false); exception when others then null; end;
  end if;
  if 'share_b'=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
    begin perform extensions.dblink_cancel_query('share_b'); exception when others then null; end;
    begin perform r.id from extensions.dblink_get_result('share_b',false) as r(id uuid); exception when others then null; end;
    begin perform r.id from extensions.dblink_get_result('share_b',false) as r(id uuid); exception when others then null; end;
  end if;
  if v_owns_fixture then
    begin perform extensions.dblink_exec('share_setup',v_cleanup); exception when others then null; end;
  end if;
  foreach v_connection in array array['share_a','share_b','share_setup'] loop
    if v_connection=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      begin perform extensions.dblink_disconnect(v_connection); exception when others then null; end;
    end if;
  end loop;
  raise;
end;
$$;

select * from pg_temp.share_link_concurrency();
select * from finish();
rollback;
