begin;

create extension if not exists pgtap with schema extensions;

select plan(43);

select has_function(
  'public',
  'validate_event_template',
  array['uuid'],
  'validate_event_template RPC exists'
);

select has_function(
  'public',
  'activate_event_template',
  array['uuid'],
  'activate_event_template RPC exists'
);

select has_function(
  'public',
  'get_event_template_preview',
  array['uuid'],
  'get_event_template_preview RPC exists'
);

insert into auth.users (id, email)
values
  ('b0000000-0000-0000-0000-000000000001', 'validation-owner@test.local'),
  ('b0000000-0000-0000-0000-000000000002', 'validation-template-officer@test.local'),
  ('b0000000-0000-0000-0000-000000000003', 'validation-event-officer@test.local'),
  ('b0000000-0000-0000-0000-000000000004', 'validation-member@test.local');

insert into public.guilds (id, name, created_by)
values (
  'b1000000-0000-0000-0000-000000000001',
  'Validation RPC Guild',
  'b0000000-0000-0000-0000-000000000001'
);

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  ('b1100000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('b1100000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'officer'),
  ('b1100000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'officer'),
  ('b1100000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'member');

insert into public.guild_officer_capabilities (
  guild_id,
  membership_id,
  capability_key,
  granted_by
)
values
  ('b1000000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000002', 'templates.manage', 'b0000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000003', 'events.manage', 'b0000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';

select set_config(
  'test.validation_area_type_id',
  public.create_event_type(
    'b1000000-0000-0000-0000-000000000001',
    'Area Event',
    null
  )::text,
  true
);

select set_config(
  'test.validation_flat_type_id',
  public.create_event_type(
    'b1000000-0000-0000-0000-000000000001',
    'Flat Event',
    null
  )::text,
  true
);

select set_config(
  'test.validation_area_template_id',
  public.create_event_template(
    'b1000000-0000-0000-0000-000000000001',
    current_setting('test.validation_area_type_id')::uuid,
    'Area Template',
    'Validation target',
    true
  )::text,
  true
);

select set_config(
  'test.validation_flat_template_id',
  public.create_event_template(
    'b1000000-0000-0000-0000-000000000001',
    current_setting('test.validation_flat_type_id')::uuid,
    'Flat Template',
    null,
    false
  )::text,
  true
);

select is(
  (
    select count(*)
    from public.validate_event_template(
      current_setting('test.validation_area_template_id')::uuid
    )
  ),
  2::bigint,
  'empty Area-based Template reports two blocking issues'
);

select results_eq(
  $sql$
    select issue_code
    from public.validate_event_template(
      current_setting('test.validation_area_template_id')::uuid
    )
    order by issue_code
  $sql$,
  array['missing_area'::text, 'missing_section'::text],
  'empty Area-based Template reports missing Area and Section'
);

select throws_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  '23514',
  null,
  'invalid Template cannot be activated'
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.validation_area_template_id')::uuid
  ),
  'draft'::text,
  'failed activation leaves Template in draft'
);

select set_config(
  'test.validation_area_id',
  public.create_event_template_area(
    current_setting('test.validation_area_template_id')::uuid,
    'Sun',
    0
  )::text,
  true
);

select is(
  (
    select issue_code
    from public.validate_event_template(
      current_setting('test.validation_area_template_id')::uuid
    )
    order by issue_code
    limit 1
  ),
  'empty_area'::text,
  'Area without Section is reported'
);

select set_config(
  'test.validation_section_id',
  public.create_event_template_section(
    current_setting('test.validation_area_template_id')::uuid,
    'Alpha',
    current_setting('test.validation_area_id')::uuid,
    0
  )::text,
  true
);

select is(
  (
    select issue_code
    from public.validate_event_template(
      current_setting('test.validation_area_template_id')::uuid
    )
    order by issue_code
    limit 1
  ),
  'empty_section'::text,
  'Section without Party is reported'
);

select set_config(
  'test.validation_party_id',
  public.create_event_template_party(
    current_setting('test.validation_section_id')::uuid,
    'Party 1',
    0
  )::text,
  true
);

select is(
  (
    select issue_code
    from public.validate_event_template(
      current_setting('test.validation_area_template_id')::uuid
    )
    order by issue_code
    limit 1
  ),
  'empty_party'::text,
  'Party without Slot is reported'
);

select set_config(
  'test.validation_slot_1_id',
  public.create_event_template_slot(
    current_setting('test.validation_party_id')::uuid,
    'Seat 1',
    'Tank',
    0
  )::text,
  true
);

select set_config(
  'test.validation_slot_2_id',
  public.create_event_template_slot(
    current_setting('test.validation_party_id')::uuid,
    'Seat 2',
    null,
    1
  )::text,
  true
);

select is(
  (
    select count(*)
    from public.validate_event_template(
      current_setting('test.validation_area_template_id')::uuid
    )
  ),
  0::bigint,
  'complete Area hierarchy has no activation errors'
);

select lives_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  'valid Template can be activated'
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.validation_area_template_id')::uuid
  ),
  'active'::text,
  'successful activation sets Template active'
);

select is(
  (
    select count(*)
    from public.get_event_template_preview(
      current_setting('test.validation_area_template_id')::uuid
    )
  ),
  2::bigint,
  'preview returns one row per Slot for a complete Party'
);

select results_eq(
  $sql$
    select slot_name
    from public.get_event_template_preview(
      current_setting('test.validation_area_template_id')::uuid
    )
    order by slot_sort_order
  $sql$,
  array['Seat 1'::text, 'Seat 2'::text],
  'preview preserves Slot ordering'
);

select is(
  (
    select
      event_type_name || '|' ||
      template_name || '|' ||
      area_name || '|' ||
      section_name || '|' ||
      party_name
    from public.get_event_template_preview(
      current_setting('test.validation_area_template_id')::uuid
    )
    limit 1
  ),
  'Area Event|Area Template|Sun|Alpha|Party 1'::text,
  'preview exposes the full organizer hierarchy'
);

select is(
  (
    select role_label
    from public.get_event_template_preview(
      current_setting('test.validation_area_template_id')::uuid
    )
    where slot_name = 'Seat 1'
  ),
  'Tank'::text,
  'preview carries optional Slot role requirements'
);

set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';

select lives_ok(
  format(
    'select public.update_event_template_slot(%L::uuid, %L::uuid, %L, %L, 0)',
    current_setting('test.validation_slot_1_id'),
    current_setting('test.validation_party_id'),
    'Tank Seat',
    'Main Tank'
  ),
  'templates.manage Officer can structurally edit an active Template'
);

select is(
  (
    select status
    from public.event_templates
    where id = current_setting('test.validation_area_template_id')::uuid
  ),
  'draft'::text,
  'successful structural edit returns active Template to draft'
);

select is(
  (
    select updated_by
    from public.event_templates
    where id = current_setting('test.validation_area_template_id')::uuid
  ),
  'b0000000-0000-0000-0000-000000000002'::uuid,
  'structural edit records the organizer who invalidated active status'
);

select lives_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  'templates.manage Officer can reactivate a valid edited Template'
);

set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000003';

select is(
  (
    select count(*)
    from public.get_event_template_preview(
      current_setting('test.validation_area_template_id')::uuid
    )
  ),
  2::bigint,
  'events.manage Officer can consume Template preview'
);

select is(
  (
    select count(*)
    from public.validate_event_template(
      current_setting('test.validation_area_template_id')::uuid
    )
  ),
  0::bigint,
  'events.manage Officer can read Template validation state'
);

select throws_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  '42501',
  null,
  'events.manage alone cannot activate reusable Templates'
);

set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000004';

select throws_ok(
  format(
    'select count(*) from public.validate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  '42501',
  null,
  'ordinary Member cannot validate reusable Templates'
);

select throws_ok(
  format(
    'select count(*) from public.get_event_template_preview(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  '42501',
  null,
  'ordinary Member cannot consume Template preview'
);

set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';

select set_config(
  'test.validation_flat_section_id',
  public.create_event_template_section(
    current_setting('test.validation_flat_template_id')::uuid,
    'Main',
    null,
    0
  )::text,
  true
);

select set_config(
  'test.validation_flat_party_id',
  public.create_event_template_party(
    current_setting('test.validation_flat_section_id')::uuid,
    'Main Party',
    0
  )::text,
  true
);

select set_config(
  'test.validation_flat_slot_id',
  public.create_event_template_slot(
    current_setting('test.validation_flat_party_id')::uuid,
    'Seat 1',
    null,
    0
  )::text,
  true
);

select is(
  (
    select count(*)
    from public.validate_event_template(
      current_setting('test.validation_flat_template_id')::uuid
    )
  ),
  0::bigint,
  'complete flat hierarchy validates without an Area'
);

select is(
  (
    select area_id is null and area_name is null
    from public.get_event_template_preview(
      current_setting('test.validation_flat_template_id')::uuid
    )
    limit 1
  ),
  true,
  'flat Template preview has no synthetic Area'
);

select lives_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_flat_template_id')
  ),
  'valid flat Template can be activated'
);

select lives_ok(
  format(
    $fmt$
      select public.update_event_template(
        %L::uuid,
        %L::uuid,
        'Flat Template',
        null,
        false,
        'archived'
      )
    $fmt$,
    current_setting('test.validation_flat_template_id'),
    current_setting('test.validation_flat_type_id')
  ),
  'Template can be archived before its Event Type'
);

select lives_ok(
  format(
    $fmt$
      select public.update_event_type(
        %L::uuid,
        'Flat Event',
        null,
        'archived'
      )
    $fmt$,
    current_setting('test.validation_flat_type_id')
  ),
  'Event Type can archive after its Template is archived'
);

select results_eq(
  format(
    $fmt$
      select issue_code
      from public.validate_event_template(%L::uuid)
      order by issue_code
    $fmt$,
    current_setting('test.validation_flat_template_id')
  ),
  array['event_type_inactive'::text],
  'archived parent Event Type is a blocking validation issue'
);

select throws_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_flat_template_id')
  ),
  '23514',
  null,
  'Template cannot activate under an archived Event Type'
);

select lives_ok(
  format(
    $fmt$
      select public.update_event_type(
        %L::uuid,
        'Flat Event',
        null,
        'active'
      )
    $fmt$,
    current_setting('test.validation_flat_type_id')
  ),
  'Event Type can be reactivated'
);

select lives_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_flat_template_id')
  ),
  'Template can activate after its Event Type is active again'
);

select set_config(
  'test.validation_empty_area_id',
  public.create_event_template_area(
    current_setting('test.validation_area_template_id')::uuid,
    'Moon',
    9
  )::text,
  true
);

select is(
  (
    select count(*)
    from public.get_event_template_preview(
      current_setting('test.validation_area_template_id')::uuid
    )
    where area_name = 'Moon'
      and section_id is null
  ),
  1::bigint,
  'preview preserves empty Areas so the designer can show remediation'
);

select results_eq(
  format(
    $fmt$
      select issue_code
      from public.validate_event_template(%L::uuid)
      where entity_id = %L::uuid
    $fmt$,
    current_setting('test.validation_area_template_id'),
    current_setting('test.validation_empty_area_id')
  ),
  array['empty_area'::text],
  'validation identifies the exact empty Area'
);

select throws_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  '23514',
  null,
  'new empty Area prevents reactivation'
);

select lives_ok(
  format(
    'select public.delete_event_template_area(%L::uuid)',
    current_setting('test.validation_empty_area_id')
  ),
  'empty Area can be removed through secure structure RPC'
);

select lives_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  'Template reactivates after validation issue is resolved'
);

reset role;
set local role anon;

select throws_ok(
  format(
    'select count(*) from public.validate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  '42501',
  null,
  'anonymous role cannot execute Template validation RPC'
);

select throws_ok(
  format(
    'select count(*) from public.get_event_template_preview(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  '42501',
  null,
  'anonymous role cannot execute Template preview RPC'
);

select throws_ok(
  format(
    'select public.activate_event_template(%L::uuid)',
    current_setting('test.validation_area_template_id')
  ),
  '42501',
  null,
  'anonymous role cannot execute Template activation RPC'
);

reset role;

select * from finish();
rollback;
