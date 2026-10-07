begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

-- Foundation tables + RLS.
select ok(to_regclass('public.event_publications') is not null, 'event_publications table exists');
select ok(to_regclass('public.event_publication_versions') is not null, 'event_publication_versions table exists');
select ok(to_regclass('public.event_publication_areas') is not null, 'event_publication_areas table exists');
select ok(to_regclass('public.event_publication_sections') is not null, 'event_publication_sections table exists');
select ok(to_regclass('public.event_publication_parties') is not null, 'event_publication_parties table exists');
select ok(to_regclass('public.event_publication_slots') is not null, 'event_publication_slots table exists');
select ok(to_regclass('public.event_publication_assignments') is not null, 'event_publication_assignments table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.event_publications'::regclass), 'event_publications has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_publication_versions'::regclass), 'event_publication_versions has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_publication_areas'::regclass), 'event_publication_areas has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_publication_sections'::regclass), 'event_publication_sections has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_publication_parties'::regclass), 'event_publication_parties has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_publication_slots'::regclass), 'event_publication_slots has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.event_publication_assignments'::regclass), 'event_publication_assignments has RLS enabled');

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.event_publications'::regclass
    and conname = 'event_publications_current_version_fk'
    and contype = 'f'
), 'current publication pointer has a scoped version foreign key');

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.event_publication_assignments'::regclass
    and conname = 'event_publication_assignments_slot_fk'
    and contype = 'f'
), 'published assignments use a scoped published Slot foreign key');

-- Users / Guilds / capabilities.
insert into auth.users (id, email) values
  ('61000000-0000-4000-8000-000000000001', 'publication-owner-a@test.local'),
  ('61000000-0000-4000-8000-000000000002', 'publication-event-manager@test.local'),
  ('61000000-0000-4000-8000-000000000003', 'publication-publisher@test.local'),
  ('61000000-0000-4000-8000-000000000004', 'publication-member@test.local'),
  ('61000000-0000-4000-8000-000000000005', 'publication-owner-b@test.local');

insert into public.guilds (id, name, created_by) values
  ('61100000-0000-4000-8000-000000000001', 'Publication Guild A', '61000000-0000-4000-8000-000000000001'),
  ('61200000-0000-4000-8000-000000000001', 'Publication Guild B', '61000000-0000-4000-8000-000000000005');

insert into public.guild_memberships (id, guild_id, user_id, role) values
  ('61110000-0000-4000-8000-000000000001', '61100000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'owner'),
  ('61110000-0000-4000-8000-000000000002', '61100000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'officer'),
  ('61110000-0000-4000-8000-000000000003', '61100000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 'officer'),
  ('61110000-0000-4000-8000-000000000004', '61100000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000004', 'member'),
  ('61210000-0000-4000-8000-000000000001', '61200000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'owner');

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
) values
  ('61100000-0000-4000-8000-000000000001', '61110000-0000-4000-8000-000000000002', 'events.manage', '61000000-0000-4000-8000-000000000001'),
  ('61100000-0000-4000-8000-000000000001', '61110000-0000-4000-8000-000000000003', 'publish.manage', '61000000-0000-4000-8000-000000000001');

-- Source Event + roster fixtures.
insert into public.event_types (id, guild_id, name, status, created_by) values
  ('61300000-0000-4000-8000-000000000001', '61100000-0000-4000-8000-000000000001', 'Guild League', 'active', '61000000-0000-4000-8000-000000000001'),
  ('61300000-0000-4000-8000-000000000002', '61100000-0000-4000-8000-000000000001', 'Boss Hunt', 'active', '61000000-0000-4000-8000-000000000001');

insert into public.event_templates (
  id, guild_id, event_type_id, name, uses_areas, status, created_by
) values
  ('61400000-0000-4000-8000-000000000001', '61100000-0000-4000-8000-000000000001', '61300000-0000-4000-8000-000000000001', 'League Area Template', true, 'active', '61000000-0000-4000-8000-000000000001'),
  ('61400000-0000-4000-8000-000000000002', '61100000-0000-4000-8000-000000000001', '61300000-0000-4000-8000-000000000002', 'Boss Flat Template', false, 'active', '61000000-0000-4000-8000-000000000001');

insert into public.events (
  id, guild_id, event_type_id, source_template_id, name, description, created_by
) values
  ('61500000-0000-4000-8000-000000000001', '61100000-0000-4000-8000-000000000001', '61300000-0000-4000-8000-000000000001', '61400000-0000-4000-8000-000000000001', 'Saturday League', 'Published snapshot source', '61000000-0000-4000-8000-000000000001'),
  ('61500000-0000-4000-8000-000000000002', '61100000-0000-4000-8000-000000000001', '61300000-0000-4000-8000-000000000002', '61400000-0000-4000-8000-000000000002', 'Sunday Boss', null, '61000000-0000-4000-8000-000000000001');

insert into public.event_areas (
  id, guild_id, event_id, name, sort_order
) values (
  '61510000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000001',
  'Sun',
  0
);

insert into public.event_sections (
  id, guild_id, event_id, area_id, name, sort_order
) values (
  '61520000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000001',
  '61510000-0000-4000-8000-000000000001',
  'Alpha',
  0
);

insert into public.event_sections (
  id, guild_id, event_id, area_id, name, sort_order
) values (
  '61520000-0000-4000-8000-000000000002',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000002',
  null,
  'Main',
  0
);

insert into public.event_parties (
  id, guild_id, event_id, section_id, name, sort_order
) values
  ('61530000-0000-4000-8000-000000000001', '61100000-0000-4000-8000-000000000001', '61500000-0000-4000-8000-000000000001', '61520000-0000-4000-8000-000000000001', 'Party 1', 0),
  ('61530000-0000-4000-8000-000000000002', '61100000-0000-4000-8000-000000000001', '61500000-0000-4000-8000-000000000002', '61520000-0000-4000-8000-000000000002', 'Party 1', 0);

insert into public.event_slots (
  id, guild_id, event_id, party_id, name, role_label, sort_order
) values
  ('61540000-0000-4000-8000-000000000001', '61100000-0000-4000-8000-000000000001', '61500000-0000-4000-8000-000000000001', '61530000-0000-4000-8000-000000000001', 'Seat 1', 'Tank', 0),
  ('61540000-0000-4000-8000-000000000002', '61100000-0000-4000-8000-000000000001', '61500000-0000-4000-8000-000000000002', '61530000-0000-4000-8000-000000000002', 'Seat 1', null, 0);

insert into public.characters (
  id, guild_id, ign, class_name, status, source_origin, created_by
) values (
  '61550000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  'TankMain',
  'Knight',
  'active',
  'manual',
  '61000000-0000-4000-8000-000000000001'
);

insert into public.character_roster_profiles (
  guild_id, character_id, designation, role_label, created_by
) values (
  '61100000-0000-4000-8000-000000000001',
  '61550000-0000-4000-8000-000000000001',
  'main',
  'Tank',
  '61000000-0000-4000-8000-000000000001'
);

insert into public.event_assignments (
  id, guild_id, event_id, slot_id, character_id, created_by
) values (
  '61560000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000001',
  '61540000-0000-4000-8000-000000000001',
  '61550000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001'
);

-- Publication state rows are initially unpublished and have no current version.
insert into public.event_publications (
  id, guild_id, event_id, status, created_by, updated_by
) values
  ('61600000-0000-4000-8000-000000000001', '61100000-0000-4000-8000-000000000001', '61500000-0000-4000-8000-000000000001', 'unpublished', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001'),
  ('61600000-0000-4000-8000-000000000002', '61100000-0000-4000-8000-000000000001', '61500000-0000-4000-8000-000000000002', 'unpublished', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001');

select is(
  (select status from public.event_publications where id = '61600000-0000-4000-8000-000000000001'),
  'unpublished'::text,
  'new publication state can exist without a current version'
);

select throws_ok($$
  insert into public.event_publication_versions (
    id, guild_id, event_id, publication_id, version_number,
    source_event_type_id, source_template_id,
    event_name_snapshot, event_type_name_snapshot,
    template_name_snapshot, uses_areas, created_by
  ) values (
    '61700000-0000-4000-8000-000000000010',
    '61100000-0000-4000-8000-000000000001',
    '61500000-0000-4000-8000-000000000001',
    '61600000-0000-4000-8000-000000000001',
    0,
    '61300000-0000-4000-8000-000000000001',
    '61400000-0000-4000-8000-000000000001',
    'Invalid Version',
    'Guild League',
    'League Area Template',
    true,
    '61000000-0000-4000-8000-000000000001'
  )
$$, '23514', null, 'publication version number must be positive');

select throws_ok($$
  insert into public.event_publication_versions (
    id, guild_id, event_id, publication_id, version_number,
    source_event_type_id, source_template_id,
    event_name_snapshot, event_type_name_snapshot,
    template_name_snapshot, uses_areas, created_by, sealed_at
  ) values (
    '61700000-0000-4000-8000-000000000011',
    '61100000-0000-4000-8000-000000000001',
    '61500000-0000-4000-8000-000000000001',
    '61600000-0000-4000-8000-000000000001',
    9,
    '61300000-0000-4000-8000-000000000001',
    '61400000-0000-4000-8000-000000000001',
    'Direct Sealed Version',
    'Guild League',
    'League Area Template',
    true,
    '61000000-0000-4000-8000-000000000001',
    now()
  )
$$, '55000', null, 'publication version cannot be inserted already sealed');

insert into public.event_publication_versions (
  id, guild_id, event_id, publication_id, version_number,
  source_event_type_id, source_template_id,
  event_name_snapshot, event_description_snapshot,
  event_type_name_snapshot, template_name_snapshot,
  uses_areas, created_by
) values
  (
    '61700000-0000-4000-8000-000000000001',
    '61100000-0000-4000-8000-000000000001',
    '61500000-0000-4000-8000-000000000001',
    '61600000-0000-4000-8000-000000000001',
    1,
    '61300000-0000-4000-8000-000000000001',
    '61400000-0000-4000-8000-000000000001',
    'Saturday League',
    'Published snapshot source',
    'Guild League',
    'League Area Template',
    true,
    '61000000-0000-4000-8000-000000000001'
  ),
  (
    '61700000-0000-4000-8000-000000000002',
    '61100000-0000-4000-8000-000000000001',
    '61500000-0000-4000-8000-000000000002',
    '61600000-0000-4000-8000-000000000002',
    1,
    '61300000-0000-4000-8000-000000000002',
    '61400000-0000-4000-8000-000000000002',
    'Sunday Boss',
    null,
    'Boss Hunt',
    'Boss Flat Template',
    false,
    '61000000-0000-4000-8000-000000000001'
  );

select throws_ok($$
  insert into public.event_publication_versions (
    guild_id, event_id, publication_id, version_number,
    source_event_type_id, source_template_id,
    event_name_snapshot, event_type_name_snapshot,
    template_name_snapshot, uses_areas
  ) values (
    '61100000-0000-4000-8000-000000000001',
    '61500000-0000-4000-8000-000000000001',
    '61600000-0000-4000-8000-000000000001',
    1,
    '61300000-0000-4000-8000-000000000001',
    '61400000-0000-4000-8000-000000000001',
    'Duplicate Number',
    'Guild League',
    'League Area Template',
    true
  )
$$, '23505', null, 'version number is unique per Event publication');

select throws_ok($$
  update public.event_publications
  set status = 'published',
      current_version_id = '61700000-0000-4000-8000-000000000002',
      published_at = now()
  where id = '61600000-0000-4000-8000-000000000002'
$$, '23514', null, 'publication cannot point at an unsealed current version');

select throws_ok($$
  insert into public.event_publication_sections (
    guild_id, event_id, publication_version_id,
    source_event_section_id, name, sort_order
  ) values (
    '61100000-0000-4000-8000-000000000001',
    '61500000-0000-4000-8000-000000000001',
    '61700000-0000-4000-8000-000000000001',
    '61520000-0000-4000-8000-000000000001',
    'Missing Area',
    0
  )
$$, '23514', null, 'Area-based publication Section requires a published Area');

insert into public.event_publication_areas (
  id, guild_id, event_id, publication_version_id,
  source_event_area_id, name, sort_order
) values (
  '61810000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000001',
  '61700000-0000-4000-8000-000000000001',
  '61510000-0000-4000-8000-000000000001',
  'Sun',
  0
);

insert into public.event_publication_sections (
  id, guild_id, event_id, publication_version_id, area_id,
  source_event_section_id, name, sort_order
) values (
  '61820000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000001',
  '61700000-0000-4000-8000-000000000001',
  '61810000-0000-4000-8000-000000000001',
  '61520000-0000-4000-8000-000000000001',
  'Alpha',
  0
);

insert into public.event_publication_parties (
  id, guild_id, event_id, publication_version_id, section_id,
  source_event_party_id, name, sort_order
) values (
  '61830000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000001',
  '61700000-0000-4000-8000-000000000001',
  '61820000-0000-4000-8000-000000000001',
  '61530000-0000-4000-8000-000000000001',
  'Party 1',
  0
);

insert into public.event_publication_slots (
  id, guild_id, event_id, publication_version_id, party_id,
  source_event_slot_id, name, role_label, sort_order
) values (
  '61840000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000001',
  '61700000-0000-4000-8000-000000000001',
  '61830000-0000-4000-8000-000000000001',
  '61540000-0000-4000-8000-000000000001',
  'Seat 1',
  'Tank',
  0
);

insert into public.event_publication_assignments (
  id, guild_id, event_id, publication_version_id, slot_id,
  source_event_assignment_id, source_character_id,
  character_ign_snapshot, character_class_snapshot,
  character_role_snapshot, character_designation_snapshot,
  character_status_snapshot
) values (
  '61850000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  '61500000-0000-4000-8000-000000000001',
  '61700000-0000-4000-8000-000000000001',
  '61840000-0000-4000-8000-000000000001',
  '61560000-0000-4000-8000-000000000001',
  '61550000-0000-4000-8000-000000000001',
  'TankMain',
  'Knight',
  'Tank',
  'main',
  'active'
);

select is((select count(*) from public.event_publication_areas where publication_version_id = '61700000-0000-4000-8000-000000000001'), 1::bigint, 'published version stores its Area snapshot');
select is((select count(*) from public.event_publication_sections where publication_version_id = '61700000-0000-4000-8000-000000000001'), 1::bigint, 'published version stores its Section snapshot');
select is((select count(*) from public.event_publication_parties where publication_version_id = '61700000-0000-4000-8000-000000000001'), 1::bigint, 'published version stores its Party snapshot');
select is((select count(*) from public.event_publication_slots where publication_version_id = '61700000-0000-4000-8000-000000000001'), 1::bigint, 'published version stores its Slot snapshot');
select is((select count(*) from public.event_publication_assignments where publication_version_id = '61700000-0000-4000-8000-000000000001'), 1::bigint, 'published version stores its assignment snapshot');

select lives_ok(
  $$update public.event_publication_versions
    set sealed_at = now()
    where id = '61700000-0000-4000-8000-000000000001'$$,
  'assembled publication version can be sealed exactly once'
);

select lives_ok(
  $$update public.event_publications
    set status = 'published',
        current_version_id = '61700000-0000-4000-8000-000000000001',
        published_at = now(),
        unpublished_at = null
    where id = '61600000-0000-4000-8000-000000000001'$$,
  'publication state can activate a sealed current version'
);

select is(
  (select current_version_id from public.event_publications where id = '61600000-0000-4000-8000-000000000001'),
  '61700000-0000-4000-8000-000000000001'::uuid,
  'current publication pointer references the sealed version'
);

select throws_ok($$
  update public.event_publication_versions
  set event_name_snapshot = 'Rewritten History'
  where id = '61700000-0000-4000-8000-000000000001'
$$, '55000', null, 'sealed publication-version metadata cannot be changed');

select throws_ok($$
  insert into public.event_publication_slots (
    guild_id, event_id, publication_version_id, party_id,
    source_event_slot_id, name, sort_order
  ) values (
    '61100000-0000-4000-8000-000000000001',
    '61500000-0000-4000-8000-000000000001',
    '61700000-0000-4000-8000-000000000001',
    '61830000-0000-4000-8000-000000000001',
    '61540000-0000-4000-8000-000000000099',
    'Late Seat',
    99
  )
$$, '55000', null, 'sealed publication snapshot rejects new child rows');

select throws_ok($$
  update public.event_publication_slots
  set name = 'Rewritten Seat'
  where id = '61840000-0000-4000-8000-000000000001'
$$, '55000', null, 'sealed publication snapshot child rows cannot be changed');

select throws_ok($$
  update public.event_publications
  set event_id = '61500000-0000-4000-8000-000000000002'
  where id = '61600000-0000-4000-8000-000000000001'
$$, '55000', null, 'publication Event scope cannot be rewritten');

-- Later draft/roster edits do not rewrite the sealed publication.
update public.event_slots
set name = 'Seat 1 Draft Renamed'
where id = '61540000-0000-4000-8000-000000000001';

update public.characters
set ign = 'TankMainRenamed', class_name = 'Lord Knight'
where id = '61550000-0000-4000-8000-000000000001';

update public.character_roster_profiles
set role_label = 'Main Tank'
where character_id = '61550000-0000-4000-8000-000000000001';

select is(
  (select name from public.event_publication_slots where id = '61840000-0000-4000-8000-000000000001'),
  'Seat 1'::text,
  'later draft Slot edits do not rewrite the sealed Slot snapshot'
);

select is(
  (select character_ign_snapshot from public.event_publication_assignments where id = '61850000-0000-4000-8000-000000000001'),
  'TankMain'::text,
  'later roster IGN edits do not rewrite the published Character snapshot'
);

select is(
  (select character_role_snapshot from public.event_publication_assignments where id = '61850000-0000-4000-8000-000000000001'),
  'Tank'::text,
  'later organizer role edits do not rewrite the published Character role snapshot'
);

select is(
  (select source_character_id from public.event_publication_assignments where id = '61850000-0000-4000-8000-000000000001'),
  '61550000-0000-4000-8000-000000000001'::uuid,
  'published assignment retains stable source Character UUID for traceability'
);

-- RLS/capability boundaries.
set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-4000-8000-000000000002';

select is(
  (select count(*) from public.event_publications),
  2::bigint,
  'events.manage Officer can read Event publication state/history metadata'
);

set local request.jwt.claim.sub = '61000000-0000-4000-8000-000000000003';

select is(
  (select count(*) from public.event_publications),
  2::bigint,
  'publish.manage Officer can read Event publication state'
);

select is(
  (select count(*) from public.event_publication_versions),
  2::bigint,
  'publish.manage Officer can read publication versions'
);

select throws_ok($$
  insert into public.event_publications (guild_id, event_id, status)
  values (
    '61100000-0000-4000-8000-000000000001',
    '61500000-0000-4000-8000-000000000001',
    'unpublished'
  )
$$, '42501', null, 'publish.manage has no direct publication-table write privilege');

set local request.jwt.claim.sub = '61000000-0000-4000-8000-000000000004';

select is(
  (select count(*) from public.event_publications),
  0::bigint,
  'ordinary Member cannot read organizer publication tables'
);

set local request.jwt.claim.sub = '61000000-0000-4000-8000-000000000005';

select is(
  (select count(*) from public.event_publications),
  0::bigint,
  'Owner of another Guild cannot read foreign publication rows'
);

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.event_publications$$,
  '42501',
  null,
  'anonymous role has no direct publication-table read privilege'
);

reset role;

select * from finish();
rollback;
