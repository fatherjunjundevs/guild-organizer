-- Phase 6.3A.5C.1: actual caller and effective privilege regressions.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(not rolcanlogin and not rolinherit and not rolbypassrls and not rolsuper
  and not rolcreatedb and not rolcreaterole and not rolreplication,
  'internal resolver role has all restricted attributes')
from pg_roles where rolname='go_event_share_resolver';
select ok(not exists(select 1 from pg_auth_members
  where member='go_event_share_resolver'::regrole or (roleid='go_event_share_resolver'::regrole
    and not (member='postgres'::regrole and grantor='supabase_admin'::regrole
      and admin_option and not inherit_option))),
  'no outgoing memberships or untrusted incoming members; trusted creator ADMIN only');
select ok(has_schema_privilege('go_event_share_resolver','public','USAGE'), 'resolver schema usage');
select ok(not has_schema_privilege('go_event_share_resolver','private','USAGE')
  and not has_schema_privilege('go_event_share_resolver','auth','USAGE'), 'protected schemas inaccessible');
select ok(has_function_privilege('go_event_share_resolver','public.resolve_event_share_link(text)','EXECUTE'),
  'internal resolver execution');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') and p.oid <> 'public.resolve_event_share_link(text)'::regprocedure
    and has_schema_privilege('go_event_share_resolver',n.oid,'USAGE')
    and has_function_privilege('go_event_share_resolver',p.oid,'EXECUTE')),
  'no other callable application functions through PUBLIC or explicit grants');
select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private','auth') and c.relkind in ('r','p','v','m','f')
    and (has_table_privilege('go_event_share_resolver',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege('go_event_share_resolver',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),
  'no effective protected table or column privileges');
select ok(not exists(select 1 from pg_namespace n where n.nspname in ('public','private','auth','extensions')
  and has_schema_privilege('go_event_share_resolver',n.oid,'CREATE')),'no application schema CREATE privilege');
select ok(not exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='public.resolve_event_share_link(text)'::regprocedure and a.grantee=0
    and a.privilege_type='EXECUTE'), 'no PUBLIC resolver execution');

-- Audit, rather than claim away, ambient PUBLIC privileges. CONNECT/TEMP and
-- built-in/extension functions may be available without resolver-specific grants.
select diag('Ambient internal role CONNECT='||has_database_privilege('go_event_share_resolver',current_database(),'CONNECT')
  ||', TEMP='||has_database_privilege('go_event_share_resolver',current_database(),'TEMP')
  ||'; effective application privileges are checked separately above.');
select diag('PUBLIC function EXECUTE without schema USAGE: '||n.nspname||'.'||p.proname)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private')
  and has_function_privilege('go_event_share_resolver',p.oid,'EXECUTE')
  and not has_schema_privilege('go_event_share_resolver',n.oid,'USAGE');

set local role anon;
select throws_ok($$select * from public.resolve_event_share_link('v1.'||repeat('A',43))$$,
  '42501',null,'anonymous caller denied, not an empty successful result');
reset role;
set local role authenticated;
select throws_ok($$select * from public.resolve_event_share_link('v1.'||repeat('A',43))$$,
  '42501',null,'authenticated caller denied before bearer validation');
reset role;
set local role service_role;
select throws_ok($$select * from public.resolve_event_share_link('v1.'||repeat('A',43))$$,
  '42501',null,'service role denied despite BYPASSRLS');
reset role;

-- The owned disposable runner supplies test-only pgTAP schema access.
-- SESSION AUTHORIZATION makes session_user unprivileged: SET ROLE from a
-- postgres session alone would not prove resistance to role escalation.
set session authorization go_event_share_resolver;
select is((select count(*) from public.resolve_event_share_link('v1.'||repeat('A',43))),0::bigint,
  'internal caller returns unavailable for an unknown canonical token');
select is((select count(*) from public.resolve_event_share_link('malformed')),0::bigint,
  'internal caller returns unavailable for malformed input');
select throws_ok($$select * from private.event_share_links$$,'42501',null,'private links inaccessible');
select throws_ok($$select * from public.guilds$$,'42501',null,'Guild records inaccessible');
select throws_ok($$select * from public.events$$,'42501',null,'draft Events inaccessible');
select throws_ok($$select * from public.characters$$,'42501',null,'roster inaccessible');
select throws_ok($$select * from auth.users$$,'42501',null,'Auth records inaccessible');
select throws_ok($$select public.revoke_event_share_link(null,null,null)$$,'42501',null,'management mutation inaccessible');
select throws_ok($$select public.create_event_share_link(null,null,null,null,null,null,null,null,null,null,null)$$,
  '42501',null,'create inaccessible even with provisioning-shaped arguments');
select throws_ok($$select public.rotate_event_share_link(null,null,null,null,null,null,null,null,null,null,null,null)$$,
  '42501',null,'rotate inaccessible even with provisioning-shaped arguments');
select throws_ok($$select * from public.get_event_share_link_management_state(null,null)$$,'42501',null,'management state inaccessible');
select throws_ok($$set role authenticated$$,'42501',null,'cannot assume authenticated role');
select throws_ok($$set role authenticator$$,'42501',null,'cannot assume Data API authenticator');
select throws_ok($$set role postgres$$,'42501',null,'cannot elevate to postgres');
select throws_ok($$create role go_forbidden_resolver_escalation$$,'42501',null,'cannot create roles');
reset session authorization;
select * from finish();
rollback;
