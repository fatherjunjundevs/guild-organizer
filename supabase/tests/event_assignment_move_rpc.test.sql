begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select has_function(
  'public',
  'move_event_slot_assignment',
  array['uuid', 'uuid'],
  'move_event_slot_assignment RPC exists'
);

insert into auth.users (id, email) values
  ('b0000000-0000-4000-8000-000000000001', 'move-owner@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'move-events-officer@test.local'),
  ('b0000000-0000-4000-8000-000000000003', 'move-roster-officer@test.local'),
  ('b0000000-0000-4000-8000-000000000004', 'move-owner-b@test.local');

insert into public.guilds (id, name, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'Move Guild A', 'b0000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000001', 'Move Guild B', 'b0000000-0000-4000-8000-000000000004');

insert into public.guild_memberships (id, guild_id, user_id, role) values
  ('b1100000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'owner'),
  ('b1100000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'officer'),
  ('b1100000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'officer'),
  ('b2200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'owner');

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
) values
  ('b1000000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000002', 'events.manage', 'b0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000003', 'roster.manage', 'b0000000-0000-4000-8000-000000000001');

insert into public.event_types (id, guild_id, name, status, created_by) values
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Siege', 'active', 'b0000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Siege', 'active', 'b0000000-0000-4000-8000-000000000004');

insert into public.event_templates (
  id, guild_id, event_type_id, name, uses_areas, status, created_by
) values
  ('b5000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'Move Template A', false, 'active', 'b0000000-0000-4000-8000-000000000001'),
  ('b6000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'Move Template B', false, 'active', 'b0000000-0000-4000-8000-000000000004');

insert into public.events (
  id, guild_id, event_type_id, source_template_id, name, status, created_by, updated_by
) values
  ('b7000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'Move Event A', 'active', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'Other Event A', 'active', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  ('b8000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'Move Event B', 'active', 'b0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004');

insert into public.event_sections (
  id, guild_id, event_id, area_id, name, sort_order
) values
  ('b7100000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', null, 'Main', 0),
  ('b7100000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000002', null, 'Other', 0),
  ('b8100000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000001', null, 'Main', 0);

insert into public.event_parties (
  id, guild_id, event_id, section_id, name, sort_order
) values
  ('b7200000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'b7100000-0000-4000-8000-000000000001', 'Party', 0),
  ('b7200000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000002', 'b7100000-0000-4000-8000-000000000002', 'Party', 0),
  ('b8200000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000001', 'b8100000-0000-4000-8000-000000000001', 'Party', 0);

insert into public.event_slots (
  id, guild_id, event_id, party_id, name, sort_order
) values
  ('b7300000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'b7200000-0000-4000-8000-000000000001', 'Seat 1', 0),
  ('b7300000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'b7200000-0000-4000-8000-000000000001', 'Seat 2', 1),
  ('b7300000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'b7200000-0000-4000-8000-000000000001', 'Seat 3', 2),
  ('b7300000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'b7200000-0000-4000-8000-000000000001', 'Seat 4', 3),
  ('b7300000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000002', 'b7200000-0000-4000-8000-000000000002', 'Seat 1', 0),
  ('b8300000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000001', 'b8200000-0000-4000-8000-000000000001', 'Seat 1', 0);

insert into public.characters (
  id, guild_id, ign, status, source_origin, created_by
) values
  ('ba000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Alpha', 'active', 'manual', 'b0000000-0000-4000-8000-000000000001'),
  ('ba000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'Beta', 'active', 'manual', 'b0000000-0000-4000-8000-000000000001');

insert into public.event_assignments (
  id, guild_id, event_id, slot_id, character_id, created_by, updated_by
) values
  ('bc000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'b7300000-0000-4000-8000-000000000001', 'ba000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  ('bc000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000001', 'b7300000-0000-4000-8000-000000000003', 'ba000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000001';

select is(
  public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000001',
    'b7300000-0000-4000-8000-000000000002'
  ),
  'moved'::text,
  'owner can move an assignment to an open Slot'
);

select is(
  (select count(*) from public.event_assignments where slot_id = 'b7300000-0000-4000-8000-000000000001'),
  0::bigint,
  'move leaves the source Slot open'
);

select is(
  (select character_id from public.event_assignments where slot_id = 'b7300000-0000-4000-8000-000000000002'),
  'ba000000-0000-4000-8000-000000000001'::uuid,
  'move places the source Character in the target Slot'
);

select is(
  public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000002',
    'b7300000-0000-4000-8000-000000000003'
  ),
  'swapped'::text,
  'dropping onto an occupied Slot swaps the two Characters'
);

select is(
  (select character_id from public.event_assignments where slot_id = 'b7300000-0000-4000-8000-000000000002'),
  'ba000000-0000-4000-8000-000000000002'::uuid,
  'swap moves the displaced target Character into the source Slot'
);

select is(
  (select character_id from public.event_assignments where slot_id = 'b7300000-0000-4000-8000-000000000003'),
  'ba000000-0000-4000-8000-000000000001'::uuid,
  'swap moves the dragged Character into the target Slot'
);

reset role;

insert into public.event_assignments (
  guild_id, event_id, slot_id, character_id, created_by, updated_by
) values (
  'b1000000-0000-4000-8000-000000000001',
  'b7000000-0000-4000-8000-000000000001',
  'b7300000-0000-4000-8000-000000000004',
  'ba000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000001';

select is(
  public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000003',
    'b7300000-0000-4000-8000-000000000004'
  ),
  'same_character'::text,
  'drop onto another Slot already holding the same Character is a safe no-op'
);

select throws_ok(
  $$select public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000002'::uuid,
    'b7300000-0000-4000-8000-000000000002'::uuid
  )$$,
  '22023',
  null,
  'source and target must be different Slots'
);

select throws_ok(
  $$select public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000001'::uuid,
    'b7300000-0000-4000-8000-000000000002'::uuid
  )$$,
  'P0002',
  null,
  'an open source Slot cannot be moved'
);

select throws_ok(
  $$select public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000002'::uuid,
    'b7300000-0000-4000-8000-000000000005'::uuid
  )$$,
  '23514',
  null,
  'target Slot must belong to the same Event'
);

select throws_ok(
  $$select public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000002'::uuid,
    'b8300000-0000-4000-8000-000000000001'::uuid
  )$$,
  '23514',
  null,
  'cross-Guild target Slot is rejected'
);

set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000002';

select lives_ok(
  $$select public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000002'::uuid,
    'b7300000-0000-4000-8000-000000000001'::uuid
  )$$,
  'events.manage Officer can move an Event assignment'
);

set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000003';

select throws_ok(
  $$select public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000001'::uuid,
    'b7300000-0000-4000-8000-000000000002'::uuid
  )$$,
  '42501',
  null,
  'roster.manage alone cannot move Event assignments'
);

reset role;
update public.events set status = 'archived'
where id = 'b7000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000001'::uuid,
    'b7300000-0000-4000-8000-000000000002'::uuid
  )$$,
  '55000',
  null,
  'archived Event rejects drag/drop mutation'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.move_event_slot_assignment(
    'b7300000-0000-4000-8000-000000000001'::uuid,
    'b7300000-0000-4000-8000-000000000002'::uuid
  )$$,
  '42501',
  null,
  'anonymous role cannot execute drag/drop mutation'
);

reset role;

select * from finish();
rollback;
