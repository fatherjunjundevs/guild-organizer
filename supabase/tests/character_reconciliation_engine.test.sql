begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

-- ---------------------------------------------------------------------------
-- Function surface
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure(
    'public.reconcile_roster_character(uuid,uuid,text,uuid)'
  ) is not null,
  'explicit Character reconciliation RPC exists'
);

select ok(
  (
    select
      p.provolatile = 'v'
      and position(
        'FOR UPDATE'
        in upper(pg_get_functiondef(p.oid))
      ) > 0
    from pg_proc p
    where p.oid = 'private.require_roster_character(uuid)'::regprocedure
  ),
  'single-Character mutation helper serializes writes with reconciliation'
);

-- ---------------------------------------------------------------------------
-- Users / Guilds / Characters
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('c0000000-0000-4000-8000-000000000001', 'reconcile-owner-a@test.local'),
  ('c0000000-0000-4000-8000-000000000002', 'reconcile-officer-a@test.local'),
  ('c0000000-0000-4000-8000-000000000003', 'reconcile-member-a@test.local'),
  ('c0000000-0000-4000-8000-000000000004', 'reconcile-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'Reconcile Engine Guild A',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c2000000-0000-4000-8000-000000000001',
    'Reconcile Engine Guild B',
    'c0000000-0000-4000-8000-000000000004'
  );

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  (
    'c1100000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    'c1100000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'officer'
  ),
  (
    'c1100000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000003',
    'member'
  ),
  (
    'c2200000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000004',
    'owner'
  );

insert into public.characters (
  id,
  guild_id,
  ign,
  gear_score,
  status,
  inactive_reason,
  left_guild_at,
  source_origin,
  reconciled_into_character_id,
  reconciled_at,
  reconciled_by,
  created_by
)
values
  (
    'c3000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'OldIGN',
    49000,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'NewIGN',
    51000,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000001',
    'OlderIGN',
    47000,
    'inactive',
    'reconciled',
    null,
    'manual',
    'c3000000-0000-4000-8000-000000000001',
    '2026-10-01T12:00:00Z',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000001',
    'ProfileConflictSource',
    45000,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'ProfileConflictTarget',
    45500,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000006',
    'c1000000-0000-4000-8000-000000000001',
    'CustomConflictSource',
    44000,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000007',
    'c1000000-0000-4000-8000-000000000001',
    'CustomConflictTarget',
    44500,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000008',
    'c1000000-0000-4000-8000-000000000001',
    'SpareSource',
    43000,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000009',
    'c1000000-0000-4000-8000-000000000001',
    'NewestIGN',
    53000,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-00000000000a',
    'c1000000-0000-4000-8000-000000000001',
    'OfficerSource',
    42000,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-00000000000b',
    'c1000000-0000-4000-8000-000000000001',
    'OfficerTarget',
    42500,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c4000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001',
    'OtherGuildIGN',
    60000,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    null,
    'c0000000-0000-4000-8000-000000000004'
  );

insert into public.character_reconciliations (
  id,
  guild_id,
  source_character_id,
  target_character_id,
  source_ign_snapshot,
  target_ign_snapshot,
  note,
  reconciled_by,
  reconciled_at
)
values (
  'c7000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000003',
  'c3000000-0000-4000-8000-000000000001',
  'OlderIGN',
  'OldIGN',
  'Earlier confirmed rename',
  'c0000000-0000-4000-8000-000000000001',
  '2026-10-01T12:00:00Z'
);

insert into public.roster_sync_runs (
  id,
  guild_id,
  source_type,
  source_filename,
  source_sha256,
  source_row_count,
  created_count,
  updated_count,
  reactivated_count,
  left_guild_count,
  unchanged_count,
  imported_by
)
values
  (
    'c6000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'rtnw_csv',
    'guild-a.csv',
    repeat('a', 64),
    1,
    0,
    1,
    0,
    0,
    0,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c6000000-0000-4000-8000-000000000002',
    'c2000000-0000-4000-8000-000000000001',
    'rtnw_csv',
    'guild-b.csv',
    repeat('b', 64),
    1,
    0,
    1,
    0,
    0,
    0,
    'c0000000-0000-4000-8000-000000000004'
  );

insert into public.character_roster_profiles (
  guild_id,
  character_id,
  designation,
  role_label,
  created_by
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'main',
    'Support',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000002',
    'main',
    null,
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000004',
    'main',
    'Support',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000005',
    'sub',
    'Support',
    'c0000000-0000-4000-8000-000000000001'
  );

insert into public.roster_tags (
  id,
  guild_id,
  name,
  created_by
)
values
  (
    'c5100000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'Alpha',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c5100000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'Bravo',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c5100000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000001',
    'Charlie',
    'c0000000-0000-4000-8000-000000000001'
  );

insert into public.character_roster_tags (
  guild_id,
  character_id,
  tag_id,
  created_by
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'c5100000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'c5100000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000002',
    'c5100000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000002',
    'c5100000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000001'
  );

insert into public.roster_custom_fields (
  id,
  guild_id,
  name,
  field_type,
  select_options,
  created_by
)
values
  (
    'c5200000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'Team',
    'text',
    '{}'::text[],
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c5200000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000001',
    'Priority',
    'number',
    '{}'::text[],
    'c0000000-0000-4000-8000-000000000001'
  );

insert into public.character_roster_custom_field_values (
  guild_id,
  character_id,
  field_id,
  value,
  created_by,
  updated_by
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'c5200000-0000-4000-8000-000000000001',
    to_jsonb('Alpha'::text),
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'c5200000-0000-4000-8000-000000000002',
    to_jsonb(1),
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000002',
    'c5200000-0000-4000-8000-000000000001',
    to_jsonb('Alpha'::text),
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000006',
    'c5200000-0000-4000-8000-000000000001',
    to_jsonb('Red'::text),
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001'
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000007',
    'c5200000-0000-4000-8000-000000000001',
    to_jsonb('Blue'::text),
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001'
  );

-- ---------------------------------------------------------------------------
-- Authorization / input safety
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000003';

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000001',
      'c3000000-0000-4000-8000-000000000002'
    )
  $sql$,
  '42501',
  null,
  'Member cannot reconcile Characters'
);

set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000002';

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-00000000000a',
      'c3000000-0000-4000-8000-00000000000b'
    )
  $sql$,
  '42501',
  null,
  'Officer without roster.manage cannot reconcile Characters'
);

set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000001';

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000001',
      'c3000000-0000-4000-8000-000000000001'
    )
  $sql$,
  '22023',
  null,
  'a Character cannot reconcile into itself'
);

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000001',
      'c4000000-0000-4000-8000-000000000001'
    )
  $sql$,
  '42501',
  null,
  'cross-Guild reconciliation is rejected'
);

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000001',
      'c3000000-0000-4000-8000-000000000002',
      repeat('x', 501)
    )
  $sql$,
  '22023',
  null,
  'reconciliation note longer than 500 characters is rejected'
);

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000001',
      'c3000000-0000-4000-8000-000000000002',
      null,
      'c6000000-0000-4000-8000-000000000002'
    )
  $sql$,
  '22023',
  null,
  'triggering import run must belong to the same Guild'
);

-- ---------------------------------------------------------------------------
-- Conflict safety / transaction rollback
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000004',
      'c3000000-0000-4000-8000-000000000005'
    )
  $sql$,
  '22023',
  null,
  'conflicting organizer profile values block reconciliation'
);

select is(
  (
    select status
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000004'
  ),
  'active'::text,
  'profile conflict leaves the source Character unchanged'
);

select is(
  (
    select designation
    from public.character_roster_profiles
    where character_id = 'c3000000-0000-4000-8000-000000000004'
  ),
  'main'::text,
  'profile conflict preserves source organizer metadata'
);

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000006',
      'c3000000-0000-4000-8000-000000000007'
    )
  $sql$,
  '22023',
  null,
  'conflicting custom-field values block reconciliation'
);

select is(
  (
    select status
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000006'
  ),
  'active'::text,
  'custom-field conflict leaves the source Character unchanged'
);

select is(
  (
    select value #>> '{}'
    from public.character_roster_custom_field_values
    where character_id = 'c3000000-0000-4000-8000-000000000006'
      and field_id = 'c5200000-0000-4000-8000-000000000001'
  ),
  'Red'::text,
  'custom-field conflict preserves the source value'
);

-- ---------------------------------------------------------------------------
-- Successful explicit reconciliation
-- ---------------------------------------------------------------------------

select ok(
  public.reconcile_roster_character(
    'c3000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000002',
    'Confirmed rename after organizer review',
    'c6000000-0000-4000-8000-000000000001'
  ) is not null,
  'authorized reconciliation returns an audit identifier'
);

select is(
  (
    select count(*)
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'source Character row remains preserved'
);

select is(
  (
    select status || '|' || inactive_reason
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000001'
  ),
  'inactive|reconciled'::text,
  'source Character becomes reconciled historical identity'
);

select is(
  (
    select reconciled_into_character_id
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000001'
  ),
  'c3000000-0000-4000-8000-000000000002'::uuid,
  'source Character points to the chosen canonical target'
);

select is(
  (
    select reconciled_by
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000001'
  ),
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'source reconciliation records the acting organizer'
);

select is(
  (
    select gear_score
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000002'
  ),
  51000::bigint,
  'target current game data remains authoritative'
);

select is(
  (
    select gear_score
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000001'
  ),
  49000::bigint,
  'source game snapshot remains preserved as history'
);

select is(
  (
    select designation || '|' || role_label
    from public.character_roster_profiles
    where character_id = 'c3000000-0000-4000-8000-000000000002'
  ),
  'main|Support'::text,
  'safe organizer profile values merge into the target'
);

select is(
  (
    select count(*)
    from public.character_roster_profiles
    where character_id = 'c3000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'source organizer profile is moved off the historical Character'
);

select results_eq(
  $sql$
    select t.name
    from public.character_roster_tags assignment
    join public.roster_tags t
      on t.guild_id = assignment.guild_id
     and t.id = assignment.tag_id
    where assignment.character_id = 'c3000000-0000-4000-8000-000000000002'
    order by t.name
  $sql$,
  array['Alpha'::text, 'Bravo'::text, 'Charlie'::text],
  'target receives the union of source and target tags'
);

select is(
  (
    select count(*)
    from public.character_roster_tags
    where character_id = 'c3000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'source tag assignments move off the historical Character'
);

select is(
  (
    select count(*)
    from public.character_roster_custom_field_values
    where character_id = 'c3000000-0000-4000-8000-000000000002'
  ),
  2::bigint,
  'target receives missing safe custom-field values'
);

select is(
  (
    select value #>> '{}'
    from public.character_roster_custom_field_values
    where character_id = 'c3000000-0000-4000-8000-000000000002'
      and field_id = 'c5200000-0000-4000-8000-000000000002'
  ),
  '1'::text,
  'source-only custom-field value transfers to the target'
);

select is(
  (
    select value #>> '{}'
    from public.character_roster_custom_field_values
    where character_id = 'c3000000-0000-4000-8000-000000000002'
      and field_id = 'c5200000-0000-4000-8000-000000000001'
  ),
  'Alpha'::text,
  'equal target custom-field value remains unchanged'
);

select is(
  (
    select count(*)
    from public.character_roster_custom_field_values
    where character_id = 'c3000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'source custom-field values move off the historical Character'
);

select is(
  (
    select reconciled_into_character_id
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000003'
  ),
  'c3000000-0000-4000-8000-000000000002'::uuid,
  'existing historical aliases are redirected to the new canonical target'
);

select is(
  (
    select target_character_id
    from public.character_reconciliations
    where id = 'c7000000-0000-4000-8000-000000000001'
  ),
  'c3000000-0000-4000-8000-000000000001'::uuid,
  'older reconciliation audit history is not rewritten'
);

select is(
  (
    select source_ign_snapshot || '->' || target_ign_snapshot
    from public.character_reconciliations
    where source_character_id = 'c3000000-0000-4000-8000-000000000001'
  ),
  'OldIGN->NewIGN'::text,
  'new reconciliation audit preserves source and target IGN snapshots'
);

select is(
  (
    select note
      || '|'
      || triggering_sync_run_id::text
    from public.character_reconciliations
    where source_character_id = 'c3000000-0000-4000-8000-000000000001'
  ),
  (
    'Confirmed rename after organizer review|'
    || 'c6000000-0000-4000-8000-000000000001'
  )::text,
  'reconciliation audit records note and triggering import context'
);

select is(
  (
    select reconciled_by
    from public.character_reconciliations
    where source_character_id = 'c3000000-0000-4000-8000-000000000001'
  ),
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'reconciliation audit records the acting organizer'
);

select throws_ok(
  $sql$
    select public.set_character_manual_status(
      'c3000000-0000-4000-8000-000000000001',
      'active'
    )
  $sql$,
  '55000',
  null,
  'ordinary roster mutations reject reconciled historical Characters'
);

select throws_ok(
  $sql$
    select public.bulk_update_roster_characters(
      array[
        'c3000000-0000-4000-8000-000000000001'::uuid,
        'c3000000-0000-4000-8000-000000000008'::uuid
      ],
      'role_label',
      'ShouldNotApply'
    )
  $sql$,
  '55000',
  null,
  'bulk organizer mutations reject reconciled historical Characters'
);

select is(
  (
    select count(*)
    from public.character_roster_profiles
    where character_id = 'c3000000-0000-4000-8000-000000000008'
  ),
  0::bigint,
  'failed mixed bulk mutation leaves mutable Characters unchanged'
);

-- ---------------------------------------------------------------------------
-- Repeated confirmed renames flatten current pointers, not audit history
-- ---------------------------------------------------------------------------

select ok(
  public.reconcile_roster_character(
    'c3000000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000009',
    'Second confirmed rename'
  ) is not null,
  'a canonical Character can later be explicitly reconciled again'
);

select is(
  (
    select reconciled_into_character_id
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000001'
  ),
  'c3000000-0000-4000-8000-000000000009'::uuid,
  'older source pointer is flattened to the newest canonical Character'
);

select is(
  (
    select status || '|' || inactive_reason || '|' || reconciled_into_character_id::text
    from public.characters
    where id = 'c3000000-0000-4000-8000-000000000002'
  ),
  (
    'inactive|reconciled|'
    || 'c3000000-0000-4000-8000-000000000009'
  )::text,
  'former canonical Character becomes preserved reconciliation history'
);

select is(
  (
    select target_character_id
    from public.character_reconciliations
    where source_character_id = 'c3000000-0000-4000-8000-000000000001'
  ),
  'c3000000-0000-4000-8000-000000000002'::uuid,
  'first reconciliation audit remains immutable after a later rename'
);

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000001',
      'c3000000-0000-4000-8000-000000000008'
    )
  $sql$,
  '55000',
  null,
  'an already reconciled historical source cannot be reconciled again'
);

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000008',
      'c3000000-0000-4000-8000-000000000002'
    )
  $sql$,
  '55000',
  null,
  'an already reconciled historical Character cannot be selected as target'
);

-- ---------------------------------------------------------------------------
-- Officer capability and anonymous denial
-- ---------------------------------------------------------------------------

reset role;

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values (
  'c1000000-0000-4000-8000-000000000001',
  'c1100000-0000-4000-8000-000000000002',
  'roster.manage',
  'c0000000-0000-4000-8000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000002';

select ok(
  public.reconcile_roster_character(
    'c3000000-0000-4000-8000-00000000000a',
    'c3000000-0000-4000-8000-00000000000b'
  ) is not null,
  'Officer with roster.manage can explicitly reconcile Characters'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select public.reconcile_roster_character(
      'c3000000-0000-4000-8000-000000000008',
      'c3000000-0000-4000-8000-000000000009'
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute Character reconciliation'
);

reset role;

select * from finish();

rollback;
