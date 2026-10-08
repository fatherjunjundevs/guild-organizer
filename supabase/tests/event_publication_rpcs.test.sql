begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

select has_function('public', 'publish_event', array['uuid'], 'publish_event RPC exists');
select has_function('public', 'update_event_publication', array['uuid'], 'update_event_publication RPC exists');
select has_function('public', 'unpublish_event', array['uuid'], 'unpublish_event RPC exists');

insert into auth.users (id, email) values
  ('6b000000-0000-4000-8000-000000000001', 'publish-owner-a@test.local'),
  ('6b000000-0000-4000-8000-000000000002', 'publish-events-officer@test.local'),
  ('6b000000-0000-4000-8000-000000000003', 'publish-officer@test.local'),
  ('6b000000-0000-4000-8000-000000000004', 'publish-member@test.local'),
  ('6b000000-0000-4000-8000-000000000005', 'publish-owner-b@test.local');

insert into public.guilds (id, name, created_by) values
  ('6b100000-0000-4000-8000-000000000001', 'Publish Guild A', '6b000000-0000-4000-8000-000000000001'),
  ('6b200000-0000-4000-8000-000000000001', 'Publish Guild B', '6b000000-0000-4000-8000-000000000005');

insert into public.guild_memberships (id, guild_id, user_id, role) values
  ('6b110000-0000-4000-8000-000000000001', '6b100000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000001', 'owner'),
  ('6b110000-0000-4000-8000-000000000002', '6b100000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000002', 'officer'),
  ('6b110000-0000-4000-8000-000000000003', '6b100000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000003', 'officer'),
  ('6b110000-0000-4000-8000-000000000004', '6b100000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000004', 'member'),
  ('6b210000-0000-4000-8000-000000000001', '6b200000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000005', 'owner');

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
) values
  ('6b100000-0000-4000-8000-000000000001', '6b110000-0000-4000-8000-000000000002', 'events.manage', '6b000000-0000-4000-8000-000000000001'),
  ('6b100000-0000-4000-8000-000000000001', '6b110000-0000-4000-8000-000000000003', 'publish.manage', '6b000000-0000-4000-8000-000000000001');

insert into public.event_types (id, guild_id, name, status, created_by) values (
  '6b300000-0000-4000-8000-000000000001',
  '6b100000-0000-4000-8000-000000000001',
  'Guild League',
  'active',
  '6b000000-0000-4000-8000-000000000001'
);

insert into public.event_templates (
  id, guild_id, event_type_id, name, uses_areas, status, created_by
) values (
  '6b400000-0000-4000-8000-000000000001',
  '6b100000-0000-4000-8000-000000000001',
  '6b300000-0000-4000-8000-000000000001',
  'League Template',
  false,
  'active',
  '6b000000-0000-4000-8000-000000000001'
);

insert into public.events (
  id, guild_id, event_type_id, source_template_id,
  name, description, status, created_by, updated_by
) values
  (
    '6b500000-0000-4000-8000-000000000001',
    '6b100000-0000-4000-8000-000000000001',
    '6b300000-0000-4000-8000-000000000001',
    '6b400000-0000-4000-8000-000000000001',
    'League Week 1',
    'Original draft',
    'active',
    '6b000000-0000-4000-8000-000000000001',
    '6b000000-0000-4000-8000-000000000001'
  ),
  (
    '6b500000-0000-4000-8000-000000000002',
    '6b100000-0000-4000-8000-000000000001',
    '6b300000-0000-4000-8000-000000000001',
    '6b400000-0000-4000-8000-000000000001',
    'Archived League',
    null,
    'active',
    '6b000000-0000-4000-8000-000000000001',
    '6b000000-0000-4000-8000-000000000001'
  );

update public.events
set status = 'archived'
where id = '6b500000-0000-4000-8000-000000000002';

insert into public.event_sections (
  id, guild_id, event_id, area_id, name, sort_order
) values (
  '6b510000-0000-4000-8000-000000000001',
  '6b100000-0000-4000-8000-000000000001',
  '6b500000-0000-4000-8000-000000000001',
  null,
  'Alpha',
  0
);

insert into public.event_parties (
  id, guild_id, event_id, section_id, name, sort_order
) values (
  '6b520000-0000-4000-8000-000000000001',
  '6b100000-0000-4000-8000-000000000001',
  '6b500000-0000-4000-8000-000000000001',
  '6b510000-0000-4000-8000-000000000001',
  'Party 1',
  0
);

insert into public.event_slots (
  id, guild_id, event_id, party_id, name, role_label, sort_order
) values
  (
    '6b530000-0000-4000-8000-000000000001',
    '6b100000-0000-4000-8000-000000000001',
    '6b500000-0000-4000-8000-000000000001',
    '6b520000-0000-4000-8000-000000000001',
    'Seat 1',
    'Tank',
    0
  ),
  (
    '6b530000-0000-4000-8000-000000000002',
    '6b100000-0000-4000-8000-000000000001',
    '6b500000-0000-4000-8000-000000000001',
    '6b520000-0000-4000-8000-000000000001',
    'Seat 2',
    null,
    1
  );

insert into public.characters (
  id, guild_id, ign, class_name, status, source_origin, created_by
) values
  (
    '6b600000-0000-4000-8000-000000000001',
    '6b100000-0000-4000-8000-000000000001',
    ' TankMain ',
    'Knight',
    'active',
    'manual',
    '6b000000-0000-4000-8000-000000000001'
  ),
  (
    '6b600000-0000-4000-8000-000000000002',
    '6b100000-0000-4000-8000-000000000001',
    'HealMain',
    'Priest',
    'active',
    'manual',
    '6b000000-0000-4000-8000-000000000001'
  );

insert into public.character_roster_profiles (
  guild_id, character_id, designation, role_label, created_by
) values
  (
    '6b100000-0000-4000-8000-000000000001',
    '6b600000-0000-4000-8000-000000000001',
    'main',
    'Tank',
    '6b000000-0000-4000-8000-000000000001'
  ),
  (
    '6b100000-0000-4000-8000-000000000001',
    '6b600000-0000-4000-8000-000000000002',
    'sub',
    'Healer',
    '6b000000-0000-4000-8000-000000000001'
  );

insert into public.event_assignments (
  id, guild_id, event_id, slot_id, character_id, created_by, updated_by
) values (
  '6b700000-0000-4000-8000-000000000001',
  '6b100000-0000-4000-8000-000000000001',
  '6b500000-0000-4000-8000-000000000001',
  '6b530000-0000-4000-8000-000000000001',
  '6b600000-0000-4000-8000-000000000001',
  '6b000000-0000-4000-8000-000000000001',
  '6b000000-0000-4000-8000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub = '6b000000-0000-4000-8000-000000000001';

select set_config(
  'test.publication_v1',
  public.publish_event('6b500000-0000-4000-8000-000000000001')::text,
  true
);

select is(
  (select status from public.event_publications where event_id = '6b500000-0000-4000-8000-000000000001'),
  'published'::text,
  'publish_event marks the Event publication published'
);

select is(
  (select version_number from public.event_publication_versions where id = current_setting('test.publication_v1')::uuid),
  1,
  'first publication receives version 1'
);

select ok(
  (select sealed_at is not null from public.event_publication_versions where id = current_setting('test.publication_v1')::uuid),
  'published version is sealed before becoming current'
);

select is(
  (select current_version_id from public.event_publications where event_id = '6b500000-0000-4000-8000-000000000001'),
  current_setting('test.publication_v1')::uuid,
  'publication current pointer references version 1'
);

select is(
  (select event_name_snapshot from public.event_publication_versions where id = current_setting('test.publication_v1')::uuid),
  'League Week 1'::text,
  'version 1 snapshots Event metadata'
);

select is(
  (select count(*) from public.event_publication_sections where publication_version_id = current_setting('test.publication_v1')::uuid),
  1::bigint,
  'version 1 snapshots all Event Sections'
);

select is(
  (select count(*) from public.event_publication_parties where publication_version_id = current_setting('test.publication_v1')::uuid),
  1::bigint,
  'version 1 snapshots all Event Parties'
);

select is(
  (select count(*) from public.event_publication_slots where publication_version_id = current_setting('test.publication_v1')::uuid),
  2::bigint,
  'version 1 snapshots all Event Slots'
);

select is(
  (select count(*) from public.event_publication_assignments where publication_version_id = current_setting('test.publication_v1')::uuid),
  1::bigint,
  'version 1 snapshots all current assignments'
);

select is(
  (
    select character_ign_snapshot
    from public.event_publication_assignments
    where publication_version_id = current_setting('test.publication_v1')::uuid
  ),
  ' TankMain '::text,
  'publication preserves exact Character IGN text'
);

select is(
  (
    select character_role_snapshot
    from public.event_publication_assignments
    where publication_version_id = current_setting('test.publication_v1')::uuid
  ),
  'Tank'::text,
  'publication snapshots organizer Character role'
);

select throws_ok(
  $$select public.publish_event('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '55000',
  null,
  'already-published Event rejects publish_event and requires update'
);

select is(
  (select count(*) from public.event_publication_versions where event_id = '6b500000-0000-4000-8000-000000000001'),
  1::bigint,
  'rejected duplicate publish creates no partial version'
);

reset role;

update public.events
set name = 'League Week 1 Updated',
    description = 'Updated draft'
where id = '6b500000-0000-4000-8000-000000000001';

update public.event_slots
set name = 'Frontline Seat'
where id = '6b530000-0000-4000-8000-000000000001';

update public.characters
set ign = 'TankMainRenamed',
    class_name = 'Lord Knight'
where id = '6b600000-0000-4000-8000-000000000001';

update public.character_roster_profiles
set role_label = 'Main Tank'
where character_id = '6b600000-0000-4000-8000-000000000001';

insert into public.event_assignments (
  id, guild_id, event_id, slot_id, character_id, created_by, updated_by
) values (
  '6b700000-0000-4000-8000-000000000002',
  '6b100000-0000-4000-8000-000000000001',
  '6b500000-0000-4000-8000-000000000001',
  '6b530000-0000-4000-8000-000000000002',
  '6b600000-0000-4000-8000-000000000002',
  '6b000000-0000-4000-8000-000000000001',
  '6b000000-0000-4000-8000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub = '6b000000-0000-4000-8000-000000000001';

select set_config(
  'test.publication_v2',
  public.update_event_publication('6b500000-0000-4000-8000-000000000001')::text,
  true
);

select is(
  (select version_number from public.event_publication_versions where id = current_setting('test.publication_v2')::uuid),
  2,
  'publication update creates immutable version 2'
);

select isnt(
  current_setting('test.publication_v2')::uuid,
  current_setting('test.publication_v1')::uuid,
  'publication update creates a fresh version UUID'
);

select is(
  (select current_version_id from public.event_publications where event_id = '6b500000-0000-4000-8000-000000000001'),
  current_setting('test.publication_v2')::uuid,
  'publication update moves current pointer to version 2'
);

select is(
  (select event_name_snapshot from public.event_publication_versions where id = current_setting('test.publication_v1')::uuid),
  'League Week 1'::text,
  'version 1 Event metadata remains unchanged'
);

select is(
  (select event_name_snapshot from public.event_publication_versions where id = current_setting('test.publication_v2')::uuid),
  'League Week 1 Updated'::text,
  'version 2 receives latest Event metadata'
);

select is(
  (
    select name
    from public.event_publication_slots
    where publication_version_id = current_setting('test.publication_v1')::uuid
      and source_event_slot_id = '6b530000-0000-4000-8000-000000000001'
  ),
  'Seat 1'::text,
  'version 1 Slot snapshot remains unchanged'
);

select is(
  (
    select name
    from public.event_publication_slots
    where publication_version_id = current_setting('test.publication_v2')::uuid
      and source_event_slot_id = '6b530000-0000-4000-8000-000000000001'
  ),
  'Frontline Seat'::text,
  'version 2 receives latest Slot name'
);

select is(
  (
    select character_ign_snapshot
    from public.event_publication_assignments
    where publication_version_id = current_setting('test.publication_v1')::uuid
      and source_character_id = '6b600000-0000-4000-8000-000000000001'
  ),
  ' TankMain '::text,
  'version 1 Character IGN remains unchanged'
);

select is(
  (
    select character_ign_snapshot
    from public.event_publication_assignments
    where publication_version_id = current_setting('test.publication_v2')::uuid
      and source_character_id = '6b600000-0000-4000-8000-000000000001'
  ),
  'TankMainRenamed'::text,
  'version 2 receives latest Character IGN'
);

select is(
  (
    select character_role_snapshot
    from public.event_publication_assignments
    where publication_version_id = current_setting('test.publication_v2')::uuid
      and source_character_id = '6b600000-0000-4000-8000-000000000001'
  ),
  'Main Tank'::text,
  'version 2 receives latest organizer Character role'
);

select is(
  (select count(*) from public.event_publication_assignments where publication_version_id = current_setting('test.publication_v2')::uuid),
  2::bigint,
  'version 2 receives latest assignment set'
);

select lives_ok(
  $$select public.unpublish_event('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  'published Event can be unpublished'
);

select is(
  (select status from public.event_publications where event_id = '6b500000-0000-4000-8000-000000000001'),
  'unpublished'::text,
  'unpublish_event records unpublished state'
);

select ok(
  (select current_version_id is null from public.event_publications where event_id = '6b500000-0000-4000-8000-000000000001'),
  'unpublish_event clears the current version pointer'
);

select is(
  (select count(*) from public.event_publication_versions where event_id = '6b500000-0000-4000-8000-000000000001'),
  2::bigint,
  'unpublish preserves all historical publication versions'
);

select throws_ok(
  $$select public.update_event_publication('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '55000',
  null,
  'unpublished Event rejects publication update'
);

select throws_ok(
  $$select public.unpublish_event('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '55000',
  null,
  'already-unpublished Event rejects duplicate unpublish'
);

select is(
  (select count(*) from public.event_publication_versions where event_id = '6b500000-0000-4000-8000-000000000001'),
  2::bigint,
  'rejected lifecycle operations leave publication history unchanged'
);

select set_config(
  'test.publication_v3',
  public.publish_event('6b500000-0000-4000-8000-000000000001')::text,
  true
);

select is(
  (select version_number from public.event_publication_versions where id = current_setting('test.publication_v3')::uuid),
  3,
  'republishing after unpublish creates the next version instead of reusing history'
);

select is(
  (select current_version_id from public.event_publications where event_id = '6b500000-0000-4000-8000-000000000001'),
  current_setting('test.publication_v3')::uuid,
  'republish makes version 3 current'
);

select throws_ok(
  $$select public.publish_event('6b500000-0000-4000-8000-000000000002'::uuid)$$,
  '55000',
  null,
  'archived Event cannot be published'
);

set local request.jwt.claim.sub = '6b000000-0000-4000-8000-000000000002';

select throws_ok(
  $$select public.update_event_publication('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '42501',
  null,
  'events.manage alone cannot update a publication'
);

set local request.jwt.claim.sub = '6b000000-0000-4000-8000-000000000003';

select set_config(
  'test.publication_v4',
  public.update_event_publication('6b500000-0000-4000-8000-000000000001')::text,
  true
);

select is(
  (select version_number from public.event_publication_versions where id = current_setting('test.publication_v4')::uuid),
  4,
  'publish.manage Officer can create the next publication version'
);

select lives_ok(
  $$select public.unpublish_event('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  'publish.manage Officer can unpublish the Event'
);

set local request.jwt.claim.sub = '6b000000-0000-4000-8000-000000000004';

select throws_ok(
  $$select public.publish_event('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '42501',
  null,
  'ordinary Member cannot publish an Event'
);

set local request.jwt.claim.sub = '6b000000-0000-4000-8000-000000000005';

select throws_ok(
  $$select public.publish_event('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '42501',
  null,
  'Owner of another Guild cannot publish a foreign Event'
);

-- The foreign-Guild Owner correctly sees zero Guild A publication rows through
-- RLS. Switch back to an authorized Guild A actor before checking the stored
-- version count so this assertion verifies mutation side effects, not RLS
-- visibility.
set local request.jwt.claim.sub = '6b000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.event_publication_versions where event_id = '6b500000-0000-4000-8000-000000000001'),
  4::bigint,
  'unauthorized publication attempts create no additional versions'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.publish_event('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '42501',
  null,
  'anonymous role cannot execute publish_event'
);

select throws_ok(
  $$select public.update_event_publication('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '42501',
  null,
  'anonymous role cannot execute update_event_publication'
);

select throws_ok(
  $$select public.unpublish_event('6b500000-0000-4000-8000-000000000001'::uuid)$$,
  '42501',
  null,
  'anonymous role cannot execute unpublish_event'
);

reset role;

select * from finish();
rollback;
