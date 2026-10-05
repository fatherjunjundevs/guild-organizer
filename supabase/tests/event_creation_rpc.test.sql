begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select has_function(
  'public',
  'create_event_from_template',
  array['uuid', 'text', 'text'],
  'create_event_from_template RPC exists'
);

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'event-create-owner-a@test.local'),
  ('e0000000-0000-0000-0000-000000000002', 'event-create-manager-a@test.local'),
  ('e0000000-0000-0000-0000-000000000003', 'event-create-template-manager-a@test.local'),
  ('e0000000-0000-0000-0000-000000000004', 'event-create-publish-manager-a@test.local'),
  ('e0000000-0000-0000-0000-000000000005', 'event-create-member-a@test.local'),
  ('e0000000-0000-0000-0000-000000000006', 'event-create-owner-b@test.local');

insert into public.guilds (id, name, created_by) values
  ('e1000000-0000-0000-0000-000000000001', 'Event Creation Guild A', 'e0000000-0000-0000-0000-000000000001'),
  ('e2000000-0000-0000-0000-000000000001', 'Event Creation Guild B', 'e0000000-0000-0000-0000-000000000006');

insert into public.guild_memberships (id, guild_id, user_id, role) values
  ('e1100000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'owner'),
  ('e1100000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'officer'),
  ('e1100000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'officer'),
  ('e1100000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'officer'),
  ('e1100000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'member'),
  ('e2200000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006', 'owner');

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
)
values
  ('e1000000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000002', 'events.manage', 'e0000000-0000-0000-0000-000000000001'),
  ('e1000000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000003', 'templates.manage', 'e0000000-0000-0000-0000-000000000001'),
  ('e1000000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000004', 'publish.manage', 'e0000000-0000-0000-0000-000000000001');

insert into public.event_types (id, guild_id, name, status, created_by) values
  ('e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Guild League', 'active', 'e0000000-0000-0000-0000-000000000001'),
  ('e3000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'Boss Hunt', 'active', 'e0000000-0000-0000-0000-000000000001'),
  ('e3000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'Draft Type', 'active', 'e0000000-0000-0000-0000-000000000001'),
  ('e3000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 'Invalid Type', 'active', 'e0000000-0000-0000-0000-000000000001'),
  ('e4000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Guild League', 'active', 'e0000000-0000-0000-0000-000000000006');

insert into public.event_templates (
  id, guild_id, event_type_id, name, uses_areas, status, created_by
)
values
  ('e5000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001', 'League Area Template', true, 'active', 'e0000000-0000-0000-0000-000000000001'),
  ('e5000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000002', 'Flat Hunt Template', false, 'active', 'e0000000-0000-0000-0000-000000000001'),
  ('e5000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000003', 'Draft Template', false, 'draft', 'e0000000-0000-0000-0000-000000000001'),
  ('e5000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000004', 'Invalid Active Template', false, 'active', 'e0000000-0000-0000-0000-000000000001'),
  ('e6000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000001', 'League B Template', false, 'active', 'e0000000-0000-0000-0000-000000000006');

insert into public.event_template_areas (id, guild_id, template_id, name, sort_order)
values ('e5100000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'Sun', 0);

insert into public.event_template_sections (id, guild_id, template_id, area_id, name, sort_order) values
  ('e5110000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e5100000-0000-0000-0000-000000000001', 'Alpha', 0),
  ('e5210000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000002', null, 'Main', 0),
  ('e5310000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000003', null, 'Draft Team', 0),
  ('e6110000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', null, 'Guild B Team', 0);

insert into public.event_template_parties (id, guild_id, template_id, section_id, name, sort_order) values
  ('e5120000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e5110000-0000-0000-0000-000000000001', 'Party 1', 0),
  ('e5120000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e5110000-0000-0000-0000-000000000001', 'Party 2', 1),
  ('e5220000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000002', 'e5210000-0000-0000-0000-000000000001', 'Main Party', 0),
  ('e5320000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000003', 'e5310000-0000-0000-0000-000000000001', 'Draft Party', 0),
  ('e6120000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', 'e6110000-0000-0000-0000-000000000001', 'Guild B Party', 0);

insert into public.event_template_slots (id, guild_id, template_id, party_id, name, role_label, sort_order) values
  ('e5130000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e5120000-0000-0000-0000-000000000001', 'Seat 1', 'Tank', 0),
  ('e5130000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e5120000-0000-0000-0000-000000000001', 'Seat 2', 'Healer', 1),
  ('e5130000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'e5120000-0000-0000-0000-000000000002', 'Seat 1', null, 0),
  ('e5230000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000002', 'e5220000-0000-0000-0000-000000000001', 'Seat 1', null, 0),
  ('e5330000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000003', 'e5320000-0000-0000-0000-000000000001', 'Seat 1', null, 0),
  ('e6130000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001', 'e6120000-0000-0000-0000-000000000001', 'Seat 1', null, 0);

set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000001';

select set_config(
  'test.area_event_id',
  public.create_event_from_template(
    'e5000000-0000-0000-0000-000000000001',
    'League Week 1',
    'Opening week'
  )::text,
  true
);

select is((select source_template_id from public.events where id = current_setting('test.area_event_id')::uuid), 'e5000000-0000-0000-0000-000000000001'::uuid, 'created Event retains source Template provenance');
select is((select event_type_id from public.events where id = current_setting('test.area_event_id')::uuid), 'e3000000-0000-0000-0000-000000000001'::uuid, 'created Event derives the source Template Event Type');
select is((select event_type_name_snapshot from public.events where id = current_setting('test.area_event_id')::uuid), 'Guild League'::text, 'Event snapshots the Event Type name');
select is((select template_name_snapshot from public.events where id = current_setting('test.area_event_id')::uuid), 'League Area Template'::text, 'Event snapshots the Template name');
select is((select description from public.events where id = current_setting('test.area_event_id')::uuid), 'Opening week'::text, 'Event stores its organizer-provided description');
select is((select uses_areas from public.events where id = current_setting('test.area_event_id')::uuid), true, 'Area mode is copied into the Event');
select is((select count(*) from public.event_areas where event_id = current_setting('test.area_event_id')::uuid), 1::bigint, 'Area-based Event receives one copied Area');
select is((select count(*) from public.event_sections where event_id = current_setting('test.area_event_id')::uuid), 1::bigint, 'Area-based Event receives its copied Section');
select is((select count(*) from public.event_parties where event_id = current_setting('test.area_event_id')::uuid), 2::bigint, 'Area-based Event receives both copied Parties');
select is((select count(*) from public.event_slots where event_id = current_setting('test.area_event_id')::uuid), 3::bigint, 'Area-based Event receives all copied Slots');
select is((select role_label from public.event_slots where event_id = current_setting('test.area_event_id')::uuid and name = 'Seat 1' and role_label is not null order by sort_order limit 1), 'Tank'::text, 'Event snapshot preserves a Slot role requirement');
select is((select role_label from public.event_slots where event_id = current_setting('test.area_event_id')::uuid and name = 'Seat 2' limit 1), 'Healer'::text, 'Event snapshot preserves the second ordered role requirement');
select isnt((select id from public.event_areas where event_id = current_setting('test.area_event_id')::uuid limit 1), 'e5100000-0000-0000-0000-000000000001'::uuid, 'Event Area receives a fresh Event-owned UUID');
select is((select s.area_id from public.event_sections s where s.event_id = current_setting('test.area_event_id')::uuid limit 1), (select a.id from public.event_areas a where a.event_id = current_setting('test.area_event_id')::uuid limit 1), 'copied Event Section references the copied Event Area');
select is((select count(*) from public.event_slots es join public.event_template_slots ts on ts.id = es.id where es.event_id = current_setting('test.area_event_id')::uuid), 0::bigint, 'Event Slots receive fresh UUIDs instead of reusing Template Slot identity');

select lives_ok(
  $$select public.update_event_template_slot('e5130000-0000-0000-0000-000000000001'::uuid, 'e5120000-0000-0000-0000-000000000001'::uuid, 'Tank Seat Updated', 'Main Tank Updated', 0)$$,
  'source Template may be edited after Event creation'
);
select is((select status from public.event_templates where id = 'e5000000-0000-0000-0000-000000000001'), 'draft'::text, 'editing the source Template correctly returns it to draft');
select is((select name from public.event_slots where event_id = current_setting('test.area_event_id')::uuid and role_label = 'Tank' limit 1), 'Seat 1'::text, 'later Template Slot rename does not alter Event Slot name');
select is((select role_label from public.event_slots where event_id = current_setting('test.area_event_id')::uuid and name = 'Seat 1' and role_label is not null limit 1), 'Tank'::text, 'later Template role edit does not alter Event role requirement');

select set_config(
  'test.flat_event_id',
  public.create_event_from_template('e5000000-0000-0000-0000-000000000002', 'Boss Hunt Week 1', null)::text,
  true
);
select ok(current_setting('test.flat_event_id')::uuid is not null, 'owner can create a flat Event from an active Template');
select is((select count(*) from public.event_areas where event_id = current_setting('test.flat_event_id')::uuid), 0::bigint, 'flat Event does not receive synthetic Areas');
select is((select area_id is null from public.event_sections where event_id = current_setting('test.flat_event_id')::uuid limit 1), true, 'flat Event Section remains a root Section');
select is((select count(*) from public.event_slots where event_id = current_setting('test.flat_event_id')::uuid), 1::bigint, 'flat Event receives its Template Slot');

set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000002';
select set_config(
  'test.officer_event_id',
  public.create_event_from_template('e5000000-0000-0000-0000-000000000002', 'Officer Boss Hunt', null)::text,
  true
);
select is((select created_by from public.events where id = current_setting('test.officer_event_id')::uuid), 'e0000000-0000-0000-0000-000000000002'::uuid, 'events.manage Officer can create an Event and receives audit attribution');

set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000003';
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000002'::uuid, 'Template Manager Attempt', null)$$, '42501', null, 'templates.manage alone cannot create Events');
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000004';
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000002'::uuid, 'Publisher Attempt', null)$$, '42501', null, 'publish.manage alone cannot create Events');
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000005';
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000002'::uuid, 'Member Attempt', null)$$, '42501', null, 'ordinary Member cannot create Events');
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000006';
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000002'::uuid, 'Cross Guild Attempt', null)$$, '42501', null, 'Owner of another Guild cannot create an Event from a foreign Template');

set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000001';
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000003'::uuid, 'Draft Attempt', null)$$, '23514', null, 'draft Template cannot create an Event');
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000004'::uuid, 'Invalid Active Attempt', null)$$, '23514', null, 'active-but-invalid Template is rejected by the canonical validation gate');
select is((select count(*) from public.events where guild_id = 'e1000000-0000-0000-0000-000000000001'), 3::bigint, 'failed Event creation attempts leave no partial Event rows');
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000002'::uuid, ' Padded Event ', null)$$, '22023', null, 'Event name must be trimmed');
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000002'::uuid, 'Too Long Description', repeat('x', 1001))$$, '22023', null, 'Event description length is bounded');

reset role;
set local role anon;
select throws_ok($$select public.create_event_from_template('e5000000-0000-0000-0000-000000000002'::uuid, 'Anonymous Attempt', null)$$, '42501', null, 'anonymous role cannot execute Event creation');
reset role;

select * from finish();
rollback;
