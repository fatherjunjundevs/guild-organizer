-- Phase 4.3B1: Atomic reusable Template cloning.
--
-- Clones Template metadata plus the complete Area -> Team -> Party -> Slot
-- hierarchy into a new independent draft Template. The clone receives fresh
-- identifiers and audit metadata while preserving names, ordering, Area mode,
-- and seat role requirements. Source Templates may be draft, active, or
-- archived; the destination Event Type must be active and belong to the same
-- Guild. Mutation authority remains templates.manage only.

create or replace function public.clone_event_template(
  p_source_template_id uuid,
  p_event_type_id uuid,
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_source record;
  v_description text := nullif(btrim(p_description), '');
  v_template_id uuid;
  v_area record;
  v_section record;
  v_party record;
  v_new_area_id uuid;
  v_new_section_id uuid;
  v_new_party_id uuid;
begin
  select *
  into v_access
  from private.require_event_template_manage(p_source_template_id, true);

  select
    t.guild_id,
    t.uses_areas
  into v_source
  from public.event_templates t
  where t.id = p_source_template_id
    and t.guild_id = v_access.guild_id;

  if not found then
    raise exception 'source event template not found'
      using errcode = 'P0002';
  end if;

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

  if not exists (
    select 1
    from public.event_types et
    where et.guild_id = v_access.guild_id
      and et.id = p_event_type_id
      and et.status = 'active'
  ) then
    raise exception 'active destination Event Type must belong to the same Guild'
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
    v_access.guild_id,
    p_event_type_id,
    p_name,
    v_description,
    v_source.uses_areas,
    'draft',
    v_access.actor_id,
    v_access.actor_id
  )
  returning id into v_template_id;

  if v_source.uses_areas then
    for v_area in
      select a.id, a.name, a.sort_order
      from public.event_template_areas a
      where a.guild_id = v_access.guild_id
        and a.template_id = p_source_template_id
      order by a.sort_order, a.id
    loop
      insert into public.event_template_areas (
        guild_id,
        template_id,
        name,
        sort_order,
        created_by,
        updated_by
      )
      values (
        v_access.guild_id,
        v_template_id,
        v_area.name,
        v_area.sort_order,
        v_access.actor_id,
        v_access.actor_id
      )
      returning id into v_new_area_id;

      for v_section in
        select s.id, s.name, s.sort_order
        from public.event_template_sections s
        where s.guild_id = v_access.guild_id
          and s.template_id = p_source_template_id
          and s.area_id = v_area.id
        order by s.sort_order, s.id
      loop
        insert into public.event_template_sections (
          guild_id,
          template_id,
          area_id,
          name,
          sort_order,
          created_by,
          updated_by
        )
        values (
          v_access.guild_id,
          v_template_id,
          v_new_area_id,
          v_section.name,
          v_section.sort_order,
          v_access.actor_id,
          v_access.actor_id
        )
        returning id into v_new_section_id;

        for v_party in
          select p.id, p.name, p.sort_order
          from public.event_template_parties p
          where p.guild_id = v_access.guild_id
            and p.template_id = p_source_template_id
            and p.section_id = v_section.id
          order by p.sort_order, p.id
        loop
          insert into public.event_template_parties (
            guild_id,
            template_id,
            section_id,
            name,
            sort_order,
            created_by,
            updated_by
          )
          values (
            v_access.guild_id,
            v_template_id,
            v_new_section_id,
            v_party.name,
            v_party.sort_order,
            v_access.actor_id,
            v_access.actor_id
          )
          returning id into v_new_party_id;

          insert into public.event_template_slots (
            guild_id,
            template_id,
            party_id,
            name,
            role_label,
            sort_order,
            created_by,
            updated_by
          )
          select
            v_access.guild_id,
            v_template_id,
            v_new_party_id,
            sl.name,
            sl.role_label,
            sl.sort_order,
            v_access.actor_id,
            v_access.actor_id
          from public.event_template_slots sl
          where sl.guild_id = v_access.guild_id
            and sl.template_id = p_source_template_id
            and sl.party_id = v_party.id
          order by sl.sort_order, sl.id;
        end loop;
      end loop;
    end loop;
  else
    for v_section in
      select s.id, s.name, s.sort_order
      from public.event_template_sections s
      where s.guild_id = v_access.guild_id
        and s.template_id = p_source_template_id
        and s.area_id is null
      order by s.sort_order, s.id
    loop
      insert into public.event_template_sections (
        guild_id,
        template_id,
        area_id,
        name,
        sort_order,
        created_by,
        updated_by
      )
      values (
        v_access.guild_id,
        v_template_id,
        null,
        v_section.name,
        v_section.sort_order,
        v_access.actor_id,
        v_access.actor_id
      )
      returning id into v_new_section_id;

      for v_party in
        select p.id, p.name, p.sort_order
        from public.event_template_parties p
        where p.guild_id = v_access.guild_id
          and p.template_id = p_source_template_id
          and p.section_id = v_section.id
        order by p.sort_order, p.id
      loop
        insert into public.event_template_parties (
          guild_id,
          template_id,
          section_id,
          name,
          sort_order,
          created_by,
          updated_by
        )
        values (
          v_access.guild_id,
          v_template_id,
          v_new_section_id,
          v_party.name,
          v_party.sort_order,
          v_access.actor_id,
          v_access.actor_id
        )
        returning id into v_new_party_id;

        insert into public.event_template_slots (
          guild_id,
          template_id,
          party_id,
          name,
          role_label,
          sort_order,
          created_by,
          updated_by
        )
        select
          v_access.guild_id,
          v_template_id,
          v_new_party_id,
          sl.name,
          sl.role_label,
          sl.sort_order,
          v_access.actor_id,
          v_access.actor_id
        from public.event_template_slots sl
        where sl.guild_id = v_access.guild_id
          and sl.template_id = p_source_template_id
          and sl.party_id = v_party.id
        order by sl.sort_order, sl.id;
      end loop;
    end loop;
  end if;

  return v_template_id;
end;
$$;

revoke all on function public.clone_event_template(uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.clone_event_template(uuid, uuid, text, text)
to authenticated;

comment on function public.clone_event_template(uuid, uuid, text, text) is
  'Atomically clones one reusable Template and its complete hierarchy into a new independent draft Template after templates.manage authorization.';
