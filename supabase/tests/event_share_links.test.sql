-- Phase 6.3A.2: actual-role authorization, lifecycle and public projection regressions.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Disposable test key; transaction rollback removes it. Never used by the app.
insert into private.event_share_link_provisioning_keys(id,key_material,activated_at)
values ('sql_test_v1',decode(repeat('77',32),'hex'),clock_timestamp()-interval '1 hour');
create function pg_temp.provisioning_mac(
 op text, actor uuid, guild uuid, event uuid, link uuid, previous uuid,
 digest text, ciphertext bytea, nonce bytea, tag bytea, aes_key text,
 proof_key text, expiry bigint
) returns bytea language sql as $$
 select extensions.hmac(convert_to(array_to_string(array[
 'go.share.provision.v1',op,actor::text,guild::text,event::text,link::text,
 coalesce(previous::text,'-'),digest,encode(ciphertext,'hex'),encode(nonce,'hex'),
 encode(tag,'hex'),aes_key,proof_key,expiry::text],E'\n'),'UTF8'),decode(repeat('77',32),'hex'),'sha256');
$$;
create function pg_temp.attested_create(
 guild uuid,event uuid,link uuid,digest text,ciphertext bytea,nonce bytea,tag bytea,aes_key text
) returns uuid language plpgsql as $$
declare expiry bigint := floor(extract(epoch from clock_timestamp()))::bigint+60;
begin
 return public.create_event_share_link(guild,event,link,digest,ciphertext,nonce,tag,aes_key,'sql_test_v1',expiry,
 pg_temp.provisioning_mac('create',auth.uid(),guild,event,link,null,digest,ciphertext,nonce,tag,aes_key,'sql_test_v1',expiry));
end;
$$;
create function pg_temp.attested_rotate(
 guild uuid,event uuid,previous uuid,link uuid,digest text,ciphertext bytea,nonce bytea,tag bytea,aes_key text
) returns uuid language plpgsql as $$
declare expiry bigint := floor(extract(epoch from clock_timestamp()))::bigint+60;
begin
 return public.rotate_event_share_link(guild,event,previous,link,digest,ciphertext,nonce,tag,aes_key,'sql_test_v1',expiry,
 pg_temp.provisioning_mac('rotate',auth.uid(),guild,event,link,previous,digest,ciphertext,nonce,tag,aes_key,'sql_test_v1',expiry));
end;
$$;


-- Deterministic test-only tokens; opaque bytes intentionally are NOT real AES
-- ciphertext. The DB cannot validate AES-GCM integrity or token randomness.

-- Fixed signed baseline; mutate actual arguments only to prove binding.
create function pg_temp.bad_provisioning(op text, changed text) returns uuid language plpgsql as $$
declare
 actor uuid := auth.uid();
 guild uuid := '6c100000-0000-4000-8000-000000000001';
 event uuid := '6c500000-0000-4000-8000-000000000001';
 link uuid := '6c800000-0000-4000-8000-000000000099';
 previous uuid := case when op='rotate' then '6c800000-0000-4000-8000-000000000001'::uuid else null end;
 digest text := repeat('a',64);
 cipher bytea := decode(repeat('ab',32),'hex');
 nonce bytea := decode(repeat('ef',12),'hex');
 tag bytea := decode(repeat('cd',16),'hex');
 aes text := 'test_key_v1';
 key_id text := 'sql_test_v1';
 expiry bigint := floor(extract(epoch from clock_timestamp()))::bigint+60;
 mac bytea;
begin
 if changed='expired' then expiry:=expiry-120; end if;
 if changed='future' then expiry:=expiry+300; end if;
 if changed='unknown' then key_id:='unknown_key'; end if;
 if changed='retired' then key_id:='retired_test'; end if;
 if changed='not_active' then key_id:='future_test'; end if;
 mac := pg_temp.provisioning_mac(case when changed='operation' then case when op='create' then 'rotate' else 'create' end else op end,
 case when changed='actor' then '6c000000-0000-4000-8000-000000000006'::uuid else actor end,
 guild,event,link,previous,digest,cipher,nonce,tag,aes,key_id,expiry);
 case changed
 when 'guild' then guild:='6c200000-0000-4000-8000-000000000001';
 when 'event' then event:='6c500000-0000-4000-8000-000000000002';
 when 'new_link' then link:='6c800000-0000-4000-8000-000000000098';
 when 'old_link' then previous:='6c800000-0000-4000-8000-000000000098';
 when 'digest' then digest:=repeat('b',64);
 when 'ciphertext' then cipher:=decode(repeat('aa',32),'hex');
 when 'nonce' then nonce:=decode(repeat('ee',12),'hex');
 when 'tag' then tag:=decode(repeat('cc',16),'hex');
 when 'aes_key' then aes:='another_aes_key';
 when 'proof_key' then key_id:='alias_test';
 when 'expiry' then expiry:=expiry-1;
 when 'forged' then mac:=decode(repeat('00',32),'hex');
 when 'missing' then mac:=null;
 when 'short_mac' then mac:=substring(mac from 1 for 31);
 when 'malformed_key' then key_id:=E'bad\nkey';
 else null;
 end case;
 if op='create' then
 return public.create_event_share_link(guild,event,link,digest,cipher,nonce,tag,aes,key_id,expiry,mac);
 end if;
 return public.rotate_event_share_link(guild,event,previous,link,digest,cipher,nonce,tag,aes,key_id,expiry,mac);
end;
$$;

create function pg_temp.share_token(p_n integer) returns text language sql immutable as $$
  select 'v1.' || translate(rtrim(encode(extensions.digest('share-fixture-' || p_n, 'sha256'), 'base64'), '='), '+/', '-_');
$$;
create function pg_temp.share_digest(p_n integer) returns text language sql immutable as $$
  select encode(extensions.digest(pg_temp.share_token(p_n), 'sha256'), 'hex');
$$;

create function pg_temp.frozen_request(op text,link uuid,previous uuid,n integer) returns text language plpgsql as $$
declare
 guild uuid := '6c100000-0000-4000-8000-000000000001'; event uuid := '6c500000-0000-4000-8000-000000000001';
 expiry bigint := floor(extract(epoch from clock_timestamp()))::bigint+60;
 digest text := pg_temp.share_digest(n); cipher bytea := decode(repeat('ab',32),'hex');
 nonce bytea := substring(extensions.digest('nonce-'||n,'sha256') from 1 for 12); tag bytea := decode(repeat('cd',16),'hex'); mac bytea;
begin
 mac:=pg_temp.provisioning_mac(op,auth.uid(),guild,event,link,previous,digest,cipher,nonce,tag,'test_key_v1','sql_test_v1',expiry);
 if op='create' then return format('select public.create_event_share_link(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)',guild,event,link,digest,cipher,nonce,tag,'test_key_v1','sql_test_v1',expiry,mac); end if;
 return format('select public.rotate_event_share_link(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)',guild,event,previous,link,digest,cipher,nonce,tag,'test_key_v1','sql_test_v1',expiry,mac);
end;
$$;
create function pg_temp.run_request(request text) returns uuid language plpgsql as $$
declare result uuid;
begin execute request into result; return result; end;
$$;

create function pg_temp.share_create(p_id uuid, p_n integer, p_event uuid default '6c500000-0000-4000-8000-000000000001') returns uuid language sql as $$
  select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001', p_event, p_id, pg_temp.share_digest(p_n),
    decode(repeat('ab',32),'hex'), substring(extensions.digest('nonce-' || p_n,'sha256') from 1 for 12), decode(repeat('cd',16),'hex'), 'test_key_v1');
$$;
create function pg_temp.share_rotate(p_old uuid, p_new uuid, p_n integer) returns uuid language sql as $$
  select pg_temp.attested_rotate('6c100000-0000-4000-8000-000000000001', '6c500000-0000-4000-8000-000000000001', p_old, p_new, pg_temp.share_digest(p_n),
    decode(repeat('ab',32),'hex'), substring(extensions.digest('nonce-' || p_n,'sha256') from 1 for 12), decode(repeat('cd',16),'hex'), 'test_key_v1');
$$;
create function pg_temp.share_revoke(p_id uuid, p_event uuid default '6c500000-0000-4000-8000-000000000001') returns void language sql as $$
  select public.revoke_event_share_link('6c100000-0000-4000-8000-000000000001',p_event,p_id);
$$;
create function pg_temp.denied_share_management() returns setof text language plpgsql as $$
begin
  return next throws_ok('select * from public.get_event_share_link_state(''6c100000-0000-4000-8000-000000000001'',''6c500000-0000-4000-8000-000000000001'')','42501',null,'unauthorized state read denied');
  return next throws_ok('select * from public.get_event_share_link_copy_payload(''6c100000-0000-4000-8000-000000000001'',''6c500000-0000-4000-8000-000000000001'',''6c800000-0000-4000-8000-000000000001'')','42501',null,'unauthorized recovery read denied');
  return next throws_ok('select pg_temp.share_create(''6c800000-0000-4000-8000-000000000099'',99)','42501',null,'unauthorized creation denied');
  return next throws_ok('select pg_temp.share_rotate(''6c800000-0000-4000-8000-000000000001'',''6c800000-0000-4000-8000-000000000099'',99)','42501',null,'unauthorized rotation denied');
  return next throws_ok('select pg_temp.share_revoke(''6c800000-0000-4000-8000-000000000001'')','42501',null,'unauthorized revocation denied');
end;
$$;

select ok((select relrowsecurity from pg_class where oid='private.event_share_links'::regclass),'private link table has RLS');
select is((select count(*) from pg_policy where polrelid='private.event_share_links'::regclass),0::bigint,'no direct-role RLS policies');
select is((select pg_get_userbyid(relowner) from pg_class where oid='private.event_share_links'::regclass),'postgres','trusted table owner');
select ok(not has_schema_privilege('anon','private','USAGE'),'anonymous private schema privileges remain unchanged');
select ok(not has_table_privilege(r,'private.event_share_links',p), r || ' lacks direct ' || p)
from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;

select unnest(array[ok(p.prosecdef,'get_event_share_link_state uses the audited definer boundary'),
  is(p.proconfig,array['search_path=""']::text[],'get_event_share_link_state has empty search_path'),
  is(pg_get_userbyid(p.proowner),'postgres','get_event_share_link_state trusted owner'),
  ok(not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'),'get_event_share_link_state has no PUBLIC execute'),
  ok(has_function_privilege('authenticated',p.oid,'EXECUTE'),'get_event_share_link_state authenticated grant'),
  is(has_function_privilege('anon',p.oid,'EXECUTE'),false,'get_event_share_link_state anonymous grant'),
  ok(not has_function_privilege('service_role',p.oid,'EXECUTE'),'get_event_share_link_state needs no service-role execution')])
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_event_share_link_state';

select unnest(array[ok(p.prosecdef,'get_event_share_link_copy_payload uses the audited definer boundary'),
  is(p.proconfig,array['search_path=""']::text[],'get_event_share_link_copy_payload has empty search_path'),
  is(pg_get_userbyid(p.proowner),'postgres','get_event_share_link_copy_payload trusted owner'),
  ok(not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'),'get_event_share_link_copy_payload has no PUBLIC execute'),
  ok(has_function_privilege('authenticated',p.oid,'EXECUTE'),'get_event_share_link_copy_payload authenticated grant'),
  is(has_function_privilege('anon',p.oid,'EXECUTE'),false,'get_event_share_link_copy_payload anonymous grant'),
  ok(not has_function_privilege('service_role',p.oid,'EXECUTE'),'get_event_share_link_copy_payload needs no service-role execution')])
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_event_share_link_copy_payload';

select unnest(array[ok(p.prosecdef,'create_event_share_link uses the audited definer boundary'),
  is(p.proconfig,array['search_path=""']::text[],'create_event_share_link has empty search_path'),
  is(pg_get_userbyid(p.proowner),'postgres','create_event_share_link trusted owner'),
  ok(not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'),'create_event_share_link has no PUBLIC execute'),
  ok(has_function_privilege('authenticated',p.oid,'EXECUTE'),'create_event_share_link authenticated grant'),
  is(has_function_privilege('anon',p.oid,'EXECUTE'),false,'create_event_share_link anonymous grant'),
  ok(not has_function_privilege('service_role',p.oid,'EXECUTE'),'create_event_share_link needs no service-role execution')])
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_event_share_link';

select unnest(array[ok(p.prosecdef,'rotate_event_share_link uses the audited definer boundary'),
  is(p.proconfig,array['search_path=""']::text[],'rotate_event_share_link has empty search_path'),
  is(pg_get_userbyid(p.proowner),'postgres','rotate_event_share_link trusted owner'),
  ok(not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'),'rotate_event_share_link has no PUBLIC execute'),
  ok(has_function_privilege('authenticated',p.oid,'EXECUTE'),'rotate_event_share_link authenticated grant'),
  is(has_function_privilege('anon',p.oid,'EXECUTE'),false,'rotate_event_share_link anonymous grant'),
  ok(not has_function_privilege('service_role',p.oid,'EXECUTE'),'rotate_event_share_link needs no service-role execution')])
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rotate_event_share_link';

select unnest(array[ok(p.prosecdef,'revoke_event_share_link uses the audited definer boundary'),
  is(p.proconfig,array['search_path=""']::text[],'revoke_event_share_link has empty search_path'),
  is(pg_get_userbyid(p.proowner),'postgres','revoke_event_share_link trusted owner'),
  ok(not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'),'revoke_event_share_link has no PUBLIC execute'),
  ok(has_function_privilege('authenticated',p.oid,'EXECUTE'),'revoke_event_share_link authenticated grant'),
  is(has_function_privilege('anon',p.oid,'EXECUTE'),false,'revoke_event_share_link anonymous grant'),
  ok(not has_function_privilege('service_role',p.oid,'EXECUTE'),'revoke_event_share_link needs no service-role execution')])
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='revoke_event_share_link';

select unnest(array[ok(p.prosecdef,'resolve_event_share_link uses the audited definer boundary'),
  is(p.proconfig,array['search_path=""']::text[],'resolve_event_share_link has empty search_path'),
  is(pg_get_userbyid(p.proowner),'postgres','resolve_event_share_link trusted owner'),
  ok(not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'),'resolve_event_share_link has no PUBLIC execute'),
  ok(has_function_privilege('authenticated',p.oid,'EXECUTE'),'resolve_event_share_link authenticated grant'),
  is(has_function_privilege('anon',p.oid,'EXECUTE'),true,'resolve_event_share_link anonymous grant'),
  ok(not has_function_privilege('service_role',p.oid,'EXECUTE'),'resolve_event_share_link needs no service-role execution')])
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_event_share_link';

select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_event_share_link'),1::bigint,'resolver has no overload/history-selector endpoint');
select is((select proargnames from pg_proc where oid='public.resolve_event_share_link(text)'::regprocedure),array['p_token','event_name','event_type_name','version_number','published_at']::text[],'resolver contract contains only approved fields');
select ok(not has_function_privilege('authenticated','private.guard_event_share_link_write()','EXECUTE'),'guard not directly executable');
insert into auth.users (id, email) values
  ('6c000000-0000-4000-8000-000000000001', 'share-owner-a@test.local'),
  ('6c000000-0000-4000-8000-000000000002', 'share-events-officer@test.local'),
  ('6c000000-0000-4000-8000-000000000003', 'share-officer@test.local'),
  ('6c000000-0000-4000-8000-000000000004', 'share-member@test.local'),
  ('6c000000-0000-4000-8000-000000000005', 'share-owner-b@test.local');

insert into public.guilds (id, name, created_by) values
  ('6c100000-0000-4000-8000-000000000001', 'Publish Guild A', '6c000000-0000-4000-8000-000000000001'),
  ('6c200000-0000-4000-8000-000000000001', 'Publish Guild B', '6c000000-0000-4000-8000-000000000005');

insert into public.guild_memberships (id, guild_id, user_id, role) values
  ('6c110000-0000-4000-8000-000000000001', '6c100000-0000-4000-8000-000000000001', '6c000000-0000-4000-8000-000000000001', 'owner'),
  ('6c110000-0000-4000-8000-000000000002', '6c100000-0000-4000-8000-000000000001', '6c000000-0000-4000-8000-000000000002', 'officer'),
  ('6c110000-0000-4000-8000-000000000003', '6c100000-0000-4000-8000-000000000001', '6c000000-0000-4000-8000-000000000003', 'officer'),
  ('6c110000-0000-4000-8000-000000000004', '6c100000-0000-4000-8000-000000000001', '6c000000-0000-4000-8000-000000000004', 'member'),
  ('6c210000-0000-4000-8000-000000000001', '6c200000-0000-4000-8000-000000000001', '6c000000-0000-4000-8000-000000000005', 'owner');

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
) values
  ('6c100000-0000-4000-8000-000000000001', '6c110000-0000-4000-8000-000000000002', 'events.manage', '6c000000-0000-4000-8000-000000000001'),
  ('6c100000-0000-4000-8000-000000000001', '6c110000-0000-4000-8000-000000000003', 'publish.manage', '6c000000-0000-4000-8000-000000000001');

insert into public.event_types (id, guild_id, name, status, created_by) values (
  '6c300000-0000-4000-8000-000000000001',
  '6c100000-0000-4000-8000-000000000001',
  'Guild League',
  'active',
  '6c000000-0000-4000-8000-000000000001'
);

insert into public.event_templates (
  id, guild_id, event_type_id, name, uses_areas, status, created_by
) values (
  '6c400000-0000-4000-8000-000000000001',
  '6c100000-0000-4000-8000-000000000001',
  '6c300000-0000-4000-8000-000000000001',
  'League Template',
  false,
  'active',
  '6c000000-0000-4000-8000-000000000001'
);

insert into public.events (
  id, guild_id, event_type_id, source_template_id,
  name, description, status, created_by, updated_by
) values
  (
    '6c500000-0000-4000-8000-000000000001',
    '6c100000-0000-4000-8000-000000000001',
    '6c300000-0000-4000-8000-000000000001',
    '6c400000-0000-4000-8000-000000000001',
    'League Week 1',
    'Original draft',
    'active',
    '6c000000-0000-4000-8000-000000000001',
    '6c000000-0000-4000-8000-000000000001'
  ),
  (
    '6c500000-0000-4000-8000-000000000002',
    '6c100000-0000-4000-8000-000000000001',
    '6c300000-0000-4000-8000-000000000001',
    '6c400000-0000-4000-8000-000000000001',
    'Archived League',
    null,
    'active',
    '6c000000-0000-4000-8000-000000000001',
    '6c000000-0000-4000-8000-000000000001'
  );

insert into public.event_sections (
  id, guild_id, event_id, area_id, name, sort_order
) values (
  '6c510000-0000-4000-8000-000000000001',
  '6c100000-0000-4000-8000-000000000001',
  '6c500000-0000-4000-8000-000000000001',
  null,
  'Alpha',
  0
);

insert into public.event_parties (
  id, guild_id, event_id, section_id, name, sort_order
) values (
  '6c520000-0000-4000-8000-000000000001',
  '6c100000-0000-4000-8000-000000000001',
  '6c500000-0000-4000-8000-000000000001',
  '6c510000-0000-4000-8000-000000000001',
  'Party 1',
  0
);

insert into public.event_slots (
  id, guild_id, event_id, party_id, name, role_label, sort_order
) values
  (
    '6c530000-0000-4000-8000-000000000001',
    '6c100000-0000-4000-8000-000000000001',
    '6c500000-0000-4000-8000-000000000001',
    '6c520000-0000-4000-8000-000000000001',
    'Seat 1',
    'Tank',
    0
  ),
  (
    '6c530000-0000-4000-8000-000000000002',
    '6c100000-0000-4000-8000-000000000001',
    '6c500000-0000-4000-8000-000000000001',
    '6c520000-0000-4000-8000-000000000001',
    'Seat 2',
    null,
    1
  );

insert into public.characters (
  id, guild_id, ign, class_name, status, source_origin, created_by
) values
  (
    '6c600000-0000-4000-8000-000000000001',
    '6c100000-0000-4000-8000-000000000001',
    ' TankMain ',
    'Knight',
    'active',
    'manual',
    '6c000000-0000-4000-8000-000000000001'
  ),
  (
    '6c600000-0000-4000-8000-000000000002',
    '6c100000-0000-4000-8000-000000000001',
    'HealMain',
    'Priest',
    'active',
    'manual',
    '6c000000-0000-4000-8000-000000000001'
  );

insert into public.character_roster_profiles (
  guild_id, character_id, designation, role_label, created_by
) values
  (
    '6c100000-0000-4000-8000-000000000001',
    '6c600000-0000-4000-8000-000000000001',
    'main',
    'Tank',
    '6c000000-0000-4000-8000-000000000001'
  ),
  (
    '6c100000-0000-4000-8000-000000000001',
    '6c600000-0000-4000-8000-000000000002',
    'sub',
    'Healer',
    '6c000000-0000-4000-8000-000000000001'
  );

insert into public.event_assignments (
  id, guild_id, event_id, slot_id, character_id, created_by, updated_by
) values (
  '6c700000-0000-4000-8000-000000000001',
  '6c100000-0000-4000-8000-000000000001',
  '6c500000-0000-4000-8000-000000000001',
  '6c530000-0000-4000-8000-000000000001',
  '6c600000-0000-4000-8000-000000000001',
  '6c000000-0000-4000-8000-000000000001',
  '6c000000-0000-4000-8000-000000000001'
);


insert into auth.users(id,email) values
 ('6c000000-0000-4000-8000-000000000006','share-admin@test.local'),
 ('6c000000-0000-4000-8000-000000000007','share-inactive@test.local');
insert into public.guild_memberships(id,guild_id,user_id,role,status) values
 ('6c110000-0000-4000-8000-000000000006','6c100000-0000-4000-8000-000000000001','6c000000-0000-4000-8000-000000000006','admin','active'),
 ('6c110000-0000-4000-8000-000000000007','6c100000-0000-4000-8000-000000000001','6c000000-0000-4000-8000-000000000007','officer','active');
insert into public.guild_officer_capabilities(guild_id,membership_id,capability_key,granted_by) values
 ('6c100000-0000-4000-8000-000000000001','6c110000-0000-4000-8000-000000000007','publish.manage','6c000000-0000-4000-8000-000000000001');
update public.guild_memberships set status='inactive' where id='6c110000-0000-4000-8000-000000000007';

set local role authenticated;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000001';

reset role;
insert into private.event_share_link_provisioning_keys(id,key_material,activated_at,retired_at) values
 ('retired_test',decode(repeat('77',32),'hex'),clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour'),
 ('future_test',decode(repeat('77',32),'hex'),clock_timestamp()+interval '1 hour',null),
 ('alias_test',decode(repeat('77',32),'hex'),clock_timestamp()-interval '1 hour',null);
select ok((select relrowsecurity from pg_class where oid='private.event_share_link_provisioning_keys'::regclass),'provisioning keys have RLS');
select is((select count(*) from pg_policy where polrelid='private.event_share_link_provisioning_keys'::regclass),0::bigint,'provisioning keys have no app policies');
select ok(not has_table_privilege(r,'private.event_share_link_provisioning_keys',p),r||' cannot access provisioning key: '||p)
from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;
select unnest(array[ok(p.prosecdef,'proof verifier is definer'),is(p.proconfig,array['search_path=""']::text[],'proof verifier fixed path'),
 is(pg_get_userbyid(p.proowner),'postgres','proof verifier owner'),ok(not has_function_privilege('authenticated',p.oid,'EXECUTE'),'no direct proof-verifier oracle'),
 ok(not has_function_privilege('anon',p.oid,'EXECUTE'),'no anon verifier'),ok(not has_function_privilege('service_role',p.oid,'EXECUTE'),'no service verifier'),
 ok(not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0),'no PUBLIC verifier')])
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='verify_event_share_link_provisioning';
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_event_share_link'),1::bigint,'one create signature');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rotate_event_share_link'),1::bigint,'one rotate signature');
select is(to_regprocedure('public.create_event_share_link(uuid,uuid,uuid,text,bytea,bytea,bytea,text)')::text,null,'legacy create entirely removed');
select is(to_regprocedure('public.rotate_event_share_link(uuid,uuid,uuid,uuid,text,bytea,bytea,bytea,text)')::text,null,'legacy rotate entirely removed');
set local role authenticated;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000001';
select throws_ok(format('select pg_temp.bad_provisioning(%L,%L)',op,changed),'42501',null,op||' rejects '||changed||' proof')
from unnest(array['create','rotate']) op cross join unnest(array['missing','unknown','retired','not_active','forged','short_mac','expired','future','actor','guild','event','operation','new_link','digest','ciphertext','nonce','tag','aes_key','proof_key','expiry','malformed_key']) changed;
select throws_ok($$select pg_temp.bad_provisioning('rotate','old_link')$$,'42501',null,'rotate binds expected old link');
select throws_ok($$select public.create_event_share_link(null,null,null,null,null,null,null,null)$$,'42883',null,'legacy proof-free create call rejected');
select throws_ok($$select public.rotate_event_share_link(null,null,null,null,null,null,null,null,null)$$,'42883',null,'legacy proof-free rotate call rejected');
select throws_ok($$select key_material from private.event_share_link_provisioning_keys$$,'42501',null,'actual authenticated key read denied');
select throws_ok($$insert into private.event_share_link_provisioning_keys values('evil',decode(repeat('00',32),'hex'),now(),null)$$,'42501',null,'actual authenticated key write denied');
reset role;
update private.event_share_link_provisioning_keys set retired_at=clock_timestamp() where id='sql_test_v1';
set local role authenticated;
select throws_ok($$select pg_temp.bad_provisioning('create','valid')$$,'42501',null,'missing valid provisioning key fails closed create');
select throws_ok($$select pg_temp.bad_provisioning('rotate','valid')$$,'42501',null,'missing valid provisioning key fails closed rotate');
reset role;
update private.event_share_link_provisioning_keys set retired_at=null where id='sql_test_v1';
set local role authenticated;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000003';
select throws_ok($$select pg_temp.bad_provisioning('create','missing')$$,'42501',null,'publish.manage Officer cannot create without server attestation');
select throws_ok($$select pg_temp.bad_provisioning('rotate','forged')$$,'42501',null,'publish.manage Officer cannot rotate with forged server attestation');
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000001';

select ok((select link_id is null and available=false from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),'state represents no active link');
do $$ begin perform set_config('test.share_create_replay',pg_temp.frozen_request('create','6c800000-0000-4000-8000-000000000001',null,1),true); end; $$;
select is(pg_temp.run_request(current_setting('test.share_create_replay')),'6c800000-0000-4000-8000-000000000001'::uuid,'Owner creates link before publication');
select lives_ok(current_setting('test.share_create_replay'),'exact same proof replay recognizes committed active create');
select is(pg_temp.share_create('6c800000-0000-4000-8000-000000000001',1),'6c800000-0000-4000-8000-000000000001'::uuid,'identical committed create request recognized');
select throws_ok($$select pg_temp.share_create('6c800000-0000-4000-8000-000000000001',2)$$,'55000',null,'same identity with different material rejected');
select throws_ok($$select pg_temp.share_create('6c800000-0000-4000-8000-000000000002',2)$$,'55000',null,'second active link rejected');
select is((select link_id from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),'6c800000-0000-4000-8000-000000000001'::uuid,'state identifies active link');
select is((select available from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),false,'prepublication link is unavailable');
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(1))),0::bigint,'prepublication bearer has no public data');
select is((select token_ciphertext from public.get_event_share_link_copy_payload('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001')),decode(repeat('ab',32),'hex'),'authorized copy returns opaque ciphertext');
select is((select token_digest from public.get_event_share_link_copy_payload('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001')),pg_temp.share_digest(1),'copy includes digest for later server verification');
select is((select count(*) from public.get_event_share_link_copy_payload('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000001')),0::bigint,'copy cannot mix Event and link identifiers');
select throws_ok($$select * from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000099')$$,'P0002',null,'missing scoped Event denied');
select throws_ok($$select * from private.event_share_links$$,'42501',null,'publisher cannot directly read links');
select throws_ok($$delete from private.event_share_links$$,'42501',null,'publisher cannot directly delete links');
select throws_ok($$update private.event_share_links set revoked_at=now()$$,'42501',null,'publisher cannot directly update links');
select throws_ok($$insert into private.event_share_links(id,guild_id,event_id,token_digest) values('6c800000-0000-4000-8000-000000000099','6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001',repeat('f',64))$$,'42501',null,'publisher cannot directly insert links');

-- events.manage only
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000002';
select * from pg_temp.denied_share_management();

-- Member
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000004';
select * from pg_temp.denied_share_management();

-- foreign Guild Owner
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000005';
select * from pg_temp.denied_share_management();

-- inactive publish.manage membership
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000007';
select * from pg_temp.denied_share_management();
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000005';
select throws_ok($$select * from public.get_event_share_link_state('6c200000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')$$,'P0002',null,'authorized foreign Guild cannot pair its Guild with our Event');
select throws_ok($$select * from public.get_event_share_link_copy_payload('6c200000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001')$$,'P0002',null,'foreign Guild/Event mismatch denies recovery');
select throws_ok($$select public.revoke_event_share_link('6c200000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001')$$,'P0002',null,'foreign Guild/Event mismatch denies revocation');
set local request.jwt.claim.sub='';
select * from pg_temp.denied_share_management();
reset role;
set local role anon;
select * from pg_temp.denied_share_management();
select throws_ok($$select * from private.event_share_links$$,'42501',null,'anonymous direct table access denied');
select throws_ok($$select * from public.event_publication_versions$$,'42501',null,'anonymous history remains inaccessible');
reset role;

select throws_ok($$insert into private.event_share_links(id,guild_id,event_id,token_digest,token_ciphertext,token_nonce,token_auth_tag,encryption_key_id,created_by)
 values('6c800000-0000-4000-8000-000000000098','6c200000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001',repeat('f',64),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'test_key_v1','6c000000-0000-4000-8000-000000000001')$$,'23503',null,'composite FK rejects mismatched Guild/Event even for privileged insertion');
-- Constraints reject malformed envelopes even from an authorized caller.
set local role authenticated;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000006';
select is((select link_id from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),'6c800000-0000-4000-8000-000000000001'::uuid,'Admin can read state');
select is((select count(*) from public.get_event_share_link_copy_payload('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001')),1::bigint,'Admin can read copy payload');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',upper(pg_temp.share_digest(10)),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'test_key_v1')$$,'23514',null,'uppercase digest rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010','invalid',decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'test_key_v1')$$,'23514',null,'short digest rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),null,decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'test_key_v1')$$,'23514',null,'missing ciphertext rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),decode(repeat('ab',31),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'test_key_v1')$$,'23514',null,'short ciphertext rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),decode(repeat('ab',32),'hex'),null,decode(repeat('cd',16),'hex'),'test_key_v1')$$,'23514',null,'missing nonce rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),decode(repeat('ab',32),'hex'),decode(repeat('ab',13),'hex'),decode(repeat('cd',16),'hex'),'test_key_v1')$$,'23514',null,'long nonce rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),null,'test_key_v1')$$,'23514',null,'missing authentication tag rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('ab',15),'hex'),'test_key_v1')$$,'23514',null,'short authentication tag rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),null)$$,'23514',null,'missing key ID rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'bad key')$$,'23514',null,'invalid key ID rejected by DB constraint');
select throws_ok($$select pg_temp.attested_create('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000010',pg_temp.share_digest(10),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),repeat('x',33))$$,'23514',null,'long key ID rejected by DB constraint');
select is(pg_temp.share_create('6c800000-0000-4000-8000-000000000010',10,'6c500000-0000-4000-8000-000000000002'),'6c800000-0000-4000-8000-000000000010'::uuid,'Admin creates server-attested opaque envelope');
select lives_ok($$select pg_temp.share_revoke('6c800000-0000-4000-8000-000000000010','6c500000-0000-4000-8000-000000000002')$$,'Admin revokes link');
select is(pg_temp.share_create('6c800000-0000-4000-8000-000000000011',11,'6c500000-0000-4000-8000-000000000002'),'6c800000-0000-4000-8000-000000000011'::uuid,'Admin also creates an active link for profile deletion regression');
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000003';
select is((select link_id from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),'6c800000-0000-4000-8000-000000000001'::uuid,'publish.manage Officer reads state without events.manage');
select is((select count(*) from public.get_event_share_link_copy_payload('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001')),1::bigint,'publish.manage Officer gets encrypted recovery');
select set_config('test.share_v1',public.publish_event('6c500000-0000-4000-8000-000000000001')::text,true);
reset role;
-- Remember every sealed header and child value, not just displayed names.
select set_config('test.share_v1_header',(select row_to_json(v)::text from public.event_publication_versions v where v.id=current_setting('test.share_v1')::uuid),true);
select set_config('test.share_v1_slots',(select jsonb_agg(to_jsonb(s) order by s.id)::text from public.event_publication_slots s where s.publication_version_id=current_setting('test.share_v1')::uuid),true);
select set_config('test.share_v1_assignments',(select jsonb_agg(to_jsonb(a) order by a.id)::text from public.event_publication_assignments a where a.publication_version_id=current_setting('test.share_v1')::uuid),true);
set local role anon;
select is((select event_name from public.resolve_event_share_link(pg_temp.share_token(1))),'League Week 1','anonymous bearer resolves sealed v1');
select is((select event_type_name from public.resolve_event_share_link(pg_temp.share_token(1))),'Guild League','Event Type comes from snapshot');
select is((select version_number from public.resolve_event_share_link(pg_temp.share_token(1))),1,'anonymous v1 number');
select ok((select published_at is not null from public.resolve_event_share_link(pg_temp.share_token(1))),'public publication timestamp');
select is((select array_agg(k order by k) from public.resolve_event_share_link(pg_temp.share_token(1)) r cross join lateral jsonb_object_keys(to_jsonb(r)) k),array['event_name','event_type_name','published_at','version_number']::text[],'actual anonymous row exposes only approved fields');
select is((select count(*) from public.resolve_event_share_link(null)),0::bigint,'null: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link('')),0::bigint,'empty: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(999))),0::bigint,'unknown canonical token: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_digest(1))),0::bigint,'digest as token: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(1)||'=')),0::bigint,'padded token: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link(' '||pg_temp.share_token(1))),0::bigint,'leading whitespace: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link(replace(pg_temp.share_token(1),'v1.','v2.'))),0::bigint,'unsupported version: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link('v1.'||repeat('A',42)||'B')),0::bigint,'nonzero base64 padding bits: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link('v1.'||repeat('A',41)||'+A')),0::bigint,'non-url alphabet: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link('v1.'||repeat('A',42))),0::bigint,'short encoding: uniform unavailable result');
select is((select count(*) from public.resolve_event_share_link(repeat('x',100000))),0::bigint,'oversized token: uniform unavailable result');
reset role;
update public.events set name='Draft Week 2', description='PRIVATE draft note' where id='6c500000-0000-4000-8000-000000000001';
update public.characters set ign='PRIVATE roster renamed', gear_score=999999 where id='6c600000-0000-4000-8000-000000000001';
update public.event_slots set name='PRIVATE draft seat' where id='6c530000-0000-4000-8000-000000000001';
set local role anon;
reset role;
update private.event_share_link_provisioning_keys set retired_at=clock_timestamp() where id='sql_test_v1';
set local role anon;
select is((select version_number from public.resolve_event_share_link(pg_temp.share_token(1))),1,'issued link resolves while provisioning key is retired');
reset role;
update private.event_share_link_provisioning_keys set retired_at=null where id='sql_test_v1';
set local role anon;
select is((select event_name from public.resolve_event_share_link(pg_temp.share_token(1))),'League Week 1','draft edits never change public v1');
select ok((select to_jsonb(r)::text not like '%PRIVATE%' from public.resolve_event_share_link(pg_temp.share_token(1)) r),'private draft/roster values do not leak');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000003';
select set_config('test.share_v2',public.update_event_publication('6c500000-0000-4000-8000-000000000001')::text,true);
select is((select event_name from public.resolve_event_share_link(pg_temp.share_token(1))),'Draft Week 2','same token follows explicit v2 update');
select is((select version_number from public.resolve_event_share_link(pg_temp.share_token(1))),2,'same token returns v2, not historical v1');
select is((select published_at from public.resolve_event_share_link(pg_temp.share_token(1))),(select published_at from public.event_publications where event_id='6c500000-0000-4000-8000-000000000001'),'resolver timestamp is current publication timestamp');
select lives_ok($$select public.unpublish_event('6c500000-0000-4000-8000-000000000001')$$,'unpublish succeeds');
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(1))),0::bigint,'unpublish removes bearer availability');
select is((select available from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),false,'management availability follows unpublish');
select is((select link_id from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),'6c800000-0000-4000-8000-000000000001'::uuid,'unpublish retains link identity');
select set_config('test.share_v3',public.publish_event('6c500000-0000-4000-8000-000000000001')::text,true);
select is((select version_number from public.resolve_event_share_link(pg_temp.share_token(1))),3,'republish restores same non-revoked token at v3');
select is((select available from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),true,'state reports available sealed publication');
select throws_ok($$select pg_temp.share_rotate('6c800000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000002',1)$$,'23505',null,'duplicate digest rotation rolls back');
select is((select link_id from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),'6c800000-0000-4000-8000-000000000001'::uuid,'failed rotation leaves old link active');
select is((select count(*) from public.get_event_share_link_copy_payload('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001')),1::bigint,'failed rotation retains recovery envelope');
select throws_ok($$select pg_temp.attested_rotate('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000002',pg_temp.share_digest(2),decode('ab','hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'test_key_v1')$$,'23514',null,'malformed replacement also rolls back revocation');
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(1))),1::bigint,'malformed rotation leaves old bearer valid');
do $$ begin perform set_config('test.share_rotate_replay',pg_temp.frozen_request('rotate','6c800000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000001',2),true); end; $$;
select is(pg_temp.run_request(current_setting('test.share_rotate_replay')),'6c800000-0000-4000-8000-000000000002'::uuid,'publish.manage Officer rotates atomically');
select throws_ok(current_setting('test.share_rotate_replay'),'55000',null,'exact rotation proof replay cannot override its replacement');
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000001';
select throws_ok(current_setting('test.share_create_replay'),'55000',null,'exact creation proof replay cannot resurrect rotated link');
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000003';
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(1))),0::bigint,'rotation invalidates old token');
select is((select version_number from public.resolve_event_share_link(pg_temp.share_token(2))),3,'replacement resolves existing current v3');
select is((select count(*) from public.get_event_share_link_copy_payload('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000001')),0::bigint,'rotated recovery cannot be retrieved');
select throws_ok($$select pg_temp.share_rotate('6c800000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000003',3)$$,'55000',null,'competing stale rotation cannot replace winner');
select lives_ok($$select pg_temp.share_revoke('6c800000-0000-4000-8000-000000000001')$$,'stale revoke against old link is harmless');
select is((select link_id from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),'6c800000-0000-4000-8000-000000000002'::uuid,'stale revoke never targets replacement');
reset role;
select is((select count(*) from private.event_share_links where guild_id='6c100000-0000-4000-8000-000000000001' and event_id='6c500000-0000-4000-8000-000000000001' and revoked_at is null),1::bigint,'exactly one active replacement');
select ok((select token_ciphertext is null and token_nonce is null and token_auth_tag is null and encryption_key_id is null and revocation_reason='rotated' from private.event_share_links where id='6c800000-0000-4000-8000-000000000001'),'rotation permanently scrubs full recovery envelope');
select throws_ok($$update private.event_share_links set revoked_at=null,revocation_reason=null,revoked_by=null where id='6c800000-0000-4000-8000-000000000001'$$,'55000',null,'privileged reactivation blocked by trigger');
select throws_ok($$update private.event_share_links set token_ciphertext=decode(repeat('ff',32),'hex') where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'active ciphertext immutable');
select throws_ok($$update private.event_share_links set token_digest=repeat('f',64) where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'active digest immutable');
select throws_ok($$update private.event_share_links set event_id='6c500000-0000-4000-8000-000000000002' where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'Event scope immutable');
select throws_ok($$update private.event_share_links set created_at=now()-interval '1 day' where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'creation timestamp immutable');
select throws_ok($$update private.event_share_links set token_nonce=decode(repeat('ff',12),'hex') where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'active nonce immutable');
select throws_ok($$update private.event_share_links set token_auth_tag=decode(repeat('ff',16),'hex') where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'active tag immutable');
select throws_ok($$update private.event_share_links set encryption_key_id='other_key' where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'active key ID immutable');
select throws_ok($$update private.event_share_links set guild_id='6c200000-0000-4000-8000-000000000001' where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'Guild scope immutable');
select throws_ok($$update private.event_share_links set id='6c800000-0000-4000-8000-000000000099' where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'link identity immutable');
select throws_ok($$update private.event_share_links set revoked_at=now(),revoked_by='6c000000-0000-4000-8000-000000000001',revocation_reason='revoked' where id='6c800000-0000-4000-8000-000000000002'$$,'23514',null,'revocation cannot retain envelope');
select throws_ok($$update private.event_share_links set revocation_reason='revoked' where id='6c800000-0000-4000-8000-000000000001'$$,'55000',null,'revocation history immutable');
select throws_ok($$update private.event_share_links set created_by=null where id='6c800000-0000-4000-8000-000000000002'$$,'55000',null,'live creation actor cannot be cleared');
update public.events set status='archived' where id='6c500000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(2))),0::bigint,'archived Event unavailable');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000006';
select throws_ok($$select pg_temp.share_rotate('6c800000-0000-4000-8000-000000000002','6c800000-0000-4000-8000-000000000003',3)$$,'55000',null,'archived Event rotation denied');
select throws_ok($$select pg_temp.share_create('6c800000-0000-4000-8000-000000000003',3)$$,'55000',null,'archived Event creation denied');
select lives_ok($$select pg_temp.share_revoke('6c800000-0000-4000-8000-000000000002')$$,'Admin can revoke archived Event');
select lives_ok($$select pg_temp.share_revoke('6c800000-0000-4000-8000-000000000002')$$,'repeat revocation is idempotent');
select is((select link_id from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')),null::uuid,'revoked link absent from active state');
reset role;
update public.events set status='active' where id='6c500000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000001';
select throws_ok($$select pg_temp.share_create('6c800000-0000-4000-8000-000000000003',2)$$,'23505',null,'revoked digest cannot be reused');
select throws_ok($$select pg_temp.share_create('6c800000-0000-4000-8000-000000000002',2)$$,'55000',null,'revoked creation request cannot reactivate');
select is(pg_temp.share_create('6c800000-0000-4000-8000-000000000003',3),'6c800000-0000-4000-8000-000000000003'::uuid,'new link can be created after permanent revocation');
reset role;
update public.guilds set status='archived' where id='6c100000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(3))),0::bigint,'inactive Guild unavailable');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000001';
select throws_ok($$select * from public.get_event_share_link_state('6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001')$$,'55000',null,'inactive Guild management denied');
select throws_ok($$select pg_temp.share_create('6c800000-0000-4000-8000-000000000099',99,'6c500000-0000-4000-8000-000000000002')$$,'55000',null,'inactive Guild creation denied');
reset role;
update public.guilds set status='active' where id='6c100000-0000-4000-8000-000000000001';
-- Profile SET NULL must preserve active and revoked links, including both actors.
delete from public.profiles where id='6c000000-0000-4000-8000-000000000006';
select ok((select created_by is null and revoked_at is null and octet_length(token_ciphertext)=32 from private.event_share_links where id='6c800000-0000-4000-8000-000000000011'),'profile deletion preserves active encrypted link');
select ok((select created_by is null and revoked_by is null from private.event_share_links where id='6c800000-0000-4000-8000-000000000010'),'deleted Admin creation/revocation actors become null without invalidating row');
select ok((select revoked_by is null and revoked_at is not null from private.event_share_links where id='6c800000-0000-4000-8000-000000000002'),'deleted revoker does not reactivate link');
select is((select row_to_json(v)::text from public.event_publication_versions v where v.id=current_setting('test.share_v1')::uuid),current_setting('test.share_v1_header'),'sealed v1 header unchanged after updates and all sharing operations');
select is((select jsonb_agg(to_jsonb(s) order by s.id)::text from public.event_publication_slots s where s.publication_version_id=current_setting('test.share_v1')::uuid),current_setting('test.share_v1_slots'),'sealed v1 seats unchanged');
select is((select jsonb_agg(to_jsonb(a) order by a.id)::text from public.event_publication_assignments a where a.publication_version_id=current_setting('test.share_v1')::uuid),current_setting('test.share_v1_assignments'),'sealed v1 assignments unchanged');
select is((select count(*) from public.event_publication_versions where event_id='6c500000-0000-4000-8000-000000000001'),3::bigint,'sharing does not create or delete publication history');
select is((select count(*) from private.event_share_links where event_id='6c500000-0000-4000-8000-000000000001'),3::bigint,'failed rotations leave no partial historical link records');
-- The unpublished secondary Event has no current-version FK complications.
delete from public.events where id='6c500000-0000-4000-8000-000000000002';
select is((select count(*) from private.event_share_links where event_id='6c500000-0000-4000-8000-000000000002'),0::bigint,'Event cascade cleans link history');
set local role anon;
select is((select count(*) from public.resolve_event_share_link(pg_temp.share_token(2))),0::bigint,'revoked token stays unavailable after restoring active Event');
select is((select version_number from public.resolve_event_share_link(pg_temp.share_token(3))),3,'fresh bearer still resolves current sealed version');
reset role;
select is(encode(pg_temp.provisioning_mac('create','6c000000-0000-4000-8000-000000000001','6c100000-0000-4000-8000-000000000001','6c500000-0000-4000-8000-000000000001','6c800000-0000-4000-8000-000000000099',null,repeat('a',64),decode(repeat('ab',32),'hex'),decode(repeat('ef',12),'hex'),decode(repeat('cd',16),'hex'),'test_key_v1','sql_test_v1',1800000000),'hex'),'88e196da02a40433791af57fce376f7cd19838d8d9f9ccf30eba0a8ce0ce5027','Node UTF-8 HMAC golden vector matches SQL encoding');

reset role;
set local request.jwt.claim.sub='6c000000-0000-4000-8000-000000000001';
create function pg_temp.verify_clock(delta integer) returns void language plpgsql as $$
declare
 expiry bigint := floor(extract(epoch from clock_timestamp()))::bigint+delta;
 actor uuid:=auth.uid(); guild uuid:='6c100000-0000-4000-8000-000000000001'; event uuid:='6c500000-0000-4000-8000-000000000001'; link uuid:='6c800000-0000-4000-8000-000000000099';
 cipher bytea:=decode(repeat('ab',32),'hex');nonce bytea:=decode(repeat('ef',12),'hex');tag bytea:=decode(repeat('cd',16),'hex');
begin
 perform private.verify_event_share_link_provisioning('create',actor,guild,event,link,null,repeat('a',64),cipher,nonce,tag,'test_key_v1','sql_test_v1',expiry,
 pg_temp.provisioning_mac('create',actor,guild,event,link,null,repeat('a',64),cipher,nonce,tag,'test_key_v1','sql_test_v1',expiry));
end;
$$;
select lives_ok('select pg_temp.verify_clock(-3)','explicit clock skew accepts recent expiration');
select lives_ok('select pg_temp.verify_clock(125)','bounded future expiry with skew accepted');
select throws_ok('select pg_temp.verify_clock(-6)','42501',null,'beyond past skew denied');
select throws_ok('select pg_temp.verify_clock(126)','42501',null,'beyond future skew denied');

select * from finish();
rollback;
