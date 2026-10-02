begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

-- ---------------------------------------------------------------------------
-- Function surface
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure(
    'private.validate_generic_roster_payload(jsonb,text[])'
  ) is not null,
  'generic roster payload validator exists'
);

select ok(
  to_regprocedure(
    'public.preview_generic_roster_import(uuid,jsonb,text[])'
  ) is not null,
  'generic roster preview RPC exists'
);

select ok(
  to_regprocedure(
    'public.apply_generic_roster_import(uuid,jsonb,text[],text,text)'
  ) is not null,
  'generic roster apply RPC exists'
);

-- ---------------------------------------------------------------------------
-- Users / Guilds
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'sheet-owner-a@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'sheet-officer-a@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'sheet-member-a@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'sheet-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'Spreadsheet Guild A',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a2000000-0000-0000-0000-000000000001',
    'Spreadsheet Guild B',
    'a0000000-0000-0000-0000-000000000004'
  );

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  (
    'a1100000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    'a1100000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'officer'
  ),
  (
    'a1100000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000003',
    'member'
  ),
  (
    'a2200000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000004',
    'owner'
  );

insert into public.characters (
  id, guild_id, ign, level, class_name, title, gear_score,
  status, inactive_reason, left_guild_at, source_origin,
  rtnw_first_seen_at, rtnw_last_seen_at, created_by
)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Stable', 82, 'High Priest', 'Keeper', 50000,
    'active', null, null, 'rtnw_export',
    '2026-09-20T12:00:00Z', '2026-10-01T12:00:00Z',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a3000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'Changed', 81, 'Sniper', 'Old Title', 48000,
    'active', null, null, 'rtnw_export',
    '2026-09-20T12:00:00Z', '2026-10-01T12:00:00Z',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a3000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000001',
    'OrganizerOnly', 80, 'Creator', null, 47000,
    'active', null, null, 'manual',
    null, null,
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a3000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000001',
    'InactiveMatch', 79, 'Lord Knight', null, 46000,
    'inactive', 'left_guild', '2026-09-28T12:00:00Z', 'rtnw_export',
    '2026-09-10T12:00:00Z', '2026-09-27T12:00:00Z',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a3000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001',
    'OmittedActive', 78, 'Champion', null, 45000,
    'active', null, null, 'rtnw_export',
    '2026-09-10T12:00:00Z', '2026-10-01T12:00:00Z',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a4000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'OtherGuild', 82, 'Paladin', null, 60000,
    'active', null, null, 'manual',
    null, null,
    'a0000000-0000-0000-0000-000000000004'
  );

insert into public.character_roster_profiles (
  guild_id, character_id, designation, role_label, created_by
)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    'main', 'Support',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000002',
    'main', 'Ranged DPS',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000003',
    'sub', 'Crafter',
    'a0000000-0000-0000-0000-000000000001'
  );

insert into public.roster_custom_fields (
  id, guild_id, name, field_type, select_options, created_by
)
values (
  'a5000000-0000-4000-8000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'Event Team', 'select', array['Main Team', 'Reserve'],
  'a0000000-0000-0000-0000-000000000001'
);

insert into public.character_roster_custom_field_values (
  guild_id, character_id, field_id, value, created_by, updated_by
)
values (
  'a1000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000002',
  'a5000000-0000-4000-8000-000000000001',
  to_jsonb('Main Team'::text),
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001'
);

create temporary table generic_payload_holder (
  payload jsonb not null,
  mapped_fields text[] not null
);

grant select on table generic_payload_holder to authenticated, anon;

insert into generic_payload_holder (payload, mapped_fields)
values (
  '[
    {"ign":"Stable","class_name":"High Priest","title":"Keeper","role_label":"Support"},
    {"ign":"Changed","class_name":"Stalker","title":null,"role_label":"Burst"},
    {"ign":"OrganizerOnly","class_name":"Creator","title":null,"role_label":"Support"},
    {"ign":"InactiveMatch","class_name":"Rune Knight","title":null,"role_label":null},
    {"ign":"NewSheet","class_name":"Scholar","title":"Fresh","role_label":"Utility"}
  ]'::jsonb,
  array['class_name', 'title', 'role_label']::text[]
);

-- ---------------------------------------------------------------------------
-- Validation
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      '[]'::jsonb,
      array[]::text[]
    )
  $sql$,
  '22023', null,
  'empty generic spreadsheet payload is rejected'
);

select throws_ok(
  $sql$
    select public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      '[{"ign":"Duplicate"},{"ign":"Duplicate"}]'::jsonb,
      array[]::text[]
    )
  $sql$,
  '22023', null,
  'duplicate exact IGNs are rejected'
);

select throws_ok(
  $sql$
    select public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      '[{"ign":"Extra","class_name":"Sniper","not_mapped":"x"}]'::jsonb,
      array['class_name']::text[]
    )
  $sql$,
  '22023', null,
  'unmapped row keys are rejected'
);

select throws_ok(
  $sql$
    select public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      '[{"ign":"MissingMapped"}]'::jsonb,
      array['class_name']::text[]
    )
  $sql$,
  '22023', null,
  'each mapped field must be represented on every row'
);

select throws_ok(
  $sql$
    select public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      '[{"ign":"BadNumber","gear_score":-1}]'::jsonb,
      array['gear_score']::text[]
    )
  $sql$,
  '22023', null,
  'negative numeric values are rejected'
);

select throws_ok(
  $sql$
    select public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      '[{"ign":"BadDesignation","designation":"alternate"}]'::jsonb,
      array['designation']::text[]
    )
  $sql$,
  '22023', null,
  'invalid organizer designation is rejected'
);

-- ---------------------------------------------------------------------------
-- Authorization
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';

select throws_ok(
  $sql$
    select *
    from public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      (select payload from generic_payload_holder),
      (select mapped_fields from generic_payload_holder)
    )
  $sql$,
  '42501', null,
  'Member cannot preview a generic roster import'
);

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';

select throws_ok(
  $sql$
    select *
    from public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      (select payload from generic_payload_holder),
      (select mapped_fields from generic_payload_holder)
    )
  $sql$,
  '42501', null,
  'Officer without imports.manage cannot preview a generic roster import'
);

reset role;

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
)
values (
  'a1000000-0000-0000-0000-000000000001',
  'a1100000-0000-0000-0000-000000000002',
  'imports.manage',
  'a0000000-0000-0000-0000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select *
    from public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      (select payload from generic_payload_holder),
      (select mapped_fields from generic_payload_holder)
    )
  $sql$,
  'Officer with imports.manage can preview a generic roster import'
);

-- ---------------------------------------------------------------------------
-- Preview semantics
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';

select results_eq(
  $sql$
    select change_kind || ':' || ign
    from public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      (select payload from generic_payload_holder),
      (select mapped_fields from generic_payload_holder)
    )
    order by
      case change_kind when 'new' then 1 when 'update' then 2 else 3 end,
      ign
  $sql$,
  array[
    'new:NewSheet'::text,
    'update:Changed'::text,
    'update:InactiveMatch'::text,
    'update:OrganizerOnly'::text,
    'unchanged:Stable'::text
  ],
  'preview classifies only incoming exact IGNs and never invents Left Guild changes'
);

select results_eq(
  $sql$
    select unnest(changed_fields)
    from public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      (select payload from generic_payload_holder),
      (select mapped_fields from generic_payload_holder)
    )
    where ign = 'Changed'
  $sql$,
  array['class_name'::text, 'title'::text, 'role_label'::text],
  'preview reports exactly which mapped fields will change'
);

select results_eq(
  $sql$
    select count(*)
    from public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      (select payload from generic_payload_holder),
      (select mapped_fields from generic_payload_holder)
    )
    where ign = 'OmittedActive'
  $sql$,
  array[0::bigint],
  'omitted characters are outside generic import preview scope'
);

-- ---------------------------------------------------------------------------
-- Apply semantics
-- ---------------------------------------------------------------------------

create temporary table generic_apply_result as
select *
from public.apply_generic_roster_import(
  'a1000000-0000-0000-0000-000000000001',
  (select payload from generic_payload_holder),
  (select mapped_fields from generic_payload_holder),
  'guild-roster.xlsx',
  repeat('d', 64)
);

select results_eq(
  'select source_row_count from generic_apply_result',
  array[5],
  'generic import records the incoming row count'
);

select results_eq(
  'select created_count from generic_apply_result',
  array[1],
  'generic import counts one new exact IGN'
);

select results_eq(
  'select updated_count from generic_apply_result',
  array[3],
  'generic import counts mapped game and organizer changes'
);

select results_eq(
  'select unchanged_count from generic_apply_result',
  array[1],
  'generic import counts one unchanged incoming row'
);

select is(
  (select class_name from public.characters
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and ign = 'Changed'),
  'Stalker'::text,
  'mapped game field is updated'
);

select is(
  (select title from public.characters
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and ign = 'Changed'),
  null::text,
  'mapped blank value intentionally clears an existing field'
);

select is(
  (select gear_score from public.characters
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and ign = 'Changed'),
  48000::bigint,
  'unmapped game field is preserved'
);

select is(
  (select designation || '|' || role_label
   from public.character_roster_profiles
   where character_id = 'a3000000-0000-0000-0000-000000000002'),
  'main|Burst'::text,
  'mapped organizer role updates while unmapped designation is preserved'
);

select is(
  (select designation || '|' || role_label
   from public.character_roster_profiles
   where character_id = 'a3000000-0000-0000-0000-000000000003'),
  'sub|Support'::text,
  'organizer-only spreadsheet change is applied'
);

select is(
  (select value #>> '{}'
   from public.character_roster_custom_field_values
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and character_id = 'a3000000-0000-0000-0000-000000000002'
     and field_id = 'a5000000-0000-4000-8000-000000000001'),
  'Main Team'::text,
  'generic import preserves organizer custom field values'
);

select is(
  (select status from public.characters
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and ign = 'OmittedActive'),
  'active'::text,
  'omitted existing character is not marked Left Guild'
);

select is(
  (select status || '|' || inactive_reason from public.characters
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and ign = 'InactiveMatch'),
  'inactive|left_guild'::text,
  'matching inactive character is not automatically reactivated'
);

select is(
  (select class_name from public.characters
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and ign = 'InactiveMatch'),
  'Rune Knight'::text,
  'mapped fields can update an inactive historical character without changing lifecycle'
);

select is(
  (select source_origin from public.characters
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and ign = 'NewSheet'),
  'manual'::text,
  'new generic-import character is recorded as non-RTNW/manual origin'
);

select ok(
  (select rtnw_first_seen_at is null and rtnw_last_seen_at is null
   from public.characters
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and ign = 'NewSheet'),
  'generic import does not manufacture RTNW seen timestamps'
);

select is(
  (select role_label
   from public.character_roster_profiles
   where guild_id = 'a1000000-0000-0000-0000-000000000001'
     and character_id = (
       select id from public.characters
       where guild_id = 'a1000000-0000-0000-0000-000000000001'
         and ign = 'NewSheet'
     )),
  'Utility'::text,
  'mapped organizer role is created for a new character'
);

select is(
  (select source_type from public.roster_sync_runs
   where guild_id = 'a1000000-0000-0000-0000-000000000001'),
  'generic_spreadsheet'::text,
  'generic import history uses a distinct source type'
);

select is(
  (select reactivated_count::text || '|' || left_guild_count::text
   from public.roster_sync_runs
   where guild_id = 'a1000000-0000-0000-0000-000000000001'),
  '0|0'::text,
  'generic import history records no implicit reactivation or departure'
);

select is(
  (select source_filename || '|' || source_sha256
   from public.roster_sync_runs
   where guild_id = 'a1000000-0000-0000-0000-000000000001'),
  ('guild-roster.xlsx|' || repeat('d', 64))::text,
  'generic import history stores filename and source hash without raw contents'
);

-- ---------------------------------------------------------------------------
-- Cross-Guild / direct access
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    select *
    from public.apply_generic_roster_import(
      'a2000000-0000-0000-0000-000000000001',
      (select payload from generic_payload_holder),
      (select mapped_fields from generic_payload_holder),
      'other.xlsx',
      repeat('e', 64)
    )
  $sql$,
  '42501', null,
  'Guild A Owner cannot apply a generic import to Guild B'
);

select throws_ok(
  $sql$
    insert into public.roster_sync_runs (
      guild_id, source_type, source_filename,
      source_sha256, source_row_count
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'generic_spreadsheet',
      'direct.xlsx',
      repeat('f', 64),
      1
    )
  $sql$,
  '42501', null,
  'authenticated application role cannot directly write import history'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select *
    from public.preview_generic_roster_import(
      'a1000000-0000-0000-0000-000000000001',
      (select payload from generic_payload_holder),
      (select mapped_fields from generic_payload_holder)
    )
  $sql$,
  '42501', null,
  'anonymous role cannot execute generic roster preview'
);

reset role;

select * from finish();

rollback;
