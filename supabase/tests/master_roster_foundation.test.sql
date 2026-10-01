begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- ---------------------------------------------------------------------------
-- Schema checks
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('public.characters') is not null,
  'characters table exists'
);

select ok(
  to_regclass('public.character_roster_profiles') is not null,
  'character_roster_profiles table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.characters'::regclass),
  'characters has RLS enabled'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.character_roster_profiles'::regclass
  ),
  'character_roster_profiles has RLS enabled'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'characters'
      and column_name = 'user_id'
  ),
  'Guild Character identity is separate from User Account identity'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.characters'::regclass
      and conname = 'characters_exact_ign_per_guild_unique'
      and contype = 'u'
  ),
  'exact IGN is unique inside one Guild'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.characters'::regclass
      and conname = 'characters_guild_id_id_unique'
      and contype = 'u'
  ),
  'characters expose a composite Guild/character identity'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.character_roster_profiles'::regclass
      and conname = 'character_roster_profiles_character_fk'
      and contype = 'f'
  ),
  'organizer roster metadata uses a composite Guild/character foreign key'
);

-- ---------------------------------------------------------------------------
-- Test identities and Guilds
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('70000000-0000-0000-0000-000000000001', 'roster-owner-a@test.local'),
  ('70000000-0000-0000-0000-000000000002', 'roster-officer-a@test.local'),
  ('70000000-0000-0000-0000-000000000003', 'roster-member-a@test.local'),
  ('70000000-0000-0000-0000-000000000004', 'roster-owner-b@test.local');

select is(
  (
    select count(*)
    from public.profiles
    where id in (
      '70000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000002',
      '70000000-0000-0000-0000-000000000003',
      '70000000-0000-0000-0000-000000000004'
    )
  ),
  4::bigint,
  'roster test auth users receive application profiles'
);

insert into public.guilds (id, name, created_by)
values
  (
    '71000000-0000-0000-0000-000000000001',
    'Roster Guild A',
    '70000000-0000-0000-0000-000000000001'
  ),
  (
    '72000000-0000-0000-0000-000000000001',
    'Roster Guild B',
    '70000000-0000-0000-0000-000000000004'
  );

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  (
    '71100000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '71100000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000002',
    'officer'
  ),
  (
    '71100000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000003',
    'member'
  ),
  (
    '72200000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000004',
    'owner'
  );

-- ---------------------------------------------------------------------------
-- Character integrity and RTNW field behavior
-- ---------------------------------------------------------------------------

insert into public.characters (
  id,
  guild_id,
  ign,
  level,
  class_name,
  title,
  gender,
  guild_position,
  gear_score,
  weekly_activity,
  weekly_contribution,
  total_contribution,
  online_status,
  source_origin,
  rtnw_first_seen_at,
  rtnw_last_seen_at,
  created_by
)
values
  (
    '73000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '焱｜Chocobi',
    82,
    'High Priest',
    'Pathfinder I',
    'F',
    'Elite',
    50000,
    700,
    2000,
    12000,
    '[Online]',
    'rtnw_export',
    '2026-10-01T12:00:00Z',
    '2026-10-01T12:00:00Z',
    '70000000-0000-0000-0000-000000000001'
  ),
  (
    '74000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000001',
    '焱｜Chocobi',
    82,
    'High Priest',
    'Pathfinder I',
    'F',
    'Elite',
    50000,
    700,
    2000,
    12000,
    '[Online]',
    'rtnw_export',
    '2026-10-01T12:00:00Z',
    '2026-10-01T12:00:00Z',
    '70000000-0000-0000-0000-000000000004'
  );

select is(
  (
    select ign
    from public.characters
    where id = '73000000-0000-0000-0000-000000000001'
  ),
  '焱｜Chocobi'::text,
  'Unicode and symbol-heavy IGNs are preserved exactly'
);

select is(
  (
    select class_name || '|' || gear_score::text || '|' || weekly_contribution::text
    from public.characters
    where id = '73000000-0000-0000-0000-000000000001'
  ),
  'High Priest|50000|2000'::text,
  'RTNW-exported roster fields are stored without organizer metadata mixing'
);

select is(
  (
    select count(*)
    from public.characters
    where ign = '焱｜Chocobi'
  ),
  2::bigint,
  'the same exact IGN may exist in different Guilds'
);

insert into public.characters (
  id,
  guild_id,
  ign,
  source_origin
)
values
  (
    '73000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001',
    'CaseName',
    'manual'
  ),
  (
    '73000000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000001',
    'casename',
    'manual'
  );

select is(
  (
    select count(*)
    from public.characters
    where guild_id = '71000000-0000-0000-0000-000000000001'
      and ign in ('CaseName', 'casename')
  ),
  2::bigint,
  'v1 exact IGN matching remains case-sensitive'
);

select throws_ok(
  $sql$
    insert into public.characters (
      guild_id,
      ign,
      source_origin
    )
    values (
      '71000000-0000-0000-0000-000000000001',
      '焱｜Chocobi',
      'manual'
    )
  $sql$,
  '23505',
  null,
  'an exact duplicate IGN cannot be inserted into the same Guild'
);

select throws_ok(
  $sql$
    insert into public.characters (
      guild_id,
      ign,
      gear_score
    )
    values (
      '71000000-0000-0000-0000-000000000001',
      'NegativeGR',
      -1
    )
  $sql$,
  '23514',
  null,
  'negative Gear Score is rejected'
);

select throws_ok(
  $sql$
    insert into public.characters (
      guild_id,
      ign,
      source_origin
    )
    values (
      '71000000-0000-0000-0000-000000000001',
      'MissingSeenTime',
      'rtnw_export'
    )
  $sql$,
  '23514',
  null,
  'an RTNW-origin character requires RTNW seen timestamps'
);

select throws_ok(
  $sql$
    insert into public.characters (
      guild_id,
      ign,
      status,
      inactive_reason,
      left_guild_at
    )
    values (
      '71000000-0000-0000-0000-000000000001',
      'InvalidActiveState',
      'active',
      'left_guild',
      now()
    )
  $sql$,
  '23514',
  null,
  'an active character cannot simultaneously be marked as having left the Guild'
);

select throws_ok(
  $sql$
    insert into public.characters (
      guild_id,
      ign,
      status,
      inactive_reason
    )
    values (
      '71000000-0000-0000-0000-000000000001',
      'InvalidLeftState',
      'inactive',
      'left_guild'
    )
  $sql$,
  '23514',
  null,
  'left_guild lifecycle requires a departure timestamp'
);

-- ---------------------------------------------------------------------------
-- Organizer-maintained metadata separation
-- ---------------------------------------------------------------------------

insert into public.character_roster_profiles (
  guild_id,
  character_id,
  designation,
  role_label,
  created_by
)
values (
  '71000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  'main',
  'Healer',
  '70000000-0000-0000-0000-000000000001'
);

select is(
  (
    select designation || '|' || role_label
    from public.character_roster_profiles
    where guild_id = '71000000-0000-0000-0000-000000000001'
      and character_id = '73000000-0000-0000-0000-000000000001'
  ),
  'main|Healer'::text,
  'organizer-maintained designation and role metadata are stored separately'
);

select throws_ok(
  $sql$
    insert into public.character_roster_profiles (
      guild_id,
      character_id,
      designation
    )
    values (
      '71000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000001',
      'sub'
    )
  $sql$,
  '23503',
  null,
  'roster metadata cannot attach a character from another Guild'
);

select throws_ok(
  $sql$
    update public.characters
    set guild_id = '72000000-0000-0000-0000-000000000001'
    where id = '73000000-0000-0000-0000-000000000001'
  $sql$,
  'P0001',
  null,
  'a character cannot be moved to another Guild'
);

-- ---------------------------------------------------------------------------
-- RLS and capability checks
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';

select results_eq(
  'select count(*) from public.characters',
  array[3::bigint],
  'Owner can read only the Master Roster for their own Guild'
);

select results_eq(
  'select count(*) from public.character_roster_profiles',
  array[1::bigint],
  'Owner can read organizer roster metadata for their own Guild'
);

set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000003';

select results_eq(
  'select count(*) from public.characters',
  array[0::bigint],
  'Member cannot directly read Master Roster management data'
);

set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000002';

select results_eq(
  'select count(*) from public.characters',
  array[0::bigint],
  'Officer without roster.manage cannot directly read the Master Roster'
);

reset role;

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values (
  '71000000-0000-0000-0000-000000000001',
  '71100000-0000-0000-0000-000000000002',
  'roster.manage',
  '70000000-0000-0000-0000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000002';

select results_eq(
  'select count(*) from public.characters',
  array[3::bigint],
  'Officer with roster.manage can read their Guild Master Roster'
);

select throws_ok(
  $sql$
    insert into public.characters (
      guild_id,
      ign
    )
    values (
      '71000000-0000-0000-0000-000000000001',
      'DirectWriteDenied'
    )
  $sql$,
  '42501',
  null,
  'authenticated application roles cannot directly write characters'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select count(*) from public.characters
  $sql$,
  '42501',
  null,
  'anonymous users cannot read Master Roster data'
);

reset role;

select * from finish();

rollback;
