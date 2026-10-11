-- Only the owned Work Package B coordinator supplies this private dblink server.
select no_plan();
select extensions.dblink_connect('viewer','go_public_lineup');
select extensions.dblink_exec('viewer','set role go_event_share_resolver');
select ok((select safe from extensions.dblink('viewer',
 'select go_event_share_private.connection_private() is true') as x(safe boolean)),
 'fresh reader backend proves effective privacy before any bearer submission');
create temporary table viewer_backend as
select pid from extensions.dblink('viewer','select pg_catalog.pg_backend_pid()') as x(pid integer);
create function pg_temp.wait_for_reader_sleep() returns boolean language plpgsql as $$
declare deadline timestamptz := clock_timestamp()+interval '3 seconds';
begin
 loop
  perform pg_stat_clear_snapshot();
  if exists(select 1 from pg_stat_activity where pid=(select pid from viewer_backend)
    and usename='go_event_share_reader' and datname=current_database() and wait_event='PgSleep') then return true; end if;
  if clock_timestamp()>=deadline then return false; end if;
  perform pg_sleep(0.01);
 end loop;
end;
$$;
select extensions.dblink_send_query('viewer',
 $$select go_event_share_private.resolve_lineup('v1.'||repeat('A',43),null,0,'') from pg_catalog.pg_sleep(1)$$);
select ok(pg_temp.wait_for_reader_sleep(),'reader query started before republish commit');
update public.events set name='Republished Event' where id='6b500000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','6b000000-0000-4000-8000-000000000001',false);
select public.update_event_publication('6b500000-0000-4000-8000-000000000001');
reset role;
create temporary table initial_read as
select lineup from extensions.dblink_get_result('viewer') as x(lineup jsonb);
select * from extensions.dblink_get_result('viewer') as x(lineup jsonb);
select is((select lineup->>'version' from initial_read),'1','in-flight read has one consistent prior version');
select is((select lineup->>'eventName' from initial_read),'HTTP published event','prior version never mixes draft/new names');
select is((select lineup->'cards'->0->'slots'->0->>'ign' from initial_read),'Published Hero','in-flight assignment remains sealed');
select is((select lineup->>'status' from extensions.dblink('viewer',
 $$select go_event_share_private.resolve_lineup('v1.'||repeat('A',43),1,0,'')$$) as x(lineup jsonb)),
 'updated','next query rejects stale pagination version');
select extensions.dblink_send_query('viewer',
 $$select go_event_share_private.resolve_lineup('v1.'||repeat('A',43),null,0,'') from pg_catalog.pg_sleep(1)$$);
select ok(pg_temp.wait_for_reader_sleep(),'reader query started before revoke commit');
set role authenticated;
select public.revoke_event_share_link('6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001','6b800000-0000-4000-8000-000000000001');
reset role;
create temporary table prior_revoke as
select lineup from extensions.dblink_get_result('viewer') as x(lineup jsonb);
select * from extensions.dblink_get_result('viewer') as x(lineup jsonb);
select is((select lineup->>'version' from prior_revoke),'2','read begun before revoke is one authorized MVCC snapshot');
select ok((select lineup is null from extensions.dblink('viewer',
 $$select go_event_share_private.resolve_lineup('v1.'||repeat('A',43),null,0,'')$$) as x(lineup jsonb)),
 'read after committed revoke is unavailable');
select extensions.dblink_disconnect('viewer');
select * from finish();
