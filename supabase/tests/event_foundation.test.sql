begin;

create extension if not exists pgtap with schema extensions;

select plan(47);

select ok(to_regclass('public.events') is not null, 'events table exists');
select ok(to_regclass('public.event_areas') is not null, 'event_areas table exists');
select ok(to_regclass('public.event_sections') is not null, 'event_sections table exists');
select ok(to_regclass('public.event_parties') is not null, 'event_parties table exists');
select ok(to_regclass('public.event_slots') is not null, 'event_slots table exists');
select ok(to_regclass('public.event_assignments') is not null, 'event_assignments table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.events'::regclass), 'events has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_areas'::regclass), 'event_areas has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_sections'::regclass), 'event_sections has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_parties'::regclass), 'event_parties has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_slots'::regclass), 'event_slots has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_assignments'::regclass), 'event_assignments has RLS enabled');

select ok(
  exists (
    select 1 from public.capability_definitions
    where capability_key = 'events.manage' and is_active
  ),
  'events.manage capability exists and is active'
);
select ok(
  exists (
    select 1 from public.capability_definitions
    where capability_key = 'publish.manage' and is_active
  ),
  'publish.manage capability exists and is active'
);

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.events'::regclass
    and conname = 'events_source_template_fk' and contype = 'f'
), 'Events retain a Guild-scoped source Template foreign key');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.events'::regclass
    and conname = 'events_event_type_fk' and contype = 'f'
), 'Events retain a Guild-scoped Event Type foreign key');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.event_sections'::regclass
    and conname = 'event_sections_area_fk' and contype = 'f'
), 'Event Sections use a composite Event/Area foreign key');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.event_parties'::regclass
    and conname = 'event_parties_section_fk' and contype = 'f'
), 'Event Parties use a composite Event/Section foreign key');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.event_slots'::regclass
    and conname = 'event_slots_party_fk' and contype = 'f'
), 'Event Slots use a composite Event/Party foreign key');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.event_assignments'::regclass
    and conname = 'event_assignments_slot_fk' and contype = 'f'
), 'Assignments use a composite Event/Slot foreign key');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.event_assignments'::regclass
    and conname = 'event_assignments_character_fk' and contype = 'f'
), 'Assignments use a Guild-scoped Character foreign key');

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'event-owner-a@test.local'),
  ('d0000000-0000-0000-0000-000000000002', 'event-manager-a@test.local'),
  ('d0000000-0000-0000-0000-000000000003', 'publish-manager-a@test.local'),
  ('d0000000-0000-0000-0000-000000000004', 'plain-officer-a@test.local'),
  ('d0000000-0000-0000-0000-000000000005', 'event-member-a@test.local'),
  ('d0000000-0000-0000-0000-000000000006', 'event-owner-b@test.local');

insert into public.guilds (id, name, created_by) values
  ('d1000000-0000-0000-0000-000000000001', 'Event Guild A', 'd0000000-0000-0000-0000-000000000001'),
  ('d2000000-0000-0000-0000-000000000001', 'Event Guild B', 'd0000000-0000-0000-0000-000000000006');

insert into public.guild_memberships (id, guild_id, user_id, role) values
  ('d1100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'owner'),
  ('d1100000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'officer'),
  ('d1100000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'officer'),
  ('d1100000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'officer'),
  ('d1100000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'member'),
  ('d2200000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'owner');

insert into public.event_types (id, guild_id, name, status, created_by) values
  ('d3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Guild League', 'active', 'd0000000-0000-0000-0000-000000000001'),
  ('d3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'Boss Hunt', 'active', 'd0000000-0000-0000-0000-000000000001'),
  ('d3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'Draft Type', 'active', 'd0000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'Guild League', 'active', 'd0000000-0000-0000-0000-000000000006');

insert into public.event_templates (
  id, guild_id, event_type_id, name, uses_areas, status, created_by
) values
  ('d5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'League Area Template', true, 'active', 'd0000000-0000-0000-0000-000000000001'),
  ('d5000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002', 'Flat Hunt Template', false, 'active', 'd0000000-0000-0000-0000-000000000001'),
  ('d5000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000003', 'Draft Template', false, 'draft', 'd0000000-0000-0000-0000-000000000001'),
  ('d6000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'League B Template', false, 'active', 'd0000000-0000-0000-0000-000000000006');

insert into public.events (
  id, guild_id, event_type_id, source_template_id, name, created_by
) values
  ('d7000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'League Week 1', 'd0000000-0000-0000-0000-000000000001'),
  ('d7000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000002', 'Boss Hunt Week 1', 'd0000000-0000-0000-0000-000000000001'),
  ('d8000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', 'League B Week 1', 'd0000000-0000-0000-0000-000000000006');

insert into public.event_areas (id, guild_id, event_id, name, sort_order) values
  ('d7100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'Sun', 0);

insert into public.event_sections (id, guild_id, event_id, area_id, name, sort_order) values
  ('d7110000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7100000-0000-0000-0000-000000000001', 'Alpha', 0),
  ('d7210000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000002', null, 'Main', 0);

insert into public.event_parties (id, guild_id, event_id, section_id, name, sort_order) values
  ('d7120000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7110000-0000-0000-0000-000000000001', 'Party 1', 0),
  ('d7220000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000002', 'd7210000-0000-0000-0000-000000000001', 'Main Party', 0);

insert into public.event_slots (id, guild_id, event_id, party_id, name, role_label, sort_order) values
  ('d7130000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7120000-0000-0000-0000-000000000001', 'Seat 1', 'Tank', 0),
  ('d7130000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7120000-0000-0000-0000-000000000001', 'Seat 2', 'Healer', 1),
  ('d7230000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000002', 'd7220000-0000-0000-0000-000000000001', 'Seat 1', null, 0);

insert into public.characters (id, guild_id, ign, source_origin, created_by) values
  ('d9000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'TankMain', 'manual', 'd0000000-0000-0000-0000-000000000001'),
  ('d9000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'HealerMain', 'manual', 'd0000000-0000-0000-0000-000000000001'),
  ('da000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'ForeignMain', 'manual', 'd0000000-0000-0000-0000-000000000006');

insert into public.event_assignments (
  id, guild_id, event_id, slot_id, character_id, created_by
) values (
  'db000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'd7000000-0000-0000-0000-000000000001',
  'd7130000-0000-0000-0000-000000000001',
  'd9000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001'
);

select is((select event_type_name_snapshot from public.events where id = 'd7000000-0000-0000-0000-000000000001'), 'Guild League'::text, 'Event stores the source Event Type name snapshot');
select is((select template_name_snapshot from public.events where id = 'd7000000-0000-0000-0000-000000000001'), 'League Area Template'::text, 'Event stores the source Template name snapshot');
select is((select uses_areas from public.events where id = 'd7000000-0000-0000-0000-000000000001'), true, 'Area Event derives Area mode from its source Template');
select is((select uses_areas from public.events where id = 'd7000000-0000-0000-0000-000000000002'), false, 'flat Event derives flat mode from its source Template');
select is((select count(*) from public.event_slots where event_id = 'd7000000-0000-0000-0000-000000000001'), 2::bigint, 'Event-owned structure stores independent Slot rows');
select is((select count(*) from public.event_assignments where event_id = 'd7000000-0000-0000-0000-000000000001'), 1::bigint, 'Event assignment is stored against an Event-owned Slot');

select throws_ok($$
  insert into public.events (guild_id, event_type_id, source_template_id, name)
  values ('d1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000003', 'd5000000-0000-0000-0000-000000000003', 'Draft Source Event')
$$, '23514', null, 'Event cannot be created from a draft Template');

select throws_ok($$
  insert into public.events (guild_id, event_type_id, source_template_id, name)
  values ('d1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000001', 'Mismatched Event Type')
$$, '23514', null, 'Event Type must match its source Template');

select throws_ok($$
  update public.events set source_template_id = 'd5000000-0000-0000-0000-000000000002'
  where id = 'd7000000-0000-0000-0000-000000000001'
$$, '55000', null, 'Event source Template provenance is immutable');

select throws_ok($$
  update public.events set guild_id = 'd2000000-0000-0000-0000-000000000001'
  where id = 'd7000000-0000-0000-0000-000000000001'
$$, '55000', null, 'Event Guild scope is immutable');

select throws_ok($$
  insert into public.event_areas (guild_id, event_id, name, sort_order)
  values ('d1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000002', 'Not Allowed', 0)
$$, '23514', null, 'flat Events cannot contain Areas');

select throws_ok($$
  insert into public.event_sections (guild_id, event_id, area_id, name, sort_order)
  values ('d1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', null, 'Missing Area', 9)
$$, '23514', null, 'Area Events require Sections to belong to an Area');

select throws_ok($$
  insert into public.event_sections (guild_id, event_id, area_id, name, sort_order)
  values ('d1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000002', 'd7100000-0000-0000-0000-000000000001', 'Cross Event', 9)
$$, '23514', null, 'flat Event cannot reference an Area even when it belongs to another Event');

select throws_ok($$
  insert into public.event_parties (guild_id, event_id, section_id, name, sort_order)
  values ('d1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7210000-0000-0000-0000-000000000001', 'Cross Event Party', 9)
$$, '23503', null, 'Party cannot reference a Section from another Event');

select throws_ok($$
  insert into public.event_slots (guild_id, event_id, party_id, name, sort_order)
  values ('d1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7220000-0000-0000-0000-000000000001', 'Cross Event Slot', 9)
$$, '23503', null, 'Slot cannot reference a Party from another Event');

select throws_ok($$
  insert into public.event_assignments (guild_id, event_id, slot_id, character_id)
  values ('d1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7130000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000001')
$$, '23503', null, 'Assignment cannot reference a Character from another Guild');

select throws_ok($$
  insert into public.event_assignments (guild_id, event_id, slot_id, character_id)
  values ('d1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7130000-0000-0000-0000-000000000001', 'd9000000-0000-0000-0000-000000000002')
$$, '23505', null, 'one Event Slot cannot contain two Characters');

select lives_ok($$
  insert into public.event_assignments (id, guild_id, event_id, slot_id, character_id)
  values ('db000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'd7130000-0000-0000-0000-000000000002', 'd9000000-0000-0000-0000-000000000001')
$$, 'draft planning permits one Character to occupy multiple Slots for warning detection');

select is(
  (select count(*) from public.event_assignments
   where event_id = 'd7000000-0000-0000-0000-000000000001'
     and character_id = 'd9000000-0000-0000-0000-000000000001'),
  2::bigint,
  'duplicate Character assignment is representable for the warning engine'
);

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
select results_eq('select count(*) from public.events', array[2::bigint], 'Owner can read Events only for their own Guild');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000005';
select results_eq('select count(*) from public.events', array[0::bigint], 'ordinary Member cannot read Event Builder management data');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000004';
select results_eq('select count(*) from public.events', array[0::bigint], 'Officer without events/publish capability cannot read Events');

reset role;
insert into public.guild_officer_capabilities (guild_id, membership_id, capability_key, granted_by) values
  ('d1000000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000002', 'events.manage', 'd0000000-0000-0000-0000-000000000001'),
  ('d1000000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000003', 'publish.manage', 'd0000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
select results_eq('select count(*) from public.event_slots', array[3::bigint], 'events.manage Officer can read Event structure');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';
select results_eq('select count(*) from public.event_assignments', array[2::bigint], 'publish.manage Officer can read current Event assignments for future publication');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
select throws_ok($$
  insert into public.events (guild_id, event_type_id, source_template_id, name)
  values ('d1000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 'Direct Write')
$$, '42501', null, 'authenticated application roles cannot directly write Events');

reset role;
set local role anon;
select throws_ok($$select count(*) from public.events$$, '42501', null, 'anonymous users cannot read Event Builder management data');
reset role;

select * from finish();
rollback;
