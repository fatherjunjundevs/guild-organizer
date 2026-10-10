-- Additive management-state contract; real roles and existing lifecycle RPCs.
-- All fixtures, including the synthetic attestation key, roll back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- The owned disposable runner supplies test-only pgTAP schema access.

select unnest(array[
  ok(p.prosecdef, 'management state uses the audited definer boundary'),
  is(p.proconfig, array['search_path=""']::text[], 'empty fixed search path'),
  is(p.provolatile, 's'::"char", 'read uses a stable statement snapshot'),
  is(pg_get_userbyid(p.proowner), 'postgres', 'trusted migration owner'),
  ok(not exists (select 1 from aclexplode(p.proacl) a where a.grantee=0
    and a.privilege_type='EXECUTE'), 'no PUBLIC execution'),
  ok(has_function_privilege('authenticated', p.oid, 'EXECUTE'), 'authenticated execution'),
  ok(not has_function_privilege('anon', p.oid, 'EXECUTE'), 'no anonymous execution'),
  ok(not has_function_privilege('service_role', p.oid, 'EXECUTE'), 'no service-role execution'),
  is(p.proargnames, array['p_guild_id','p_event_id','state','link_id','created_at','available']::text[],
    'only scoped inputs and four approved output fields'),
  is(pg_get_function_result(p.oid),
    'TABLE(state text, link_id uuid, created_at timestamp with time zone, available boolean)',
    'no credential, actor, or historical-record output')
]) from pg_proc p
where p.oid='public.get_event_share_link_management_state(uuid,uuid)'::regprocedure;
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_event_share_link_management_state'),
  1::bigint, 'no alternate selector overload');
select ok((select relrowsecurity from pg_class where oid='private.event_share_links'::regclass),
  'private-table RLS preserved');
select is((select count(*) from pg_policy where polrelid='private.event_share_links'::regclass),
  0::bigint, 'no direct-access policies');
select ok(not has_table_privilege(r,'private.event_share_links',p), r || ' lacks direct ' || p)
from unnest(array['anon','authenticated','service_role']) r
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;

insert into auth.users (id,email) values
  ('6e000000-0000-4000-8000-000000000001','state-owner-a@test.local'),
  ('6e000000-0000-4000-8000-000000000002','state-admin@test.local'),
  ('6e000000-0000-4000-8000-000000000003','state-publisher@test.local'),
  ('6e000000-0000-4000-8000-000000000004','state-events-only@test.local'),
  ('6e000000-0000-4000-8000-000000000005','state-member@test.local'),
  ('6e000000-0000-4000-8000-000000000006','state-owner-b@test.local'),
  ('6e000000-0000-4000-8000-000000000007','state-inactive@test.local');
insert into public.guilds (id,name,created_by) values
  ('6e100000-0000-4000-8000-000000000001','State Guild A','6e000000-0000-4000-8000-000000000001'),
  ('6e200000-0000-4000-8000-000000000001','State Guild B','6e000000-0000-4000-8000-000000000006');
insert into public.guild_memberships (id,guild_id,user_id,role) values
  ('6e110000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000001','owner'),
  ('6e110000-0000-4000-8000-000000000002','6e100000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000002','admin'),
  ('6e110000-0000-4000-8000-000000000003','6e100000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000003','officer'),
  ('6e110000-0000-4000-8000-000000000004','6e100000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000004','officer'),
  ('6e110000-0000-4000-8000-000000000005','6e100000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000005','member'),
  ('6e210000-0000-4000-8000-000000000001','6e200000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000006','owner'),
  ('6e110000-0000-4000-8000-000000000007','6e100000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000007','officer');
insert into public.guild_officer_capabilities (guild_id,membership_id,capability_key,granted_by) values
  ('6e100000-0000-4000-8000-000000000001','6e110000-0000-4000-8000-000000000003','publish.manage','6e000000-0000-4000-8000-000000000001'),
  ('6e100000-0000-4000-8000-000000000001','6e110000-0000-4000-8000-000000000004','events.manage','6e000000-0000-4000-8000-000000000001'),
  ('6e100000-0000-4000-8000-000000000001','6e110000-0000-4000-8000-000000000007','publish.manage','6e000000-0000-4000-8000-000000000001');
update public.guild_memberships set status='inactive' where id='6e110000-0000-4000-8000-000000000007';
insert into public.event_types (id,guild_id,name,status,created_by) values
  ('6e300000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001','League','active','6e000000-0000-4000-8000-000000000001');
insert into public.event_templates (id,guild_id,event_type_id,name,uses_areas,status,created_by) values
  ('6e400000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001','6e300000-0000-4000-8000-000000000001','State Template',false,'active','6e000000-0000-4000-8000-000000000001');
insert into public.events (id,guild_id,event_type_id,source_template_id,name,created_by,updated_by) values
  ('6e500000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001','6e300000-0000-4000-8000-000000000001','6e400000-0000-4000-8000-000000000001','State Event','6e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000001'),
  ('6e500000-0000-4000-8000-000000000002','6e100000-0000-4000-8000-000000000001','6e300000-0000-4000-8000-000000000001','6e400000-0000-4000-8000-000000000001','Never Shared','6e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000001');
insert into public.event_sections (id,guild_id,event_id,name,sort_order) values
  ('6e510000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001','Team',0);
insert into public.event_parties (id,guild_id,event_id,section_id,name,sort_order) values
  ('6e520000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001','6e510000-0000-4000-8000-000000000001','Party',0);
insert into public.event_slots (id,guild_id,event_id,party_id,name,sort_order) values
  ('6e530000-0000-4000-8000-000000000001','6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001','6e520000-0000-4000-8000-000000000001','Seat',0);

-- Synthetic SQL-only envelopes, as in the existing lifecycle suite. No live
-- secret or real recovery token is used; these helpers remain invoker functions.
insert into private.event_share_link_provisioning_keys (id,key_material,activated_at)
values ('state_sql_test',decode(repeat('a5',32),'hex'),clock_timestamp()-interval '1 hour');
create function pg_temp.link_id(n integer) returns uuid language sql immutable as $$
  select ('6e800000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.token(n integer) returns text language sql immutable as $$
  select 'v1.' || translate(rtrim(encode(extensions.digest('state-test-'||n,'sha256'),'base64'),'='),'+/','-_');
$$;
create function pg_temp.issue(n integer, previous uuid default null) returns uuid language plpgsql as $$
declare
  guild uuid := '6e100000-0000-4000-8000-000000000001';
  event uuid := '6e500000-0000-4000-8000-000000000001';
  link uuid := pg_temp.link_id(n);
  op text := case when previous is null then 'create' else 'rotate' end;
  digest text := encode(extensions.digest(pg_temp.token(n),'sha256'),'hex');
  cipher bytea := decode(repeat('ab',32),'hex');
  nonce bytea := substring(extensions.digest('state-nonce-'||n,'sha256') from 1 for 12);
  tag bytea := decode(repeat('cd',16),'hex');
  expiry bigint := floor(extract(epoch from clock_timestamp()))::bigint+60;
  mac bytea;
begin
  mac := extensions.hmac(convert_to(array_to_string(array[
    'go.share.provision.v1',op,auth.uid()::text,guild::text,event::text,link::text,
    coalesce(previous::text,'-'),digest,encode(cipher,'hex'),encode(nonce,'hex'),encode(tag,'hex'),
    'state_aes_test','state_sql_test',expiry::text],E'\n'),'UTF8'),decode(repeat('a5',32),'hex'),'sha256');
  if previous is null then
    return public.create_event_share_link(guild,event,link,digest,cipher,nonce,tag,'state_aes_test','state_sql_test',expiry,mac);
  end if;
  return public.rotate_event_share_link(guild,event,previous,link,digest,cipher,nonce,tag,'state_aes_test','state_sql_test',expiry,mac);
end;
$$;
create function pg_temp.check_state(expected text, n integer, resolves boolean, label text)
returns setof text language plpgsql as $check$
begin
  return next results_eq(
    $$select state,link_id,created_at is not null,available
      from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,
    format('values (%L::text,%L::uuid,%L::boolean,%L::boolean)',expected,pg_temp.link_id(n),n is not null,resolves),label);
  return next is((select array_agg(k order by k)
    from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001') r
    cross join lateral jsonb_object_keys(to_jsonb(r)) k),
    array['available','created_at','link_id','state']::text[],label || ': only approved wire fields');
end;
$check$;

set local role authenticated;
set local request.jwt.claim.sub='6e000000-0000-4000-8000-000000000001';
select throws_ok($$select * from public.resolve_event_share_link('malformed')$$,'42501',null,'Owner denied direct resolver execution');
select * from pg_temp.check_state('absent',null,false,'Owner reads never-created Event');
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000099')$$,'P0002',null,'missing Event rejected');
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001',null)$$,'P0002',null,'null Event rejected');
select is(pg_temp.issue(1),pg_temp.link_id(1),'existing create provisions first link');
select * from pg_temp.check_state('active',1,false,'new link before publication is active but unavailable');
select is((select link_id from public.get_event_share_link_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')),pg_temp.link_id(1),'legacy active state preserved');
select is((select count(*) from public.get_event_share_link_copy_payload('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001',pg_temp.link_id(1))),1::bigint,'existing copy contract still available');

set local request.jwt.claim.sub='6e000000-0000-4000-8000-000000000002';
select throws_ok($$select * from public.resolve_event_share_link('malformed')$$,'42501',null,'Admin denied direct resolver execution');
select * from pg_temp.check_state('active',1,false,'Admin reads active state');
set local request.jwt.claim.sub='6e000000-0000-4000-8000-000000000003';
select throws_ok($$select * from public.resolve_event_share_link('malformed')$$,'42501',null,'publish.manage Officer denied direct resolver execution');
select * from pg_temp.check_state('active',1,false,'publish.manage-only Officer reads active state');
select throws_ok($$select * from private.event_share_links$$,'42501',null,'publisher cannot read link history directly');
select lives_ok($$select public.publish_event('6e500000-0000-4000-8000-000000000001')$$,'existing publication RPC succeeds');
select * from pg_temp.check_state('active',1,true,'published active link is available');
reset role;
set local role go_event_share_resolver;
select is((select count(*) from public.resolve_event_share_link(pg_temp.token(1))),1::bigint,'resolver agrees with available state');
reset role;
set local role authenticated;
reset role;
select is((select created_at from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')),
  (select created_at from private.event_share_links where id=pg_temp.link_id(1)), 'exact active creation timestamp');
select set_config('test.state.sealed_before',(select jsonb_agg(to_jsonb(v) order by v.id)::text
  from public.event_publication_versions v where v.event_id='6e500000-0000-4000-8000-000000000001'),true);
set local role authenticated;
select lives_ok($$select public.unpublish_event('6e500000-0000-4000-8000-000000000001')$$,'existing unpublish RPC succeeds');
select * from pg_temp.check_state('active',1,false,'unpublished link retains identity without availability');
reset role;
set local role go_event_share_resolver;
select is((select count(*) from public.resolve_event_share_link(pg_temp.token(1))),0::bigint,'unpublished bearer cannot resolve');
reset role;
set local role authenticated;
select lives_ok($$select public.revoke_event_share_link('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001',pg_temp.link_id(1))$$,'existing revoke succeeds');
select * from pg_temp.check_state('revoked',null,false,'revoked differs from absent and unpublished active');
select is((select link_id from public.get_event_share_link_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')),null::uuid,'legacy revoked state remains unchanged');
select is(pg_temp.issue(2),pg_temp.link_id(2),'fresh link after revocation');
select * from pg_temp.check_state('active',2,false,'active takes precedence over revoked history');
select is(pg_temp.issue(3,pg_temp.link_id(2)),pg_temp.link_id(3),'existing rotation succeeds');
select * from pg_temp.check_state('active',3,false,'active takes precedence over multiple historical revocations');
select lives_ok($$select public.revoke_event_share_link('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001',pg_temp.link_id(3))$$,'revoke replacement');
select * from pg_temp.check_state('revoked',null,false,'multiple revoked records expose no history');
select ok((select state='absent' and link_id is null and created_at is null and not available
  from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000002')),'history is scoped to this exact Event');
select is(pg_temp.issue(4),pg_temp.link_id(4),'new active link after multiple revocations');
select lives_ok($$select public.publish_event('6e500000-0000-4000-8000-000000000001')$$,'republish retains sharing compatibility');
select * from pg_temp.check_state('active',4,true,'fresh active bearer resolves republished Event');

-- Archived Events are readable; an unrevoked identity stays active, unavailable.
reset role;
update public.events set status='archived' where guild_id='6e100000-0000-4000-8000-000000000001';
set local role authenticated;
select * from pg_temp.check_state('active',4,false,'archived Event retains active identity but cannot resolve');
reset role;
set local role go_event_share_resolver;
select is((select count(*) from public.resolve_event_share_link(pg_temp.token(4))),0::bigint,'resolver agrees for archived Event');
reset role;
set local role authenticated;
select ok((select state='absent' and not available from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000002')),'archived never-created Event remains absent');
select lives_ok($$select public.revoke_event_share_link('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001',pg_temp.link_id(4))$$,'archived Event can still revoke');
select * from pg_temp.check_state('revoked',null,false,'archived revoked Event remains readable');

-- Actual authenticated JWT identities, including an authorized foreign Guild.
set local request.jwt.claim.sub='6e000000-0000-4000-8000-000000000004';
select throws_ok($$select * from public.resolve_event_share_link('malformed')$$,'42501',null,'events.manage Officer denied direct resolver execution');
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'42501',null,'events.manage-only Officer denied');
set local request.jwt.claim.sub='6e000000-0000-4000-8000-000000000005';
select throws_ok($$select * from public.resolve_event_share_link('malformed')$$,'42501',null,'Member denied direct resolver execution');
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'42501',null,'Member denied');
set local request.jwt.claim.sub='6e000000-0000-4000-8000-000000000007';
select throws_ok($$select * from public.resolve_event_share_link('malformed')$$,'42501',null,'inactive Officer denied direct resolver execution');
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'42501',null,'inactive publish.manage Officer denied');
set local request.jwt.claim.sub='6e000000-0000-4000-8000-000000000006';
select throws_ok($$select * from public.resolve_event_share_link('malformed')$$,'42501',null,'foreign Owner denied direct resolver execution');
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'42501',null,'foreign Guild Owner denied');
select throws_ok($$select * from public.get_event_share_link_management_state('6e200000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'P0002',null,'authorized Guild cannot select another Guild Event');
set local request.jwt.claim.sub='';
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'42501',null,'authenticated role without user denied');
reset role;
set local role anon;
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous invocation denied');
reset role;
set local role service_role;
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'42501',null,'service-role invocation denied');
reset role;
update public.guilds set status='archived' where id='6e100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='6e000000-0000-4000-8000-000000000001';
select throws_ok($$select * from public.get_event_share_link_management_state('6e100000-0000-4000-8000-000000000001','6e500000-0000-4000-8000-000000000001')$$,'55000',null,'inactive Guild management denied');
reset role;
select is((select count(*) from private.event_share_links where event_id='6e500000-0000-4000-8000-000000000001'),4::bigint,'state reads never delete historical links');
select is((select count(*) from public.event_publication_versions where event_id='6e500000-0000-4000-8000-000000000001'),2::bigint,'only explicit publications create versions');
select is((select jsonb_agg(to_jsonb(v) order by v.id)::text from public.event_publication_versions v
  where v.event_id='6e500000-0000-4000-8000-000000000001' and v.version_number=1),
  current_setting('test.state.sealed_before'),'sealed version unchanged by management reads and lifecycle changes');
select * from finish();
rollback;
