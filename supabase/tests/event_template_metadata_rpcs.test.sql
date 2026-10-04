begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select has_function(
  'public',
  'create_event_type',
  array['uuid', 'text', 'text'],
  'create_event_type RPC exists'
);

select has_function(
  'public',
  'update_event_type',
  array['uuid', 'text', 'text', 'text'],
  'update_event_type RPC exists'
);

select has_function(
  'public',
  'delete_event_type',
  array['uuid'],
  'delete_event_type RPC exists'
);

select has_function(
  'public',
  'create_event_template',
  array['uuid', 'uuid', 'text', 'text', 'boolean'],
  'create_event_template RPC exists'
);

select has_function(
  'public',
  'update_event_template',
  array['uuid', 'uuid', 'text', 'text', 'boolean', 'text'],
  'update_event_template RPC exists'
);

select has_function(
  'public',
  'delete_event_template',
  array['uuid'],
  'delete_event_template RPC exists'
);

insert into auth.users (id, email)
values
  ('90000000-0000-0000-0000-000000000001', 'rpc-owner-a@test.local'),
  ('90000000-0000-0000-0000-000000000002', 'rpc-template-officer@test.local'),
  ('90000000-0000-0000-0000-000000000003', 'rpc-event-officer@test.local'),
  ('90000000-0000-0000-0000-000000000004', 'rpc-member@test.local'),
  ('90000000-0000-0000-0000-000000000005', 'rpc-owner-b@test.local');

insert into public.guilds (id, name, created_by)
values
  ('91000000-0000-0000-0000-000000000001', 'Template RPC Guild A', '90000000-0000-0000-0000-000000000001'),
  ('92000000-0000-0000-0000-000000000001', 'Template RPC Guild B', '90000000-0000-0000-0000-000000000005');

insert into public.guild_memberships (id, guild_id, user_id, role)
values
  ('91100000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'owner'),
  ('91100000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'officer'),
  ('91100000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 'officer'),
  ('91100000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', 'member'),
  ('92200000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000005', 'owner');

insert into public.guild_officer_capabilities (
  guild_id, membership_id, capability_key, granted_by
)
values
  ('91000000-0000-0000-0000-000000000001', '91100000-0000-0000-0000-000000000002', 'templates.manage', '90000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000001', '91100000-0000-0000-0000-000000000003', 'events.manage', '90000000-0000-0000-0000-000000000001');

insert into public.event_types (
  id, guild_id, name, created_by, updated_by
)
values (
  '93000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  'Other Guild Type',
  '90000000-0000-0000-0000-000000000005',
  '90000000-0000-0000-0000-000000000005'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.create_event_type(
      '91000000-0000-0000-0000-000000000001',
      'Guild League',
      ' Primary competitive family '
    )
  $sql$,
  'Owner can create an Event Type'
);

select is(
  (
    select description
    from public.event_types
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and name = 'Guild League'
  ),
  'Primary competitive family'::text,
  'Event Type description is normalized'
);

select is(
  (
    select created_by = '90000000-0000-0000-0000-000000000001'
       and updated_by = '90000000-0000-0000-0000-000000000001'
    from public.event_types
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and name = 'Guild League'
  ),
  true,
  'Event Type records actor audit identity'
);

select lives_ok(
  $sql$
    select public.create_event_template(
      '91000000-0000-0000-0000-000000000001',
      (
        select id
        from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      ),
      'League 40',
      ' Reusable layout ',
      true
    )
  $sql$,
  'Owner can create a reusable Template'
);

select is(
  (
    select status
    from public.event_templates
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and name = 'League 40'
  ),
  'draft'::text,
  'new Template starts as draft'
);

select is(
  (
    select description
    from public.event_templates
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and name = 'League 40'
  ),
  'Reusable layout'::text,
  'Template description is normalized'
);

select set_config(
  'test.phase4_template_id',
  (
    select id::text
    from public.event_templates
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and name = 'League 40'
  ),
  true
);

select throws_ok(
  $sql$
    select public.create_event_template(
      '91000000-0000-0000-0000-000000000001',
      '93000000-0000-0000-0000-000000000001',
      'Cross Guild',
      null,
      false
    )
  $sql$,
  '42501',
  null,
  'Template cannot attach an Event Type from another Guild'
);

select throws_ok(
  $sql$
    select public.update_event_type(
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      ),
      'Guild League',
      null,
      'archived'
    )
  $sql$,
  '55000',
  null,
  'Event Type cannot archive while a draft Template references it'
);

select throws_ok(
  $sql$
    select public.delete_event_type(
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      )
    )
  $sql$,
  '55000',
  null,
  'Event Type cannot delete while any Template references it'
);

select throws_ok(
  $sql$
    select public.update_event_template(
      (
        select id from public.event_templates
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'League 40'
      ),
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      ),
      'League 40',
      null,
      true,
      'active'
    )
  $sql$,
  '22023',
  null,
  'Template activation is blocked until the later validation gate'
);

set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000003';

select throws_ok(
  $sql$
    select public.create_event_type(
      '91000000-0000-0000-0000-000000000001',
      'Events Only',
      null
    )
  $sql$,
  '42501',
  null,
  'events.manage alone cannot mutate reusable Template metadata'
);

set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000004';

select throws_ok(
  $sql$
    select public.delete_event_template(
      current_setting('test.phase4_template_id')::uuid
    )
  $sql$,
  '42501',
  null,
  'ordinary Member cannot mutate a Template'
);

set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000002';

select lives_ok(
  $sql$
    select public.create_event_type(
      '91000000-0000-0000-0000-000000000001',
      'Officer Type',
      null
    )
  $sql$,
  'Officer with templates.manage can mutate reusable Template metadata'
);

select is(
  (
    select updated_by
    from public.event_types
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and name = 'Officer Type'
  ),
  '90000000-0000-0000-0000-000000000002'::uuid,
  'templates.manage Officer is recorded in audit metadata'
);

set local request.jwt.claim.sub = '90000000-0000-0000-0000-000000000001';

select lives_ok(
  $sql$
    select public.update_event_template(
      (
        select id from public.event_templates
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'League 40'
      ),
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      ),
      'League 40',
      'Archived reusable layout',
      true,
      'archived'
    )
  $sql$,
  'Owner can archive a Template'
);

select lives_ok(
  $sql$
    select public.update_event_type(
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      ),
      'Guild League',
      null,
      'archived'
    )
  $sql$,
  'Event Type may archive after its Templates are archived'
);

select throws_ok(
  $sql$
    select public.update_event_template(
      (
        select id from public.event_templates
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'League 40'
      ),
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      ),
      'League 40',
      null,
      true,
      'draft'
    )
  $sql$,
  '42501',
  null,
  'Template cannot return to draft under an archived Event Type'
);

select lives_ok(
  $sql$
    select public.update_event_type(
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      ),
      'Guild League',
      null,
      'active'
    )
  $sql$,
  'Owner can reactivate an Event Type'
);

select lives_ok(
  $sql$
    select public.update_event_template(
      (
        select id from public.event_templates
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'League 40'
      ),
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Guild League'
      ),
      'League 40',
      null,
      true,
      'draft'
    )
  $sql$,
  'Owner can return archived Template to draft after Event Type reactivation'
);

select throws_ok(
  $sql$
    select public.create_event_type(
      '91000000-0000-0000-0000-000000000001',
      ' Padded ',
      null
    )
  $sql$,
  '22023',
  null,
  'RPC rejects untrimmed Event Type names'
);

select throws_ok(
  $sql$
    select public.update_event_type(
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Officer Type'
      ),
      'Officer Type',
      null,
      'disabled'
    )
  $sql$,
  '22023',
  null,
  'RPC rejects invalid Event Type status'
);

select lives_ok(
  $sql$
    select public.create_event_type(
      '91000000-0000-0000-0000-000000000001',
      'Disposable Type',
      null
    )
  $sql$,
  'Owner can create an unreferenced Event Type'
);

select lives_ok(
  $sql$
    select public.delete_event_type(
      (
        select id from public.event_types
        where guild_id = '91000000-0000-0000-0000-000000000001'
          and name = 'Disposable Type'
      )
    )
  $sql$,
  'Owner can delete an unreferenced Event Type'
);

select is(
  (
    select count(*) from public.event_types
    where guild_id = '91000000-0000-0000-0000-000000000001'
      and name = 'Disposable Type'
  ),
  0::bigint,
  'deleted Event Type is removed'
);

reset role;
set local role anon;

select throws_ok(
  $sql$
    select public.create_event_type(
      '91000000-0000-0000-0000-000000000001',
      'Anonymous',
      null
    )
  $sql$,
  '42501',
  null,
  'anonymous role cannot execute Template mutation RPCs'
);

reset role;

select * from finish();
rollback;
