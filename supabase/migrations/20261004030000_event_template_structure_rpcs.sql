-- Phase 4.1B2: Secure Event Template structural mutation RPCs.
--
-- Adds templates.manage-gated CRUD for the optional
-- Area -> Section -> Party -> Slot hierarchy.
-- Direct table writes remain unavailable to application roles.
-- Structural edits are blocked for archived Templates.
-- Every successful structural mutation touches the parent Template audit fields.

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
  set updated_by = p_actor_id
  where id = p_template_id;

  if not found then
    raise exception 'event template not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function private.touch_event_template(uuid, uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Areas
-- ---------------------------------------------------------------------------

create or replace function public.create_event_template_area(
  p_template_id uuid,
  p_name text,
  p_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_area_id uuid;
begin
  select *
  into v_access
  from private.require_event_template_manage(p_template_id, false);

  if not v_access.uses_areas then
    raise exception 'template does not use Areas'
      using errcode = '23514';
  end if;

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Area name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
  end if;

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
    p_template_id,
    p_name,
    p_sort_order,
    v_access.actor_id,
    v_access.actor_id
  )
  returning id into v_area_id;

  perform private.touch_event_template(p_template_id, v_access.actor_id);

  return v_area_id;
end;
$$;

create or replace function public.update_event_template_area(
  p_area_id uuid,
  p_name text,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_access record;
begin
  select a.template_id
  into v_template_id
  from public.event_template_areas a
  where a.id = p_area_id;

  if v_template_id is null then
    raise exception 'template Area not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Area name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
  end if;

  update public.event_template_areas
  set
    name = p_name,
    sort_order = p_sort_order,
    updated_by = v_access.actor_id
  where id = p_area_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Area not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(v_template_id, v_access.actor_id);
end;
$$;

create or replace function public.delete_event_template_area(
  p_area_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_access record;
begin
  select a.template_id
  into v_template_id
  from public.event_template_areas a
  where a.id = p_area_id;

  if v_template_id is null then
    raise exception 'template Area not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  delete from public.event_template_areas
  where id = p_area_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Area not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(v_template_id, v_access.actor_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Sections
-- ---------------------------------------------------------------------------

create or replace function public.create_event_template_section(
  p_template_id uuid,
  p_name text,
  p_area_id uuid default null,
  p_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_section_id uuid;
begin
  select *
  into v_access
  from private.require_event_template_manage(p_template_id, false);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Section name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
  end if;

  if v_access.uses_areas and p_area_id is null then
    raise exception 'Area-based Template Section requires an Area'
      using errcode = '23514';
  end if;

  if not v_access.uses_areas and p_area_id is not null then
    raise exception 'flat Template Section cannot reference an Area'
      using errcode = '23514';
  end if;

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
    p_sort_order,
    v_access.actor_id,
    v_access.actor_id
  )
  returning id into v_section_id;

  perform private.touch_event_template(p_template_id, v_access.actor_id);

  return v_section_id;
end;
$$;

create or replace function public.update_event_template_section(
  p_section_id uuid,
  p_name text,
  p_area_id uuid,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_access record;
begin
  select s.template_id
  into v_template_id
  from public.event_template_sections s
  where s.id = p_section_id;

  if v_template_id is null then
    raise exception 'template Section not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Section name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
  end if;

  if v_access.uses_areas and p_area_id is null then
    raise exception 'Area-based Template Section requires an Area'
      using errcode = '23514';
  end if;

  if not v_access.uses_areas and p_area_id is not null then
    raise exception 'flat Template Section cannot reference an Area'
      using errcode = '23514';
  end if;

  update public.event_template_sections
  set
    area_id = p_area_id,
    name = p_name,
    sort_order = p_sort_order,
    updated_by = v_access.actor_id
  where id = p_section_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Section not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(v_template_id, v_access.actor_id);
end;
$$;

create or replace function public.delete_event_template_section(
  p_section_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_access record;
begin
  select s.template_id
  into v_template_id
  from public.event_template_sections s
  where s.id = p_section_id;

  if v_template_id is null then
    raise exception 'template Section not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  delete from public.event_template_sections
  where id = p_section_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Section not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(v_template_id, v_access.actor_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Parties
-- ---------------------------------------------------------------------------

create or replace function public.create_event_template_party(
  p_section_id uuid,
  p_name text,
  p_sort_order integer default 0
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
begin
  select s.template_id, s.guild_id
  into v_template_id, v_guild_id
  from public.event_template_sections s
  where s.id = p_section_id;

  if v_template_id is null then
    raise exception 'template Section not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  if v_guild_id <> v_access.guild_id then
    raise exception 'template Section scope changed'
      using errcode = '55000';
  end if;

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Party name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
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
    p_name,
    p_sort_order,
    v_access.actor_id,
    v_access.actor_id
  )
  returning id into v_party_id;

  perform private.touch_event_template(v_template_id, v_access.actor_id);

  return v_party_id;
end;
$$;

create or replace function public.update_event_template_party(
  p_party_id uuid,
  p_section_id uuid,
  p_name text,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_access record;
begin
  select p.template_id
  into v_template_id
  from public.event_template_parties p
  where p.id = p_party_id;

  if v_template_id is null then
    raise exception 'template Party not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Party name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
  end if;

  update public.event_template_parties
  set
    section_id = p_section_id,
    name = p_name,
    sort_order = p_sort_order,
    updated_by = v_access.actor_id
  where id = p_party_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Party not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(v_template_id, v_access.actor_id);
end;
$$;

create or replace function public.delete_event_template_party(
  p_party_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_access record;
begin
  select p.template_id
  into v_template_id
  from public.event_template_parties p
  where p.id = p_party_id;

  if v_template_id is null then
    raise exception 'template Party not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  delete from public.event_template_parties
  where id = p_party_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Party not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(v_template_id, v_access.actor_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Slots
-- ---------------------------------------------------------------------------

create or replace function public.create_event_template_slot(
  p_party_id uuid,
  p_name text,
  p_role_label text default null,
  p_sort_order integer default 0
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
  v_slot_id uuid;
  v_role_label text := nullif(btrim(p_role_label), '');
begin
  select p.template_id, p.guild_id
  into v_template_id, v_guild_id
  from public.event_template_parties p
  where p.id = p_party_id;

  if v_template_id is null then
    raise exception 'template Party not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  if v_guild_id <> v_access.guild_id then
    raise exception 'template Party scope changed'
      using errcode = '55000';
  end if;

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Slot name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if v_role_label is not null and char_length(v_role_label) > 80 then
    raise exception 'Slot role label must be at most 80 characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
  end if;

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
    p_party_id,
    p_name,
    v_role_label,
    p_sort_order,
    v_access.actor_id,
    v_access.actor_id
  )
  returning id into v_slot_id;

  perform private.touch_event_template(v_template_id, v_access.actor_id);

  return v_slot_id;
end;
$$;

create or replace function public.update_event_template_slot(
  p_slot_id uuid,
  p_party_id uuid,
  p_name text,
  p_role_label text,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_access record;
  v_role_label text := nullif(btrim(p_role_label), '');
begin
  select s.template_id
  into v_template_id
  from public.event_template_slots s
  where s.id = p_slot_id;

  if v_template_id is null then
    raise exception 'template Slot not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 80 then
    raise exception 'Slot name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if v_role_label is not null and char_length(v_role_label) > 80 then
    raise exception 'Slot role label must be at most 80 characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
  end if;

  update public.event_template_slots
  set
    party_id = p_party_id,
    name = p_name,
    role_label = v_role_label,
    sort_order = p_sort_order,
    updated_by = v_access.actor_id
  where id = p_slot_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Slot not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(v_template_id, v_access.actor_id);
end;
$$;

create or replace function public.delete_event_template_slot(
  p_slot_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template_id uuid;
  v_access record;
begin
  select s.template_id
  into v_template_id
  from public.event_template_slots s
  where s.id = p_slot_id;

  if v_template_id is null then
    raise exception 'template Slot not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_access
  from private.require_event_template_manage(v_template_id, false);

  delete from public.event_template_slots
  where id = p_slot_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Slot not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(v_template_id, v_access.actor_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC privilege surface
-- ---------------------------------------------------------------------------

revoke all on function public.create_event_template_area(uuid, text, integer)
from public, anon, authenticated;
revoke all on function public.update_event_template_area(uuid, text, integer)
from public, anon, authenticated;
revoke all on function public.delete_event_template_area(uuid)
from public, anon, authenticated;

revoke all on function public.create_event_template_section(uuid, text, uuid, integer)
from public, anon, authenticated;
revoke all on function public.update_event_template_section(uuid, text, uuid, integer)
from public, anon, authenticated;
revoke all on function public.delete_event_template_section(uuid)
from public, anon, authenticated;

revoke all on function public.create_event_template_party(uuid, text, integer)
from public, anon, authenticated;
revoke all on function public.update_event_template_party(uuid, uuid, text, integer)
from public, anon, authenticated;
revoke all on function public.delete_event_template_party(uuid)
from public, anon, authenticated;

revoke all on function public.create_event_template_slot(uuid, text, text, integer)
from public, anon, authenticated;
revoke all on function public.update_event_template_slot(uuid, uuid, text, text, integer)
from public, anon, authenticated;
revoke all on function public.delete_event_template_slot(uuid)
from public, anon, authenticated;

grant execute on function public.create_event_template_area(uuid, text, integer)
to authenticated;
grant execute on function public.update_event_template_area(uuid, text, integer)
to authenticated;
grant execute on function public.delete_event_template_area(uuid)
to authenticated;

grant execute on function public.create_event_template_section(uuid, text, uuid, integer)
to authenticated;
grant execute on function public.update_event_template_section(uuid, text, uuid, integer)
to authenticated;
grant execute on function public.delete_event_template_section(uuid)
to authenticated;

grant execute on function public.create_event_template_party(uuid, text, integer)
to authenticated;
grant execute on function public.update_event_template_party(uuid, uuid, text, integer)
to authenticated;
grant execute on function public.delete_event_template_party(uuid)
to authenticated;

grant execute on function public.create_event_template_slot(uuid, text, text, integer)
to authenticated;
grant execute on function public.update_event_template_slot(uuid, uuid, text, text, integer)
to authenticated;
grant execute on function public.delete_event_template_slot(uuid)
to authenticated;

comment on function public.create_event_template_area(uuid, text, integer) is
  'Creates an optional top-level Area in a reusable Template after templates.manage authorization.';
comment on function public.create_event_template_section(uuid, text, uuid, integer) is
  'Creates a Section in a reusable Template, respecting flat versus Area-based structure.';
comment on function public.create_event_template_party(uuid, text, integer) is
  'Creates a Party inside a reusable Template Section after templates.manage authorization.';
comment on function public.create_event_template_slot(uuid, text, text, integer) is
  'Creates one reusable Template seat. Slot row count is the Party seat-count source of truth.';
