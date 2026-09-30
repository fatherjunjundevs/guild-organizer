begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- ---------------------------------------------------------------------------
-- Test identities
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('30000000-0000-0000-0000-000000000001', 'owner@test.local'),
  ('30000000-0000-0000-0000-000000000002', 'admin@test.local'),
  ('30000000-0000-0000-0000-000000000003', 'officer@test.local'),
  ('30000000-0000-0000-0000-000000000004', 'member@test.local'),
  ('30000000-0000-0000-0000-000000000005', 'member2@test.local'),
  ('30000000-0000-0000-0000-000000000006', 'owner-b@test.local'),
  ('30000000-0000-0000-0000-000000000007', 'officer-b@test.local');

-- Anonymous callers cannot create guilds.
set local role anon;

select throws_ok(
  $sql$
    select public.create_guild('Anonymous Guild')
  $sql$,
  '42501',
  null,
  'anonymous callers cannot create guilds'
);

reset role;

-- Owner creates Guild A through the RPC.
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.create_guild('Guild A')
  $sql$,
  'an authenticated user can create a guild'
);

reset role;

select is(
  (
    select count(*)
    from public.guilds
    where name = 'Guild A'
  ),
  1::bigint,
  'create_guild inserts exactly one guild'
);

select is(
  (
    select count(*)
    from public.guild_memberships m
    join public.guilds g on g.id = m.guild_id
    where g.name = 'Guild A'
      and m.user_id = '30000000-0000-0000-0000-000000000001'
      and m.role = 'owner'
      and m.status = 'active'
  ),
  1::bigint,
  'create_guild creates the caller as active Owner'
);

-- Create Guild B for cross-guild checks.
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000006';

select lives_ok(
  $sql$
    select public.create_guild('Guild B')
  $sql$,
  'a second authenticated user can create another guild'
);

reset role;

-- Add test memberships directly as postgres fixtures.
insert into public.guild_memberships (id, guild_id, user_id, role, status)
select
  '31000000-0000-0000-0000-000000000002',
  g.id,
  '30000000-0000-0000-0000-000000000002',
  'admin',
  'active'
from public.guilds g
where g.name = 'Guild A';

insert into public.guild_memberships (id, guild_id, user_id, role, status)
select
  '31000000-0000-0000-0000-000000000003',
  g.id,
  '30000000-0000-0000-0000-000000000003',
  'officer',
  'active'
from public.guilds g
where g.name = 'Guild A';

insert into public.guild_memberships (id, guild_id, user_id, role, status)
select
  '31000000-0000-0000-0000-000000000004',
  g.id,
  '30000000-0000-0000-0000-000000000004',
  'member',
  'active'
from public.guilds g
where g.name = 'Guild A';

insert into public.guild_memberships (id, guild_id, user_id, role, status)
select
  '31000000-0000-0000-0000-000000000005',
  g.id,
  '30000000-0000-0000-0000-000000000005',
  'member',
  'active'
from public.guilds g
where g.name = 'Guild A';

insert into public.guild_memberships (id, guild_id, user_id, role, status)
select
  '32000000-0000-0000-0000-000000000007',
  g.id,
  '30000000-0000-0000-0000-000000000007',
  'officer',
  'active'
from public.guilds g
where g.name = 'Guild B';

-- Direct table mutation remains unavailable to authenticated users.
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    insert into public.guilds (name, created_by)
    values (
      'Direct Write',
      '30000000-0000-0000-0000-000000000001'
    )
  $sql$,
  '42501',
  null,
  'authenticated users cannot insert guilds directly'
);

select throws_ok(
  $sql$
    update public.guild_memberships
    set role = 'admin'
    where id = '31000000-0000-0000-0000-000000000004'
  $sql$,
  '42501',
  null,
  'authenticated users cannot update memberships directly'
);

-- Owner may promote a non-Owner membership to Admin.
select lives_ok(
  $sql$
    select public.set_guild_membership_role(
      '31000000-0000-0000-0000-000000000005',
      'admin'
    )
  $sql$,
  'Owner can promote a non-Owner membership to Admin'
);

reset role;

select is(
  (
    select role
    from public.guild_memberships
    where id = '31000000-0000-0000-0000-000000000005'
  ),
  'admin',
  'Owner role change persisted'
);

-- Admin may manage Member/Officer roles but cannot assign Admin.
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.set_guild_membership_role(
      '31000000-0000-0000-0000-000000000004',
      'officer'
    )
  $sql$,
  'Admin can promote Member to Officer'
);

select throws_ok(
  $sql$
    select public.set_guild_membership_role(
      '31000000-0000-0000-0000-000000000004',
      'admin'
    )
  $sql$,
  '42501',
  null,
  'Admin cannot promote another membership to Admin'
);

select throws_ok(
  $sql$
    select public.set_guild_membership_role(
      '31000000-0000-0000-0000-000000000005',
      'member'
    )
  $sql$,
  '42501',
  null,
  'Admin cannot modify another Admin membership'
);

-- Restore member fixture using the Owner.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.set_guild_membership_role(
      '31000000-0000-0000-0000-000000000004',
      'member'
    )
  $sql$,
  'Owner can demote Officer back to Member'
);

-- Owner/Admin can grant Officer capabilities. Exercise the Admin path here.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.grant_officer_capability(
      '31000000-0000-0000-0000-000000000003',
      'members.manage'
    )
  $sql$,
  'Admin can grant an Officer capability'
);

reset role;

select is(
  (
    select count(*)
    from public.guild_officer_capabilities
    where membership_id = '31000000-0000-0000-0000-000000000003'
      and capability_key = 'members.manage'
  ),
  1::bigint,
  'Officer capability grant persisted'
);

-- Officer with members.manage may change ordinary Member status.
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';

select lives_ok(
  $sql$
    select public.set_guild_membership_status(
      '31000000-0000-0000-0000-000000000004',
      'inactive'
    )
  $sql$,
  'Officer with members.manage can deactivate a Member'
);

select throws_ok(
  $sql$
    select public.set_guild_membership_status(
      '31000000-0000-0000-0000-000000000002',
      'inactive'
    )
  $sql$,
  '42501',
  null,
  'Officer cannot deactivate an Admin'
);

select throws_ok(
  $sql$
    select public.set_guild_membership_role(
      '31000000-0000-0000-0000-000000000004',
      'officer'
    )
  $sql$,
  '42501',
  null,
  'Officer cannot change membership roles'
);

-- Reactivate the ordinary Member so the next check tests role authority,
-- not merely inactive-membership denial.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.set_guild_membership_status(
      '31000000-0000-0000-0000-000000000004',
      'active'
    )
  $sql$,
  'Owner can reactivate a Member after Officer management'
);

-- Member cannot grant capabilities.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000004';

select throws_ok(
  $sql$
    select public.grant_officer_capability(
      '31000000-0000-0000-0000-000000000003',
      'events.manage'
    )
  $sql$,
  '42501',
  null,
  'Member cannot grant Officer capabilities'
);

-- Cross-guild target is inaccessible to Guild A owner for grants.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select public.grant_officer_capability(
      '32000000-0000-0000-0000-000000000007',
      'events.manage'
    )
  $sql$,
  '42501',
  null,
  'a Guild A Owner cannot grant capabilities in Guild B'
);

-- Revoke works for Owner.
select lives_ok(
  $sql$
    select public.revoke_officer_capability(
      '31000000-0000-0000-0000-000000000003',
      'members.manage'
    )
  $sql$,
  'Owner can revoke an Officer capability'
);

reset role;

select is(
  (
    select count(*)
    from public.guild_officer_capabilities
    where membership_id = '31000000-0000-0000-0000-000000000003'
      and capability_key = 'members.manage'
  ),
  0::bigint,
  'Officer capability was revoked'
);

-- Current Owner cannot be deactivated through status RPC.
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select public.set_guild_membership_status(
      (
        select m.id
        from public.guild_memberships m
        join public.guilds g on g.id = m.guild_id
        where g.name = 'Guild A'
          and m.role = 'owner'
      ),
      'inactive'
    )
  $sql$,
  '42501',
  null,
  'current Owner cannot be deactivated'
);

-- Non-owner cannot transfer ownership.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';

select throws_ok(
  $sql$
    select public.transfer_guild_ownership(
      (select id from public.guilds where name = 'Guild A'),
      '31000000-0000-0000-0000-000000000003'
    )
  $sql$,
  '42501',
  null,
  'non-Owner cannot transfer ownership'
);

-- Reactivate member and transfer ownership to them.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.transfer_guild_ownership(
      (select id from public.guilds where name = 'Guild A'),
      '31000000-0000-0000-0000-000000000004'
    )
  $sql$,
  'current Owner can transfer ownership atomically'
);

reset role;

select is(
  (
    select role
    from public.guild_memberships
    where user_id = '30000000-0000-0000-0000-000000000001'
      and guild_id = (select id from public.guilds where name = 'Guild A')
  ),
  'admin',
  'previous Owner becomes Admin after ownership transfer'
);

select is(
  (
    select role
    from public.guild_memberships
    where id = '31000000-0000-0000-0000-000000000004'
  ),
  'owner',
  'new Owner receives the Owner role'
);

select is(
  (
    select count(*)
    from public.guild_memberships
    where guild_id = (select id from public.guilds where name = 'Guild A')
      and role = 'owner'
      and status = 'active'
  ),
  1::bigint,
  'ownership transfer preserves exactly one active Owner'
);

-- Previous Owner can no longer transfer ownership.
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select public.transfer_guild_ownership(
      (select id from public.guilds where name = 'Guild A'),
      '31000000-0000-0000-0000-000000000003'
    )
  $sql$,
  '42501',
  null,
  'previous Owner loses ownership-transfer authority immediately'
);

reset role;

select * from finish();

rollback;
