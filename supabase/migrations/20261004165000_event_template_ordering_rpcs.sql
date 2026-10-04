-- Phase 4.2B2: atomic Team / Party ordering.
--
-- Ordering is persisted as normalized zero-based sort_order values. Reorder
-- RPCs require the caller to submit the complete sibling set exactly once, so
-- stale, partial, duplicate, or cross-parent payloads cannot silently corrupt
-- Template ordering.

create or replace function public.reorder_event_template_teams(
  p_template_id uuid,
  p_area_id uuid,
  p_ordered_section_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_expected_count integer;
begin
  select *
  into v_access
  from private.require_event_template_manage(p_template_id, false);

  if p_ordered_section_ids is null
     or cardinality(p_ordered_section_ids) < 1
     or array_position(p_ordered_section_ids, null) is not null then
    raise exception 'ordered Team ids must be a non-empty uuid array'
      using errcode = '22023';
  end if;

  if (
    select count(distinct id)
    from unnest(p_ordered_section_ids) as submitted(id)
  ) <> cardinality(p_ordered_section_ids) then
    raise exception 'ordered Team ids must not contain duplicates'
      using errcode = '22023';
  end if;

  if v_access.uses_areas and p_area_id is null then
    raise exception 'Area-based Template Team ordering requires an Area'
      using errcode = '23514';
  end if;

  if not v_access.uses_areas and p_area_id is not null then
    raise exception 'flat Template Team ordering cannot reference an Area'
      using errcode = '23514';
  end if;

  if p_area_id is not null
     and not exists (
       select 1
       from public.event_template_areas a
       where a.id = p_area_id
         and a.guild_id = v_access.guild_id
         and a.template_id = p_template_id
     ) then
    raise exception 'template Area not found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.event_template_sections s
  where s.guild_id = v_access.guild_id
    and s.template_id = p_template_id
    and (
      (p_area_id is null and s.area_id is null)
      or s.area_id = p_area_id
    )
  for update;

  select count(*)
  into v_expected_count
  from public.event_template_sections s
  where s.guild_id = v_access.guild_id
    and s.template_id = p_template_id
    and (
      (p_area_id is null and s.area_id is null)
      or s.area_id = p_area_id
    );

  if cardinality(p_ordered_section_ids) <> v_expected_count
     or exists (
       (
         select s.id
         from public.event_template_sections s
         where s.guild_id = v_access.guild_id
           and s.template_id = p_template_id
           and (
             (p_area_id is null and s.area_id is null)
             or s.area_id = p_area_id
           )
       )
       except
       (
         select submitted.id
         from unnest(p_ordered_section_ids) as submitted(id)
       )
     )
     or exists (
       (
         select submitted.id
         from unnest(p_ordered_section_ids) as submitted(id)
       )
       except
       (
         select s.id
         from public.event_template_sections s
         where s.guild_id = v_access.guild_id
           and s.template_id = p_template_id
           and (
             (p_area_id is null and s.area_id is null)
             or s.area_id = p_area_id
           )
       )
     ) then
    raise exception 'ordered Team ids must exactly match the current sibling Teams'
      using errcode = '22023';
  end if;

  update public.event_template_sections s
  set
    sort_order = (ordered.ordinality - 1)::integer,
    updated_by = v_access.actor_id
  from unnest(p_ordered_section_ids)
    with ordinality as ordered(id, ordinality)
  where s.id = ordered.id
    and s.guild_id = v_access.guild_id
    and s.template_id = p_template_id;

  perform private.touch_event_template(
    p_template_id,
    v_access.actor_id
  );
end;
$$;

create or replace function public.reorder_event_template_parties(
  p_section_id uuid,
  p_ordered_party_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_guild_id uuid;
  v_access record;
  v_expected_count integer;
begin
  select s.template_id, s.guild_id
  into v_template_id, v_guild_id
  from public.event_template_sections s
  where s.id = p_section_id;

  if v_template_id is null then
    raise exception 'template Team not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  if v_guild_id <> v_access.guild_id then
    raise exception 'template Team scope changed'
      using errcode = '55000';
  end if;

  if p_ordered_party_ids is null
     or cardinality(p_ordered_party_ids) < 1
     or array_position(p_ordered_party_ids, null) is not null then
    raise exception 'ordered Party ids must be a non-empty uuid array'
      using errcode = '22023';
  end if;

  if (
    select count(distinct id)
    from unnest(p_ordered_party_ids) as submitted(id)
  ) <> cardinality(p_ordered_party_ids) then
    raise exception 'ordered Party ids must not contain duplicates'
      using errcode = '22023';
  end if;

  perform 1
  from public.event_template_parties p
  where p.guild_id = v_access.guild_id
    and p.template_id = v_template_id
    and p.section_id = p_section_id
  for update;

  select count(*)
  into v_expected_count
  from public.event_template_parties p
  where p.guild_id = v_access.guild_id
    and p.template_id = v_template_id
    and p.section_id = p_section_id;

  if cardinality(p_ordered_party_ids) <> v_expected_count
     or exists (
       (
         select p.id
         from public.event_template_parties p
         where p.guild_id = v_access.guild_id
           and p.template_id = v_template_id
           and p.section_id = p_section_id
       )
       except
       (
         select submitted.id
         from unnest(p_ordered_party_ids) as submitted(id)
       )
     )
     or exists (
       (
         select submitted.id
         from unnest(p_ordered_party_ids) as submitted(id)
       )
       except
       (
         select p.id
         from public.event_template_parties p
         where p.guild_id = v_access.guild_id
           and p.template_id = v_template_id
           and p.section_id = p_section_id
       )
     ) then
    raise exception 'ordered Party ids must exactly match the current Team Parties'
      using errcode = '22023';
  end if;

  update public.event_template_parties p
  set
    sort_order = (ordered.ordinality - 1)::integer,
    updated_by = v_access.actor_id
  from unnest(p_ordered_party_ids)
    with ordinality as ordered(id, ordinality)
  where p.id = ordered.id
    and p.guild_id = v_access.guild_id
    and p.template_id = v_template_id
    and p.section_id = p_section_id;

  perform private.touch_event_template(
    v_template_id,
    v_access.actor_id
  );
end;
$$;

revoke all on function public.reorder_event_template_teams(
  uuid, uuid, uuid[]
)
from public, anon, authenticated;

revoke all on function public.reorder_event_template_parties(
  uuid, uuid[]
)
from public, anon, authenticated;

grant execute on function public.reorder_event_template_teams(
  uuid, uuid, uuid[]
)
to authenticated;

grant execute on function public.reorder_event_template_parties(
  uuid, uuid[]
)
to authenticated;

comment on function public.reorder_event_template_teams(
  uuid, uuid, uuid[]
) is
  'Atomically normalizes the complete sibling Team order within one root Template or Area. Requires templates.manage.';

comment on function public.reorder_event_template_parties(
  uuid, uuid[]
) is
  'Atomically normalizes the complete Party order within one Team. Requires templates.manage.';
