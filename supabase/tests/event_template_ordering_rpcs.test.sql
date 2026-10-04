begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_function(
  'public',
  'reorder_event_template_teams',
  array['uuid', 'uuid', 'uuid[]'],
  'reorder Teams RPC exists'
);

select has_function(
  'public',
  'reorder_event_template_parties',
  array['uuid', 'uuid[]'],
  'reorder Parties RPC exists'
);

insert into auth.users (id, email)
values
  ('d0000000-0000-0000-0000-000000000001', 'ordering-owner@test.local'),
  ('d0000000-0000-0000-0000-000000000002', 'ordering-template-officer@test.local'),
  ('d0000000-0000-0000-0000-000000000003', 'ordering-events-officer@test.local'),
  ('d0000000-0000-0000-0000-000000000004', 'ordering-member@test.local');

insert into public.guilds (id, name, created_by)
values (
  'd1000000-0000-0000-0000-000000000001',
  'Ordering Guild',
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
  'test.ordering_type_id',
  public.create_event_type(
    'd1000000-0000-0000-0000-000000000001',
    'Ordering Type',
    null
  )::text,
  true
);

select set_config(
  'test.ordering_template_id',
  public.create_event_template(
    'd1000000-0000-0000-0000-000000000001',
    current_setting('test.ordering_type_id')::uuid,
    'Ordering Template',
    null,
    false
  )::text,
  true
);

select set_config(
  'test.team_a_id',
  public.create_event_template_team(
    current_setting('test.ordering_template_id')::uuid,
    'ALPHA',
    null,
    2,
    5
  )::text,
  true
);

select set_config(
  'test.team_b_id',
  public.create_event_template_team(
    current_setting('test.ordering_template_id')::uuid,
    'BRAVO',
    null,
    2,
    5
  )::text,
  true
);

select set_config(
  'test.team_c_id',
  public.create_event_template_team(
    current_setting('test.ordering_template_id')::uuid,
    'CHARLIE',
    null,
    1,
    5
  )::text,
  true
);

select lives_ok(
  $sql$
    select public.reorder_event_template_teams(
      current_setting('test.ordering_template_id')::uuid,
      null,
      array[
        current_setting('test.team_c_id')::uuid,
        current_setting('test.team_a_id')::uuid,
        current_setting('test.team_b_id')::uuid
      ]
    )
  $sql$,
  'Owner can atomically reorder root Teams'
);

select results_eq(
  $sql$
    select name
    from public.event_template_sections
    where template_id = current_setting('test.ordering_template_id')::uuid
    order by sort_order, id
  $sql$,
  array['CHARLIE'::text, 'ALPHA'::text, 'BRAVO'::text],
  'Team order is normalized to submitted order'
);

select results_eq(
  $sql$
    select sort_order
    from public.event_template_sections
    where template_id = current_setting('test.ordering_template_id')::uuid
    order by sort_order, id
  $sql$,
  array[0, 1, 2],
  'Team sort order is normalized to zero-based positions'
);

select set_config(
  'test.alpha_party_1',
  (
    select id::text
    from public.event_template_parties
    where section_id = current_setting('test.team_a_id')::uuid
    order by sort_order
    limit 1
  ),
  true
);

select set_config(
  'test.alpha_party_2',
  (
    select id::text
    from public.event_template_parties
    where section_id = current_setting('test.team_a_id')::uuid
    order by sort_order desc
    limit 1
  ),
  true
);

select lives_ok(
  $sql$
    select public.reorder_event_template_parties(
      current_setting('test.team_a_id')::uuid,
      array[
        current_setting('test.alpha_party_2')::uuid,
        current_setting('test.alpha_party_1')::uuid
      ]
    )
  $sql$,
  'Owner can atomically reorder Parties inside a Team'
);

select results_eq(
  $sql$
    select id
    from public.event_template_parties
    where section_id = current_setting('test.team_a_id')::uuid
    order by sort_order, id
  $sql$,
  array[
    current_setting('test.alpha_party_2')::uuid,
    current_setting('test.alpha_party_1')::uuid
  ],
  'Party order matches submitted order'
);

select results_eq(
  $sql$
    select sort_order
    from public.event_template_parties
    where section_id = current_setting('test.team_a_id')::uuid
    order by sort_order, id
  $sql$,
  array[0, 1],
  'Party sort order is normalized to zero-based positions'
);

select throws_ok(
  $sql$
    select public.reorder_event_template_teams(
      current_setting('test.ordering_template_id')::uuid,
      null,
      array[
        current_setting('test.team_a_id')::uuid,
        current_setting('test.team_a_id')::uuid,
        current_setting('test.team_b_id')::uuid
      ]
    )
  $sql$,
  '22023',
  null,
  'duplicate Team ids are rejected'
);

select throws_ok(
  $sql$
    select public.reorder_event_template_teams(
      current_setting('test.ordering_template_id')::uuid,
      null,
      array[
        current_setting('test.team_a_id')::uuid,
        current_setting('test.team_b_id')::uuid
      ]
    )
  $sql$,
  '22023',
  null,
  'partial Team sibling sets are rejected'
);

select throws_ok(
  $sql$
    select public.reorder_event_template_parties(
      current_setting('test.team_a_id')::uuid,
      array[current_setting('test.alpha_party_1')::uuid]
    )
  $sql$,
  '22023',
  null,
  'partial Party sibling sets are rejected'
);

select set_config(
  'test.bravo_party_id',
  (
    select id::text
    from public.event_template_parties
    where section_id = current_setting('test.team_b_id')::uuid
    order by sort_order
    limit 1
  ),
  true
);

select throws_ok(
  $sql$
    select public.reorder_event_template_parties(
      current_setting('test.team_a_id')::uuid,
      array[
        current_setting('test.alpha_party_1')::uuid,
        current_setting('test.bravo_party_id')::uuid
      ]
    )
  $sql$,
  '22023',
  null,
  'Party reorder cannot pull a Party from another Team'
);

select lives_ok(
  $sql$
    select public.activate_event_template(
      current_setting('test.ordering_template_id')::uuid
    )
  $sql$,
  'complete Template activates before reorder invalidation test'
);

select lives_ok(
  $sql$
    select public.reorder_event_template_teams(
      current_setting('test.ordering_template_id')::uuid,
      null,
      array[
        current_setting('test.team_b_id')::uuid,
        current_setting('test.team_a_id')::uuid,
        current_setting('test.team_c_id')::uuid
      ]
    )
  $sql$,
  'active Template can be structurally reordered'
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.ordering_template_id')::uuid
  ),
  'draft'::text,
  'reordering returns an active Template to Draft'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';

select throws_ok(
  $sql$
    select public.reorder_event_template_teams(
      current_setting('test.ordering_template_id')::uuid,
      null,
      array[
        current_setting('test.team_b_id')::uuid,
        current_setting('test.team_a_id')::uuid,
        current_setting('test.team_c_id')::uuid
      ]
    )
  $sql$,
  '42501',
  null,
  'events.manage alone cannot reorder reusable Teams'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000004';

select throws_ok(
  $sql$
    select public.reorder_event_template_parties(
      current_setting('test.team_a_id')::uuid,
      array[
        current_setting('test.alpha_party_2')::uuid,
        current_setting('test.alpha_party_1')::uuid
      ]
    )
  $sql$,
  '42501',
  null,
  'ordinary Member cannot reorder reusable Parties'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.reorder_event_template_parties(
      current_setting('test.team_a_id')::uuid,
      array[
        current_setting('test.alpha_party_1')::uuid,
        current_setting('test.alpha_party_2')::uuid
      ]
    )
  $sql$,
  'templates.manage Officer can reorder Parties'
);

select is(
  (
    select updated_by
    from public.event_templates
    where id = current_setting('test.ordering_template_id')::uuid
  ),
  'd0000000-0000-0000-0000-000000000002'::uuid,
  'reorder records organizer audit identity'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select public.reorder_event_template_teams(
      current_setting('test.ordering_template_id')::uuid,
      null,
      array[
        current_setting('test.team_b_id')::uuid,
        current_setting('test.team_a_id')::uuid,
        current_setting('test.team_c_id')::uuid
      ]
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute Team reorder RPC'
);

select throws_ok(
  $sql$
    select public.reorder_event_template_parties(
      current_setting('test.team_a_id')::uuid,
      array[
        current_setting('test.alpha_party_1')::uuid,
        current_setting('test.alpha_party_2')::uuid
      ]
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute Party reorder RPC'
);

reset role;

select * from finish();
rollback;
