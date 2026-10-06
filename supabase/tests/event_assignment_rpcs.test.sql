begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

select has_function(
  'public',
  'get_event_builder_characters',
  array['uuid'],
  'get_event_builder_characters RPC exists'
);

select has_function(
  'public',
  'assign_event_slot',
  array['uuid', 'uuid'],
  'assign_event_slot RPC exists'
);

select has_function(
  'public',
  'clear_event_slot',
  array['uuid'],
  'clear_event_slot RPC exists'
);

-- ---------------------------------------------------------------------------
-- Users / Guilds / permissions
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'assignment-owner-a@test.local'),
  ('a0000000-0000-4000-8000-000000000002', 'assignment-events-officer@test.local'),
  ('a0000000-0000-4000-8000-000000000003', 'assignment-roster-officer@test.local'),
  ('a0000000-0000-4000-8000-000000000004', 'assignment-member@test.local'),
  ('a0000000-0000-4000-8000-000000000005', 'assignment-owner-b@test.local');

insert into public.guilds (id, name, created_by) values
  ('a1000000-0000-4000-8000-000000000001', 'Assignment Guild A', 'a0000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000001', 'Assignment Guild B', 'a0000000-0000-4000-8000-000000000005');

insert into public.guild_memberships (id, guild_id, user_id, role) values
  ('a1100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('a1100000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'officer'),
  ('a1100000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'officer'),
  ('a1100000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'member'),
  ('a2200000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'owner');

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
) values
  ('a1000000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000002', 'events.manage', 'a0000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000003', 'roster.manage', 'a0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Event fixtures
-- ---------------------------------------------------------------------------

insert into public.event_types (id, guild_id, name, status, created_by) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Siege', 'active', 'a0000000-0000-4000-8000-000000000001'),
  ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Siege', 'active', 'a0000000-0000-4000-8000-000000000005');

insert into public.event_templates (
  id, guild_id, event_type_id, name, uses_areas, status, created_by
) values
  ('a5000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Assignment Template A', false, 'active', 'a0000000-0000-4000-8000-000000000001'),
  ('a6000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'Assignment Template B', false, 'active', 'a0000000-0000-4000-8000-000000000005');

insert into public.events (
  id, guild_id, event_type_id, source_template_id, name, status, created_by, updated_by
) values
  ('a7000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'Assignment Event A', 'active', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('a8000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'Assignment Event B', 'active', 'a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005');

insert into public.event_sections (
  id, guild_id, event_id, area_id, name, sort_order
) values
  ('a7100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', null, 'Main Team', 0),
  ('a8100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', null, 'Main Team', 0);

insert into public.event_parties (
  id, guild_id, event_id, section_id, name, sort_order
) values
  ('a7200000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'a7100000-0000-4000-8000-000000000001', 'Party 1', 0),
  ('a8200000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'a8100000-0000-4000-8000-000000000001', 'Party 1', 0);

insert into public.event_slots (
  id, guild_id, event_id, party_id, name, role_label, sort_order
) values
  ('a7300000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000001', 'Seat 1', 'Tank', 0),
  ('a7300000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'a7200000-0000-4000-8000-000000000001', 'Seat 2', null, 1),
  ('a8300000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'a8200000-0000-4000-8000-000000000001', 'Seat 1', null, 0);

-- ---------------------------------------------------------------------------
-- Character fixtures
-- ---------------------------------------------------------------------------

insert into public.characters (
  id, guild_id, ign, level, class_name, guild_position, gear_score,
  online_status, status, source_origin, created_by
) values
  ('aa000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'AlphaTank', 90, 'Knight', 'Member', 120000, 'Online', 'active', 'manual', 'a0000000-0000-4000-8000-000000000001'),
  ('aa000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'BetaHeal', 88, 'Priest', 'Member', 115000, 'Offline', 'active', 'manual', 'a0000000-0000-4000-8000-000000000001'),
  ('aa000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'FormerMage', 85, 'Wizard', 'Member', 100000, 'Offline', 'inactive', 'manual', 'a0000000-0000-4000-8000-000000000001'),
  ('ab000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'ForeignKnight', 91, 'Knight', 'Member', 130000, 'Online', 'active', 'manual', 'a0000000-0000-4000-8000-000000000005');

insert into public.character_roster_profiles (
  guild_id, character_id, designation, role_label, created_by
) values
  ('a1000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'main', 'Tank', 'a0000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002', 'sub', 'Healer', 'a0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Owner: roster read + mutation semantics
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
  ),
  2::bigint,
  'Event Builder roster initially returns only active Guild Characters'
);

select is(
  (
    select role_label
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
    where character_id = 'aa000000-0000-4000-8000-000000000001'
  ),
  'Tank'::text,
  'Event Builder roster includes organizer role metadata'
);

select is(
  (
    select designation
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
    where character_id = 'aa000000-0000-4000-8000-000000000001'
  ),
  'main'::text,
  'Event Builder roster includes organizer designation'
);

select ok(
  public.assign_event_slot(
    'a7300000-0000-4000-8000-000000000001',
    'aa000000-0000-4000-8000-000000000001'
  ) is not null,
  'Owner can assign an active Character to a Slot'
);

select is(
  (
    select character_id
    from public.event_assignments
    where slot_id = 'a7300000-0000-4000-8000-000000000001'
  ),
  'aa000000-0000-4000-8000-000000000001'::uuid,
  'Slot stores the selected Character'
);

select is(
  (
    select cardinality(assigned_slot_ids)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
    where character_id = 'aa000000-0000-4000-8000-000000000001'
  ),
  1,
  'Event Builder roster reports one current assignment'
);

select lives_ok(
  $$
    select public.assign_event_slot(
      'a7300000-0000-4000-8000-000000000002'::uuid,
      'aa000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'same Character may occupy a second draft Slot for duplicate-warning detection'
);

select is(
  (
    select cardinality(assigned_slot_ids)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
    where character_id = 'aa000000-0000-4000-8000-000000000001'
  ),
  2,
  'duplicate draft assignment is represented in the read model'
);

select ok(
  public.assign_event_slot(
    'a7300000-0000-4000-8000-000000000001',
    'aa000000-0000-4000-8000-000000000002'
  ) is not null,
  'assigning an occupied Slot replaces its current Character atomically'
);

select is(
  (
    select character_id
    from public.event_assignments
    where slot_id = 'a7300000-0000-4000-8000-000000000001'
  ),
  'aa000000-0000-4000-8000-000000000002'::uuid,
  'replacement Character owns the occupied Slot'
);

select is(
  (
    select cardinality(assigned_slot_ids)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
    where character_id = 'aa000000-0000-4000-8000-000000000001'
  ),
  1,
  'replaced Character keeps only its remaining Slot'
);

select is(
  (
    select cardinality(assigned_slot_ids)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
    where character_id = 'aa000000-0000-4000-8000-000000000002'
  ),
  1,
  'replacement Character is reported as assigned'
);

select lives_ok(
  $$
    select public.clear_event_slot(
      'a7300000-0000-4000-8000-000000000002'::uuid
    )
  $$,
  'Owner can clear an Event Slot'
);

select is(
  (
    select count(*)
    from public.event_assignments
    where slot_id = 'a7300000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'clearing removes the draft assignment'
);

select is(
  (
    select cardinality(assigned_slot_ids)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
    where character_id = 'aa000000-0000-4000-8000-000000000001'
  ),
  0,
  'cleared active Character remains eligible with zero assignments'
);

select is(
  (
    select count(*)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
  ),
  2::bigint,
  'inactive unassigned Character remains excluded from eligible Event roster'
);

select throws_ok(
  $$
    select public.assign_event_slot(
      'a7300000-0000-4000-8000-000000000002'::uuid,
      'aa000000-0000-4000-8000-000000000003'::uuid
    )
  $$,
  '23514',
  null,
  'inactive Character cannot receive a new Event assignment'
);

select throws_ok(
  $$
    select public.assign_event_slot(
      'a7300000-0000-4000-8000-000000000002'::uuid,
      'ab000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'P0002',
  null,
  'Character from another Guild cannot be assigned'
);

-- ---------------------------------------------------------------------------
-- Capability boundaries
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';

select is(
  (
    select count(*)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
  ),
  2::bigint,
  'events.manage Officer can read the narrow Event Builder roster without roster.manage'
);

select lives_ok(
  $$
    select public.assign_event_slot(
      'a7300000-0000-4000-8000-000000000002'::uuid,
      'aa000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'events.manage Officer can assign an eligible Character'
);

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000003';

select throws_ok(
  $$
    select * from public.get_event_builder_characters(
      'a7000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'roster.manage alone cannot read Event Builder roster'
);

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';

select throws_ok(
  $$
    select * from public.get_event_builder_characters(
      'a7000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'ordinary Member cannot read Event Builder roster'
);

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';

select throws_ok(
  $$
    select * from public.get_event_builder_characters(
      'a7000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'Owner of another Guild cannot read a foreign Event Builder roster'
);

select throws_ok(
  $$
    select public.assign_event_slot(
      'a7300000-0000-4000-8000-000000000001'::uuid,
      'ab000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'Owner of another Guild cannot mutate a foreign Event Slot'
);

-- ---------------------------------------------------------------------------
-- Historical visibility + archived mutation protection
-- ---------------------------------------------------------------------------

reset role;

update public.event_assignments
set character_id = 'aa000000-0000-4000-8000-000000000003'
where slot_id = 'a7300000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
  ),
  3::bigint,
  'inactive Character remains visible while referenced by a draft assignment'
);

select is(
  (
    select character_status
    from public.get_event_builder_characters('a7000000-0000-4000-8000-000000000001')
    where character_id = 'aa000000-0000-4000-8000-000000000003'
  ),
  'inactive'::text,
  'historical assigned Character is explicitly marked inactive'
);

reset role;

update public.events
set status = 'archived'
where id = 'a7000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select public.assign_event_slot(
      'a7300000-0000-4000-8000-000000000001'::uuid,
      'aa000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '55000',
  null,
  'archived Event rejects new assignment changes'
);

select throws_ok(
  $$
    select public.clear_event_slot(
      'a7300000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '55000',
  null,
  'archived Event rejects assignment clearing'
);

reset role;
set local role anon;

select throws_ok(
  $$
    select * from public.get_event_builder_characters(
      'a7000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'anonymous role cannot execute Event Builder roster RPC'
);

select throws_ok(
  $$
    select public.assign_event_slot(
      'a7300000-0000-4000-8000-000000000001'::uuid,
      'aa000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'anonymous role cannot execute Event assignment mutation'
);

reset role;

select * from finish();
rollback;
