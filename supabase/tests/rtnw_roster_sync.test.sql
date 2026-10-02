begin;

create extension if not exists pgtap with schema extensions;

select plan(39);

-- ---------------------------------------------------------------------------
-- Schema / function surface
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('public.roster_sync_runs') is not null,
  'roster_sync_runs table exists'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.roster_sync_runs'::regclass
  ),
  'roster_sync_runs has RLS enabled'
);

select ok(
  to_regprocedure(
    'private.require_import_manage(uuid)'
  ) is not null,
  'private import authorization helper exists'
);

select ok(
  to_regprocedure(
    'public.preview_rtnw_roster_sync(uuid,jsonb)'
  ) is not null,
  'RTNW roster preview RPC exists'
);

select ok(
  to_regprocedure(
    'public.apply_rtnw_roster_sync(uuid,jsonb,text,text)'
  ) is not null,
  'RTNW roster apply RPC exists'
);

-- ---------------------------------------------------------------------------
-- Test users / Guilds
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('90000000-0000-0000-0000-000000000001', 'sync-owner-a@test.local'),
  ('90000000-0000-0000-0000-000000000002', 'sync-officer-a@test.local'),
  ('90000000-0000-0000-0000-000000000003', 'sync-member-a@test.local'),
  ('90000000-0000-0000-0000-000000000004', 'sync-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    '91000000-0000-0000-0000-000000000001',
    'Sync Guild A',
    '90000000-0000-0000-0000-000000000001'
  ),
  (
    '92000000-0000-0000-0000-000000000001',
    'Sync Guild B',
    '90000000-0000-0000-0000-000000000004'
  );

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  (
    '91100000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '91100000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000002',
    'officer'
  ),
  (
    '91100000-0000-0000-0000-000000000003',
    '91000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000003',
    'member'
  ),
  (
    '92200000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000004',
    'owner'
  );

-- Existing Guild A roster:
--   Stable       -> incoming unchanged
--   Changed      -> incoming updated
--   Returned     -> currently left, incoming reactivates
--   OldName      -> absent; should become left_guild
--   ManualSeen   -> manual origin, incoming; should remain manual origin
--   AlreadyLeft  -> absent and already left; should not count again
insert into public.characters (
  id,
  guild_id,
  ign,
  level,
  class_name,
  gear_score,
  weekly_activity,
  weekly_contribution,
  total_contribution,
  online_status,
  status,
  inactive_reason,
  left_guild_at,
  source_origin,
  rtnw_first_seen_at,
  rtnw_last_seen_at,
  created_by
)
values
  (
    '93000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'Stable',
    82,
    'High Priest',
    50000,
    700,
    2000,
    12000,
    '[Online]',
    'active',
    null,
    null,
    'rtnw_export',
    '2026-09-30T12:00:00Z',
    '2026-09-30T12:00:00Z',
    '90000000-0000-0000-0000-000000000001'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001',
    'Changed',
    81,
    'Sniper',
    48000,
    600,
    1500,
    10000,
    'Offline for 1 hr',
    'active',
    null,
    null,
    'rtnw_export',
    '2026-09-30T12:00:00Z',
    '2026-09-30T12:00:00Z',
    '90000000-0000-0000-0000-000000000001'
  ),
  (
    '93000000-0000-0000-0000-000000000003',
    '91000000-0000-0000-0000-000000000001',
    'Returned',
    80,
    'Lord Knight',
    47000,
    500,
    1200,
    9000,
    'Offline for 2 d',
    'inactive',
    'left_guild',
    '2026-09-29T12:00:00Z',
    'rtnw_export',
    '2026-09-20T12:00:00Z',
    '2026-09-28T12:00:00Z',
    '90000000-0000-0000-0000-000000000001'
  ),
  (
    '93000000-0000-0000-0000-000000000004',
    '91000000-0000-0000-0000-000000000001',
    'OldName',
    79,
    'Champion',
    46000,
    450,
    1100,
    8000,
    '[Online]',
    'active',
    null,
    null,
    'rtnw_export',
    '2026-09-20T12:00:00Z',
    '2026-09-30T12:00:00Z',
    '90000000-0000-0000-0000-000000000001'
  ),
  (
    '93000000-0000-0000-0000-000000000005',
    '91000000-0000-0000-0000-000000000001',
    'ManualSeen',
    78,
    'Creator',
    45000,
    400,
    1000,
    7000,
    '[Online]',
    'active',
    null,
    null,
    'manual',
    null,
    null,
    '90000000-0000-0000-0000-000000000001'
  ),
  (
    '93000000-0000-0000-0000-000000000006',
    '91000000-0000-0000-0000-000000000001',
    'AlreadyLeft',
    77,
    'Clown',
    44000,
    350,
    900,
    6000,
    'Offline for 4 d',
    'inactive',
    'left_guild',
    '2026-09-25T12:00:00Z',
    'rtnw_export',
    '2026-09-10T12:00:00Z',
    '2026-09-24T12:00:00Z',
    '90000000-0000-0000-0000-000000000001'
  ),
  (
    '94000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    'OtherGuild',
    82,
    'Paladin',
    60000,
    800,
    2500,
    20000,
    '[Online]',
    'active',
    null,
    null,
    'manual',
    null,
    null,
    '90000000-0000-0000-0000-000000000004'
  );

insert into public.character_roster_profiles (
  guild_id,
  character_id,
  designation,
  role_label,
  created_by
)
values (
  '91000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000002',
  'main',
  'Ranged DPS',
  '90000000-0000-0000-0000-000000000001'
);

insert into public.roster_custom_fields (
  id,
  guild_id,
  name,
  field_type,
  select_options,
  created_by
)
values (
  '95000000-0000-4000-8000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'Event Team',
  'select',
  array['Main Team', 'Reserve'],
  '90000000-0000-0000-0000-000000000001'
);

insert into public.character_roster_custom_field_values (
  guild_id,
  character_id,
  field_id,
  value,
  created_by,
  updated_by
)
values (
  '91000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000002',
  '95000000-0000-4000-8000-000000000001',
  to_jsonb('Main Team'::text),
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001'
);

-- Normalized version of an official RTNW export. The extra "id" values mimic
-- the game's counting-only CSV Id column and must have no identity effect.
create temporary table rtnw_payload_holder (
  payload jsonb not null
);

grant select on table rtnw_payload_holder to authenticated, anon;

insert into rtnw_payload_holder(payload)
values (
  '[
    {
      "id": 1,
      "ign": "Stable",
      "level": 82,
      "class_name": "High Priest",
      "title": null,
      "gender": null,
      "guild_position": null,
      "gear_score": 50000,
      "weekly_activity": 700,
      "weekly_contribution": 2000,
      "total_contribution": 12000,
      "online_status": "[Online]"
    },
    {
      "id": 2,
      "ign": "Changed",
      "level": 82,
      "class_name": "Sniper",
      "title": "Pathfinder I",
      "gender": "F",
      "guild_position": "Elite",
      "gear_score": 52000,
      "weekly_activity": 720,
      "weekly_contribution": 2200,
      "total_contribution": 13000,
      "online_status": "[Online]"
    },
    {
      "id": 3,
      "ign": "Returned",
      "level": 81,
      "class_name": "Lord Knight",
      "title": null,
      "gender": "M",
      "guild_position": "Elite",
      "gear_score": 49000,
      "weekly_activity": 650,
      "weekly_contribution": 1800,
      "total_contribution": 11000,
      "online_status": "[Online]"
    },
    {
      "id": 4,
      "ign": "ManualSeen",
      "level": 79,
      "class_name": "Creator",
      "title": null,
      "gender": "F",
      "guild_position": "Member",
      "gear_score": 47000,
      "weekly_activity": 500,
      "weekly_contribution": 1300,
      "total_contribution": 8500,
      "online_status": "[Online]"
    },
    {
      "id": 999,
      "ign": "NewName",
      "level": 79,
      "class_name": "Champion",
      "title": null,
      "gender": "M",
      "guild_position": "Member",
      "gear_score": 46500,
      "weekly_activity": 460,
      "weekly_contribution": 1150,
      "total_contribution": 8100,
      "online_status": "[Online]"
    }
  ]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Payload validation
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      '[]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'empty RTNW payload is rejected to prevent accidental mass deactivation'
);

select throws_ok(
  $sql$
    select public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      '[{"ign":"Duplicate"},{"ign":"Duplicate"}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'duplicate exact IGNs in one RTNW payload are rejected'
);

select throws_ok(
  $sql$
    select public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      '[{"ign":"  Whitespace  "}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'surrounding IGN whitespace is rejected instead of silently changing identity'
);

select throws_ok(
  $sql$
    select public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      '[{"ign":"BadNumeric","gear_score":-1}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'negative RTNW numeric values are rejected'
);

-- ---------------------------------------------------------------------------
-- Authorization
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000003';

select throws_ok(
  $sql$
    select *
    from public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder)
    )
  $sql$,
  '42501',
  null,
  'Member cannot preview an RTNW roster sync'
);

set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000002';

select throws_ok(
  $sql$
    select *
    from public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder)
    )
  $sql$,
  '42501',
  null,
  'Officer without imports.manage cannot preview an RTNW roster sync'
);

reset role;

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values (
  '91000000-0000-0000-0000-000000000001',
  '91100000-0000-0000-0000-000000000002',
  'imports.manage',
  '90000000-0000-0000-0000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select *
    from public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder)
    )
  $sql$,
  'Officer with imports.manage can preview an RTNW roster sync'
);

-- ---------------------------------------------------------------------------
-- Preview semantics
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000001';

select results_eq(
  $sql$
    select change_kind || ':' || ign
    from public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder)
    )
    where change_kind <> 'unchanged'
    order by
      case change_kind
        when 'new' then 1
        when 'reactivate' then 2
        when 'update' then 3
        when 'left_guild' then 4
        else 5
      end,
      ign
  $sql$,
  array[
    'new:NewName'::text,
    'reactivate:Returned'::text,
    'update:Changed'::text,
    'update:ManualSeen'::text,
    'left_guild:OldName'::text
  ],
  'preview classifies new, reactivated, updated, and missing characters without rename guessing'
);

select results_eq(
  $sql$
    select change_kind
    from public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder)
    )
    where ign = 'Stable'
  $sql$,
  array['unchanged'::text],
  'preview identifies an unchanged exact IGN'
);

select results_eq(
  $sql$
    select count(*)
    from public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder)
    )
    where ign = 'AlreadyLeft'
  $sql$,
  array[0::bigint],
  'a character already marked left_guild is not repeatedly reported as leaving'
);

select results_eq(
  $sql$
    select count(*)
    from public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder)
    )
    where ign = 'NewName' and character_id is null
  $sql$,
  array[1::bigint],
  'new IGN is treated as a new character and not guessed to be OldName'
);

-- ---------------------------------------------------------------------------
-- Apply semantics
-- ---------------------------------------------------------------------------

create temporary table sync_result as
select *
from public.apply_rtnw_roster_sync(
  '91000000-0000-0000-0000-000000000001',
  (select payload from rtnw_payload_holder),
  'Immortals_20261002_0014.csv',
  repeat('a', 64)
);

select results_eq(
  'select source_row_count from sync_result',
  array[5],
  'applied sync records the incoming row count'
);

select results_eq(
  'select created_count from sync_result',
  array[1],
  'applied sync counts one new IGN'
);

select results_eq(
  'select updated_count from sync_result',
  array[2],
  'applied sync counts changed current rows'
);

select results_eq(
  'select reactivated_count from sync_result',
  array[1],
  'applied sync counts one returning exact IGN'
);

select results_eq(
  'select left_guild_count from sync_result',
  array[1],
  'applied sync counts one newly missing character'
);

select results_eq(
  'select unchanged_count from sync_result',
  array[1],
  'applied sync counts one unchanged incoming row'
);

select is(
  (
    select status
    from public.characters
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and ign = 'Returned'
  ),
  'active'::text,
  'exact IGN returning in a later export is reactivated'
);

select is(
  (
    select status || '|' || inactive_reason
    from public.characters
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and ign = 'OldName'
  ),
  'inactive|left_guild'::text,
  'missing current character is soft-marked left_guild instead of deleted'
);

select ok(
  (
    select left_guild_at is not null
    from public.characters
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and ign = 'OldName'
  ),
  'newly missing character receives a departure timestamp'
);

select is(
  (
    select status || '|' || inactive_reason
    from public.characters
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and ign = 'AlreadyLeft'
  ),
  'inactive|left_guild'::text,
  'previously left character stays historical and is not deleted'
);

select is(
  (
    select source_origin
    from public.characters
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and ign = 'ManualSeen'
  ),
  'manual'::text,
  'RTNW sync does not rewrite how an existing character originally entered the roster'
);

select ok(
  (
    select rtnw_first_seen_at is not null and rtnw_last_seen_at is not null
    from public.characters
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and ign = 'ManualSeen'
  ),
  'manual-origin character receives RTNW seen timestamps once observed in an export'
);

select is(
  (
    select source_origin
    from public.characters
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and ign = 'NewName'
  ),
  'rtnw_export'::text,
  'new character created by sync records RTNW export provenance'
);

select is(
  (
    select designation || '|' || role_label
    from public.character_roster_profiles
    where character_id = '93000000-0000-0000-0000-000000000002'
  ),
  'main|Ranged DPS'::text,
  'RTNW sync preserves organizer-maintained roster metadata'
);

select is(
  (
    select value #>> '{}'
    from public.character_roster_custom_field_values
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and character_id = '93000000-0000-0000-0000-000000000002'
      and field_id = '95000000-0000-4000-8000-000000000001'
  ),
  'Main Team'::text,
  'RTNW sync preserves organizer custom field values'
);

select is(
  (
    select count(*)
    from public.characters
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and ign in ('OldName', 'NewName')
  ),
  2::bigint,
  'name change is not guessed: old history and new IGN remain separate character rows'
);

select is(
  (
    select count(*)
    from public.roster_sync_runs
    where guild_id = '91000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'successful apply writes one sync-history row'
);

select is(
  (
    select source_filename
    from public.roster_sync_runs
    where guild_id = '91000000-0000-0000-0000-000000000001'
  ),
  'Immortals_20261002_0014.csv'::text,
  'sync history stores source filename metadata'
);

select is(
  (
    select source_sha256
    from public.roster_sync_runs
    where guild_id = '91000000-0000-0000-0000-000000000001'
  ),
  repeat('a', 64)::text,
  'sync history stores source hash metadata without storing raw CSV contents'
);

-- ---------------------------------------------------------------------------
-- Cross-Guild / raw-write protections
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    select *
    from public.apply_rtnw_roster_sync(
      '92000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder),
      'other.csv',
      repeat('b', 64)
    )
  $sql$,
  '42501',
  null,
  'Guild A Owner cannot apply a sync to Guild B'
);

select is(
  (
    select ign
    from public.characters
    where id = '94000000-0000-0000-0000-000000000001'
  ),
  null::text,
  'RLS hides Guild B roster data from Guild A Owner'
);

select throws_ok(
  $sql$
    insert into public.roster_sync_runs (
      guild_id,
      source_filename,
      source_sha256,
      source_row_count
    )
    values (
      '91000000-0000-0000-0000-000000000001',
      'direct.csv',
      repeat('c', 64),
      1
    )
  $sql$,
  '42501',
  null,
  'authenticated application role cannot directly write sync history'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select *
    from public.preview_rtnw_roster_sync(
      '91000000-0000-0000-0000-000000000001',
      (select payload from rtnw_payload_holder)
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute RTNW roster preview'
);

reset role;

select * from finish();

rollback;
