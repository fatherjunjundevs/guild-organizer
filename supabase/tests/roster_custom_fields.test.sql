begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select ok(
  to_regprocedure('public.create_roster_custom_field(uuid,text,text,text[])') is not null,
  'create custom field RPC exists'
);

select ok(
  to_regprocedure('public.update_roster_custom_field(uuid,text,text[])') is not null,
  'update custom field RPC exists'
);

select ok(
  to_regprocedure('public.delete_roster_custom_field(uuid)') is not null,
  'delete custom field RPC exists'
);

select ok(
  to_regprocedure('public.set_character_roster_custom_fields(uuid,jsonb)') is not null,
  'set character custom fields RPC exists'
);

insert into auth.users (id, email)
values
  ('b3000000-0000-4000-8000-000000000001', 'fields-owner-a@test.local'),
  ('b3000000-0000-4000-8000-000000000002', 'fields-member-a@test.local'),
  ('b3000000-0000-4000-8000-000000000003', 'fields-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  (
    'b4000000-0000-4000-8000-000000000001',
    'Fields Guild A',
    'b3000000-0000-4000-8000-000000000001'
  ),
  (
    'b5000000-0000-4000-8000-000000000001',
    'Fields Guild B',
    'b3000000-0000-4000-8000-000000000003'
  );

insert into public.guild_memberships (
  id,
  guild_id,
  user_id,
  role
)
values
  (
    'b4100000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    'b4100000-0000-4000-8000-000000000002',
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000002',
    'member'
  ),
  (
    'b5100000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000003',
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
    'b6000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'CustomFieldRTNW',
    'rtnw_export',
    now(),
    now(),
    'b3000000-0000-4000-8000-000000000001'
  ),
  (
    'b7000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    'OtherGuildCharacter',
    'manual',
    null,
    null,
    'b3000000-0000-4000-8000-000000000003'
  );

set local role authenticated;
set local request.jwt.claim.sub =
  'b3000000-0000-4000-8000-000000000001';

select lives_ok(
  $test$
    select public.create_roster_custom_field(
      'b4000000-0000-4000-8000-000000000001',
      'Discord',
      'text',
      '{}'::text[]
    )
  $test$,
  'Owner can create a text custom field'
);

select is(
  (
    select field_type
    from public.roster_custom_fields
    where guild_id = 'b4000000-0000-4000-8000-000000000001'
      and name = 'Discord'
  ),
  'text'::text,
  'text custom field is stored'
);

select throws_ok(
  $test$
    select public.create_roster_custom_field(
      'b4000000-0000-4000-8000-000000000001',
      'discord',
      'text',
      '{}'::text[]
    )
  $test$,
  '23505',
  null,
  'custom field names are case-insensitively unique inside a Guild'
);

select lives_ok(
  $test$
    select public.create_roster_custom_field(
      'b4000000-0000-4000-8000-000000000001',
      'Priority',
      'number',
      '{}'::text[]
    )
  $test$,
  'Owner can create a number custom field'
);

select lives_ok(
  $test$
    select public.create_roster_custom_field(
      'b4000000-0000-4000-8000-000000000001',
      'Available',
      'boolean',
      '{}'::text[]
    )
  $test$,
  'Owner can create a yes/no custom field'
);

select lives_ok(
  $test$
    select public.create_roster_custom_field(
      'b4000000-0000-4000-8000-000000000001',
      'Schedule',
      'select',
      array['Weekdays', 'Weekends']
    )
  $test$,
  'Owner can create a select custom field'
);

select is(
  (
    select select_options
    from public.roster_custom_fields
    where guild_id = 'b4000000-0000-4000-8000-000000000001'
      and name = 'Schedule'
  ),
  array['Weekdays', 'Weekends']::text[],
  'select options preserve organizer-defined order'
);

select throws_ok(
  $test$
    select public.create_roster_custom_field(
      'b4000000-0000-4000-8000-000000000001',
      'Duplicate Options',
      'select',
      array['Raid', 'raid']
    )
  $test$,
  '22023',
  null,
  'select options must be case-insensitively unique'
);

select lives_ok(
  $test$
    select public.update_roster_custom_field(
      (
        select id
        from public.roster_custom_fields
        where guild_id = 'b4000000-0000-4000-8000-000000000001'
          and name = 'Discord'
      ),
      'Discord Name',
      '{}'::text[]
    )
  $test$,
  'Owner can rename a custom field'
);

select is(
  (
    select count(*)
    from public.roster_custom_fields
    where guild_id = 'b4000000-0000-4000-8000-000000000001'
      and name = 'Discord Name'
  ),
  1::bigint,
  'renamed custom field persists'
);

select lives_ok(
  $test$
    select public.update_roster_custom_field(
      (
        select id
        from public.roster_custom_fields
        where guild_id = 'b4000000-0000-4000-8000-000000000001'
          and name = 'Schedule'
      ),
      'Schedule',
      array['Weekdays', 'Weekends', 'Flexible']
    )
  $test$,
  'Owner can add a select option'
);

select is(
  public.set_character_roster_custom_fields(
    'b6000000-0000-4000-8000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'field_id',
        (
          select id::text
          from public.roster_custom_fields
          where guild_id = 'b4000000-0000-4000-8000-000000000001'
            and name = 'Discord Name'
        ),
        'value',
        'FatherJunJun#1'
      ),
      jsonb_build_object(
        'field_id',
        (
          select id::text
          from public.roster_custom_fields
          where guild_id = 'b4000000-0000-4000-8000-000000000001'
            and name = 'Priority'
        ),
        'value',
        7.5
      ),
      jsonb_build_object(
        'field_id',
        (
          select id::text
          from public.roster_custom_fields
          where guild_id = 'b4000000-0000-4000-8000-000000000001'
            and name = 'Available'
        ),
        'value',
        true
      ),
      jsonb_build_object(
        'field_id',
        (
          select id::text
          from public.roster_custom_fields
          where guild_id = 'b4000000-0000-4000-8000-000000000001'
            and name = 'Schedule'
        ),
        'value',
        'Weekdays'
      )
    )
  ),
  4,
  'Owner can transactionally save all supported custom field value types'
);

select is(
  (
    select count(*)
    from public.character_roster_custom_field_values
    where character_id = 'b6000000-0000-4000-8000-000000000001'
  ),
  4::bigint,
  'four custom field values are stored'
);

select is(
  (
    select source_origin
    from public.characters
    where id = 'b6000000-0000-4000-8000-000000000001'
  ),
  'rtnw_export'::text,
  'custom fields never change RTNW source provenance'
);

select is(
  (
    select value #>> '{}'
    from public.character_roster_custom_field_values v
    join public.roster_custom_fields f
      on f.guild_id = v.guild_id
     and f.id = v.field_id
    where v.character_id = 'b6000000-0000-4000-8000-000000000001'
      and f.name = 'Discord Name'
  ),
  'FatherJunJun#1'::text,
  'text custom field value is preserved'
);

select lives_ok(
  $test$
    select public.update_roster_custom_field(
      (
        select id
        from public.roster_custom_fields
        where guild_id = 'b4000000-0000-4000-8000-000000000001'
          and name = 'Discord Name'
      ),
      'Discord Handle',
      '{}'::text[]
    )
  $test$,
  'Owner can rename a populated custom field'
);

select is(
  (
    select value #>> '{}'
    from public.character_roster_custom_field_values v
    join public.roster_custom_fields f
      on f.guild_id = v.guild_id
     and f.id = v.field_id
    where v.character_id = 'b6000000-0000-4000-8000-000000000001'
      and f.name = 'Discord Handle'
  ),
  'FatherJunJun#1'::text,
  'renaming a populated custom field preserves its character value'
);

select is(
  public.set_character_roster_custom_fields(
    'b6000000-0000-4000-8000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'field_id',
        (
          select id::text
          from public.roster_custom_fields
          where guild_id = 'b4000000-0000-4000-8000-000000000001'
            and name = 'Schedule'
        ),
        'value',
        'Weekdays'
      )
    )
  ),
  1,
  'saving custom fields replaces the previous character field set'
);

select is(
  (
    select count(*)
    from public.character_roster_custom_field_values
    where character_id = 'b6000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'replacement leaves only the submitted custom field value'
);

select throws_ok(
  $test$
    select public.set_character_roster_custom_fields(
      'b6000000-0000-4000-8000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'field_id',
          (
            select id::text
            from public.roster_custom_fields
            where guild_id = 'b4000000-0000-4000-8000-000000000001'
              and name = 'Priority'
          ),
          'value',
          'not-a-number'
        )
      )
    )
  $test$,
  '22023',
  null,
  'number custom field rejects a string value'
);

select throws_ok(
  $test$
    select public.update_roster_custom_field(
      (
        select id
        from public.roster_custom_fields
        where guild_id = 'b4000000-0000-4000-8000-000000000001'
          and name = 'Schedule'
      ),
      'Schedule',
      array['Weekends', 'Flexible']
    )
  $test$,
  '23514',
  null,
  'an in-use select option cannot be removed'
);

set local request.jwt.claim.sub =
  'b3000000-0000-4000-8000-000000000003';

select lives_ok(
  $test$
    select public.create_roster_custom_field(
      'b5000000-0000-4000-8000-000000000001',
      'Other Guild Field',
      'text',
      '{}'::text[]
    )
  $test$,
  'Other Guild owner can create its own custom field'
);

set local request.jwt.claim.sub =
  'b3000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.roster_custom_fields
    where guild_id = 'b5000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'RLS hides another Guild custom field definitions'
);

reset role;

insert into public.roster_custom_fields (
  id,
  guild_id,
  name,
  field_type,
  select_options,
  created_by
)
values (
  'b8000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  'Other Guild Fixture',
  'text',
  '{}'::text[],
  'b3000000-0000-4000-8000-000000000003'
);

set local role authenticated;
set local request.jwt.claim.sub =
  'b3000000-0000-4000-8000-000000000001';

select throws_ok(
  $test$
    select public.set_character_roster_custom_fields(
      'b6000000-0000-4000-8000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'field_id',
          'b8000000-0000-4000-8000-000000000001',
          'value',
          'Forbidden'
        )
      )
    )
  $test$,
  '42501',
  null,
  'cross-Guild custom field assignment is rejected'
);

set local request.jwt.claim.sub =
  'b3000000-0000-4000-8000-000000000002';

select throws_ok(
  $test$
    select public.create_roster_custom_field(
      'b4000000-0000-4000-8000-000000000001',
      'Member Field',
      'text',
      '{}'::text[]
    )
  $test$,
  '42501',
  null,
  'Member cannot create custom fields'
);

select throws_ok(
  $test$
    select public.set_character_roster_custom_fields(
      'b6000000-0000-4000-8000-000000000001',
      '[]'::jsonb
    )
  $test$,
  '42501',
  null,
  'Member cannot edit character custom fields'
);

set local request.jwt.claim.sub =
  'b3000000-0000-4000-8000-000000000001';

select lives_ok(
  $test$
    do $body$
    declare
      i integer;
    begin
      for i in 1..16 loop
        perform public.create_roster_custom_field(
          'b4000000-0000-4000-8000-000000000001',
          'Filler ' || i,
          'text',
          '{}'::text[]
        );
      end loop;
    end;
    $body$
  $test$,
  'Owner can create fields up to the 20-field Guild limit'
);

select is(
  (
    select count(*)
    from public.roster_custom_fields
    where guild_id = 'b4000000-0000-4000-8000-000000000001'
  ),
  20::bigint,
  'Guild stores at most the configured field limit'
);

select throws_ok(
  $test$
    select public.create_roster_custom_field(
      'b4000000-0000-4000-8000-000000000001',
      'Too Many',
      'text',
      '{}'::text[]
    )
  $test$,
  '22023',
  null,
  '21st custom field is rejected'
);

select lives_ok(
  $test$
    select public.delete_roster_custom_field(
      (
        select id
        from public.roster_custom_fields
        where guild_id = 'b4000000-0000-4000-8000-000000000001'
          and name = 'Schedule'
      )
    )
  $test$,
  'Owner can delete a custom field'
);

select is(
  (
    select count(*)
    from public.character_roster_custom_field_values
    where character_id = 'b6000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'deleting a custom field cascades only its character values'
);

select is(
  (
    select count(*)
    from public.characters
    where id = 'b6000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'deleting a custom field never deletes the character'
);

reset role;

select * from finish();

rollback;
