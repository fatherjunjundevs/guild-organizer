begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

-- Schema / security foundation.
select ok(to_regclass('public.event_types') is not null, 'event_types table exists');
select ok(to_regclass('public.event_templates') is not null, 'event_templates table exists');
select ok(to_regclass('public.event_template_areas') is not null, 'event_template_areas table exists');
select ok(to_regclass('public.event_template_sections') is not null, 'event_template_sections table exists');
select ok(to_regclass('public.event_template_parties') is not null, 'event_template_parties table exists');
select ok(to_regclass('public.event_template_slots') is not null, 'event_template_slots table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.event_types'::regclass), 'event_types has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_templates'::regclass), 'event_templates has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_template_areas'::regclass), 'event_template_areas has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_template_sections'::regclass), 'event_template_sections has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_template_parties'::regclass), 'event_template_parties has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_template_slots'::regclass), 'event_template_slots has RLS enabled');

select ok(
  exists (
    select 1 from public.capability_definitions
    where capability_key = 'templates.manage' and is_active
  ),
  'templates.manage capability exists and is active'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_templates'::regclass
      and conname = 'event_templates_event_type_fk' and contype = 'f'
  ),
  'Templates use a Guild-scoped Event Type foreign key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_template_sections'::regclass
      and conname = 'event_template_sections_area_fk' and contype = 'f'
  ),
  'Sections use a composite Template/Area foreign key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_template_parties'::regclass
      and conname = 'event_template_parties_section_fk' and contype = 'f'
  ),
  'Parties use a composite Template/Section foreign key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_template_slots'::regclass
      and conname = 'event_template_slots_party_fk' and contype = 'f'
  ),
  'Slots use a composite Template/Party foreign key'
);

-- Test identities / Guilds.
insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-000000000001', 'template-owner-a@test.local'),
  ('80000000-0000-0000-0000-000000000002', 'template-officer-a@test.local'),
  ('80000000-0000-0000-0000-000000000003', 'event-officer-a@test.local'),
  ('80000000-0000-0000-0000-000000000004', 'plain-officer-a@test.local'),
  ('80000000-0000-0000-0000-000000000005', 'template-member-a@test.local'),
  ('80000000-0000-0000-0000-000000000006', 'template-owner-b@test.local');

insert into public.guilds (id, name, created_by) values
  ('81000000-0000-0000-0000-000000000001', 'Template Guild A', '80000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000001', 'Template Guild B', '80000000-0000-0000-0000-000000000006');

insert into public.guild_memberships (id, guild_id, user_id, role) values
  ('81100000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'owner'),
  ('81100000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 'officer'),
  ('81100000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000003', 'officer'),
  ('81100000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000004', 'officer'),
  ('81100000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000005', 'member'),
  ('82200000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000006', 'owner');

-- Valid reusable structures.
insert into public.event_types (id, guild_id, name, description, created_by) values
  ('83000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Guild League', 'Structured Guild League planning.', '80000000-0000-0000-0000-000000000001'),
  ('83000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', 'Boss Hunt', null, '80000000-0000-0000-0000-000000000001'),
  ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'Guild League', null, '80000000-0000-0000-0000-000000000006');

insert into public.event_templates (id, guild_id, event_type_id, name, uses_areas, status, created_by) values
  ('85000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'League 40', true, 'draft', '80000000-0000-0000-0000-000000000001'),
  ('85000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000002', 'Quick Hunt', false, 'draft', '80000000-0000-0000-0000-000000000001'),
  ('86000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'League B', true, 'draft', '80000000-0000-0000-0000-000000000006');

insert into public.event_template_areas (id, guild_id, template_id, name, sort_order) values
  ('87000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'Sun', 0),
  ('88000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', 'Moon', 0);

insert into public.event_template_sections (id, guild_id, template_id, area_id, name, sort_order) values
  ('87100000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', 'Alpha', 0),
  ('87400000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002', null, 'Main', 0);

insert into public.event_template_parties (id, guild_id, template_id, section_id, name, sort_order) values
  ('87200000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '87100000-0000-0000-0000-000000000001', 'Party 1', 0),
  ('87500000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002', '87400000-0000-0000-0000-000000000001', 'Main Party', 0);

insert into public.event_template_slots (id, guild_id, template_id, party_id, name, role_label, sort_order) values
  ('87300000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '87200000-0000-0000-0000-000000000001', 'Seat 1', 'Tank', 0),
  ('87300000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '87200000-0000-0000-0000-000000000001', 'Seat 2', 'Healer', 1),
  ('87600000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002', '87500000-0000-0000-0000-000000000001', 'Seat 1', null, 0);

select is((select count(*) from public.event_template_areas where guild_id = '81000000-0000-0000-0000-000000000001'), 1::bigint, 'Area-based template stores its optional top-level Area');
select is((select count(*) from public.event_template_sections where guild_id = '81000000-0000-0000-0000-000000000001'), 2::bigint, 'Area-based and flat templates both store Sections');
select is((select count(*) from public.event_template_slots where guild_id = '81000000-0000-0000-0000-000000000001'), 3::bigint, 'Slot rows are the source of truth for seat count');

-- Structural integrity / validation.
select throws_ok(
  $$insert into public.event_types (guild_id, name)
    values ('81000000-0000-0000-0000-000000000001', 'guild league')$$,
  '23505', null, 'live Event Type names are unique case-insensitively per Guild'
);

select throws_ok(
  $$insert into public.event_templates (guild_id, event_type_id, name)
    values ('81000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'LEAGUE 40')$$,
  '23505', null, 'live Template names are unique case-insensitively within an Event Type'
);

select throws_ok(
  $$insert into public.event_types (guild_id, name)
    values ('81000000-0000-0000-0000-000000000001', ' Padded ')$$,
  '23514', null, 'Event Type names must be trimmed'
);

select throws_ok(
  $$insert into public.event_templates (guild_id, event_type_id, name, status)
    values ('81000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Invalid Status', 'published')$$,
  '23514', null, 'Template status is constrained'
);

select throws_ok(
  $$insert into public.event_template_areas (guild_id, template_id, name, sort_order)
    values ('81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'Negative', -1)$$,
  '23514', null, 'negative structural sort order is rejected'
);

select throws_ok(
  $$insert into public.event_template_areas (guild_id, template_id, name)
    values ('81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002', 'Not Allowed')$$,
  '23514', null, 'flat templates cannot contain Areas'
);

select throws_ok(
  $$insert into public.event_template_sections (guild_id, template_id, area_id, name)
    values ('81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', null, 'Missing Area')$$,
  '23514', null, 'Area-based templates require Sections to belong to an Area'
);

select throws_ok(
  $$insert into public.event_template_sections (guild_id, template_id, area_id, name)
    values ('81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000001', 'Cross Guild')$$,
  '23503', null, 'a Section cannot reference an Area from another Guild or Template'
);

select throws_ok(
  $$insert into public.event_template_parties (guild_id, template_id, section_id, name)
    values ('81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '87400000-0000-0000-0000-000000000001', 'Cross Template Party')$$,
  '23503', null, 'a Party cannot reference a Section from another Template'
);

select throws_ok(
  $$insert into public.event_template_slots (guild_id, template_id, party_id, name)
    values ('81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '87500000-0000-0000-0000-000000000001', 'Cross Template Slot')$$,
  '23503', null, 'a Slot cannot reference a Party from another Template'
);

select throws_ok(
  $$insert into public.event_template_slots (guild_id, template_id, party_id, name, role_label)
    values ('81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '87200000-0000-0000-0000-000000000001', 'Seat 3', ' Healer ')$$,
  '23514', null, 'Slot role labels are trimmed Guild-defined organizer metadata'
);

select throws_ok(
  $$update public.event_templates set uses_areas = true
    where id = '85000000-0000-0000-0000-000000000002'$$,
  '55000', null, 'Template Area mode cannot change after structure exists'
);

select throws_ok(
  $$update public.event_template_sections
    set template_id = '85000000-0000-0000-0000-000000000001'
    where id = '87400000-0000-0000-0000-000000000001'$$,
  '55000', null, 'child Template scope is immutable'
);

select throws_ok(
  $$delete from public.event_types
    where id = '83000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'Event Types referenced by Templates cannot be deleted'
);

-- RLS / capability behavior.
set local role authenticated;
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';

select results_eq('select count(*) from public.event_types', array[2::bigint], 'Owner can read Event Types only for their own Guild');
select results_eq('select count(*) from public.event_templates', array[2::bigint], 'Owner can read Templates only for their own Guild');
select results_eq('select count(*) from public.event_template_slots', array[3::bigint], 'Owner can read Template structure only for their own Guild');

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000005';
select results_eq('select count(*) from public.event_templates', array[0::bigint], 'Member cannot read reusable Template management data');

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000004';
select results_eq('select count(*) from public.event_templates', array[0::bigint], 'Officer without template/event capability cannot read Templates');

reset role;

insert into public.guild_officer_capabilities (guild_id, membership_id, capability_key, granted_by) values
  ('81000000-0000-0000-0000-000000000001', '81100000-0000-0000-0000-000000000002', 'templates.manage', '80000000-0000-0000-0000-000000000001'),
  ('81000000-0000-0000-0000-000000000001', '81100000-0000-0000-0000-000000000003', 'events.manage', '80000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000002';
select results_eq('select count(*) from public.event_templates', array[2::bigint], 'Officer with templates.manage can read their Guild Templates');
select results_eq('select count(*) from public.event_template_slots', array[3::bigint], 'Officer with templates.manage can read Template structure');

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000003';
select results_eq('select count(*) from public.event_templates', array[2::bigint], 'Officer with events.manage may read Templates for future Event creation');
select results_eq('select count(*) from public.event_template_areas', array[1::bigint], 'Officer with events.manage may read Template structure');

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';
select throws_ok(
  $$insert into public.event_types (guild_id, name)
    values ('81000000-0000-0000-0000-000000000001', 'Direct Write')$$,
  '42501', null, 'authenticated application roles cannot directly write Event Types'
);

reset role;
set local role anon;
select throws_ok(
  $$select count(*) from public.event_templates$$,
  '42501', null, 'anonymous users cannot read reusable Template management data'
);
reset role;

select * from finish();
rollback;
