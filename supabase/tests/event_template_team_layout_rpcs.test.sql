begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_function(
  'public',
  'create_event_template_team',
  array['uuid', 'text', 'uuid', 'integer', 'integer'],
  'create Team layout RPC exists'
);

select has_function(
  'public',
  'create_event_template_party_with_slots',
  array['uuid', 'integer'],
  'create Party-with-Slots RPC exists'
);

insert into auth.users (id, email)
values
  ('c0000000-0000-0000-0000-000000000001', 'team-owner@test.local'),
  ('c0000000-0000-0000-0000-000000000002', 'team-template-officer@test.local'),
  ('c0000000-0000-0000-0000-000000000003', 'team-events-officer@test.local'),
  ('c0000000-0000-0000-0000-000000000004', 'team-member@test.local');

insert into public.guilds (id, name, created_by)
values (
  'c1000000-0000-0000-0000-000000000001',
  'Team Board Guild',
  'c0000000-0000-0000-0000-000000000001'
);

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  ('c1100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'owner'),
  ('c1100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'officer'),
  ('c1100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'officer'),
  ('c1100000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'member');

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values
  ('c1000000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000002', 'templates.manage', 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000003', 'events.manage', 'c0000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';

select set_config(
  'test.team_flat_type_id',
  public.create_event_type(
    'c1000000-0000-0000-0000-000000000001',
    'Team Board',
    null
  )::text,
  true
);

select set_config(
  'test.team_area_type_id',
  public.create_event_type(
    'c1000000-0000-0000-0000-000000000001',
    'Grouped Team Board',
    null
  )::text,
  true
);

select set_config(
  'test.team_flat_template_id',
  public.create_event_template(
    'c1000000-0000-0000-0000-000000000001',
    current_setting('test.team_flat_type_id')::uuid,
    'Flat Team Board',
    null,
    false
  )::text,
  true
);

select set_config(
  'test.team_area_template_id',
  public.create_event_template(
    'c1000000-0000-0000-0000-000000000001',
    current_setting('test.team_area_type_id')::uuid,
    'Grouped Team Board',
    null,
    true
  )::text,
  true
);

select lives_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_flat_template_id')::uuid,
      'SUN'
    )
  $sql$,
  'Owner can create the default 8-Party Team'
);

select set_config(
  'test.sun_team_id',
  (
    select id::text
    from public.event_template_sections
    where template_id = current_setting('test.team_flat_template_id')::uuid
      and name = 'SUN'
  ),
  true
);

select is(
  (
    select count(*)
    from public.event_template_parties
    where section_id = current_setting('test.sun_team_id')::uuid
  ),
  8::bigint,
  'default Team creates 8 Parties'
);

select is(
  (
    select count(*)
    from public.event_template_slots s
    join public.event_template_parties p
      on p.guild_id = s.guild_id
     and p.template_id = s.template_id
     and p.id = s.party_id
    where p.section_id = current_setting('test.sun_team_id')::uuid
  ),
  40::bigint,
  'default Team creates 5 Slot rows per Party'
);

select results_eq(
  $sql$
    select name
    from public.event_template_parties
    where section_id = current_setting('test.sun_team_id')::uuid
    order by sort_order
  $sql$,
  array[
    'Party 1'::text,
    'Party 2'::text,
    'Party 3'::text,
    'Party 4'::text,
    'Party 5'::text,
    'Party 6'::text,
    'Party 7'::text,
    'Party 8'::text
  ],
  'Team Parties receive deterministic display names'
);

select is(
  (
    select count(*)
    from public.event_template_slots s
    join public.event_template_parties p
      on p.guild_id = s.guild_id
     and p.template_id = s.template_id
     and p.id = s.party_id
    where p.section_id = current_setting('test.sun_team_id')::uuid
      and s.role_label is not null
  ),
  0::bigint,
  'auto-created Team seats start without role requirements'
);

select lives_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_flat_template_id')::uuid,
      'STAR',
      null,
      4,
      5
    )
  $sql$,
  'one Template can contain multiple Teams'
);

select is(
  (
    select count(*)
    from public.event_template_sections
    where template_id = current_setting('test.team_flat_template_id')::uuid
  ),
  2::bigint,
  'multiple Teams are stored as sibling Sections'
);

select set_config(
  'test.star_team_id',
  (
    select id::text
    from public.event_template_sections
    where template_id = current_setting('test.team_flat_template_id')::uuid
      and name = 'STAR'
  ),
  true
);

select lives_ok(
  $sql$
    select public.create_event_template_party_with_slots(
      current_setting('test.star_team_id')::uuid
    )
  $sql$,
  'Team with fewer than 8 Parties can add one 5-seat Party'
);

select is(
  (
    select count(*)
    from public.event_template_parties
    where section_id = current_setting('test.star_team_id')::uuid
  ),
  5::bigint,
  'adding one Party increases Team Party count by one'
);

select is(
  (
    select count(*)
    from public.event_template_slots s
    join public.event_template_parties p
      on p.guild_id = s.guild_id
     and p.template_id = s.template_id
     and p.id = s.party_id
    where p.section_id = current_setting('test.star_team_id')::uuid
  ),
  25::bigint,
  'added Party receives 5 Slot rows'
);

select throws_ok(
  $sql$
    select public.create_event_template_party_with_slots(
      current_setting('test.sun_team_id')::uuid
    )
  $sql$,
  '23514',
  null,
  'Team Board helper rejects a ninth Party'
);

select throws_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_flat_template_id')::uuid,
      'TOO MANY',
      null,
      9,
      5
    )
  $sql$,
  '22023',
  null,
  'Team creation rejects more than 8 Parties'
);

select throws_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_flat_template_id')::uuid,
      'BAD SEATS',
      null,
      1,
      0
    )
  $sql$,
  '22023',
  null,
  'Team creation rejects an invalid seat count'
);

select set_config(
  'test.team_area_id',
  public.create_event_template_area(
    current_setting('test.team_area_template_id')::uuid,
    'North',
    0
  )::text,
  true
);

select lives_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_area_template_id')::uuid,
      'MOON',
      current_setting('test.team_area_id')::uuid,
      2,
      5
    )
  $sql$,
  'Area-based Template can create a Team under an Area'
);

select throws_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_area_template_id')::uuid,
      'Missing Area'
    )
  $sql$,
  '23514',
  null,
  'Area-based Team creation requires an Area'
);

select throws_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_flat_template_id')::uuid,
      'Foreign Mode',
      current_setting('test.team_area_id')::uuid,
      1,
      5
    )
  $sql$,
  '23514',
  null,
  'flat Team creation rejects an Area parent'
);

select lives_ok(
  $sql$
    select public.activate_event_template(
      current_setting('test.team_flat_template_id')::uuid
    )
  $sql$,
  'complete Team Board Template can activate'
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.team_flat_template_id')::uuid
  ),
  'active'::text,
  'Template is active before structural edit'
);

select set_config(
  'test.star_party_id',
  (
    select id::text
    from public.event_template_parties
    where section_id = current_setting('test.star_team_id')::uuid
    order by sort_order
    limit 1
  ),
  true
);

select lives_ok(
  $sql$
    select public.delete_event_template_party(
      current_setting('test.star_party_id')::uuid
    )
  $sql$,
  'structural Team edit is allowed on active Template'
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.team_flat_template_id')::uuid
  ),
  'draft'::text,
  'structural Team edit returns active Template to draft'
);

set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000003';

select throws_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_flat_template_id')::uuid,
      'EVENTS ONLY',
      null,
      1,
      5
    )
  $sql$,
  '42501',
  null,
  'events.manage alone cannot create reusable Team structure'
);

set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000004';

select throws_ok(
  $sql$
    select public.create_event_template_party_with_slots(
      current_setting('test.star_team_id')::uuid
    )
  $sql$,
  '42501',
  null,
  'ordinary Member cannot add a Team Party'
);

set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.create_event_template_party_with_slots(
      current_setting('test.star_team_id')::uuid
    )
  $sql$,
  'templates.manage Officer can add a Team Party'
);

select is(
  (
    select updated_by
    from public.event_templates
    where id = current_setting('test.team_flat_template_id')::uuid
  ),
  'c0000000-0000-0000-0000-000000000002'::uuid,
  'Team helper records organizer audit identity'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select public.create_event_template_team(
      current_setting('test.team_flat_template_id')::uuid,
      'ANON',
      null,
      1,
      5
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute Team creation RPC'
);

select throws_ok(
  $sql$
    select public.create_event_template_party_with_slots(
      current_setting('test.star_team_id')::uuid
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute Party-with-Slots RPC'
);

reset role;

select * from finish();
rollback;
