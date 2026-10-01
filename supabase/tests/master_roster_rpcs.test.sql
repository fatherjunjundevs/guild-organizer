begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

-- ---------------------------------------------------------------------------
-- Function surface
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure(
    'private.require_roster_manage(uuid)'
  ) is not null,
  'private roster authorization helper exists'
);

select ok(
  to_regprocedure(
    'public.create_roster_character(uuid,text,integer,text,text,text,text,bigint,bigint,bigint,bigint,text,text,text)'
  ) is not null,
  'manual character creation RPC exists'
);

select ok(
  to_regprocedure(
    'public.update_roster_character(uuid,text,integer,text,text,text,text,bigint,bigint,bigint,bigint,text)'
  ) is not null,
  'character update RPC exists'
);

select ok(
  to_regprocedure(
    'public.set_character_manual_status(uuid,text)'
  ) is not null,
  'manual lifecycle RPC exists'
);

select ok(
  to_regprocedure(
    'public.set_character_roster_profile(uuid,text,text)'
  ) is not null,
  'organizer roster-profile RPC exists'
);

-- ---------------------------------------------------------------------------
-- Test identities and Guilds
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('80000000-0000-0000-0000-000000000001', 'rpc-owner-a@test.local'),
  ('80000000-0000-0000-0000-000000000002', 'rpc-admin-a@test.local'),
  ('80000000-0000-0000-0000-000000000003', 'rpc-officer-a@test.local'),
  ('80000000-0000-0000-0000-000000000004', 'rpc-member-a@test.local'),
  ('80000000-0000-0000-0000-000000000005', 'rpc-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    '81000000-0000-0000-0000-000000000001',
    'RPC Guild A',
    '80000000-0000-0000-0000-000000000001'
  ),
  (
    '82000000-0000-0000-0000-000000000001',
    'RPC Guild B',
    '80000000-0000-0000-0000-000000000005'
  );

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  (
    '81100000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '81100000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000002',
    'admin'
  ),
  (
    '81100000-0000-0000-0000-000000000003',
    '81000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000003',
    'officer'
  ),
  (
    '81100000-0000-0000-0000-000000000004',
    '81000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000004',
    'member'
  ),
  (
    '82200000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000005',
    'owner'
  );

insert into public.characters (
  id,
  guild_id,
  ign,
  source_origin,
  created_by
)
values
  (
    '83000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    'OtherGuildCharacter',
    'manual',
    '80000000-0000-0000-0000-000000000005'
  );

-- ---------------------------------------------------------------------------
-- Owner / Admin behavior
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.create_roster_character(
      '81000000-0000-0000-0000-000000000001',
      '焱｜ManualPriest',
      80,
      'High Priest',
      'Pathfinder I',
      'F',
      'Elite',
      51000,
      700,
      2200,
      15000,
      '[Online]',
      'main',
      'Healer'
    )
  $sql$,
  'Owner can create a manual roster character'
);

select is(
  (
    select count(*)
    from public.characters
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and ign = '焱｜ManualPriest'
  ),
  1::bigint,
  'created character is stored in the target Guild'
);

select is(
  (
    select source_origin
    from public.characters
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and ign = '焱｜ManualPriest'
  ),
  'manual'::text,
  'manual creation records manual source provenance'
);

select is(
  (
    select designation || '|' || role_label
    from public.character_roster_profiles
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and character_id = (
        select id
        from public.characters
        where guild_id = '81000000-0000-0000-0000-000000000001'
          and ign = '焱｜ManualPriest'
      )
  ),
  'main|Healer'::text,
  'manual create can atomically add organizer roster metadata'
);

select throws_ok(
  $sql$
    select public.create_roster_character(
      '81000000-0000-0000-0000-000000000001',
      '  BadWhitespace  '
    )
  $sql$,
  '22023',
  null,
  'manual create rejects surrounding IGN whitespace'
);

select throws_ok(
  $sql$
    select public.create_roster_character(
      '81000000-0000-0000-0000-000000000001',
      '焱｜ManualPriest'
    )
  $sql$,
  '23505',
  null,
  'manual create cannot duplicate an exact IGN in the same Guild'
);

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.create_roster_character(
      '81000000-0000-0000-0000-000000000001',
      'AdminCreated',
      75,
      'Assassin Cross'
    )
  $sql$,
  'Admin receives roster.manage and can create roster characters'
);

select lives_ok(
  $sql$
    select public.update_roster_character(
      (
        select id
        from public.characters
        where guild_id = '81000000-0000-0000-0000-000000000001'
          and ign = 'AdminCreated'
      ),
      'AdminUpdated',
      76,
      'Assassin Cross',
      null,
      null,
      'Member',
      54000,
      710,
      2300,
      16000,
      '[Offline]'
    )
  $sql$,
  'Admin can update a Guild roster character'
);

select is(
  (
    select ign || '|' || level::text || '|' || gear_score::text
    from public.characters
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and ign = 'AdminUpdated'
  ),
  'AdminUpdated|76|54000'::text,
  'character update persists current roster fields'
);

select is(
  (
    select source_origin
    from public.characters
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and ign = 'AdminUpdated'
  ),
  'manual'::text,
  'manual update does not rewrite character source provenance'
);

-- ---------------------------------------------------------------------------
-- Member / Officer capability enforcement
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000004';

select throws_ok(
  $sql$
    select public.create_roster_character(
      '81000000-0000-0000-0000-000000000001',
      'MemberDenied'
    )
  $sql$,
  '42501',
  null,
  'Member cannot create roster characters'
);

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000003';

select throws_ok(
  $sql$
    select public.create_roster_character(
      '81000000-0000-0000-0000-000000000001',
      'OfficerDenied'
    )
  $sql$,
  '42501',
  null,
  'Officer without roster.manage cannot create roster characters'
);

reset role;

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values (
  '81000000-0000-0000-0000-000000000001',
  '81100000-0000-0000-0000-000000000003',
  'roster.manage',
  '80000000-0000-0000-0000-000000000001'
);

set local role authenticated;
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000003';

select lives_ok(
  $sql$
    select public.create_roster_character(
      '81000000-0000-0000-0000-000000000001',
      'OfficerAllowed',
      78,
      'Lord Knight'
    )
  $sql$,
  'Officer with roster.manage can create roster characters'
);

select is(
  (
    select count(*)
    from public.characters
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and ign = 'OfficerAllowed'
  ),
  1::bigint,
  'Officer-created character is stored only in the authorized Guild'
);

-- ---------------------------------------------------------------------------
-- Cross-Guild authorization
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select public.update_roster_character(
      '83000000-0000-0000-0000-000000000001',
      'CrossGuildDenied',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    )
  $sql$,
  '42501',
  null,
  'Owner cannot update a character belonging to another Guild'
);

reset role;

select is(
  (
    select ign
    from public.characters
    where id = '83000000-0000-0000-0000-000000000001'
  ),
  'OtherGuildCharacter'::text,
  'cross-Guild denial leaves the other Guild character unchanged'
);

set local role authenticated;
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Manual lifecycle
-- ---------------------------------------------------------------------------

select lives_ok(
  $sql$
    select public.set_character_manual_status(
      (
        select id
        from public.characters
        where guild_id = '81000000-0000-0000-0000-000000000001'
          and ign = '焱｜ManualPriest'
      ),
      'inactive'
    )
  $sql$,
  'roster manager can manually deactivate a character'
);

select is(
  (
    select status || '|' || inactive_reason
    from public.characters
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and ign = '焱｜ManualPriest'
  ),
  'inactive|manual'::text,
  'manual deactivation uses the manual inactive reason'
);

select is(
  (
    select left_guild_at
    from public.characters
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and ign = '焱｜ManualPriest'
  ),
  null::timestamptz,
  'manual deactivation does not impersonate RTNW left_guild state'
);

select lives_ok(
  $sql$
    select public.set_character_manual_status(
      (
        select id
        from public.characters
        where guild_id = '81000000-0000-0000-0000-000000000001'
          and ign = '焱｜ManualPriest'
      ),
      'active'
    )
  $sql$,
  'roster manager can reactivate a manually inactive character'
);

select is(
  (
    select status
    from public.characters
    where guild_id = '81000000-0000-0000-0000-000000000001'
      and ign = '焱｜ManualPriest'
  ),
  'active'::text,
  'manual reactivation restores active lifecycle state'
);

select throws_ok(
  $sql$
    select public.set_character_manual_status(
      (
        select id
        from public.characters
        where guild_id = '81000000-0000-0000-0000-000000000001'
          and ign = '焱｜ManualPriest'
      ),
      'left_guild'
    )
  $sql$,
  '22023',
  null,
  'manual status RPC cannot assign RTNW-reserved left_guild state'
);

-- ---------------------------------------------------------------------------
-- Organizer-maintained metadata
-- ---------------------------------------------------------------------------

select lives_ok(
  $sql$
    select public.set_character_roster_profile(
      (
        select id
        from public.characters
        where guild_id = '81000000-0000-0000-0000-000000000001'
          and ign = '焱｜ManualPriest'
      ),
      'sub',
      'Support'
    )
  $sql$,
  'roster manager can update organizer-maintained metadata'
);

select is(
  (
    select designation || '|' || role_label
    from public.character_roster_profiles
    where character_id = (
      select id
      from public.characters
      where guild_id = '81000000-0000-0000-0000-000000000001'
        and ign = '焱｜ManualPriest'
    )
  ),
  'sub|Support'::text,
  'organizer profile update persists independently from game fields'
);

select throws_ok(
  $sql$
    select public.set_character_roster_profile(
      (
        select id
        from public.characters
        where guild_id = '81000000-0000-0000-0000-000000000001'
          and ign = '焱｜ManualPriest'
      ),
      'primary',
      null
    )
  $sql$,
  '22023',
  null,
  'invalid main/sub designation is rejected'
);

select lives_ok(
  $sql$
    select public.set_character_roster_profile(
      (
        select id
        from public.characters
        where guild_id = '81000000-0000-0000-0000-000000000001'
          and ign = '焱｜ManualPriest'
      ),
      null,
      null
    )
  $sql$,
  'passing null organizer metadata clears the organizer profile'
);

select is(
  (
    select count(*)
    from public.character_roster_profiles
    where character_id = (
      select id
      from public.characters
      where guild_id = '81000000-0000-0000-0000-000000000001'
        and ign = '焱｜ManualPriest'
    )
  ),
  0::bigint,
  'cleared organizer profile row is removed'
);

-- ---------------------------------------------------------------------------
-- Direct-write / anonymous protections
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    update public.characters
    set ign = 'DirectWriteDenied'
    where guild_id = '81000000-0000-0000-0000-000000000001'
  $sql$,
  '42501',
  null,
  'authenticated application role cannot directly update characters'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select public.create_roster_character(
      '81000000-0000-0000-0000-000000000001',
      'AnonymousDenied'
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute roster mutation RPCs'
);

reset role;

select * from finish();

rollback;
