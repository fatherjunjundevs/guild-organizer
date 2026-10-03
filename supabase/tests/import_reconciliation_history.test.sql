begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

-- ---------------------------------------------------------------------------
-- Users / Guild / initial RTNW fixture
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('b0000000-0000-0000-0000-000000000001', 'b2-owner@test.local');

insert into public.guilds (id, name, created_by)
values (
  'b1000000-0000-0000-0000-000000000001',
  'B2 Import Guild',
  'b0000000-0000-0000-0000-000000000001'
);

insert into public.guild_memberships (id, guild_id, user_id, role)
values (
  'b1100000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'owner'
);

insert into public.characters (
  id,
  guild_id,
  ign,
  level,
  class_name,
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
    'b3000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'HistOld',
    70,
    'Priest',
    'active',
    null,
    null,
    'manual',
    null,
    null,
    'b0000000-0000-0000-0000-000000000001'
  ),
  (
    'b3000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'Canonical',
    83,
    'Scholar',
    'active',
    null,
    null,
    'rtnw_export',
    '2026-10-01T12:00:00Z',
    '2026-10-02T12:00:00Z',
    'b0000000-0000-0000-0000-000000000001'
  ),
  (
    'b3000000-0000-0000-0000-000000000003',
    'b1000000-0000-0000-0000-000000000001',
    'Stable',
    82,
    'High Priest',
    'active',
    null,
    null,
    'rtnw_export',
    '2026-10-01T12:00:00Z',
    '2026-10-02T12:00:00Z',
    'b0000000-0000-0000-0000-000000000001'
  ),
  (
    'b3000000-0000-0000-0000-000000000004',
    'b1000000-0000-0000-0000-000000000001',
    'Changed',
    81,
    'Sniper',
    'active',
    null,
    null,
    'rtnw_export',
    '2026-10-01T12:00:00Z',
    '2026-10-02T12:00:00Z',
    'b0000000-0000-0000-0000-000000000001'
  ),
  (
    'b3000000-0000-0000-0000-000000000005',
    'b1000000-0000-0000-0000-000000000001',
    'Returned',
    80,
    'Lord Knight',
    'inactive',
    'left_guild',
    '2026-10-02T12:00:00Z',
    'rtnw_export',
    '2026-09-20T12:00:00Z',
    '2026-10-01T12:00:00Z',
    'b0000000-0000-0000-0000-000000000001'
  ),
  (
    'b3000000-0000-0000-0000-000000000006',
    'b1000000-0000-0000-0000-000000000001',
    'Departing',
    79,
    'Champion',
    'active',
    null,
    null,
    'rtnw_export',
    '2026-10-01T12:00:00Z',
    '2026-10-02T12:00:00Z',
    'b0000000-0000-0000-0000-000000000001'
  );

create temporary table b2_rtnw_payload (payload jsonb not null);
grant select on table b2_rtnw_payload to authenticated;

insert into b2_rtnw_payload (payload)
values (
  '[
    {"ign":"Canonical","level":83,"class_name":"Scholar"},
    {"ign":"Stable","level":82,"class_name":"High Priest"},
    {"ign":"Changed","level":81,"class_name":"Stalker"},
    {"ign":"Returned","level":80,"class_name":"Lord Knight"},
    {"ign":"NewRtnw","level":70,"class_name":"Wizard"}
  ]'::jsonb
);

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.reconcile_roster_character(
      'b3000000-0000-0000-0000-000000000001',
      'b3000000-0000-0000-0000-000000000002',
      'B2 import guard fixture'
    )
  $sql$,
  'fixture reconciliation succeeds'
);

-- ---------------------------------------------------------------------------
-- RTNW reconciled-history guards
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    select *
    from public.preview_rtnw_roster_sync(
      'b1000000-0000-0000-0000-000000000001',
      '[{"ign":"HistOld"}]'::jsonb
    )
  $sql$,
  '55000',
  null,
  'RTNW preview blocks an exact IGN belonging to reconciled history'
);

select throws_ok(
  $sql$
    select *
    from public.apply_rtnw_roster_sync(
      'b1000000-0000-0000-0000-000000000001',
      '[{"ign":"HistOld"}]'::jsonb,
      'blocked.csv',
      repeat('a', 64)
    )
  $sql$,
  '55000',
  null,
  'RTNW apply blocks an exact IGN belonging to reconciled history'
);

select is(
  (
    select count(*)
    from public.roster_sync_runs
    where guild_id = 'b1000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'blocked RTNW apply writes no import run'
);

select is(
  (
    select count(*)
    from public.preview_rtnw_roster_sync(
      'b1000000-0000-0000-0000-000000000001',
      (select payload from b2_rtnw_payload)
    )
    where ign = 'HistOld'
  ),
  0::bigint,
  'reconciled historical Character is excluded from RTNW omission changes'
);

-- ---------------------------------------------------------------------------
-- RTNW apply + per-Character history
-- ---------------------------------------------------------------------------

create temporary table b2_rtnw_result as
select *
from public.apply_rtnw_roster_sync(
  'b1000000-0000-0000-0000-000000000001',
  (select payload from b2_rtnw_payload),
  'guild-export.csv',
  repeat('b', 64)
);

select is(
  (select source_row_count from b2_rtnw_result),
  5,
  'RTNW apply records source row count'
);

select is(
  (select created_count from b2_rtnw_result),
  1,
  'RTNW apply counts one new Character'
);

select is(
  (select updated_count from b2_rtnw_result),
  1,
  'RTNW apply counts one updated Character'
);

select is(
  (select reactivated_count from b2_rtnw_result),
  1,
  'RTNW apply counts one reactivated Character'
);

select is(
  (select left_guild_count from b2_rtnw_result),
  1,
  'RTNW apply counts one departure'
);

select is(
  (select unchanged_count from b2_rtnw_result),
  2,
  'RTNW apply counts two unchanged incoming Characters'
);

select is(
  (
    select count(*)
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
  ),
  4::bigint,
  'RTNW run writes history only for meaningful Character changes'
);

select results_eq(
  $sql$
    select change_kind || ':' || character_ign
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
    order by character_ign
  $sql$,
  array[
    'update:Changed'::text,
    'left_guild:Departing'::text,
    'new:NewRtnw'::text,
    'reactivate:Returned'::text
  ],
  'RTNW history records update, departure, new, and reactivation kinds'
);

select is(
  (
    select count(*)
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
      and character_ign = 'HistOld'
  ),
  0::bigint,
  'RTNW history never rewrites reconciled historical identity'
);

select results_eq(
  $sql$
    select unnest(changed_fields)
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
      and character_ign = 'Changed'
  $sql$,
  array['class_name'::text],
  'RTNW update history records only the changed game field'
);

select is(
  (
    select before_values ->> 'class_name'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
      and character_ign = 'Changed'
  ),
  'Sniper'::text,
  'RTNW update history stores the prior changed value'
);

select is(
  (
    select after_values ->> 'class_name'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
      and character_ign = 'Changed'
  ),
  'Stalker'::text,
  'RTNW update history stores the applied changed value'
);

select is(
  (
    select after_values ->> 'status'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
      and character_ign = 'Returned'
  ),
  'active'::text,
  'RTNW reactivation history records active lifecycle state'
);

select ok(
  not (
    select after_values ? 'level'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
      and character_ign = 'NewRtnw'
  ),
  'new RTNW history does not duplicate imported game fields'
);

select is(
  (
    select after_values ->> 'inactive_reason'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_rtnw_result)
      and character_ign = 'Departing'
  ),
  'left_guild'::text,
  'RTNW departure history records lifecycle transition'
);

select is(
  (
    select reconciled_into_character_id
    from public.characters
    where id = 'b3000000-0000-0000-0000-000000000001'
  ),
  'b3000000-0000-0000-0000-000000000002'::uuid,
  'RTNW apply preserves the historical Character reconciliation pointer'
);

select ok(
  lower(
    pg_get_functiondef(
      'public.apply_rtnw_roster_sync(uuid,jsonb,text,text)'::regprocedure
    )
  ) like '%order by c.id%for update%'
  and lower(
    pg_get_functiondef(
      'public.apply_rtnw_roster_sync(uuid,jsonb,text,text)'::regprocedure
    )
  ) like '%reconciled_into_character_id is null%',
  'RTNW apply definition contains deterministic Character locking and reconciliation guards'
);

-- ---------------------------------------------------------------------------
-- Generic spreadsheet fixture
-- ---------------------------------------------------------------------------

reset role;

insert into public.characters (
  id,
  guild_id,
  ign,
  level,
  class_name,
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
    'b4000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'GenericChanged',
    60,
    'Creator',
    'active',
    null,
    null,
    'manual',
    null,
    null,
    'b0000000-0000-0000-0000-000000000001'
  ),
  (
    'b4000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'GenericInactive',
    59,
    'Lord Knight',
    'inactive',
    'left_guild',
    '2026-10-01T12:00:00Z',
    'rtnw_export',
    '2026-09-20T12:00:00Z',
    '2026-10-01T12:00:00Z',
    'b0000000-0000-0000-0000-000000000001'
  ),
  (
    'b4000000-0000-0000-0000-000000000003',
    'b1000000-0000-0000-0000-000000000001',
    'GenericStable',
    58,
    'Priest',
    'active',
    null,
    null,
    'manual',
    null,
    null,
    'b0000000-0000-0000-0000-000000000001'
  );

insert into public.character_roster_profiles (
  guild_id,
  character_id,
  designation,
  role_label,
  created_by
)
values (
  'b1000000-0000-0000-0000-000000000001',
  'b4000000-0000-0000-0000-000000000001',
  'main',
  'Crafter',
  'b0000000-0000-0000-0000-000000000001'
);

create temporary table b2_generic_payload (
  payload jsonb not null,
  mapped_fields text[] not null
);
grant select on table b2_generic_payload to authenticated;

insert into b2_generic_payload (payload, mapped_fields)
values (
  '[
    {"ign":"GenericChanged","class_name":"Whitesmith","role_label":"Leader"},
    {"ign":"GenericInactive","class_name":"Rune Knight","role_label":null},
    {"ign":"GenericStable","class_name":"Priest","role_label":null},
    {"ign":"NewSheet","class_name":"Scholar","role_label":"Utility"}
  ]'::jsonb,
  array['class_name', 'role_label']::text[]
);

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Generic reconciled-history guards
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    select *
    from public.preview_generic_roster_import(
      'b1000000-0000-0000-0000-000000000001',
      '[{"ign":"HistOld","class_name":"Wizard"}]'::jsonb,
      array['class_name']::text[]
    )
  $sql$,
  '55000',
  null,
  'generic preview blocks an exact IGN belonging to reconciled history'
);

select throws_ok(
  $sql$
    select *
    from public.apply_generic_roster_import(
      'b1000000-0000-0000-0000-000000000001',
      '[{"ign":"HistOld","class_name":"Wizard"}]'::jsonb,
      array['class_name']::text[],
      'blocked.xlsx',
      repeat('c', 64)
    )
  $sql$,
  '55000',
  null,
  'generic apply blocks an exact IGN belonging to reconciled history'
);

select is(
  (
    select count(*)
    from public.roster_sync_runs
    where guild_id = 'b1000000-0000-0000-0000-000000000001'
      and source_type = 'generic_spreadsheet'
  ),
  0::bigint,
  'blocked generic apply writes no import run'
);

-- ---------------------------------------------------------------------------
-- Generic apply + per-Character history
-- ---------------------------------------------------------------------------

create temporary table b2_generic_result as
select *
from public.apply_generic_roster_import(
  'b1000000-0000-0000-0000-000000000001',
  (select payload from b2_generic_payload),
  (select mapped_fields from b2_generic_payload),
  'mapped-roster.xlsx',
  repeat('d', 64)
);

select is(
  (select source_row_count from b2_generic_result),
  4,
  'generic apply records source row count'
);

select is(
  (select created_count from b2_generic_result),
  1,
  'generic apply counts one new Character'
);

select is(
  (select updated_count from b2_generic_result),
  2,
  'generic apply counts two updated existing Characters'
);

select is(
  (select unchanged_count from b2_generic_result),
  1,
  'generic apply counts one unchanged Character'
);

select is(
  (
    select count(*)
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
  ),
  3::bigint,
  'generic run writes history only for new and updated Characters'
);

select results_eq(
  $sql$
    select change_kind || ':' || character_ign
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
    order by character_ign
  $sql$,
  array[
    'update:GenericChanged'::text,
    'update:GenericInactive'::text,
    'new:NewSheet'::text
  ],
  'generic history records only meaningful incoming changes'
);

select results_eq(
  $sql$
    select unnest(changed_fields)
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
      and character_ign = 'GenericChanged'
  $sql$,
  array['class_name'::text, 'role_label'::text],
  'generic history records game and organizer fields that changed'
);

select is(
  (
    select before_values ->> 'class_name'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
      and character_ign = 'GenericChanged'
  ),
  'Creator'::text,
  'generic history stores prior mapped game value'
);

select is(
  (
    select before_values ->> 'role_label'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
      and character_ign = 'GenericChanged'
  ),
  'Crafter'::text,
  'generic history stores prior organizer value'
);

select is(
  (
    select after_values ->> 'class_name'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
      and character_ign = 'GenericChanged'
  ),
  'Whitesmith'::text,
  'generic history stores applied mapped game value'
);

select is(
  (
    select after_values ->> 'role_label'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
      and character_ign = 'GenericChanged'
  ),
  'Leader'::text,
  'generic history stores applied organizer value'
);

select is(
  (
    select status || '|' || inactive_reason
    from public.characters
    where guild_id = 'b1000000-0000-0000-0000-000000000001'
      and ign = 'GenericInactive'
  ),
  'inactive|left_guild'::text,
  'generic updates preserve inactive lifecycle state'
);

select ok(
  not (
    select after_values ? 'class_name'
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
      and character_ign = 'NewSheet'
  ),
  'new generic history does not duplicate mapped spreadsheet fields'
);

select is(
  (
    select count(*)
    from public.roster_sync_run_changes
    where sync_run_id = (select sync_run_id from b2_generic_result)
      and character_ign = 'HistOld'
  ),
  0::bigint,
  'generic history never writes against reconciled historical identity'
);

select ok(
  lower(
    pg_get_functiondef(
      'public.apply_generic_roster_import(uuid,jsonb,text[],text,text)'::regprocedure
    )
  ) like '%order by c.id%for update%'
  and lower(
    pg_get_functiondef(
      'public.apply_generic_roster_import(uuid,jsonb,text[],text,text)'::regprocedure
    )
  ) like '%reconciled_into_character_id is null%',
  'generic apply definition contains deterministic matching-row locking and reconciliation guards'
);

select is(
  (
    select count(*)
    from public.roster_sync_run_changes
    where guild_id = 'b1000000-0000-0000-0000-000000000001'
      and change_kind not in ('new', 'update', 'reactivate', 'left_guild')
  ),
  0::bigint,
  'per-Character history contains only supported change kinds'
);

select is(
  (
    select count(*)
    from public.roster_sync_run_changes h
    join public.roster_sync_runs r
      on r.id = h.sync_run_id
     and r.guild_id = h.guild_id
    where h.guild_id = 'b1000000-0000-0000-0000-000000000001'
      and h.change_kind = 'update'
      and h.character_ign = 'GenericStable'
  ),
  0::bigint,
  'unchanged generic Character gets no per-Character history row'
);

reset role;

select * from finish();

rollback;
