begin;

create extension if not exists pgtap with schema extensions;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('50000000-0000-0000-0000-000000000001', 'rpc-owner-a@test.local'),
  ('50000000-0000-0000-0000-000000000002', 'rpc-admin-a@test.local'),
  ('50000000-0000-0000-0000-000000000003', 'rpc-officer-manager@test.local'),
  ('50000000-0000-0000-0000-000000000004', 'rpc-officer-basic@test.local'),
  ('50000000-0000-0000-0000-000000000005', 'rpc-member-a@test.local'),
  ('50000000-0000-0000-0000-000000000006', 'rpc-owner-b@test.local'),
  ('50000000-0000-0000-0000-000000000007', 'rpc-new-1@test.local'),
  ('50000000-0000-0000-0000-000000000008', 'rpc-new-2@test.local'),
  ('50000000-0000-0000-0000-000000000009', 'rpc-new-3@test.local'),
  ('50000000-0000-0000-0000-000000000010', 'rpc-new-4@test.local'),
  ('50000000-0000-0000-0000-000000000011', 'rpc-inactive@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    '51000000-0000-0000-0000-000000000001',
    'RPC Guild A',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    '52000000-0000-0000-0000-000000000001',
    'RPC Guild B',
    '50000000-0000-0000-0000-000000000006'
  );

insert into public.guild_memberships (id, guild_id, user_id, role, status)
values
  (
    '51100000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'owner',
    'active'
  ),
  (
    '51100000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    'admin',
    'active'
  ),
  (
    '51100000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000003',
    'officer',
    'active'
  ),
  (
    '51100000-0000-0000-0000-000000000004',
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000004',
    'officer',
    'active'
  ),
  (
    '51100000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000005',
    'member',
    'active'
  ),
  (
    '51100000-0000-0000-0000-000000000011',
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000011',
    'member',
    'inactive'
  ),
  (
    '52100000-0000-0000-0000-000000000001',
    '52000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000006',
    'owner',
    'active'
  );

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values (
  '51000000-0000-0000-0000-000000000001',
  '51100000-0000-0000-0000-000000000003',
  'members.manage',
  '50000000-0000-0000-0000-000000000001'
);

-- Fixed rows used by revoke/regenerate/accept tests.
insert into public.guild_invites (
  id, guild_id, invite_kind, role, token_digest, max_uses, expires_at, created_by
)
values
  (
    '53000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    'join_link', 'member', repeat('a', 64), null,
    now() + interval '10 days',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    '53000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000001',
    'elevated', 'officer', repeat('b', 64), 1,
    now() + interval '1 day',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    '53000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000001',
    'elevated', 'admin', repeat('c', 64), 1,
    now() + interval '1 day',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    '53000000-0000-0000-0000-000000000004',
    '52000000-0000-0000-0000-000000000001',
    'join_link', 'member', repeat('d', 64), null,
    now() + interval '10 days',
    '50000000-0000-0000-0000-000000000006'
  ),
  (
    '53000000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000001',
    'join_link', 'member', repeat('e', 64), null,
    now() + interval '10 days',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    '53000000-0000-0000-0000-000000000006',
    '51000000-0000-0000-0000-000000000001',
    'elevated', 'officer', repeat('f', 64), 1,
    now() + interval '1 day',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    '53000000-0000-0000-0000-000000000007',
    '51000000-0000-0000-0000-000000000001',
    'elevated', 'admin', repeat('1', 64), 1,
    now() + interval '1 day',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    '53000000-0000-0000-0000-000000000008',
    '51000000-0000-0000-0000-000000000001',
    'join_link', 'member', repeat('2', 64), null,
    now() + interval '10 days',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    '53000000-0000-0000-0000-000000000010',
    '51000000-0000-0000-0000-000000000001',
    'join_link', 'member', repeat('4', 64), null,
    now() + interval '10 days',
    '50000000-0000-0000-0000-000000000001'
  );

-- Expired fixture with a historical creation time.
insert into public.guild_invites (
  id, guild_id, invite_kind, role, token_digest, max_uses,
  created_at, expires_at, created_by
)
values (
  '53000000-0000-0000-0000-000000000009',
  '51000000-0000-0000-0000-000000000001',
  'join_link', 'member', repeat('3', 64), null,
  now() - interval '2 days',
  now() - interval '1 day',
  '50000000-0000-0000-0000-000000000001'
);

-- Revoke one fixture directly for unavailable-link checks.
update public.guild_invites
set status = 'revoked', revoked_at = now(),
    revoked_by = '50000000-0000-0000-0000-000000000001'
where id = '53000000-0000-0000-0000-000000000010';

-- ---------------------------------------------------------------------------
-- Plan
-- ---------------------------------------------------------------------------

select plan(51);

-- Function existence.
select ok(
  to_regprocedure('public.create_guild_invite(uuid,text,text,text,timestamp with time zone)') is not null,
  'create_guild_invite exists'
);

select ok(
  to_regprocedure('public.revoke_guild_invite(uuid)') is not null,
  'revoke_guild_invite exists'
);

select ok(
  to_regprocedure('public.regenerate_guild_invite(uuid,text,timestamp with time zone)') is not null,
  'regenerate_guild_invite exists'
);

select ok(
  to_regprocedure('public.resolve_guild_invite(text,integer)') is not null,
  'resolve_guild_invite exists'
);

select ok(
  to_regprocedure('public.accept_guild_invite(text,integer)') is not null,
  'accept_guild_invite exists'
);

-- ---------------------------------------------------------------------------
-- Create authorization
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('5', 64),
      now() + interval '1 day'
    )
  $sql$,
  '42501',
  null,
  'anonymous callers cannot create invites'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('6', 64),
      now() + interval '10 days'
    )
  $sql$,
  'Owner can create Member join links'
);

select lives_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'elevated',
      'officer',
      repeat('7', 64),
      now() + interval '1 day'
    )
  $sql$,
  'Owner can create Officer invites'
);

select lives_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'elevated',
      'admin',
      repeat('8', 64),
      now() + interval '1 day'
    )
  $sql$,
  'Owner can create Admin invites'
);

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '52000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('9', 64),
      now() + interval '1 day'
    )
  $sql$,
  '42501',
  null,
  'Owner cannot create an invite in another guild'
);

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'elevated',
      'owner',
      repeat('0', 64),
      now() + interval '1 day'
    )
  $sql$,
  '22023',
  null,
  'no invite can assign Owner'
);

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'officer',
      repeat('5', 63) || 'a',
      now() + interval '1 day'
    )
  $sql$,
  '22023',
  null,
  'join links cannot assign Officer'
);

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      'not-a-digest',
      now() + interval '1 day'
    )
  $sql$,
  '22023',
  null,
  'create rejects malformed token digests'
);

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('a', 63) || '5',
      now() - interval '1 minute'
    )
  $sql$,
  '22023',
  null,
  'create rejects non-future expiration'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('b', 63) || '5',
      now() + interval '1 day'
    )
  $sql$,
  'Admin can create Member join links'
);

select lives_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'elevated',
      'officer',
      repeat('c', 63) || '5',
      now() + interval '1 day'
    )
  $sql$,
  'Admin can create Officer invites'
);

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'elevated',
      'admin',
      repeat('d', 63) || '5',
      now() + interval '1 day'
    )
  $sql$,
  '42501',
  null,
  'Admin cannot create Admin invites'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000003';

select lives_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('e', 63) || '5',
      now() + interval '1 day'
    )
  $sql$,
  'Officer with members.manage can create Member join links'
);

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'elevated',
      'officer',
      repeat('f', 63) || '5',
      now() + interval '1 day'
    )
  $sql$,
  '42501',
  null,
  'Officer cannot create elevated invites'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000004';

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('1', 63) || '5',
      now() + interval '1 day'
    )
  $sql$,
  '42501',
  null,
  'Officer without members.manage cannot create Member invites'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000005';

select throws_ok(
  $sql$
    select public.create_guild_invite(
      '51000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('2', 63) || '5',
      now() + interval '1 day'
    )
  $sql$,
  '42501',
  null,
  'Member cannot create invites'
);

-- ---------------------------------------------------------------------------
-- Resolve
-- ---------------------------------------------------------------------------

reset role;
set local role anon;

select is(
  (
    select guild_name
    from public.resolve_guild_invite(repeat('a', 64), 1)
  ),
  'RPC Guild A',
  'anonymous callers can resolve an available invite'
);

select is(
  (
    select invite_role
    from public.resolve_guild_invite(repeat('b', 64), 1)
  ),
  'officer',
  'resolve exposes the intended role'
);

select is(
  (
    select count(*)
    from public.resolve_guild_invite(repeat('a', 64), 2)
  ),
  0::bigint,
  'stale generations do not resolve'
);

select is(
  (
    select count(*)
    from public.resolve_guild_invite(repeat('3', 64), 1)
  ),
  0::bigint,
  'expired invitations do not resolve'
);

select is(
  (
    select count(*)
    from public.resolve_guild_invite(repeat('4', 64), 1)
  ),
  0::bigint,
  'revoked invitations do not resolve'
);

select is(
  (
    select count(*)
    from public.resolve_guild_invite('not-a-digest', 1)
  ),
  0::bigint,
  'malformed digests resolve to no invite'
);

-- ---------------------------------------------------------------------------
-- Revoke
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.revoke_guild_invite(
      '53000000-0000-0000-0000-000000000002'
    )
  $sql$,
  'Admin can revoke an Officer invite'
);

select throws_ok(
  $sql$
    select public.revoke_guild_invite(
      '53000000-0000-0000-0000-000000000003'
    )
  $sql$,
  '42501',
  null,
  'Admin cannot revoke an Admin invite'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000003';

select lives_ok(
  $sql$
    select public.revoke_guild_invite(
      '53000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'Officer with members.manage can revoke a Member join link'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000005';

select throws_ok(
  $sql$
    select public.revoke_guild_invite(
      '53000000-0000-0000-0000-000000000005'
    )
  $sql$,
  '42501',
  null,
  'Member cannot revoke invites'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select public.revoke_guild_invite(
      '53000000-0000-0000-0000-000000000004'
    )
  $sql$,
  '42501',
  null,
  'Guild A Owner cannot revoke Guild B invites'
);

-- ---------------------------------------------------------------------------
-- Regenerate
-- ---------------------------------------------------------------------------

select is(
  public.regenerate_guild_invite(
    '53000000-0000-0000-0000-000000000001',
    repeat('6', 63) || 'a',
    now() + interval '10 days'
  ),
  2,
  'Owner can regenerate a revoked Member link and increment generation'
);

reset role;
set local role anon;

select is(
  (
    select count(*)
    from public.resolve_guild_invite(repeat('a', 64), 1)
  ),
  0::bigint,
  'old digest no longer resolves after regeneration'
);

select is(
  (
    select generation
    from public.resolve_guild_invite(repeat('6', 63) || 'a', 2)
  ),
  2,
  'new digest resolves only with the new generation'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000002';

select throws_ok(
  $sql$
    select public.regenerate_guild_invite(
      '53000000-0000-0000-0000-000000000003',
      repeat('7', 63) || 'a',
      now() + interval '1 day'
    )
  $sql$,
  '42501',
  null,
  'Admin cannot regenerate an Admin invite'
);

-- ---------------------------------------------------------------------------
-- Accept
-- ---------------------------------------------------------------------------

reset role;
set local role anon;

select throws_ok(
  $sql$
    select public.accept_guild_invite(repeat('e', 64), 1)
  $sql$,
  '42501',
  null,
  'anonymous callers cannot accept invitations'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000007';

select lives_ok(
  $sql$
    select public.accept_guild_invite(repeat('e', 64), 1)
  $sql$,
  'authenticated user can accept a Member join link'
);

reset role;

select is(
  (
    select role || ':' || status
    from public.guild_memberships
    where guild_id = '51000000-0000-0000-0000-000000000001'
      and user_id = '50000000-0000-0000-0000-000000000007'
  ),
  'member:active',
  'Member invite creates an active Member membership'
);

select is(
  (
    select count(*)
    from public.guild_invite_acceptances
    where invite_id = '53000000-0000-0000-0000-000000000005'
      and user_id = '50000000-0000-0000-0000-000000000007'
  ),
  1::bigint,
  'successful acceptance is recorded once'
);

select is(
  (
    select use_count
    from public.guild_invites
    where id = '53000000-0000-0000-0000-000000000005'
  ),
  1,
  'successful acceptance increments invite use_count'
);

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000007';

select throws_ok(
  $sql$
    select public.accept_guild_invite(repeat('e', 64), 1)
  $sql$,
  '23505',
  null,
  'an invite cannot upgrade or duplicate an existing membership'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000008';

select lives_ok(
  $sql$
    select public.accept_guild_invite(repeat('f', 64), 1)
  $sql$,
  'new user can accept a single-use Officer invite'
);

reset role;

select is(
  (
    select role
    from public.guild_memberships
    where guild_id = '51000000-0000-0000-0000-000000000001'
      and user_id = '50000000-0000-0000-0000-000000000008'
  ),
  'officer',
  'Officer invite creates an Officer membership'
);

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000009';

select throws_ok(
  $sql$
    select public.accept_guild_invite(repeat('f', 64), 1)
  $sql$,
  'P0002',
  null,
  'single-use elevated invite cannot be accepted twice'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000009';

select lives_ok(
  $sql$
    select public.accept_guild_invite(repeat('1', 64), 1)
  $sql$,
  'new user can accept an Owner-issued Admin invite'
);

reset role;

select is(
  (
    select role
    from public.guild_memberships
    where guild_id = '51000000-0000-0000-0000-000000000001'
      and user_id = '50000000-0000-0000-0000-000000000009'
  ),
  'admin',
  'Admin invite creates an Admin membership'
);

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000010';

select throws_ok(
  $sql$
    select public.accept_guild_invite(repeat('3', 64), 1)
  $sql$,
  'P0002',
  null,
  'expired invite cannot be accepted'
);

select throws_ok(
  $sql$
    select public.accept_guild_invite(repeat('4', 64), 1)
  $sql$,
  'P0002',
  null,
  'revoked invite cannot be accepted'
);

select throws_ok(
  $sql$
    select public.accept_guild_invite(repeat('6', 63) || 'a', 1)
  $sql$,
  'P0002',
  null,
  'stale invite generation cannot be accepted'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000011';

select throws_ok(
  $sql$
    select public.accept_guild_invite(repeat('2', 64), 1)
  $sql$,
  '23505',
  null,
  'an inactive existing membership cannot self-reactivate through an invite'
);

reset role;

select * from finish();

rollback;
