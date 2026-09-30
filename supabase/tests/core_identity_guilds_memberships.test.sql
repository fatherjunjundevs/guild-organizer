begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

-- ---------------------------------------------------------------------------
-- Schema checks
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('public.profiles') is not null,
  'profiles table exists'
);

select ok(
  to_regclass('public.guilds') is not null,
  'guilds table exists'
);

select ok(
  to_regclass('public.guild_memberships') is not null,
  'guild_memberships table exists'
);

select ok(
  to_regclass('public.capability_definitions') is not null,
  'capability_definitions table exists'
);

select ok(
  to_regclass('public.guild_officer_capabilities') is not null,
  'guild_officer_capabilities table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.guilds'::regclass),
  'guilds has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.guild_memberships'::regclass),
  'guild_memberships has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.capability_definitions'::regclass),
  'capability_definitions has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.guild_officer_capabilities'::regclass),
  'guild_officer_capabilities has RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.guild_officer_capabilities'::regclass
      and conname = 'guild_officer_capabilities_membership_fk'
      and contype = 'f'
  ),
  'officer capabilities use a composite guild/membership foreign key'
);

select ok(
  to_regclass('public.guild_memberships_one_active_owner_idx') is not null,
  'one-active-owner unique index exists'
);

-- ---------------------------------------------------------------------------
-- Test users
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'member-a@test.local'),
  ('00000000-0000-0000-0000-000000000003', 'officer-a@test.local'),
  ('00000000-0000-0000-0000-000000000004', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-000000000005', 'officer-b@test.local');

select is(
  (
    select count(*)
    from public.profiles
    where id in (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000005'
    )
  ),
  5::bigint,
  'auth user inserts automatically create application profiles'
);

-- ---------------------------------------------------------------------------
-- Test guilds and memberships
-- ---------------------------------------------------------------------------

insert into public.guilds (id, name, created_by)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Guild A',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    'Guild B',
    '00000000-0000-0000-0000-000000000004'
  );

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  (
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'member'
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    'officer'
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    'owner'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000005',
    'officer'
  );

select throws_ok(
  $sql$
    insert into public.guild_memberships (
      id,
      guild_id,
      user_id,
      role
    )
    values (
      '11000000-0000-0000-0000-000000000099',
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000004',
      'owner'
    )
  $sql$,
  '23505',
  null,
  'a guild cannot have a second active owner'
);

select throws_ok(
  $sql$
    do $block$
    begin
      update public.guild_memberships
      set status = 'inactive'
      where id = '11000000-0000-0000-0000-000000000001';

      perform private.assert_guild_has_one_active_owner(
        '10000000-0000-0000-0000-000000000001'::uuid
      );
    end
    $block$
  $sql$,
  'P0001',
  null,
  'the owner invariant rejects a guild with zero active owners'
);

-- ---------------------------------------------------------------------------
-- Capability checks
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    insert into public.guild_officer_capabilities (
      guild_id,
      membership_id,
      capability_key,
      granted_by
    )
    values (
      '10000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000002',
      'events.manage',
      '00000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'P0001',
  null,
  'capabilities cannot be granted to a Member'
);

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values (
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000003',
  'events.manage',
  '00000000-0000-0000-0000-000000000001'
);

select ok(
  exists (
    select 1
    from public.guild_officer_capabilities
    where guild_id = '10000000-0000-0000-0000-000000000001'
      and membership_id = '11000000-0000-0000-0000-000000000003'
      and capability_key = 'events.manage'
  ),
  'an active Officer can receive an explicit capability'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select ok(
  private.has_guild_capability(
    '10000000-0000-0000-0000-000000000001',
    'roster.manage'
  ),
  'Owner receives active management capabilities'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

select ok(
  private.has_guild_capability(
    '10000000-0000-0000-0000-000000000001',
    'events.manage'
  ),
  'Officer receives an explicitly granted capability'
);

select ok(
  not private.has_guild_capability(
    '10000000-0000-0000-0000-000000000001',
    'roster.manage'
  ),
  'Officer does not receive ungranted capabilities'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

select ok(
  not private.has_guild_capability(
    '10000000-0000-0000-0000-000000000001',
    'events.manage'
  ),
  'Member receives no management capability'
);

reset role;

select throws_ok(
  $sql$
    insert into public.guild_officer_capabilities (
      guild_id,
      membership_id,
      capability_key,
      granted_by
    )
    values (
      '10000000-0000-0000-0000-000000000001',
      '22000000-0000-0000-0000-000000000002',
      'events.manage',
      '00000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'P0001',
  null,
  'a capability cannot attach a membership from another guild'
);

update public.guild_memberships
set role = 'member'
where id = '11000000-0000-0000-0000-000000000003';

select is(
  (
    select count(*)
    from public.guild_officer_capabilities
    where membership_id = '11000000-0000-0000-0000-000000000003'
  ),
  0::bigint,
  'officer capability grants are removed when the membership stops being an active Officer'
);

-- ---------------------------------------------------------------------------
-- RLS checks
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select results_eq(
  'select count(*) from public.guilds',
  array[1::bigint],
  'a user can only read guilds where they have an active membership'
);

select results_eq(
  'select count(*) from public.guild_memberships',
  array[3::bigint],
  'a user can only read memberships from their own guild'
);

select results_eq(
  'select count(*) from public.profiles',
  array[3::bigint],
  'profiles are visible only for self and users sharing an active guild'
);

select results_eq(
  $sql$
    update public.profiles
    set display_name = 'Owner A Updated'
    where id = '00000000-0000-0000-0000-000000000001'
    returning display_name
  $sql$,
  array['Owner A Updated'::text],
  'a user can update their own public profile fields'
);

select results_eq(
  $sql$
    update public.profiles
    set display_name = 'Should Not Change'
    where id = '00000000-0000-0000-0000-000000000002'
    returning id
  $sql$,
  $sql$
    select id
    from public.profiles
    where false
  $sql$,
  'a user cannot update another profile'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select count(*) from public.guilds
  $sql$,
  '42501',
  null,
  'anonymous users cannot read guild data'
);

reset role;

select * from finish();

rollback;
