begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_function(
  'public',
  'clone_event_template',
  array['uuid', 'uuid', 'text', 'text'],
  'clone_event_template RPC exists'
);

insert into auth.users (id, email)
values
  ('d0000000-0000-0000-0000-000000000001', 'clone-owner@test.local'),
  ('d0000000-0000-0000-0000-000000000002', 'clone-template-officer@test.local'),
  ('d0000000-0000-0000-0000-000000000003', 'clone-events-officer@test.local'),
  ('d0000000-0000-0000-0000-000000000004', 'clone-member@test.local'),
  ('d0000000-0000-0000-0000-000000000005', 'clone-other-owner@test.local');

insert into public.guilds (id, name, created_by)
values
  ('d1000000-0000-0000-0000-000000000001', 'Clone Guild', 'd0000000-0000-0000-0000-000000000001'),
  ('d1000000-0000-0000-0000-000000000002', 'Other Clone Guild', 'd0000000-0000-0000-0000-000000000005');

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  ('d1100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'owner'),
  ('d1100000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'officer'),
  ('d1100000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'officer'),
  ('d1100000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'member'),
  ('d1100000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'owner');

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values
  ('d1000000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000002', 'templates.manage', 'd0000000-0000-0000-0000-000000000001'),
  ('d1000000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000003', 'events.manage', 'd0000000-0000-0000-0000-000000000001');

insert into public.event_types (
  id, guild_id, name, status, created_by, updated_by
)
values
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Guild League', 'active', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001'),
  ('d2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'Siege', 'active', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001'),
  ('d2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'Archived Type', 'archived', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001'),
  ('d2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'Other Guild Type', 'active', 'd0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005');

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';

select set_config(
  'test.clone_flat_source',
  public.create_event_template(
    'd1000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'League Source',
    'Original reusable structure',
    false
  )::text,
  true
);

select set_config(
  'test.clone_flat_team',
  public.create_event_template_team(
    current_setting('test.clone_flat_source')::uuid,
    'MAIN TEAM',
    null,
    2,
    5
  )::text,
  true
);

select public.update_event_template_slot(
  (
    select sl.id
    from public.event_template_slots sl
    join public.event_template_parties p on p.id = sl.party_id
    where sl.template_id = current_setting('test.clone_flat_source')::uuid
      and p.section_id = current_setting('test.clone_flat_team')::uuid
    order by p.sort_order, sl.sort_order
    limit 1
  ),
  (
    select sl.party_id
    from public.event_template_slots sl
    join public.event_template_parties p on p.id = sl.party_id
    where sl.template_id = current_setting('test.clone_flat_source')::uuid
      and p.section_id = current_setting('test.clone_flat_team')::uuid
    order by p.sort_order, sl.sort_order
    limit 1
  ),
  'Seat 1',
  'Main Tank',
  0
);

select set_config(
  'test.clone_flat_copy',
  public.clone_event_template(
    current_setting('test.clone_flat_source')::uuid,
    'd2000000-0000-0000-0000-000000000002',
    'League Source Copy',
    'Cloned for Siege'
  )::text,
  true
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.clone_flat_copy')::uuid
  ),
  'draft'::text,
  'clone always starts as draft'
);

select is(
  (
    select event_type_id
    from public.event_templates
    where id = current_setting('test.clone_flat_copy')::uuid
  ),
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'clone can target another active Event Type in the same Guild'
);

select is(
  (
    select description
    from public.event_templates
    where id = current_setting('test.clone_flat_copy')::uuid
  ),
  'Cloned for Siege'::text,
  'clone stores normalized destination description'
);

select is(
  (
    select uses_areas
    from public.event_templates
    where id = current_setting('test.clone_flat_copy')::uuid
  ),
  false,
  'flat hierarchy mode is preserved'
);

select is(
  (
    select count(*)
    from public.event_template_sections
    where template_id = current_setting('test.clone_flat_copy')::uuid
  ),
  1::bigint,
  'flat clone copies Teams'
);

select is(
  (
    select count(*)
    from public.event_template_parties
    where template_id = current_setting('test.clone_flat_copy')::uuid
  ),
  2::bigint,
  'flat clone copies Parties'
);

select is(
  (
    select count(*)
    from public.event_template_slots
    where template_id = current_setting('test.clone_flat_copy')::uuid
  ),
  10::bigint,
  'flat clone copies every seat row'
);

select is(
  (
    select role_label
    from public.event_template_slots
    where template_id = current_setting('test.clone_flat_copy')::uuid
      and role_label is not null
    order by sort_order
    limit 1
  ),
  'Main Tank'::text,
  'seat role requirements are preserved'
);

select is(
  (
    select created_by = 'd0000000-0000-0000-0000-000000000001'::uuid
       and updated_by = 'd0000000-0000-0000-0000-000000000001'::uuid
    from public.event_templates
    where id = current_setting('test.clone_flat_copy')::uuid
  ),
  true,
  'clone records the cloning actor in audit metadata'
);

select is(
  (
    select count(*) = 0
    from public.event_template_sections source_section
    join public.event_template_sections clone_section
      on clone_section.id = source_section.id
    where source_section.template_id = current_setting('test.clone_flat_source')::uuid
      and clone_section.template_id = current_setting('test.clone_flat_copy')::uuid
  ),
  true,
  'clone hierarchy receives independent identifiers'
);

select set_config(
  'test.clone_area_source',
  public.create_event_template(
    'd1000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Area Source',
    null,
    true
  )::text,
  true
);

select set_config(
  'test.clone_area_id',
  public.create_event_template_area(
    current_setting('test.clone_area_source')::uuid,
    'North',
    0
  )::text,
  true
);

select public.create_event_template_team(
  current_setting('test.clone_area_source')::uuid,
  'STAR TEAM',
  current_setting('test.clone_area_id')::uuid,
  1,
  5
);

select set_config(
  'test.clone_area_copy',
  public.clone_event_template(
    current_setting('test.clone_area_source')::uuid,
    'd2000000-0000-0000-0000-000000000001',
    'Area Source Copy',
    null
  )::text,
  true
);

select is(
  (
    select count(*)
    from public.event_template_areas
    where template_id = current_setting('test.clone_area_copy')::uuid
  ),
  1::bigint,
  'Area clone copies Areas'
);

select is(
  (
    select a.name || '>' || s.name
    from public.event_template_areas a
    join public.event_template_sections s
      on s.template_id = a.template_id
     and s.area_id = a.id
    where a.template_id = current_setting('test.clone_area_copy')::uuid
    limit 1
  ),
  'North>STAR TEAM'::text,
  'Area clone preserves Team-to-Area hierarchy'
);

select throws_ok(
  format(
    'select public.clone_event_template(%L::uuid, %L::uuid, %L, null)',
    current_setting('test.clone_flat_source'),
    'd2000000-0000-0000-0000-000000000003',
    'Blocked Archived Type Clone'
  ),
  '42501',
  null,
  'clone cannot target an archived Event Type'
);

select throws_ok(
  format(
    'select public.clone_event_template(%L::uuid, %L::uuid, %L, null)',
    current_setting('test.clone_flat_source'),
    'd2000000-0000-0000-0000-000000000004',
    'Blocked Cross Guild Clone'
  ),
  '42501',
  null,
  'clone cannot target another Guild Event Type'
);

select throws_ok(
  format(
    'select public.clone_event_template(%L::uuid, %L::uuid, %L, null)',
    current_setting('test.clone_flat_source'),
    'd2000000-0000-0000-0000-000000000002',
    'League Source Copy'
  ),
  '23505',
  null,
  'clone respects live Template name uniqueness'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000003';

select throws_ok(
  format(
    'select public.clone_event_template(%L::uuid, %L::uuid, %L, null)',
    current_setting('test.clone_flat_source'),
    'd2000000-0000-0000-0000-000000000001',
    'Events Officer Clone'
  ),
  '42501',
  null,
  'events.manage alone cannot clone reusable Templates'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000004';

select throws_ok(
  format(
    'select public.clone_event_template(%L::uuid, %L::uuid, %L, null)',
    current_setting('test.clone_flat_source'),
    'd2000000-0000-0000-0000-000000000001',
    'Member Clone'
  ),
  '42501',
  null,
  'ordinary Members cannot clone reusable Templates'
);

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';

select lives_ok(
  format(
    'select public.clone_event_template(%L::uuid, %L::uuid, %L, null)',
    current_setting('test.clone_flat_source'),
    'd2000000-0000-0000-0000-000000000001',
    'Officer Clone'
  ),
  'Officer with templates.manage can clone reusable Templates'
);

select * from finish();
rollback;
