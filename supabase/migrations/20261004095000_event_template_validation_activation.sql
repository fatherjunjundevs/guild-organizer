-- Phase 4.1C: Template validation, activation, and preview-readiness.
--
-- Adds a reusable validation surface, explicit activation gate, and a stable
-- flattened preview read model for the upcoming Template Designer UI.
--
-- Active Templates remain reusable/editable. Any successful structural edit
-- automatically returns an active Template to draft so it must pass validation
-- again before it can be activated.

create or replace function private.require_event_template_read(
  p_template_id uuid
)
returns table (
  guild_id uuid,
  template_status text,
  uses_areas boolean,
  event_type_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_template_status text;
  v_uses_areas boolean;
  v_event_type_id uuid;
  v_guild_status text;
begin
  perform private.require_authenticated_user();

  select t.guild_id, t.status, t.uses_areas, t.event_type_id
  into v_guild_id, v_template_status, v_uses_areas, v_event_type_id
  from public.event_templates t
  where t.id = p_template_id;

  if v_guild_id is null then
    raise exception 'event template not found'
      using errcode = 'P0002';
  end if;

  select g.status
  into v_guild_status
  from public.guilds g
  where g.id = v_guild_id;

  if v_guild_status is null then
    raise exception 'guild not found'
      using errcode = 'P0002';
  end if;

  if v_guild_status <> 'active' then
    raise exception 'guild is not active'
      using errcode = '55000';
  end if;

  if not (
    private.has_guild_capability(v_guild_id, 'templates.manage')
    or private.has_guild_capability(v_guild_id, 'events.manage')
  ) then
    raise exception 'template read authority required'
      using errcode = '42501';
  end if;

  return query
  select v_guild_id, v_template_status, v_uses_areas, v_event_type_id;
end;
$$;

revoke all on function private.require_event_template_read(uuid)
from public, anon, authenticated;

create or replace function private.event_template_validation_issues(
  p_template_id uuid
)
returns table (
  issue_code text,
  severity text,
  message text,
  entity_type text,
  entity_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template record;
begin
  select
    t.guild_id,
    t.uses_areas,
    et.status as event_type_status
  into v_template
  from public.event_templates t
  join public.event_types et
    on et.guild_id = t.guild_id
   and et.id = t.event_type_id
  where t.id = p_template_id;

  if not found then
    raise exception 'event template not found'
      using errcode = 'P0002';
  end if;

  if v_template.event_type_status <> 'active' then
    return query
    select
      'event_type_inactive'::text,
      'error'::text,
      'The Template Event Type must be active before activation.'::text,
      'template'::text,
      p_template_id;
  end if;

  if v_template.uses_areas then
    if not exists (
      select 1
      from public.event_template_areas a
      where a.guild_id = v_template.guild_id
        and a.template_id = p_template_id
    ) then
      return query
      select
        'missing_area'::text,
        'error'::text,
        'Area-based Templates need at least one Area.'::text,
        'template'::text,
        p_template_id;
    end if;

    return query
    select
      'empty_area'::text,
      'error'::text,
      format('Area "%s" needs at least one Section.', a.name)::text,
      'area'::text,
      a.id
    from public.event_template_areas a
    where a.guild_id = v_template.guild_id
      and a.template_id = p_template_id
      and not exists (
        select 1
        from public.event_template_sections s
        where s.guild_id = a.guild_id
          and s.template_id = a.template_id
          and s.area_id = a.id
      )
    order by a.sort_order, a.id;
  elsif exists (
    select 1
    from public.event_template_areas a
    where a.guild_id = v_template.guild_id
      and a.template_id = p_template_id
  ) then
    return query
    select
      'unexpected_area'::text,
      'error'::text,
      'Flat Templates cannot contain Areas.'::text,
      'template'::text,
      p_template_id;
  end if;

  if not exists (
    select 1
    from public.event_template_sections s
    where s.guild_id = v_template.guild_id
      and s.template_id = p_template_id
  ) then
    return query
    select
      'missing_section'::text,
      'error'::text,
      'Templates need at least one Section.'::text,
      'template'::text,
      p_template_id;
  end if;

  return query
  select
    'empty_section'::text,
    'error'::text,
    format('Section "%s" needs at least one Party.', s.name)::text,
    'section'::text,
    s.id
  from public.event_template_sections s
  where s.guild_id = v_template.guild_id
    and s.template_id = p_template_id
    and not exists (
      select 1
      from public.event_template_parties p
      where p.guild_id = s.guild_id
        and p.template_id = s.template_id
        and p.section_id = s.id
    )
  order by s.sort_order, s.id;

  return query
  select
    'empty_party'::text,
    'error'::text,
    format('Party "%s" needs at least one Slot.', p.name)::text,
    'party'::text,
    p.id
  from public.event_template_parties p
  where p.guild_id = v_template.guild_id
    and p.template_id = p_template_id
    and not exists (
      select 1
      from public.event_template_slots sl
      where sl.guild_id = p.guild_id
        and sl.template_id = p.template_id
        and sl.party_id = p.id
    )
  order by p.sort_order, p.id;
end;
$$;

revoke all on function private.event_template_validation_issues(uuid)
from public, anon, authenticated;

create or replace function public.validate_event_template(
  p_template_id uuid
)
returns table (
  issue_code text,
  severity text,
  message text,
  entity_type text,
  entity_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.require_event_template_read(p_template_id);

  return query
  select
    i.issue_code,
    i.severity,
    i.message,
    i.entity_type,
    i.entity_id
  from private.event_template_validation_issues(p_template_id) i;
end;
$$;

revoke all on function public.validate_event_template(uuid)
from public, anon, authenticated;
grant execute on function public.validate_event_template(uuid)
to authenticated;

create or replace function public.activate_event_template(
  p_template_id uuid
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
  from private.require_event_template_manage(p_template_id, true);

  if exists (
    select 1
    from private.event_template_validation_issues(p_template_id) i
    where i.severity = 'error'
  ) then
    raise exception 'event template has validation errors; validate before activation'
      using errcode = '23514';
  end if;

  update public.event_templates
  set
    status = 'active',
    updated_by = v_access.actor_id
  where id = p_template_id;
end;
$$;

revoke all on function public.activate_event_template(uuid)
from public, anon, authenticated;
grant execute on function public.activate_event_template(uuid)
to authenticated;

create or replace function public.get_event_template_preview(
  p_template_id uuid
)
returns table (
  event_type_id uuid,
  event_type_name text,
  template_id uuid,
  template_name text,
  template_description text,
  template_status text,
  uses_areas boolean,
  area_id uuid,
  area_name text,
  area_sort_order integer,
  section_id uuid,
  section_name text,
  section_sort_order integer,
  party_id uuid,
  party_name text,
  party_sort_order integer,
  slot_id uuid,
  slot_name text,
  role_label text,
  slot_sort_order integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.require_event_template_read(p_template_id);

  return query
  select
    et.id,
    et.name,
    t.id,
    t.name,
    t.description,
    t.status,
    t.uses_areas,
    a.id,
    a.name,
    a.sort_order,
    s.id,
    s.name,
    s.sort_order,
    p.id,
    p.name,
    p.sort_order,
    sl.id,
    sl.name,
    sl.role_label,
    sl.sort_order
  from public.event_templates t
  join public.event_types et
    on et.guild_id = t.guild_id
   and et.id = t.event_type_id
  left join public.event_template_areas a
    on t.uses_areas
   and a.guild_id = t.guild_id
   and a.template_id = t.id
  left join public.event_template_sections s
    on s.guild_id = t.guild_id
   and s.template_id = t.id
   and (
     (t.uses_areas and s.area_id = a.id)
     or
     (not t.uses_areas and s.area_id is null)
   )
  left join public.event_template_parties p
    on p.guild_id = t.guild_id
   and p.template_id = t.id
   and p.section_id = s.id
  left join public.event_template_slots sl
    on sl.guild_id = t.guild_id
   and sl.template_id = t.id
   and sl.party_id = p.id
  where t.id = p_template_id
  order by
    a.sort_order nulls first,
    a.id nulls first,
    s.sort_order nulls first,
    s.id nulls first,
    p.sort_order nulls first,
    p.id nulls first,
    sl.sort_order nulls first,
    sl.id nulls first;
end;
$$;

revoke all on function public.get_event_template_preview(uuid)
from public, anon, authenticated;
grant execute on function public.get_event_template_preview(uuid)
to authenticated;

create or replace function private.touch_event_template(
  p_template_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.event_templates
  set
    status = case
      when status = 'active' then 'draft'
      else status
    end,
    updated_by = p_actor_id
  where id = p_template_id;

  if not found then
    raise exception 'event template not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function private.touch_event_template(uuid, uuid)
from public, anon, authenticated;

comment on function public.validate_event_template(uuid) is
  'Returns machine-readable validation issues for one reusable Template. Zero rows means the Template passes the current activation rules.';
comment on function public.activate_event_template(uuid) is
  'Activates one reusable Template only when the canonical validation rules return no errors.';
comment on function public.get_event_template_preview(uuid) is
  'Returns a stable ordered flattened hierarchy for Template preview and future Event-template consumption.';
