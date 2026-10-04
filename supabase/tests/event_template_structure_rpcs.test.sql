begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

-- RPC surface.
select has_function('public', 'create_event_template_area', array['uuid', 'text', 'integer'], 'create Area RPC exists');
select has_function('public', 'update_event_template_area', array['uuid', 'text', 'integer'], 'update Area RPC exists');
select has_function('public', 'delete_event_template_area', array['uuid'], 'delete Area RPC exists');

select has_function('public', 'create_event_template_section', array['uuid', 'text', 'uuid', 'integer'], 'create Section RPC exists');
select has_function('public', 'update_event_template_section', array['uuid', 'text', 'uuid', 'integer'], 'update Section RPC exists');
select has_function('public', 'delete_event_template_section', array['uuid'], 'delete Section RPC exists');

select has_function('public', 'create_event_template_party', array['uuid', 'text', 'integer'], 'create Party RPC exists');
select has_function('public', 'update_event_template_party', array['uuid', 'uuid', 'text', 'integer'], 'update Party RPC exists');
select has_function('public', 'delete_event_template_party', array['uuid'], 'delete Party RPC exists');

select has_function('public', 'create_event_template_slot', array['uuid', 'text', 'text', 'integer'], 'create Slot RPC exists');
select has_function('public', 'update_event_template_slot', array['uuid', 'uuid', 'text', 'text', 'integer'], 'update Slot RPC exists');
select has_function('public', 'delete_event_template_slot', array['uuid'], 'delete Slot RPC exists');

-- Identities and Guilds.
insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'structure-owner-a@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'structure-template-officer@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'structure-event-officer@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'structure-member@test.local'),
  ('a0000000-0000-0000-0000-000000000005', 'structure-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  ('a1000000-0000-0000-0000-000000000001', 'Structure RPC Guild A', 'a0000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000001', 'Structure RPC Guild B', 'a0000000-0000-0000-0000-000000000005');

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  ('a1100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('a1100000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'officer'),
  ('a1100000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'officer'),
  ('a1100000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'member'),
  ('a2200000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'owner');

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
)
values
  ('a1000000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000002', 'templates.manage', 'a0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000003', 'events.manage', 'a0000000-0000-0000-0000-000000000001');

-- Cross-Guild seed data is setup-only and exercises composite parent guards later.
insert into public.event_types (
  id, guild_id, name, created_by, updated_by
)
values (
  'a3000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'Other Guild Type',
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000005'
);

insert into public.event_templates (
  id, guild_id, event_type_id, name, uses_areas, created_by, updated_by
)
values (
  'a4000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'Other Guild Template',
  true,
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000005'
);

insert into public.event_template_areas (
  id, guild_id, template_id, name, sort_order
)
values (
  'a5000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001',
  'Foreign Area',
  0
);

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

-- Create two reusable Templates through the B1 RPC surface.
select set_config(
  'test.structure_type_id',
  public.create_event_type(
    'a1000000-0000-0000-0000-000000000001',
    'Structured Type',
    null
  )::text,
  true
);

select set_config(
  'test.flat_type_id',
  public.create_event_type(
    'a1000000-0000-0000-0000-000000000001',
    'Flat Type',
    null
  )::text,
  true
);

select set_config(
  'test.structure_template_id',
  public.create_event_template(
    'a1000000-0000-0000-0000-000000000001',
    current_setting('test.structure_type_id')::uuid,
    'Structured Template',
    null,
    true
  )::text,
  true
);

select set_config(
  'test.flat_template_id',
  public.create_event_template(
    'a1000000-0000-0000-0000-000000000001',
    current_setting('test.flat_type_id')::uuid,
    'Flat Template',
    null,
    false
  )::text,
  true
);

select lives_ok(
  $sql$
    select public.create_event_template_area(
      current_setting('test.structure_template_id')::uuid,
      'Sun',
      0
    )
  $sql$,
  'Owner can create an Area'
);

select set_config(
  'test.area_id',
  (
    select id::text
    from public.event_template_areas
    where template_id = current_setting('test.structure_template_id')::uuid
      and name = 'Sun'
  ),
  true
);

select is(
  (
    select created_by
    from public.event_template_areas
    where id = current_setting('test.area_id')::uuid
  ),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Area records creator audit identity'
);

select lives_ok(
  $sql$
    select public.create_event_template_section(
      current_setting('test.structure_template_id')::uuid,
      'Alpha',
      current_setting('test.area_id')::uuid,
      0
    )
  $sql$,
  'Owner can create an Area Section'
);

select set_config(
  'test.section_id',
  (
    select id::text
    from public.event_template_sections
    where template_id = current_setting('test.structure_template_id')::uuid
      and name = 'Alpha'
  ),
  true
);

select lives_ok(
  $sql$
    select public.create_event_template_party(
      current_setting('test.section_id')::uuid,
      'Party 1',
      0
    )
  $sql$,
  'Owner can create a Party'
);

select set_config(
  'test.party_id',
  (
    select id::text
    from public.event_template_parties
    where template_id = current_setting('test.structure_template_id')::uuid
      and name = 'Party 1'
  ),
  true
);

select lives_ok(
  $sql$
    select public.create_event_template_slot(
      current_setting('test.party_id')::uuid,
      'Seat 1',
      ' Main Tank ',
      0
    )
  $sql$,
  'Owner can create a role-labelled Slot'
);

select set_config(
  'test.slot_id',
  (
    select id::text
    from public.event_template_slots
    where template_id = current_setting('test.structure_template_id')::uuid
      and name = 'Seat 1'
  ),
  true
);

select is(
  (
    select role_label
    from public.event_template_slots
    where id = current_setting('test.slot_id')::uuid
  ),
  'Main Tank'::text,
  'Slot role label is normalized by the RPC'
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where template_id = current_setting('test.structure_template_id')::uuid
  ),
  1::bigint,
  'Slot rows remain the seat-count source of truth'
);

select lives_ok(
  $sql$
    select public.create_event_template_section(
      current_setting('test.flat_template_id')::uuid,
      'Main',
      null,
      0
    )
  $sql$,
  'flat Template supports a root Section'
);

select set_config(
  'test.flat_section_id',
  (
    select id::text
    from public.event_template_sections
    where template_id = current_setting('test.flat_template_id')::uuid
      and name = 'Main'
  ),
  true
);

select lives_ok(
  $sql$
    select public.create_event_template_party(
      current_setting('test.flat_section_id')::uuid,
      'Flat Party',
      0
    )
  $sql$,
  'flat Template supports Parties'
);

select set_config(
  'test.flat_party_id',
  (
    select id::text
    from public.event_template_parties
    where template_id = current_setting('test.flat_template_id')::uuid
      and name = 'Flat Party'
  ),
  true
);

select throws_ok(
  $sql$
    select public.create_event_template_area(
      current_setting('test.flat_template_id')::uuid,
      'Invalid Area',
      0
    )
  $sql$,
  '23514',
  null,
  'flat Template rejects Areas'
);

select throws_ok(
  $sql$
    select public.create_event_template_section(
      current_setting('test.structure_template_id')::uuid,
      'Missing Area',
      null,
      0
    )
  $sql$,
  '23514',
  null,
  'Area-based Template rejects root Sections'
);

select throws_ok(
  $sql$
    select public.create_event_template_section(
      current_setting('test.structure_template_id')::uuid,
      'Foreign Parent',
      'a5000000-0000-0000-0000-000000000001',
      0
    )
  $sql$,
  '23503',
  null,
  'Section cannot attach an Area from another Guild or Template'
);

select lives_ok(
  $sql$
    select public.update_event_template_area(
      current_setting('test.area_id')::uuid,
      'SUN',
      2
    )
  $sql$,
  'Owner can rename and reorder an Area'
);

select lives_ok(
  $sql$
    select public.update_event_template_section(
      current_setting('test.section_id')::uuid,
      'ALPHA',
      current_setting('test.area_id')::uuid,
      3
    )
  $sql$,
  'Owner can rename and reorder a Section'
);

select lives_ok(
  $sql$
    select public.update_event_template_party(
      current_setting('test.party_id')::uuid,
      current_setting('test.section_id')::uuid,
      'Party A',
      4
    )
  $sql$,
  'Owner can rename and reorder a Party'
);

select lives_ok(
  $sql$
    select public.update_event_template_slot(
      current_setting('test.slot_id')::uuid,
      current_setting('test.party_id')::uuid,
      'Tank Seat',
      ' Lead Tank ',
      5
    )
  $sql$,
  'Owner can rename, relabel, and reorder a Slot'
);

select is(
  (
    select name || '|' || role_label || '|' || sort_order::text
    from public.event_template_slots
    where id = current_setting('test.slot_id')::uuid
  ),
  'Tank Seat|Lead Tank|5'::text,
  'Slot update persists organizer structure metadata'
);

select throws_ok(
  $sql$
    select public.update_event_template_slot(
      current_setting('test.slot_id')::uuid,
      current_setting('test.flat_party_id')::uuid,
      'Tank Seat',
      'Lead Tank',
      5
    )
  $sql$,
  '23503',
  null,
  'Slot cannot move to a Party in another Template'
);

select throws_ok(
  $sql$
    select public.create_event_template_party(
      current_setting('test.section_id')::uuid,
      'Negative',
      -1
    )
  $sql$,
  '22023',
  null,
  'negative structural sort order is rejected by RPC'
);

select throws_ok(
  $sql$
    select public.create_event_template_slot(
      current_setting('test.party_id')::uuid,
      ' Padded ',
      null,
      0
    )
  $sql$,
  '22023',
  null,
  'untrimmed structural names are rejected by RPC'
);

-- Capability boundaries.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';

select throws_ok(
  $sql$
    select public.create_event_template_slot(
      current_setting('test.party_id')::uuid,
      'Events Only',
      null,
      1
    )
  $sql$,
  '42501',
  null,
  'events.manage alone cannot mutate reusable Template structure'
);

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';

select throws_ok(
  $sql$
    select public.update_event_template_slot(
      current_setting('test.slot_id')::uuid,
      current_setting('test.party_id')::uuid,
      'Forbidden',
      null,
      0
    )
  $sql$,
  '42501',
  null,
  'ordinary Member cannot mutate Template structure'
);

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.create_event_template_slot(
      current_setting('test.party_id')::uuid,
      'Officer Seat',
      null,
      6
    )
  $sql$,
  'Officer with templates.manage can mutate Template structure'
);

select is(
  (
    select updated_by
    from public.event_templates
    where id = current_setting('test.structure_template_id')::uuid
  ),
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'structural mutation touches parent Template audit identity'
);

select set_config(
  'test.officer_slot_id',
  (
    select id::text
    from public.event_template_slots
    where template_id = current_setting('test.structure_template_id')::uuid
      and name = 'Officer Seat'
  ),
  true
);

-- Archived Templates reject structural edits.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.update_event_template(
      current_setting('test.structure_template_id')::uuid,
      current_setting('test.structure_type_id')::uuid,
      'Structured Template',
      null,
      true,
      'archived'
    )
  $sql$,
  'Owner can archive the reusable Template'
);

select throws_ok(
  $sql$
    select public.create_event_template_slot(
      current_setting('test.party_id')::uuid,
      'Blocked Create',
      null,
      7
    )
  $sql$,
  '55000',
  null,
  'archived Template rejects structural creates'
);

select throws_ok(
  $sql$
    select public.update_event_template_slot(
      current_setting('test.slot_id')::uuid,
      current_setting('test.party_id')::uuid,
      'Blocked Update',
      null,
      0
    )
  $sql$,
  '55000',
  null,
  'archived Template rejects structural updates'
);

select throws_ok(
  $sql$
    select public.delete_event_template_slot(
      current_setting('test.slot_id')::uuid
    )
  $sql$,
  '55000',
  null,
  'archived Template rejects structural deletes'
);

select lives_ok(
  $sql$
    select public.update_event_template(
      current_setting('test.structure_template_id')::uuid,
      current_setting('test.structure_type_id')::uuid,
      'Structured Template',
      null,
      true,
      'draft'
    )
  $sql$,
  'Owner can return archived Template to draft'
);

-- Authorized delete behavior.
select lives_ok(
  $sql$
    select public.delete_event_template_slot(
      current_setting('test.officer_slot_id')::uuid
    )
  $sql$,
  'Owner can delete a Slot'
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where id = current_setting('test.officer_slot_id')::uuid
  ),
  0::bigint,
  'deleted Slot is removed'
);

select lives_ok(
  $sql$
    select public.create_event_template_slot(
      current_setting('test.flat_party_id')::uuid,
      'Cascade Seat',
      null,
      0
    )
  $sql$,
  'create a Slot for Section cascade test'
);

select lives_ok(
  $sql$
    select public.delete_event_template_section(
      current_setting('test.flat_section_id')::uuid
    )
  $sql$,
  'Owner can delete a Section'
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where template_id = current_setting('test.flat_template_id')::uuid
  ),
  0::bigint,
  'deleting a Section cascades through its Parties and Slots'
);

select lives_ok(
  $sql$
    select public.delete_event_template_party(
      current_setting('test.party_id')::uuid
    )
  $sql$,
  'Owner can delete a Party'
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where id = current_setting('test.slot_id')::uuid
  ),
  0::bigint,
  'deleting a Party cascades through its Slots'
);

select lives_ok(
  $sql$
    select public.create_event_template_section(
      current_setting('test.structure_template_id')::uuid,
      'Disposable Section',
      current_setting('test.area_id')::uuid,
      9
    )
  $sql$,
  'create a Section for Area cascade test'
);

select lives_ok(
  $sql$
    select public.delete_event_template_area(
      current_setting('test.area_id')::uuid
    )
  $sql$,
  'Owner can delete an Area'
);

select is(
  (
    select count(*)
    from public.event_template_sections
    where template_id = current_setting('test.structure_template_id')::uuid
  ),
  0::bigint,
  'deleting an Area cascades through its Sections'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select public.create_event_template_area(
      current_setting('test.structure_template_id')::uuid,
      'Anonymous',
      0
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute Template structure RPCs'
);

reset role;

select * from finish();
rollback;
