begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- New synthetic records only; the host verifies the empty owned database first.
insert into auth.users(id,email) values
('6b000000-0000-4000-8000-000000000001','http-owner@test.local'),
('6b000000-0000-4000-8000-000000000002','http-member@test.local');
insert into public.guilds(id,name,created_by) values
('6b100000-0000-4000-8000-000000000001','HTTP synthetic Guild','6b000000-0000-4000-8000-000000000001');
insert into public.guild_memberships(id,guild_id,user_id,role) values
('6b110000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6b000000-0000-4000-8000-000000000001','owner'),
('6b110000-0000-4000-8000-000000000002','6b100000-0000-4000-8000-000000000001','6b000000-0000-4000-8000-000000000002','member');
insert into public.event_types(id,guild_id,name,status) values
('6b300000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','HTTP League','active');
insert into public.event_templates(id,guild_id,event_type_id,name,status) values
('6b400000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6b300000-0000-4000-8000-000000000001','HTTP template','active');
insert into public.events(id,guild_id,event_type_id,source_template_id,name,description) values
('6b500000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6b300000-0000-4000-8000-000000000001','6b400000-0000-4000-8000-000000000001','HTTP published event','PRIVATE_HTTP_DRAFT_CANARY');
insert into public.event_sections(id,guild_id,event_id,name,sort_order) values
('6b510000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001','HTTP Team',0);
insert into public.event_parties(id,guild_id,event_id,section_id,name,sort_order) values
('6b520000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001','6b510000-0000-4000-8000-000000000001','HTTP Party',0);
insert into public.event_slots(id,guild_id,event_id,party_id,name,sort_order) values
('6b530000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001','6b520000-0000-4000-8000-000000000001','HTTP Seat',0);
insert into public.characters(id,guild_id,ign,class_name,status,source_origin,created_by) values
('6b600000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','Published Hero','Knight','active','manual','6b000000-0000-4000-8000-000000000001');
insert into public.event_assignments(guild_id,event_id,slot_id,character_id) values
('6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001','6b530000-0000-4000-8000-000000000001','6b600000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='6b000000-0000-4000-8000-000000000001';
select public.publish_event('6b500000-0000-4000-8000-000000000001');
reset role;
insert into private.event_share_links(id,guild_id,event_id,token_digest,token_ciphertext,token_nonce,token_auth_tag,encryption_key_id,created_by)
values('6b800000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001',
encode(extensions.digest('v1.'||repeat('A',43),'sha256'),'hex'),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'test_key','6b000000-0000-4000-8000-000000000001');
create function pg_temp.lineup(p_search text default '', p_page int default 0,p_version int default null) returns jsonb language sql as $$
select go_event_share_private.resolve_lineup('v1.'||repeat('A',43),p_version,p_page,p_search);
$$;
-- Public display regression assertions. The owned race runner reuses only the
-- preceding synthetic setup, inside its verified empty disposable database.
select is(pg_temp.lineup()->>'status','ready','valid current published token');
select is(pg_temp.lineup()->>'eventName','HTTP published event','sealed Event display name');
select is(pg_temp.lineup()->'cards'->0->'slots'->0->>'ign','Published Hero','sealed IGN');
select is(pg_temp.lineup()->>'version','1','first publication');
select is(pg_temp.lineup('hErO')->>'matchedCards','1','case insensitive literal IGN search');
select is(pg_temp.lineup('%')->>'matchedCards','0','search is not a SQL wildcard');
select is(pg_temp.lineup('',1)->'cards','[]'::jsonb,'bounded page after end');
select is(pg_temp.lineup('',0,2)->>'status','updated','version is not a historical selector');
select ok(go_event_share_private.resolve_lineup('invalid',null,0,'') is null,'invalid token unavailable');
select ok(go_event_share_private.resolve_lineup('v1.'||repeat('A',42)||'B',null,0,'') is null,'noncanonical base64url tail unavailable');
select ok(pg_temp.lineup('',-1) is null and pg_temp.lineup('',417) is null,'page bounds');
select ok(pg_temp.lineup(repeat('x',81)) is null,'search length bound');
select ok(pg_temp.lineup(E'\n') is null,'search control characters denied');
select ok(not (pg_temp.lineup()::text ~ '(6b[0-9a-f-]{34}|PRIVATE_HTTP|created_by|designation|source_character|ciphertext|digest|notes|description)'),
 'public DTO excludes IDs, private fields and cryptographic material');
set local role authenticated;
select public.update_roster_character('6b600000-0000-4000-8000-000000000001','PRIVATE_LIVE_ROSTER',null,'PRIVATE_LIVE_CLASS',null,null,null,null,null,null,null,null);
reset role;
update public.events set name='PRIVATE_DRAFT_NAME' where id='6b500000-0000-4000-8000-000000000001';
select is(pg_temp.lineup()->'cards'->0->'slots'->0->>'ign','Published Hero','live roster change cannot change snapshot');
select is(pg_temp.lineup()->>'eventName','HTTP published event','draft name cannot change snapshot');
select ok(not has_schema_privilege('anon','go_event_share_private','USAGE')
 and not has_schema_privilege('authenticated','go_event_share_private','USAGE')
 and not has_schema_privilege('service_role','go_event_share_private','USAGE'),'request roles have no schema usage');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where p.pronamespace='go_event_share_private'::regnamespace and a.grantee=0),'no PUBLIC execute');
set local role anon;
select throws_ok($$select go_event_share_private.resolve_lineup('v1.'||repeat('A',43),null,0,'')$$,'42501',null,'anon denied at private boundary');
reset role;
set local role authenticated;
select throws_ok($$select go_event_share_private.resolve_lineup('v1.'||repeat('A',43),null,0,'')$$,'42501',null,'Member denied at private boundary');
reset role;
set local role service_role;
select throws_ok($$select go_event_share_private.resolve_lineup('v1.'||repeat('A',43),null,0,'')$$,'42501',null,'service_role denied at private boundary');
reset role;
set local role go_event_share_resolver;
select is(go_event_share_private.resolve_lineup('v1.'||repeat('A',43),null,0,'')->>'status','ready','restricted identity can resolve');
select is(go_event_share_private.connection_private(),false,'administrative session cannot impersonate dedicated backend');
select throws_ok($$select * from public.event_publication_assignments$$,'42501',null,'resolver cannot read snapshot tables directly');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='6b000000-0000-4000-8000-000000000001';
select public.update_event_publication('6b500000-0000-4000-8000-000000000001');
reset role;
select is(pg_temp.lineup()->>'version','2','current publication updates');
select is(pg_temp.lineup('',0,1)->>'status','updated','old pages cannot mix publication versions');
select is(pg_temp.lineup()->'cards'->0->'slots'->0->>'ign','PRIVATE_LIVE_ROSTER','new publication uses its own sealed values');
-- Many cards, duplicate assignments, and an empty Team remain bounded and visible.
insert into public.event_parties(guild_id,event_id,section_id,name,sort_order)
select '6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001',
 '6b510000-0000-4000-8000-000000000001','Party '||n,n from generate_series(1,13) n;
insert into public.event_slots(guild_id,event_id,party_id,name,sort_order)
select guild_id,event_id,id,'Seat',0 from public.event_parties where name='Party 1';
insert into public.event_assignments(guild_id,event_id,slot_id,character_id)
select guild_id,event_id,id,'6b600000-0000-4000-8000-000000000001' from public.event_slots where name='Seat';
insert into public.event_sections(guild_id,event_id,name,sort_order)
values('6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001','Empty Team',1);
set local role authenticated;
select public.update_event_publication('6b500000-0000-4000-8000-000000000001');
reset role;
select is(pg_temp.lineup()->>'totalCards','15','large structure includes empty Team');
select is(jsonb_array_length(pg_temp.lineup()->'cards'),12,'first page bounded to 12 cards');
select is(jsonb_array_length(pg_temp.lineup('',1)->'cards'),3,'remaining cards on second page');
select is(pg_temp.lineup('PRIVATE_LIVE_ROSTER')->>'matchedCards','2','duplicate IGN returns both Parties');
select is(pg_temp.lineup('',1)->'cards'->2->'slots','[]'::jsonb,'empty Team has an empty slot array');
select is(pg_temp.lineup('',0,2)->>'status','updated','version guard protects pagination across updates');
insert into public.guilds(id,name,created_by) values('6b100000-0000-4000-8000-000000000002','Unrelated Guild','6b000000-0000-4000-8000-000000000001');
insert into public.guild_memberships(guild_id,user_id,role) values('6b100000-0000-4000-8000-000000000002','6b000000-0000-4000-8000-000000000001','owner');
insert into public.event_types(id,guild_id,name,status) values('6b300000-0000-4000-8000-000000000002','6b100000-0000-4000-8000-000000000002','Other League','active');
insert into public.event_templates(id,guild_id,event_type_id,name,status) values('6b400000-0000-4000-8000-000000000002','6b100000-0000-4000-8000-000000000002','6b300000-0000-4000-8000-000000000002','Other Template','active');
insert into public.events(id,guild_id,event_type_id,source_template_id,name) values('6b500000-0000-4000-8000-000000000002','6b100000-0000-4000-8000-000000000002','6b300000-0000-4000-8000-000000000002','6b400000-0000-4000-8000-000000000002','Unrelated Event');
set local role authenticated;
select public.publish_event('6b500000-0000-4000-8000-000000000002');
reset role;
insert into private.event_share_links(id,guild_id,event_id,token_digest,token_ciphertext,token_nonce,token_auth_tag,encryption_key_id,created_by)
values('6b800000-0000-4000-8000-000000000003','6b100000-0000-4000-8000-000000000002','6b500000-0000-4000-8000-000000000002',
encode(extensions.digest('v1.'||repeat('C',42)||'A','sha256'),'hex'),decode(repeat('ab',32),'hex'),decode(repeat('ec',12),'hex'),decode(repeat('cd',16),'hex'),'test_key','6b000000-0000-4000-8000-000000000001');
select ok(pg_temp.lineup()::text not like '%Unrelated%','first Guild bearer excludes second Guild snapshot');
select is(go_event_share_private.resolve_lineup('v1.'||repeat('C',42)||'A',null,0,'')->>'eventName','Unrelated Event','second bearer resolves only its own Guild');
select is(go_event_share_private.resolve_lineup('v1.'||repeat('C',42)||'A',null,0,'')->>'totalCards','0','empty publication structure supported');
update public.events set status='archived' where id='6b500000-0000-4000-8000-000000000001';
select ok(pg_temp.lineup() is null,'archived unavailable');
update public.events set status='active' where id='6b500000-0000-4000-8000-000000000001';
set local role authenticated;
select public.unpublish_event('6b500000-0000-4000-8000-000000000001');
reset role;
select ok(pg_temp.lineup() is null,'unpublished unavailable');
set local role authenticated;
select public.publish_event('6b500000-0000-4000-8000-000000000001');
reset role;
-- Exercise the real attested rotation RPC; this fixed test key rolls back.
insert into private.event_share_link_provisioning_keys(id,key_material,activated_at)
values('sql_lineup',decode(repeat('77',32),'hex'),clock_timestamp()-interval '1 hour');
set local role authenticated;
with proof as (select floor(extract(epoch from clock_timestamp()))::bigint+60 expiry,
 encode(extensions.digest('v1.'||repeat('B',42)||'A','sha256'),'hex') digest)
select public.rotate_event_share_link(
 '6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001',
 '6b800000-0000-4000-8000-000000000001','6b800000-0000-4000-8000-000000000002',
 digest,decode(repeat('ab',32),'hex'),decode(repeat('ed',12),'hex'),decode(repeat('cd',16),'hex'),'test_key','sql_lineup',expiry,
 extensions.hmac(convert_to(array_to_string(array['go.share.provision.v1','rotate',
 '6b000000-0000-4000-8000-000000000001','6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001',
 '6b800000-0000-4000-8000-000000000002','6b800000-0000-4000-8000-000000000001',
 digest,repeat('ab',32),repeat('ed',12),repeat('cd',16),'test_key','sql_lineup',expiry::text],E'\n'),'UTF8'),decode(repeat('77',32),'hex'),'sha256'))
from proof;
reset role;
select ok(pg_temp.lineup() is null,'rotated bearer unavailable');
select ok(pg_temp.lineup() is null,'old bearer remains unavailable after replacement');
select is(go_event_share_private.resolve_lineup('v1.'||repeat('B',42)||'A',null,0,'')->>'status','ready','replacement bearer resolves current version');
set local role authenticated;
select public.revoke_event_share_link('6b100000-0000-4000-8000-000000000001','6b500000-0000-4000-8000-000000000001','6b800000-0000-4000-8000-000000000002');
reset role;
select ok(go_event_share_private.resolve_lineup('v1.'||repeat('B',42)||'A',null,0,'') is null,'revoked replacement unavailable');
select * from finish();
rollback;
