begin;

create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email)
values
  ('60000000-0000-0000-0000-000000000001', 'manage-owner-a@test.local'),
  ('60000000-0000-0000-0000-000000000002', 'manage-admin-a@test.local'),
  ('60000000-0000-0000-0000-000000000003', 'manage-officer-manager@test.local'),
  ('60000000-0000-0000-0000-000000000004', 'manage-officer-basic@test.local'),
  ('60000000-0000-0000-0000-000000000005', 'manage-member-a@test.local'),
  ('60000000-0000-0000-0000-000000000006', 'manage-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    '61000000-0000-0000-0000-000000000001',
    'Invite Management Guild A',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '62000000-0000-0000-0000-000000000001',
    'Invite Management Guild B',
    '60000000-0000-0000-0000-000000000006'
  );

insert into public.guild_memberships (id, guild_id, user_id, role, status)
values
  (
    '61100000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    'owner',
    'active'
  ),
  (
    '61100000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002',
    'admin',
    'active'
  ),
  (
    '61100000-0000-0000-0000-000000000003',
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000003',
    'officer',
    'active'
  ),
  (
    '61100000-0000-0000-0000-000000000004',
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000004',
    'officer',
    'active'
  ),
  (
    '61100000-0000-0000-0000-000000000005',
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000005',
    'member',
    'active'
  ),
  (
    '62100000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000006',
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
  '61000000-0000-0000-0000-000000000001',
  '61100000-0000-0000-0000-000000000003',
  'members.manage',
  '60000000-0000-0000-0000-000000000001'
);

insert into public.guild_invites (
  id, guild_id, invite_kind, role, token_digest, generation,
  status, max_uses, use_count, last_used_at,
  expires_at, created_by
)
values
  (
    '63000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    'join_link', 'member', repeat('a', 64), 4,
    'active', null, 2, now(),
    now() + interval '20 days',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '63000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000001',
    'elevated', 'officer', repeat('b', 64), 1,
    'active', 1, 0, null,
    now() + interval '1 day',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '63000000-0000-0000-0000-000000000003',
    '61000000-0000-0000-0000-000000000001',
    'elevated', 'admin', repeat('c', 64), 1,
    'active', 1, 0, null,
    now() + interval '1 day',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '63000000-0000-0000-0000-000000000004',
    '61000000-0000-0000-0000-000000000001',
    'join_link', 'member', repeat('d', 64), 1,
    'active', null, 0, null,
    now() + interval '20 days',
    '60000000-0000-0000-0000-000000000001'
  ),
  (
    '63000000-0000-0000-0000-000000000006',
    '62000000-0000-0000-0000-000000000001',
    'join_link', 'member', repeat('f', 64), 1,
    'active', null, 0, null,
    now() + interval '20 days',
    '60000000-0000-0000-0000-000000000006'
  );

update public.guild_invites
set status = 'revoked',
    revoked_at = now(),
    revoked_by = '60000000-0000-0000-0000-000000000001'
where id = '63000000-0000-0000-0000-000000000004';

insert into public.guild_invites (
  id, guild_id, invite_kind, role, token_digest, generation,
  status, max_uses, use_count, last_used_at,
  created_at, expires_at, created_by
)
values (
  '63000000-0000-0000-0000-000000000005',
  '61000000-0000-0000-0000-000000000001',
  'join_link', 'member', repeat('e', 64), 1,
  'active', null, 0, null,
  now() - interval '3 days',
  now() - interval '1 day',
  '60000000-0000-0000-0000-000000000001'
);

select plan(18);

select ok(
  to_regprocedure('public.list_manageable_guild_invites(uuid)') is not null,
  'list_manageable_guild_invites exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.list_manageable_guild_invites(uuid)',
    'EXECUTE'
  ),
  'authenticated callers may execute the management resolver'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.list_manageable_guild_invites(uuid)',
    'EXECUTE'
  ),
  'anonymous callers have no execute privilege'
);

set local role anon;

select throws_ok(
  $sql$
    select * from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
  $sql$,
  '42501',
  null,
  'anonymous callers cannot list managed invites'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000001';

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
  ),
  5::bigint,
  'Owner can list all Guild invite roles'
);

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
    where invite_role = 'admin'
  ),
  1::bigint,
  'Owner can see Admin invitations'
);

set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000002';

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
  ),
  4::bigint,
  'Admin can list Member and Officer invitations'
);

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
    where invite_role = 'admin'
  ),
  0::bigint,
  'Admin cannot see Admin invitations'
);

set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000003';

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
  ),
  3::bigint,
  'Officer with members.manage can list Member invitations'
);

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
    where invite_role <> 'member'
  ),
  0::bigint,
  'Officer with members.manage cannot see elevated invitations'
);

set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000004';

select throws_ok(
  $sql$
    select * from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
  $sql$,
  '42501',
  null,
  'Officer without members.manage cannot list invitations'
);

set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000005';

select throws_ok(
  $sql$
    select * from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
  $sql$,
  '42501',
  null,
  'Member cannot list invitations'
);

set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select * from public.list_manageable_guild_invites(
      '62000000-0000-0000-0000-000000000001'
    )
  $sql$,
  '42501',
  null,
  'Guild A Owner cannot list Guild B invitations'
);

set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000006';

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '62000000-0000-0000-0000-000000000001'
    )
  ),
  1::bigint,
  'Guild B Owner can list Guild B invitations'
);

set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000001';

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
    where status = 'revoked'
  ),
  1::bigint,
  'management listing retains revoked invitations'
);

select is(
  (
    select count(*)
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
    where status = 'active'
      and expires_at < now()
  ),
  1::bigint,
  'management listing retains expired invitations for regeneration'
);

select ok(
  position(
    'token_digest' in pg_get_function_result(
      'public.list_manageable_guild_invites(uuid)'::regprocedure
    )
  ) = 0,
  'management resolver never exposes token digests'
);

select is(
  (
    select generation
    from public.list_manageable_guild_invites(
      '61000000-0000-0000-0000-000000000001'
    )
    where invite_id = '63000000-0000-0000-0000-000000000001'
  ),
  4,
  'management resolver returns current invite generation metadata'
);

reset role;

select * from finish();

rollback;
