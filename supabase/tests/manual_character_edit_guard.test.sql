begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email)
values (
  '90000000-0000-0000-0000-000000000001',
  'manual-edit-owner@test.local'
);

insert into public.guilds (id, name, created_by)
values (
  '91000000-0000-0000-0000-000000000001',
  'Manual Edit Guard Guild',
  '90000000-0000-0000-0000-000000000001'
);

insert into public.guild_memberships (
  id,
  guild_id,
  user_id,
  role
)
values (
  '91100000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  'owner'
);

insert into public.characters (
  id,
  guild_id,
  ign,
  level,
  class_name,
  source_origin,
  rtnw_first_seen_at,
  rtnw_last_seen_at,
  created_by
)
values
  (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'ManualBefore',
    70,
    'High Priest',
    'manual',
    null,
    null,
    '90000000-0000-0000-0000-000000000001'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001',
    'SyncedBefore',
    80,
    'High Wizard',
    'rtnw_export',
    now(),
    now(),
    '90000000-0000-0000-0000-000000000001'
  );

set local role authenticated;
set local request.jwt.claim.sub =
  '90000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.update_roster_character(
      '92000000-0000-0000-0000-000000000001',
      'ManualAfter',
      81,
      'High Priest',
      'Pathfinder I',
      'F',
      'Elite',
      56000,
      820,
      2400,
      18000,
      '[Online]'
    )
  $sql$,
  'manual-origin character game fields can be edited'
);

select is(
  (
    select
      ign || '|' ||
      level::text || '|' ||
      gear_score::text || '|' ||
      weekly_contribution::text
    from public.characters
    where id = '92000000-0000-0000-0000-000000000001'
  ),
  'ManualAfter|81|56000|2400'::text,
  'manual-origin game-field changes persist'
);

select throws_ok(
  $sql$
    select public.update_roster_character(
      '92000000-0000-0000-0000-000000000002',
      'SyncedChanged',
      99,
      'High Wizard',
      null,
      null,
      'Elite',
      99999,
      999,
      9999,
      99999,
      '[Online]'
    )
  $sql$,
  '55000',
  null,
  'RTNW-synced character game fields are protected from manual update'
);

select is(
  (
    select
      ign || '|' ||
      level::text || '|' ||
      class_name
    from public.characters
    where id = '92000000-0000-0000-0000-000000000002'
  ),
  'SyncedBefore|80|High Wizard'::text,
  'rejected RTNW-synced edit leaves game fields unchanged'
);

reset role;

select * from finish();

rollback;
