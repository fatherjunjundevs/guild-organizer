-- Phase 5.1B: Atomic Event creation from an active reusable Template.
--
-- The Event and its complete structural snapshot are created in one
-- transaction. Every Area / Section / Party / Slot receives a fresh Event-owned
-- UUID while names, ordering, Area mode, and Slot role requirements are copied.
-- Holding a row lock on the source Template serializes this snapshot against
-- application Template structural edits, which also lock/touch the Template.
--
-- The source Template remains reusable and unchanged by Event creation.

create or replace function private.require_events_manage(
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

  if not private.has_guild_capability(p_guild_id, 'events.manage') then
    raise exception 'events.manage authority required'
      using errcode = '42501';
  end if;

  return v_actor_id;
end;
$$;

revoke all on function private.require_events_manage(uuid)
from public, anon, authenticated;

create or replace function public.create_event_from_template(
  p_template_id uuid,
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template record;
  v_actor_id uuid;
  v_event_id uuid;
  v_description text := nullif(btrim(p_description), '');

  v_area record;
  v_section record;
  v_party record;

  v_new_area_id uuid;
  v_new_section_id uuid;
  v_new_party_id uuid;
begin
  -- Serialize Event snapshot creation against normal application Template
  -- structural edits. Phase 4 structural RPCs lock/touch this same parent row.
  select
    t.guild_id,
    t.event_type_id,
    t.name as template_name,
    t.uses_areas,
    t.status as template_status,
    et.name as event_type_name,
    et.status as event_type_status
  into v_template
  from public.event_templates t
  join public.event_types et
    on et.guild_id = t.guild_id
   and et.id = t.event_type_id
  where t.id = p_template_id
  for update of t;

  if not found then
    raise exception 'event template not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_events_manage(v_template.guild_id);

  if v_template.template_status <> 'active'
     or v_template.event_type_status <> 'active' then
    raise exception 'Event creation requires an active Template and Event Type'
      using errcode = '23514';
  end if;

  -- Active status normally means this gate already passed, but validating again
  -- makes the snapshot boundary defensive against privileged/manual DB changes.
  if exists (
    select 1
    from private.event_template_validation_issues(p_template_id) i
    where i.severity = 'error'
  ) then
    raise exception 'event template has validation errors'
      using errcode = '23514';
  end if;

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 120 then
    raise exception 'Event name must be 1 to 120 trimmed characters'
      using errcode = '22023';
  end if;

  if v_description is not null
     and char_length(v_description) > 1000 then
    raise exception 'Event description must be at most 1000 characters'
      using errcode = '22023';
  end if;

  insert into public.events (
    guild_id,
    event_type_id,
    source_template_id,
    name,
    description,
    event_type_name_snapshot,
    template_name_snapshot,
    uses_areas,
    status,
    created_by,
    updated_by
  )
  values (
    v_template.guild_id,
    v_template.event_type_id,
    p_template_id,
    p_name,
    v_description,
    v_template.event_type_name,
    v_template.template_name,
    v_template.uses_areas,
    'active',
    v_actor_id,
    v_actor_id
  )
  returning id into v_event_id;

  if v_template.uses_areas then
    for v_area in
      select a.id, a.name, a.sort_order
      from public.event_template_areas a
      where a.guild_id = v_template.guild_id
        and a.template_id = p_template_id
      order by a.sort_order, a.id
    loop
      insert into public.event_areas (
        guild_id, event_id, name, sort_order, created_by, updated_by
      )
      values (
        v_template.guild_id, v_event_id, v_area.name, v_area.sort_order,
        v_actor_id, v_actor_id
      )
      returning id into v_new_area_id;

      for v_section in
        select s.id, s.name, s.sort_order
        from public.event_template_sections s
        where s.guild_id = v_template.guild_id
          and s.template_id = p_template_id
          and s.area_id = v_area.id
        order by s.sort_order, s.id
      loop
        insert into public.event_sections (
          guild_id, event_id, area_id, name, sort_order, created_by, updated_by
        )
        values (
          v_template.guild_id, v_event_id, v_new_area_id, v_section.name,
          v_section.sort_order, v_actor_id, v_actor_id
        )
        returning id into v_new_section_id;

        for v_party in
          select p.id, p.name, p.sort_order
          from public.event_template_parties p
          where p.guild_id = v_template.guild_id
            and p.template_id = p_template_id
            and p.section_id = v_section.id
          order by p.sort_order, p.id
        loop
          insert into public.event_parties (
            guild_id, event_id, section_id, name, sort_order, created_by, updated_by
          )
          values (
            v_template.guild_id, v_event_id, v_new_section_id, v_party.name,
            v_party.sort_order, v_actor_id, v_actor_id
          )
          returning id into v_new_party_id;

          insert into public.event_slots (
            guild_id, event_id, party_id, name, role_label, sort_order,
            created_by, updated_by
          )
          select
            v_template.guild_id,
            v_event_id,
            v_new_party_id,
            sl.name,
            sl.role_label,
            sl.sort_order,
            v_actor_id,
            v_actor_id
          from public.event_template_slots sl
          where sl.guild_id = v_template.guild_id
            and sl.template_id = p_template_id
            and sl.party_id = v_party.id
          order by sl.sort_order, sl.id;
        end loop;
      end loop;
    end loop;
  else
    for v_section in
      select s.id, s.name, s.sort_order
      from public.event_template_sections s
      where s.guild_id = v_template.guild_id
        and s.template_id = p_template_id
        and s.area_id is null
      order by s.sort_order, s.id
    loop
      insert into public.event_sections (
        guild_id, event_id, area_id, name, sort_order, created_by, updated_by
      )
      values (
        v_template.guild_id, v_event_id, null, v_section.name,
        v_section.sort_order, v_actor_id, v_actor_id
      )
      returning id into v_new_section_id;

      for v_party in
        select p.id, p.name, p.sort_order
        from public.event_template_parties p
        where p.guild_id = v_template.guild_id
          and p.template_id = p_template_id
          and p.section_id = v_section.id
        order by p.sort_order, p.id
      loop
        insert into public.event_parties (
          guild_id, event_id, section_id, name, sort_order, created_by, updated_by
        )
        values (
          v_template.guild_id, v_event_id, v_new_section_id, v_party.name,
          v_party.sort_order, v_actor_id, v_actor_id
        )
        returning id into v_new_party_id;

        insert into public.event_slots (
          guild_id, event_id, party_id, name, role_label, sort_order,
          created_by, updated_by
        )
        select
          v_template.guild_id,
          v_event_id,
          v_new_party_id,
          sl.name,
          sl.role_label,
          sl.sort_order,
          v_actor_id,
          v_actor_id
        from public.event_template_slots sl
        where sl.guild_id = v_template.guild_id
          and sl.template_id = p_template_id
          and sl.party_id = v_party.id
        order by sl.sort_order, sl.id;
      end loop;
    end loop;
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.create_event_from_template(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.create_event_from_template(uuid, text, text)
to authenticated;

comment on function public.create_event_from_template(uuid, text, text) is
  'Atomically creates one Guild Event from an active validated reusable Template and copies the complete hierarchy into fresh Event-owned Area/Section/Party/Slot rows. Requires events.manage.';
