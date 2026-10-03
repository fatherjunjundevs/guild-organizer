begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- ---------------------------------------------------------------------------
-- Schema surface
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('public.character_reconciliations') is not null,
  'character_reconciliations table exists'
);

select ok(
  to_regclass('public.roster_sync_run_changes') is not null,
  'roster_sync_run_changes table exists'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.character_reconciliations'::regclass
  ),
  'character_reconciliations has RLS enabled'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.roster_sync_run_changes'::regclass
  ),
  'roster_sync_run_changes has RLS enabled'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'characters'
      and column_name = 'reconciled_into_character_id'
  ),
  'characters exposes canonical reconciliation target'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'characters'
      and column_name = 'reconciled_at'
  ),
  'characters records reconciliation time'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'characters'
      and column_name = 'reconciled_by'
  ),
  'characters records reconciliation actor'
);

-- ---------------------------------------------------------------------------
-- Test identities / Guilds
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('b0000000-0000-4000-8000-000000000001', 'reconcile-owner-a@test.local'),
  ('b0000000-0000-4000-8000-000000000002', 'reconcile-officer-a@test.local'),
  ('b0000000-0000-4000-8000-000000000003', 'reconcile-member-a@test.local'),
  ('b0000000-0000-4000-8000-000000000004', 'reconcile-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'Reconcile Guild A',
    'b0000000-0000-4000-8000-000000000001'
  ),
  (
    'b2000000-0000-4000-8000-000000000001',
    'Reconcile Guild B',
    'b0000000-0000-4000-8000-000000000004'
  );

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  (
    'b1100000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    'b1100000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000002',
    'officer'
  ),
  (
    'b1100000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000003',
    'member'
  ),
  (
    'b2200000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000004',
    'owner'
  );

insert into public.characters (
  id, guild_id, ign, source_origin, created_by
)
values
  (
    'b3000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'OldIGN',
    'manual',
    'b0000000-0000-4000-8000-000000000001'
  ),
  (
    'b3000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'NewIGN',
    'manual',
    'b0000000-0000-4000-8000-000000000001'
  ),
  (
    'b3000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000001',
    'AnotherIGN',
    'manual',
    'b0000000-0000-4000-8000-000000000001'
  ),
  (
    'b4000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'OtherGuildIGN',
    'manual',
    'b0000000-0000-4000-8000-000000000004'
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
    'b5000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'rtnw_csv',
    'guild-a.csv',
    repeat('a', 64),
    1,
    0,
    1,
    0,
    0,
    0,
    'b0000000-0000-4000-8000-000000000001'
  ),
  (
    'b6000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'rtnw_csv',
    'guild-b.csv',
    repeat('b', 64),
    1,
    0,
    1,
    0,
    0,
    0,
    'b0000000-0000-4000-8000-000000000004'
  );

-- ---------------------------------------------------------------------------
-- Character reconciliation lifecycle integrity
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    update public.characters
    set
      status = 'inactive',
      inactive_reason = 'reconciled',
      reconciled_into_character_id = id,
      reconciled_at = now(),
      reconciled_by = 'b0000000-0000-4000-8000-000000000001'
    where id = 'b3000000-0000-4000-8000-000000000001'
  $sql$,
  '23514',
  null,
  'a Character cannot reconcile into itself'
);

select throws_ok(
  $sql$
    update public.characters
    set
      status = 'inactive',
      inactive_reason = 'reconciled',
      reconciled_into_character_id = 'b4000000-0000-4000-8000-000000000001',
      reconciled_at = now(),
      reconciled_by = 'b0000000-0000-4000-8000-000000000001'
    where id = 'b3000000-0000-4000-8000-000000000001'
  $sql$,
  '23503',
  null,
  'a Character cannot reconcile into a Character from another Guild'
);

select throws_ok(
  $sql$
    update public.characters
    set
      status = 'inactive',
      inactive_reason = 'reconciled',
      reconciled_into_character_id = 'b3000000-0000-4000-8000-000000000002'
    where id = 'b3000000-0000-4000-8000-000000000001'
  $sql$,
  '23514',
  null,
  'reconciled lifecycle requires a reconciliation timestamp'
);

select lives_ok(
  $sql$
    update public.characters
    set
      status = 'inactive',
      inactive_reason = 'reconciled',
      left_guild_at = null,
      reconciled_into_character_id = 'b3000000-0000-4000-8000-000000000002',
      reconciled_at = '2026-10-02T21:40:00Z',
      reconciled_by = 'b0000000-0000-4000-8000-000000000001'
    where id = 'b3000000-0000-4000-8000-000000000001'
  $sql$,
  'a valid explicit reconciliation state is accepted'
);

select is(
  (
    select status || '|' || inactive_reason
    from public.characters
    where id = 'b3000000-0000-4000-8000-000000000001'
  ),
  'inactive|reconciled'::text,
  'reconciled Character remains preserved as inactive history'
);

-- ---------------------------------------------------------------------------
-- Reconciliation audit integrity
-- ---------------------------------------------------------------------------

insert into public.character_reconciliations (
  id,
  guild_id,
  source_character_id,
  target_character_id,
  source_ign_snapshot,
  target_ign_snapshot,
  triggering_sync_run_id,
  note,
  reconciled_by,
  reconciled_at
)
values (
  'b7000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000002',
  'OldIGN',
  'NewIGN',
  'b5000000-0000-4000-8000-000000000001',
  'Confirmed rename after organizer review',
  'b0000000-0000-4000-8000-000000000001',
  '2026-10-02T21:40:00Z'
);

select is(
  (
    select source_ign_snapshot || '->' || target_ign_snapshot
    from public.character_reconciliations
    where id = 'b7000000-0000-4000-8000-000000000001'
  ),
  'OldIGN->NewIGN'::text,
  'reconciliation history preserves both IGN snapshots'
);

select throws_ok(
  $sql$
    insert into public.character_reconciliations (
      guild_id,
      source_character_id,
      target_character_id,
      source_ign_snapshot,
      target_ign_snapshot,
      reconciled_by
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      'b3000000-0000-4000-8000-000000000003',
      'AnotherIGN',
      'AnotherIGN',
      'b0000000-0000-4000-8000-000000000001'
    )
  $sql$,
  '23514',
  null,
  'reconciliation audit rejects identical source and target Characters'
);

select throws_ok(
  $sql$
    insert into public.character_reconciliations (
      guild_id,
      source_character_id,
      target_character_id,
      source_ign_snapshot,
      target_ign_snapshot,
      triggering_sync_run_id,
      reconciled_by
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      'b3000000-0000-4000-8000-000000000002',
      'AnotherIGN',
      'NewIGN',
      'b6000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000001'
    )
  $sql$,
  '23503',
  null,
  'reconciliation audit cannot reference an import run from another Guild'
);

select throws_ok(
  $sql$
    insert into public.character_reconciliations (
      guild_id,
      source_character_id,
      target_character_id,
      source_ign_snapshot,
      target_ign_snapshot,
      reconciled_by
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      'OldIGN',
      'AnotherIGN',
      'b0000000-0000-4000-8000-000000000001'
    )
  $sql$,
  '23505',
  null,
  'one historical source Character cannot be reconciled twice'
);

-- ---------------------------------------------------------------------------
-- Per-Character import history integrity
-- ---------------------------------------------------------------------------

insert into public.roster_sync_run_changes (
  id,
  guild_id,
  sync_run_id,
  character_id,
  character_ign,
  change_kind,
  changed_fields,
  before_values,
  after_values,
  recorded_at
)
values (
  'b8000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000002',
  'NewIGN',
  'update',
  array['gear_score'],
  '{"gear_score":49000}'::jsonb,
  '{"gear_score":51000}'::jsonb,
  '2026-10-02T21:41:00Z'
);

select is(
  (
    select change_kind || ':' || character_ign
    from public.roster_sync_run_changes
    where id = 'b8000000-0000-4000-8000-000000000001'
  ),
  'update:NewIGN'::text,
  'per-Character import history stores applied change metadata'
);

select throws_ok(
  $sql$
    insert into public.roster_sync_run_changes (
      guild_id,
      sync_run_id,
      character_id,
      character_ign,
      change_kind,
      changed_fields
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      'AnotherIGN',
      'update',
      array['class_name']
    )
  $sql$,
  '23503',
  null,
  'import history cannot attach a sync run from another Guild'
);

select throws_ok(
  $sql$
    insert into public.roster_sync_run_changes (
      guild_id,
      sync_run_id,
      character_id,
      character_ign,
      change_kind,
      changed_fields
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b5000000-0000-4000-8000-000000000001',
      'b4000000-0000-4000-8000-000000000001',
      'OtherGuildIGN',
      'update',
      array['class_name']
    )
  $sql$,
  '23503',
  null,
  'import history cannot attach a Character from another Guild'
);

select throws_ok(
  $sql$
    insert into public.roster_sync_run_changes (
      guild_id,
      sync_run_id,
      character_id,
      character_ign,
      change_kind,
      changed_fields
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b5000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      'AnotherIGN',
      'rename',
      array['ign']
    )
  $sql$,
  '23514',
  null,
  'import history rejects unsupported automatic rename change kinds'
);

select throws_ok(
  $sql$
    insert into public.roster_sync_run_changes (
      guild_id,
      sync_run_id,
      character_id,
      character_ign,
      change_kind,
      changed_fields
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b5000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      'AnotherIGN',
      'update',
      array[]::text[]
    )
  $sql$,
  '23514',
  null,
  'import history requires at least one changed field'
);

-- ---------------------------------------------------------------------------
-- RLS / direct-write protection
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000001';

select results_eq(
  'select count(*) from public.character_reconciliations',
  array[1::bigint],
  'Guild Owner can read reconciliation history for their Guild'
);

select results_eq(
  'select count(*) from public.roster_sync_run_changes',
  array[1::bigint],
  'Guild Owner can read per-Character import history for their Guild'
);

set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000003';

select results_eq(
  'select count(*) from public.character_reconciliations',
  array[0::bigint],
  'ordinary Guild Member cannot read reconciliation history'
);

select results_eq(
  'select count(*) from public.roster_sync_run_changes',
  array[0::bigint],
  'ordinary Guild Member cannot read per-Character import history'
);

set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000001';

select throws_ok(
  $sql$
    insert into public.character_reconciliations (
      guild_id,
      source_character_id,
      target_character_id,
      source_ign_snapshot,
      target_ign_snapshot
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      'b3000000-0000-4000-8000-000000000002',
      'AnotherIGN',
      'NewIGN'
    )
  $sql$,
  '42501',
  null,
  'authenticated application roles cannot directly write reconciliation history'
);

select throws_ok(
  $sql$
    insert into public.roster_sync_run_changes (
      guild_id,
      sync_run_id,
      character_id,
      character_ign,
      change_kind,
      changed_fields
    )
    values (
      'b1000000-0000-4000-8000-000000000001',
      'b5000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      'AnotherIGN',
      'update',
      array['class_name']
    )
  $sql$,
  '42501',
  null,
  'authenticated application roles cannot directly write per-Character import history'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select count(*) from public.character_reconciliations
  $sql$,
  '42501',
  null,
  'anonymous users cannot read reconciliation history'
);

reset role;

select * from finish();

rollback;
