-- Phase 4.1B1: Secure Event Type / Template metadata mutation RPCs.
--
-- Direct table writes remain unavailable to application roles.
-- Application mutations require templates.manage through SECURITY DEFINER RPCs.
-- Template activation is intentionally deferred until the later validation gate.

create or replace function private.require_templates_manage(
  p_guild_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := private.require_authenticated_user();
  v_guild_status text;
begin
  select g.status
  into v_guild_status
  from public.guilds g
  where g.id = p_guild_id;

  if v_guild_status is null then
    raise exception 'guild not found'
      using errcode = 'P0002';
  end if;

  if v_guild_status <> 'active' then
    raise exception 'guild is not active'
      using errcode = '55000';
  end if;

  if not private.has_guild_capability(p_guild_id, 'templates.manage') then
    raise exception 'templates.manage authority required'
      using errcode = '42501';
  end if;

  return v_actor_id;
end;
$$;

revoke all on function private.require_templates_manage(uuid)
from public, anon, authenticated;

create or replace function private.require_event_type_manage(
  p_event_type_id uuid
)
returns table (
  guild_id uuid,
  actor_id uuid,
  event_type_status text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_status text;
  v_actor_id uuid;
begin
  select t.guild_id, t.status
  into v_guild_id, v_status
  from public.event_types t
  where t.id = p_event_type_id
  for update;

  if v_guild_id is null then
    raise exception 'event type not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_templates_manage(v_guild_id);

  return query
  select v_guild_id, v_actor_id, v_status;
end;
$$;

revoke all on function private.require_event_type_manage(uuid)
from public, anon, authenticated;

create or replace function private.require_event_template_manage(
  p_template_id uuid,
  p_allow_archived boolean
)
returns table (
  guild_id uuid,
  actor_id uuid,
  template_status text,
  uses_areas boolean
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_status text;
  v_uses_areas boolean;
  v_actor_id uuid;
begin
  select t.guild_id, t.status, t.uses_areas
  into v_guild_id, v_status, v_uses_areas
  from public.event_templates t
  where t.id = p_template_id
  for update;

  if v_guild_id is null then
    raise exception 'event template not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_templates_manage(v_guild_id);

  if not p_allow_archived and v_status = 'archived' then
    raise exception 'archived event template cannot be structurally edited'
      using errcode = '55000';
  end if;

  return query
  select v_guild_id, v_actor_id, v_status, v_uses_areas;
end;
$$;

revoke all on function private.require_event_template_manage(uuid, boolean)
from public, anon, authenticated;

create or replace function public.create_event_type(
  p_guild_id uuid,
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_event_type_id uuid;
  v_description text := nullif(btrim(p_description), '');
begin
  v_actor_id := private.require_templates_manage(p_guild_id);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'event type name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if v_description is not null and char_length(v_description) > 500 then
    raise exception 'event type description must be at most 500 characters'
      using errcode = '22023';
  end if;

  insert into public.event_types (
    guild_id, name, description, status, created_by, updated_by
  )
  values (
    p_guild_id, p_name, v_description, 'active', v_actor_id, v_actor_id
  )
  returning id into v_event_type_id;

  return v_event_type_id;
end;
$$;

create or replace function public.update_event_type(
  p_event_type_id uuid,
  p_name text,
  p_description text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_description text := nullif(btrim(p_description), '');
begin
  select *
  into v_access
  from private.require_event_type_manage(p_event_type_id);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'event type name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if v_description is not null and char_length(v_description) > 500 then
    raise exception 'event type description must be at most 500 characters'
      using errcode = '22023';
  end if;

  if p_status not in ('active', 'archived') then
    raise exception 'event type status must be active or archived'
      using errcode = '22023';
  end if;

  if p_status = 'archived'
     and exists (
       select 1
       from public.event_templates t
       where t.guild_id = v_access.guild_id
         and t.event_type_id = p_event_type_id
         and t.status <> 'archived'
     ) then
    raise exception 'archive Event Templates before archiving their Event Type'
      using errcode = '55000';
  end if;

  update public.event_types
  set
    name = p_name,
    description = v_description,
    status = p_status,
    updated_by = v_access.actor_id
  where id = p_event_type_id;
end;
$$;

create or replace function public.delete_event_type(
  p_event_type_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
begin
  select *
  into v_access
  from private.require_event_type_manage(p_event_type_id);

  if exists (
    select 1
    from public.event_templates t
    where t.guild_id = v_access.guild_id
      and t.event_type_id = p_event_type_id
  ) then
    raise exception 'Event Type cannot be deleted while Templates reference it'
      using errcode = '55000';
  end if;

  delete from public.event_types
  where id = p_event_type_id;
end;
$$;

create or replace function public.create_event_template(
  p_guild_id uuid,
  p_event_type_id uuid,
  p_name text,
  p_description text default null,
  p_uses_areas boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_template_id uuid;
  v_description text := nullif(btrim(p_description), '');
begin
  v_actor_id := private.require_templates_manage(p_guild_id);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 120 then
    raise exception 'event template name must be 1 to 120 trimmed characters'
      using errcode = '22023';
  end if;

  if v_description is not null and char_length(v_description) > 1000 then
    raise exception 'event template description must be at most 1000 characters'
      using errcode = '22023';
  end if;

  if p_uses_areas is null then
    raise exception 'uses_areas is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.event_types t
    where t.guild_id = p_guild_id
      and t.id = p_event_type_id
      and t.status = 'active'
  ) then
    raise exception 'active Event Type must belong to the same Guild'
      using errcode = '42501';
  end if;

  insert into public.event_templates (
    guild_id,
    event_type_id,
    name,
    description,
    uses_areas,
    status,
    created_by,
    updated_by
  )
  values (
    p_guild_id,
    p_event_type_id,
    p_name,
    v_description,
    p_uses_areas,
    'draft',
    v_actor_id,
    v_actor_id
  )
  returning id into v_template_id;

  return v_template_id;
end;
$$;

create or replace function public.update_event_template(
  p_template_id uuid,
  p_event_type_id uuid,
  p_name text,
  p_description text,
  p_uses_areas boolean,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_description text := nullif(btrim(p_description), '');
begin
  select *
  into v_access
  from private.require_event_template_manage(p_template_id, true);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 120 then
    raise exception 'event template name must be 1 to 120 trimmed characters'
      using errcode = '22023';
  end if;

  if v_description is not null and char_length(v_description) > 1000 then
    raise exception 'event template description must be at most 1000 characters'
      using errcode = '22023';
  end if;

  if p_uses_areas is null then
    raise exception 'uses_areas is required'
      using errcode = '22023';
  end if;

  if p_status not in ('draft', 'archived') then
    raise exception 'Template activation requires the later validation gate'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.event_types t
    where t.guild_id = v_access.guild_id
      and t.id = p_event_type_id
      and (t.status = 'active' or p_status = 'archived')
  ) then
    raise exception 'Event Type must belong to the same Guild and be active for a draft Template'
      using errcode = '42501';
  end if;

  update public.event_templates
  set
    event_type_id = p_event_type_id,
    name = p_name,
    description = v_description,
    uses_areas = p_uses_areas,
    status = p_status,
    updated_by = v_access.actor_id
  where id = p_template_id;
end;
$$;

create or replace function public.delete_event_template(
  p_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.require_event_template_manage(p_template_id, true);

  delete from public.event_templates
  where id = p_template_id;
end;
$$;

revoke all on function public.create_event_type(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.update_event_type(uuid, text, text, text)
from public, anon, authenticated;
revoke all on function public.delete_event_type(uuid)
from public, anon, authenticated;
revoke all on function public.create_event_template(uuid, uuid, text, text, boolean)
from public, anon, authenticated;
revoke all on function public.update_event_template(uuid, uuid, text, text, boolean, text)
from public, anon, authenticated;
revoke all on function public.delete_event_template(uuid)
from public, anon, authenticated;

grant execute on function public.create_event_type(uuid, text, text)
to authenticated;
grant execute on function public.update_event_type(uuid, text, text, text)
to authenticated;
grant execute on function public.delete_event_type(uuid)
to authenticated;
grant execute on function public.create_event_template(uuid, uuid, text, text, boolean)
to authenticated;
grant execute on function public.update_event_template(uuid, uuid, text, text, boolean, text)
to authenticated;
grant execute on function public.delete_event_template(uuid)
to authenticated;

comment on function public.create_event_type(uuid, text, text) is
  'Creates one Guild-defined Event Type after templates.manage authorization.';
comment on function public.create_event_template(uuid, uuid, text, text, boolean) is
  'Creates one reusable draft Event Template after templates.manage authorization.';
comment on function public.update_event_template(uuid, uuid, text, text, boolean, text) is
  'Updates reusable Template metadata. Application-level activation remains blocked until the later Template validation gate.';
comment on function public.delete_event_template(uuid) is
  'Deletes one reusable Event Template and its template-owned structure after templates.manage authorization. Future Events must own independent snapshots.';
