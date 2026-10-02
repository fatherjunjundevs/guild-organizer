begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select ok(
  to_regprocedure('public.create_roster_tag(uuid,text)') is not null,
  'create roster tag RPC exists'
);

select ok(
  to_regprocedure('public.rename_roster_tag(uuid,text)') is not null,
  'rename roster tag RPC exists'
);

select ok(
  to_regprocedure('public.delete_roster_tag(uuid)') is not null,
  'delete roster tag RPC exists'
);

select ok(
  to_regprocedure('public.set_character_roster_tags(uuid,uuid[])') is not null,
  'set character roster tags RPC exists'
);

insert into auth.users (id, email)
values
  ('a3000000-0000-4000-8000-000000000001', 'tags-owner-a@test.local'),
  ('a3000000-0000-4000-8000-000000000002', 'tags-member-a@test.local'),
  ('a3000000-0000-4000-8000-000000000003', 'tags-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    'a4000000-0000-4000-8000-000000000001',
    'Tags Guild A',
    'a3000000-0000-4000-8000-000000000001'
  ),
  (
    'a5000000-0000-4000-8000-000000000001',
    'Tags Guild B',
    'a3000000-0000-4000-8000-000000000003'
  );

insert into public.guild_memberships (
  id,
  guild_id,
  user_id,
  role
)
values
  (
    'a4100000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    'a4100000-0000-4000-8000-000000000002',
    'a4000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002',
    'member'
  ),
  (
    'a5100000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000003',
    'owner'
  );

insert into public.characters (
  id,
  guild_id,
  ign,
  source_origin,
  rtnw_first_seen_at,
  rtnw_last_seen_at,
  created_by
)
values
  (
    'a6000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    'TaggedRTNW',
    'rtnw_export',
    now(),
    now(),
    'a3000000-0000-4000-8000-000000000001'
  ),
  (
    'a7000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001',
    'OtherGuildTagged',
    'manual',
    null,
    null,
    'a3000000-0000-4000-8000-000000000003'
  );

set local role authenticated;
set local request.jwt.claim.sub =
  'a3000000-0000-4000-8000-000000000001';

select lives_ok(
  $sql$
    select public.create_roster_tag(
      'a4000000-0000-4000-8000-000000000001',
      'Raid'
    )
  $sql$,
  'Owner can create a roster tag'
);

select is(
  (
    select count(*)
    from public.roster_tags
    where guild_id = 'a4000000-0000-4000-8000-000000000001'
      and name = 'Raid'
  ),
  1::bigint,
  'created roster tag is stored'
);

select throws_ok(
  $sql$
    select public.create_roster_tag(
      'a4000000-0000-4000-8000-000000000001',
      'raid'
    )
  $sql$,
  '23505',
  null,
  'tag names are case-insensitively unique inside a Guild'
);

select lives_ok(
  $sql$
    select public.create_roster_tag(
      'a4000000-0000-4000-8000-000000000001',
      'Support'
    )
  $sql$,
  'Owner can create a second roster tag'
);

select lives_ok(
  $sql$
    select public.rename_roster_tag(
      (
        select id
        from public.roster_tags
        where guild_id = 'a4000000-0000-4000-8000-000000000001'
          and name = 'Support'
      ),
      'Healer'
    )
  $sql$,
  'Owner can rename a roster tag'
);

select is(
  (
    select count(*)
    from public.roster_tags
    where guild_id = 'a4000000-0000-4000-8000-000000000001'
      and name = 'Healer'
  ),
  1::bigint,
  'renamed tag persists'
);

select is(
  public.set_character_roster_tags(
    'a6000000-0000-4000-8000-000000000001',
    array[
      (
        select id
        from public.roster_tags
        where guild_id = 'a4000000-0000-4000-8000-000000000001'
          and name = 'Raid'
      ),
      (
        select id
        from public.roster_tags
        where guild_id = 'a4000000-0000-4000-8000-000000000001'
          and name = 'Healer'
      )
    ]
  ),
  2,
  'Owner can assign multiple organizer tags'
);

select is(
  (
    select count(*)
    from public.character_roster_tags
    where character_id = 'a6000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'two character tag assignments are stored'
);

select is(
  (
    select source_origin
    from public.characters
    where id = 'a6000000-0000-4000-8000-000000000001'
  ),
  'rtnw_export'::text,
  'tagging never changes RTNW source provenance'
);

select is(
  public.set_character_roster_tags(
    'a6000000-0000-4000-8000-000000000001',
    array[
      (
        select id
        from public.roster_tags
        where guild_id = 'a4000000-0000-4000-8000-000000000001'
          and name = 'Raid'
      )
    ]
  ),
  1,
  'tag update replaces the prior tag set'
);

select is(
  (
    select t.name
    from public.character_roster_tags crt
    join public.roster_tags t
      on t.guild_id = crt.guild_id
     and t.id = crt.tag_id
    where crt.character_id = 'a6000000-0000-4000-8000-000000000001'
  ),
  'Raid'::text,
  'replacement leaves only the requested tag'
);

set local request.jwt.claim.sub =
  'a3000000-0000-4000-8000-000000000003';

select lives_ok(
  $sql$
    select public.create_roster_tag(
      'a5000000-0000-4000-8000-000000000001',
      'OtherGuildTag'
    )
  $sql$,
  'Other Guild owner can create its own tag'
);

reset role;

insert into public.roster_tags (
  id,
  guild_id,
  name,
  created_by
)
values (
  'a8000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  'OtherGuildFixture',
  'a3000000-0000-4000-8000-000000000003'
);

set local role authenticated;
set local request.jwt.claim.sub =
  'a3000000-0000-4000-8000-000000000001';

select throws_ok(
  $sql$
    select public.set_character_roster_tags(
      'a6000000-0000-4000-8000-000000000001',
      array[
        'a8000000-0000-4000-8000-000000000001'::uuid
      ]
    )
  $sql$,
  '42501',
  null,
  'cross-Guild tag assignment is rejected'
);

set local request.jwt.claim.sub =
  'a3000000-0000-4000-8000-000000000002';

select throws_ok(
  $sql$
    select public.create_roster_tag(
      'a4000000-0000-4000-8000-000000000001',
      'MemberDenied'
    )
  $sql$,
  '42501',
  null,
  'Member cannot create roster tags'
);

set local request.jwt.claim.sub =
  'a3000000-0000-4000-8000-000000000001';

select lives_ok(
  $sql$
    select public.delete_roster_tag(
      (
        select id
        from public.roster_tags
        where guild_id = 'a4000000-0000-4000-8000-000000000001'
          and name = 'Raid'
      )
    )
  $sql$,
  'Owner can delete a roster tag'
);

select is(
  (
    select count(*)
    from public.character_roster_tags
    where character_id = 'a6000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'deleting a tag cascades its character assignments'
);

reset role;

select * from finish();

rollback;
