begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select ok(
  to_regclass('public.guild_invites') is not null,
  'guild_invites table exists'
);

select ok(
  to_regclass('public.guild_invite_acceptances') is not null,
  'guild_invite_acceptances table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.guild_invites'::regclass),
  'guild_invites has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.guild_invite_acceptances'::regclass),
  'guild_invite_acceptances has RLS enabled'
);

insert into auth.users (id, email)
values
  ('40000000-0000-0000-0000-000000000001', 'invite-owner-a@test.local'),
  ('40000000-0000-0000-0000-000000000002', 'invite-member-a@test.local'),
  ('40000000-0000-0000-0000-000000000003', 'invite-owner-b@test.local'),
  ('40000000-0000-0000-0000-000000000004', 'invite-member-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    '41000000-0000-0000-0000-000000000001',
    'Invite Guild A',
    '40000000-0000-0000-0000-000000000001'
  ),
  (
    '42000000-0000-0000-0000-000000000001',
    'Invite Guild B',
    '40000000-0000-0000-0000-000000000003'
  );

insert into public.guild_memberships (id, guild_id, user_id, role, status)
values
  (
    '41100000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'owner',
    'active'
  ),
  (
    '41100000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    'member',
    'active'
  ),
  (
    '42100000-0000-0000-0000-000000000001',
    '42000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000003',
    'owner',
    'active'
  ),
  (
    '42100000-0000-0000-0000-000000000002',
    '42000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000004',
    'member',
    'active'
  );

select lives_ok(
  $sql$
    insert into public.guild_invites (
      id, guild_id, invite_kind, role, token_digest, expires_at, created_by
    )
    values (
      '43000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('a', 64),
      now() + interval '30 days',
      '40000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'a reusable Member join link is valid'
);

select lives_ok(
  $sql$
    insert into public.guild_invites (
      id, guild_id, invite_kind, role, token_digest, max_uses, expires_at, created_by
    )
    values (
      '43000000-0000-0000-0000-000000000002',
      '41000000-0000-0000-0000-000000000001',
      'elevated',
      'officer',
      repeat('b', 64),
      1,
      now() + interval '1 day',
      '40000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'a single-use Officer invite is valid'
);

select lives_ok(
  $sql$
    insert into public.guild_invites (
      id, guild_id, invite_kind, role, token_digest, max_uses, expires_at, created_by
    )
    values (
      '43000000-0000-0000-0000-000000000003',
      '41000000-0000-0000-0000-000000000001',
      'elevated',
      'admin',
      repeat('c', 64),
      1,
      now() + interval '1 day',
      '40000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'a single-use Admin invite is valid'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'officer',
      repeat('d', 64),
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'join links cannot assign Officer'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, max_uses, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'elevated',
      'member',
      repeat('e', 64),
      1,
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'elevated invites cannot assign Member'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, max_uses, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'elevated',
      'owner',
      repeat('f', 64),
      1,
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'invites can never assign Owner'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, max_uses, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'elevated',
      'officer',
      repeat('1', 64),
      2,
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'elevated invites must be single-use'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, max_uses, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('2', 64),
      5,
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'reusable join links do not carry a finite max_uses'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('g', 64),
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'token digests must be lowercase SHA-256 hex'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, generation, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('3', 64),
      0,
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'invite generation must be positive'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, expires_at, created_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('4', 64),
      now() - interval '1 minute',
      now()
    )
  $sql$,
  '23514',
  null,
  'invite expiration must be later than creation'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, max_uses, use_count,
      last_used_at, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'elevated',
      'officer',
      repeat('5', 64),
      1,
      2,
      now(),
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'invite use_count cannot exceed max_uses'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, use_count, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('6', 64),
      1,
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'used invites must record last_used_at'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, status, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('7', 64),
      'revoked',
      now() + interval '1 day'
    )
  $sql$,
  '23514',
  null,
  'revoked invites must record revoked_at'
);

select lives_ok(
  $sql$
    insert into public.guild_invites (
      id, guild_id, invite_kind, role, token_digest, status, revoked_at,
      expires_at, created_by
    )
    values (
      '43000000-0000-0000-0000-000000000004',
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('8', 64),
      'revoked',
      now(),
      now() + interval '1 day',
      '40000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'a revoked invite with revoked_at is valid'
);

select lives_ok(
  $sql$
    insert into public.guild_invite_acceptances (
      guild_id,
      invite_id,
      invite_generation,
      user_id,
      membership_id,
      accepted_role
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      '43000000-0000-0000-0000-000000000001',
      1,
      '40000000-0000-0000-0000-000000000002',
      '41100000-0000-0000-0000-000000000002',
      'member'
    )
  $sql$,
  'a matching acceptance snapshot is valid'
);

select throws_ok(
  $sql$
    insert into public.guild_invite_acceptances (
      guild_id, invite_id, invite_generation, user_id, membership_id, accepted_role
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      '43000000-0000-0000-0000-000000000002',
      1,
      '40000000-0000-0000-0000-000000000002',
      '41100000-0000-0000-0000-000000000002',
      'member'
    )
  $sql$,
  '23514',
  null,
  'acceptance role must match the invite role'
);

select throws_ok(
  $sql$
    insert into public.guild_invite_acceptances (
      guild_id, invite_id, invite_generation, user_id, membership_id, accepted_role
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      '43000000-0000-0000-0000-000000000001',
      1,
      '40000000-0000-0000-0000-000000000004',
      '42100000-0000-0000-0000-000000000002',
      'member'
    )
  $sql$,
  '23514',
  null,
  'acceptance membership cannot come from another guild'
);

select throws_ok(
  $sql$
    insert into public.guild_invite_acceptances (
      guild_id, invite_id, invite_generation, user_id, membership_id, accepted_role
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      '43000000-0000-0000-0000-000000000001',
      1,
      '40000000-0000-0000-0000-000000000001',
      '41100000-0000-0000-0000-000000000002',
      'member'
    )
  $sql$,
  '23514',
  null,
  'acceptance membership must belong to the accepting user'
);

select throws_ok(
  $sql$
    insert into public.guild_invite_acceptances (
      guild_id, invite_id, invite_generation, user_id, membership_id, accepted_role
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      '43000000-0000-0000-0000-000000000001',
      2,
      '40000000-0000-0000-0000-000000000002',
      '41100000-0000-0000-0000-000000000002',
      'member'
    )
  $sql$,
  '23514',
  null,
  'acceptance generation must match the current invite generation'
);

set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$ select count(*) from public.guild_invites $sql$,
  '42501',
  null,
  'authenticated users cannot read invite rows directly'
);

select throws_ok(
  $sql$
    insert into public.guild_invites (
      guild_id, invite_kind, role, token_digest, expires_at
    )
    values (
      '41000000-0000-0000-0000-000000000001',
      'join_link',
      'member',
      repeat('9', 64),
      now() + interval '1 day'
    )
  $sql$,
  '42501',
  null,
  'authenticated users cannot create invite rows directly'
);

reset role;
set local role anon;

select throws_ok(
  $sql$ select count(*) from public.guild_invites $sql$,
  '42501',
  null,
  'anonymous users cannot read invite rows directly'
);

select throws_ok(
  $sql$ select count(*) from public.guild_invite_acceptances $sql$,
  '42501',
  null,
  'anonymous users cannot read acceptance history directly'
);

reset role;

select * from finish();

rollback;
