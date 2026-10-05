begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select has_function(
  'public',
  'update_event_template_party_layout',
  array['uuid', 'text', 'integer', 'integer', 'boolean'],
  'atomic Party layout RPC exists'
);

insert into auth.users (id, email)
values
  ('d0000000-0000-0000-0000-000000000001', 'party-layout-owner@test.local'),
  ('d0000000-0000-0000-0000-000000000002', 'party-layout-template-officer@test.local'),
  ('d0000000-0000-0000-0000-000000000003', 'party-layout-events-officer@test.local'),
  ('d0000000-0000-0000-0000-000000000004', 'party-layout-member@test.local');

insert into public.guilds (id, name, created_by)
values (
  'd1000000-0000-0000-0000-000000000001',
  'Party Layout Guild',
  'd0000000-0000-0000-0000-000000000001'
);

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  ('d1100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'owner'),
  ('d1100000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'officer'),
  ('d1100000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'officer'),
  ('d1100000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'member');

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
)
values
  ('d1000000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000002', 'templates.manage', 'd0000000-0000-0000-0000-000000000001'),
  ('d1000000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000003', 'events.manage', 'd0000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';

select set_config(
  'test.party_layout_type_id',
  public.create_event_type(
    'd1000000-0000-0000-0000-000000000001',
    'Party Layout',
    null
  )::text,
  true
);

select set_config(
  'test.party_layout_template_id',
  public.create_event_template(
    'd1000000-0000-0000-0000-000000000001',
    current_setting('test.party_layout_type_id')::uuid,
    'Resizable Party Template',
    null,
    false
  )::text,
  true
);

select set_config(
  'test.party_layout_team_id',
  public.create_event_template_team(
    current_setting('test.party_layout_template_id')::uuid,
    'SUN',
    null,
    1,
    5
  )::text,
  true
);

select set_config(
  'test.party_layout_party_id',
  (
    select id::text
    from public.event_template_parties
    where section_id = current_setting('test.party_layout_team_id')::uuid
    order by sort_order
    limit 1
  ),
  true
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where party_id = current_setting('test.party_layout_party_id')::uuid
  ),
  5::bigint,
  'fixture Party starts with 5 seats'
);

select set_config(
  'test.party_layout_first_slot_id',
  (
    select id::text
    from public.event_template_slots
    where party_id = current_setting('test.party_layout_party_id')::uuid
    order by sort_order, id
    limit 1
  ),
  true
);

select lives_ok(
  $$
    select public.update_event_template_slot(
      (
        select id
        from public.event_template_slots
        where party_id = current_setting('test.party_layout_party_id')::uuid
        order by sort_order, id
        offset 4
        limit 1
      ),
      current_setting('test.party_layout_party_id')::uuid,
      'Seat 5',
      'Healer',
      4
    )
  $$,
  'owner can assign a role to a trailing seat before resize'
);

select throws_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      3,
      false
    )
  $$,
  '23514',
  null,
  'seat reduction refuses to silently remove a role requirement'
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where party_id = current_setting('test.party_layout_party_id')::uuid
  ),
  5::bigint,
  'failed reduction leaves all seats intact'
);

select lives_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      3,
      true
    )
  $$,
  'confirmed reduction can shrink 5 seats to 3 atomically'
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where party_id = current_setting('test.party_layout_party_id')::uuid
  ),
  3::bigint,
  'confirmed reduction removes exactly two trailing seats'
);

select ok(
  exists (
    select 1
    from public.event_template_slots
    where id = current_setting('test.party_layout_first_slot_id')::uuid
      and party_id = current_setting('test.party_layout_party_id')::uuid
  ),
  'retained leading seat keeps its original UUID'
);

select lives_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      7,
      false
    )
  $$,
  'Party can grow from 3 seats to 7'
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where party_id = current_setting('test.party_layout_party_id')::uuid
  ),
  7::bigint,
  'growth appends the requested number of seats'
);

select results_eq(
  $$
    select name
    from public.event_template_slots
    where party_id = current_setting('test.party_layout_party_id')::uuid
    order by sort_order, id
  $$,
  array[
    'Seat 1'::text,
    'Seat 2'::text,
    'Seat 3'::text,
    'Seat 4'::text,
    'Seat 5'::text,
    'Seat 6'::text,
    'Seat 7'::text
  ],
  'grown Party keeps deterministic internal seat names'
);

select throws_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      0,
      false
    )
  $$,
  '22023',
  null,
  'Party resize rejects zero seats'
);

select throws_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      9,
      false
    )
  $$,
  '22023',
  null,
  'Party resize rejects more than 8 seats'
);

select lives_ok(
  $$
    select public.activate_event_template(
      current_setting('test.party_layout_template_id')::uuid
    )
  $$,
  'complete resized Template can activate'
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.party_layout_template_id')::uuid
  ),
  'active'::text,
  'Template is active before another Party resize'
);

select lives_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      6,
      false
    )
  $$,
  'structural Party resize is allowed on an active Template'
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.party_layout_template_id')::uuid
  ),
  'draft'::text,
  'Party resize returns an active Template to Draft'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';

select throws_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      5,
      false
    )
  $$,
  '42501',
  null,
  'events.manage alone cannot resize reusable Template Parties'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';

select lives_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      5,
      false
    )
  $$,
  'templates.manage Officer can resize a Party'
);

select is(
  (
    select updated_by
    from public.event_templates
    where id = current_setting('test.party_layout_template_id')::uuid
  ),
  'd0000000-0000-0000-0000-000000000002'::uuid,
  'Party resize records organizer audit identity'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000004';

select throws_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      4,
      false
    )
  $$,
  '42501',
  null,
  'ordinary Member cannot resize a Template Party'
);

reset role;
set local role anon;

select throws_ok(
  $$
    select public.update_event_template_party_layout(
      current_setting('test.party_layout_party_id')::uuid,
      'Party 1',
      0,
      4,
      false
    )
  $$,
  '42501',
  null,
  'anonymous role cannot resize a Template Party'
);

reset role;

select * from finish();
rollback;
