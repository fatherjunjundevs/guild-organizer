-- Phase 4.2B1: Team-board convenience RPCs.
--
-- The generic reusable Template hierarchy remains:
--   optional Area -> Section -> Party -> Slot
--
-- The Team Board UX maps Section -> Team and uses these transactional helpers
-- to create the common RTNW layout efficiently:
--   Team -> up to 8 Parties -> 5 seats per Party by default.
--
-- Slot rows remain the seat-count source of truth. Party/Seat display names
-- created here are internal ordering labels; the Team Board UI does not require
-- organizers to type or display seat numbers.

create or replace function public.create_event_template_team(
  p_template_id uuid,
  p_name text,
  p_area_id uuid default null,
  p_party_count integer default 8,
  p_seat_count integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_section_id uuid;
  v_party_id uuid;
  v_team_sort_order integer;
  v_party_index integer;
  v_seat_index integer;
begin
  select *
  into v_access
  from private.require_event_template_manage(p_template_id, false);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Team name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if p_party_count is null or p_party_count not between 1 and 8 then
    raise exception 'Team party count must be between 1 and 8'
      using errcode = '22023';
  end if;

  if p_seat_count is null or p_seat_count not between 1 and 8 then
    raise exception 'Party seat count must be between 1 and 8'
      using errcode = '22023';
  end if;

  if v_access.uses_areas and p_area_id is null then
    raise exception 'Area-based Template Team requires an Area'
      using errcode = '23514';
  end if;

  if not v_access.uses_areas and p_area_id is not null then
    raise exception 'flat Template Team cannot reference an Area'
      using errcode = '23514';
  end if;

  select coalesce(max(s.sort_order) + 1, 0)
  into v_team_sort_order
  from public.event_template_sections s
  where s.guild_id = v_access.guild_id
    and s.template_id = p_template_id
    and (
      (p_area_id is null and s.area_id is null)
      or s.area_id = p_area_id
    );

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
    p_template_id,
    p_area_id,
    p_name,
    v_team_sort_order,
    v_access.actor_id,
    v_access.actor_id
  )
  returning id into v_section_id;

  for v_party_index in 1..p_party_count loop
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
      p_template_id,
      v_section_id,
      format('Party %s', v_party_index),
      v_party_index - 1,
      v_access.actor_id,
      v_access.actor_id
    )
    returning id into v_party_id;

    for v_seat_index in 1..p_seat_count loop
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
      values (
        v_access.guild_id,
        p_template_id,
        v_party_id,
        format('Seat %s', v_seat_index),
        null,
        v_seat_index - 1,
        v_access.actor_id,
        v_access.actor_id
      );
    end loop;
  end loop;

  perform private.touch_event_template(
    p_template_id,
    v_access.actor_id
  );

  return v_section_id;
end;
$$;

create or replace function public.create_event_template_party_with_slots(
  p_section_id uuid,
  p_seat_count integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_guild_id uuid;
  v_access record;
  v_party_id uuid;
  v_party_count integer;
  v_party_sort_order integer;
  v_party_number integer;
  v_candidate integer;
  v_seat_index integer;
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

  if p_seat_count is null or p_seat_count not between 1 and 8 then
    raise exception 'Party seat count must be between 1 and 8'
      using errcode = '22023';
  end if;

  select count(*), coalesce(max(p.sort_order) + 1, 0)
  into v_party_count, v_party_sort_order
  from public.event_template_parties p
  where p.guild_id = v_access.guild_id
    and p.template_id = v_template_id
    and p.section_id = p_section_id;

  if v_party_count >= 8 then
    raise exception 'Team already has the maximum of 8 Parties'
      using errcode = '23514';
  end if;

  v_party_number := null;

  for v_candidate in 1..8 loop
    if not exists (
      select 1
      from public.event_template_parties p
      where p.guild_id = v_access.guild_id
        and p.template_id = v_template_id
        and p.section_id = p_section_id
        and lower(p.name) = lower(format('Party %s', v_candidate))
    ) then
      v_party_number := v_candidate;
      exit;
    end if;
  end loop;

  if v_party_number is null then
    v_party_number := v_party_count + 1;
  end if;

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
    p_section_id,
    format('Party %s', v_party_number),
    v_party_sort_order,
    v_access.actor_id,
    v_access.actor_id
  )
  returning id into v_party_id;

  for v_seat_index in 1..p_seat_count loop
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
    values (
      v_access.guild_id,
      v_template_id,
      v_party_id,
      format('Seat %s', v_seat_index),
      null,
      v_seat_index - 1,
      v_access.actor_id,
      v_access.actor_id
    );
  end loop;

  perform private.touch_event_template(
    v_template_id,
    v_access.actor_id
  );

  return v_party_id;
end;
$$;

revoke all on function public.create_event_template_team(
  uuid, text, uuid, integer, integer
)
from public, anon, authenticated;

revoke all on function public.create_event_template_party_with_slots(
  uuid, integer
)
from public, anon, authenticated;

grant execute on function public.create_event_template_team(
  uuid, text, uuid, integer, integer
)
to authenticated;

grant execute on function public.create_event_template_party_with_slots(
  uuid, integer
)
to authenticated;

comment on function public.create_event_template_team(
  uuid, text, uuid, integer, integer
) is
  'Transactionally creates one Team (stored as a Template Section), up to 8 Parties, and ordered Slot rows. Default Team Board layout is 8 Parties with 5 seats each.';

comment on function public.create_event_template_party_with_slots(
  uuid, integer
) is
  'Transactionally adds one Party to a Team with ordered Slot rows, enforcing the Team Board maximum of 8 Parties. Default seat count is 5.';
