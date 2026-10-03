begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select ok(
  to_regprocedure(
    'public.bulk_update_roster_characters(uuid[],text,text)'
  ) is not null,
  'bulk roster management RPC exists'
);

insert into auth.users (id, email)
values
  ('93000000-0000-0000-0000-000000000001', 'bulk-owner-a@test.local'),
  ('93000000-0000-0000-0000-000000000002', 'bulk-member-a@test.local'),
  ('93000000-0000-0000-0000-000000000003', 'bulk-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    '94000000-0000-0000-0000-000000000001',
    'Bulk Guild A',
    '93000000-0000-0000-0000-000000000001'
  ),
  (
    '95000000-0000-0000-0000-000000000001',
    'Bulk Guild B',
    '93000000-0000-0000-0000-000000000003'
  );

insert into public.guild_memberships (
  id,
  guild_id,
  user_id,
  role
)
values
  (
    '94100000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '94100000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000002',
    'member'
  ),
  (
    '95100000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000003',
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
    '96000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    'BulkOne',
    'rtnw_export',
    now(),
    now(),
    '93000000-0000-0000-0000-000000000001'
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000001',
    'BulkTwo',
    'manual',
    null,
    null,
    '93000000-0000-0000-0000-000000000001'
  ),
  (
    '97000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    'OtherGuildBulk',
    'manual',
    null,
    null,
    '93000000-0000-0000-0000-000000000003'
  );

insert into public.character_roster_profiles (
  guild_id,
  character_id,
  designation,
  role_label,
  created_by
)
values
  (
    '94000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000001',
    'sub',
    'Tank',
    '93000000-0000-0000-0000-000000000001'
  ),
  (
    '94000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000002',
    'sub',
    'Support',
    '93000000-0000-0000-0000-000000000001'
  );

set local role authenticated;
set local request.jwt.claim.sub =
  '93000000-0000-0000-0000-000000000001';

select is(
  public.bulk_update_roster_characters(
    array[
      '96000000-0000-0000-0000-000000000001'::uuid,
      '96000000-0000-0000-0000-000000000002'::uuid
    ],
    'designation',
    'main'
  ),
  2,
  'Owner can bulk-set designation'
);

select is(
  (
    select string_agg(
      designation || '|' || role_label,
      ',' order by character_id
    )
    from public.character_roster_profiles
    where guild_id = '94000000-0000-0000-0000-000000000001'
  ),
  'main|Tank,main|Support'::text,
  'bulk designation preserves organizer roles'
);

select is(
  public.bulk_update_roster_characters(
    array[
      '96000000-0000-0000-0000-000000000001'::uuid,
      '96000000-0000-0000-0000-000000000002'::uuid
    ],
    'role_label',
    'Healer'
  ),
  2,
  'Owner can bulk-set organizer role'
);

select is(
  (
    select string_agg(
      designation || '|' || role_label,
      ',' order by character_id
    )
    from public.character_roster_profiles
    where guild_id = '94000000-0000-0000-0000-000000000001'
  ),
  'main|Healer,main|Healer'::text,
  'bulk role update preserves designation'
);

select is(
  public.bulk_update_roster_characters(
    array[
      '96000000-0000-0000-0000-000000000001'::uuid,
      '96000000-0000-0000-0000-000000000002'::uuid
    ],
    'status',
    'inactive'
  ),
  2,
  'Owner can bulk-set manual inactive status'
);

select is(
  (
    select string_agg(
      status || '|' || inactive_reason,
      ',' order by id
    )
    from public.characters
    where guild_id = '94000000-0000-0000-0000-000000000001'
  ),
  'inactive|manual,inactive|manual'::text,
  'bulk inactive state never impersonates left_guild'
);

select throws_ok(
  $sql$
    select public.bulk_update_roster_characters(
      array[
        '96000000-0000-0000-0000-000000000001'::uuid,
        '97000000-0000-0000-0000-000000000001'::uuid
      ],
      'status',
      'active'
    )
  $sql$,
  '42501',
  null,
  'mixed-Guild bulk selection is rejected'
);

select is(
  (
    select status
    from public.characters
    where id = '96000000-0000-0000-0000-000000000001'
  ),
  'inactive'::text,
  'rejected mixed-Guild update is atomic'
);

set local request.jwt.claim.sub =
  '93000000-0000-0000-0000-000000000002';

select throws_ok(
  $sql$
    select public.bulk_update_roster_characters(
      array[
        '96000000-0000-0000-0000-000000000001'::uuid
      ],
      'designation',
      'sub'
    )
  $sql$,
  '42501',
  null,
  'Member cannot execute bulk roster changes'
);

reset role;

select * from finish();

rollback;
