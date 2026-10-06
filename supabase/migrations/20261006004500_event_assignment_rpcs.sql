-- Phase 5.3A: Event assignment mutation + Event Builder roster read surface.
--
-- events.manage organizers need a narrow roster surface for Event building even
-- when they do not also hold roster.manage. This migration intentionally does
-- NOT broaden direct Master Roster RLS. Instead, a SECURITY DEFINER RPC returns
-- only the Character fields required by the Event Builder.
--
-- Active Characters are eligible for new draft assignments. Inactive
-- Characters are returned only when they are already assigned to the Event so
-- historical draft references remain visible instead of silently disappearing.
--
-- One Character may occupy multiple Slots in a draft Event. This remains
-- intentional so duplicate assignments are representable and can be surfaced
-- by the warning engine in the next checkpoint.

create or replace function private.require_event_slot_manage(
  p_slot_id uuid
)
returns table (
  guild_id uuid,
  event_id uuid,
  actor_id uuid,
  event_status text
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_event_id uuid;
  v_event_status text;
  v_actor_id uuid;
begin
  select s.guild_id, s.event_id, e.status
  into v_guild_id, v_event_id, v_event_status
  from public.event_slots s
  join public.events e
    on e.guild_id = s.guild_id
   and e.id = s.event_id
  where s.id = p_slot_id
  for update of s, e;

  if v_guild_id is null then
    raise exception 'Event Slot not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_events_manage(v_guild_id);

  if v_event_status <> 'active' then
    raise exception 'archived Events cannot change assignments'
      using errcode = '55000';
  end if;

  return query
  select v_guild_id, v_event_id, v_actor_id, v_event_status;
end;
$$;

revoke all on function private.require_event_slot_manage(uuid)
from public, anon, authenticated;

create or replace function public.get_event_builder_characters(
  p_event_id uuid
)
returns table (
  character_id uuid,
  ign text,
  level integer,
  class_name text,
  guild_position text,
  gear_score bigint,
  online_status text,
  designation text,
  role_label text,
  character_status text,
  assigned_slot_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
begin
  select e.guild_id
  into v_guild_id
  from public.events e
  where e.id = p_event_id;

  if v_guild_id is null then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  perform private.require_events_manage(v_guild_id);

  return query
  select
    c.id,
    c.ign,
    c.level,
    c.class_name,
    c.guild_position,
    c.gear_score,
    c.online_status,
    rp.designation,
    rp.role_label,
    c.status,
    coalesce(
      array_agg(a.slot_id order by a.slot_id)
        filter (where a.id is not null),
      '{}'::uuid[]
    ) as assigned_slot_ids
  from public.characters c
  left join public.character_roster_profiles rp
    on rp.guild_id = c.guild_id
   and rp.character_id = c.id
  left join public.event_assignments a
    on a.guild_id = c.guild_id
   and a.character_id = c.id
   and a.event_id = p_event_id
  where c.guild_id = v_guild_id
  group by
    c.id,
    c.ign,
    c.level,
    c.class_name,
    c.guild_position,
    c.gear_score,
    c.online_status,
    rp.designation,
    rp.role_label,
    c.status
  having c.status = 'active' or count(a.id) > 0
  order by
    (c.status = 'active') desc,
    lower(c.ign),
    c.ign,
    c.id;
end;
$$;

revoke all on function public.get_event_builder_characters(uuid)
from public, anon, authenticated;
grant execute on function public.get_event_builder_characters(uuid)
to authenticated;

create or replace function public.assign_event_slot(
  p_slot_id uuid,
  p_character_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_character_status text;
  v_assignment_id uuid;
begin
  select *
  into v_access
  from private.require_event_slot_manage(p_slot_id);

  select c.status
  into v_character_status
  from public.characters c
  where c.guild_id = v_access.guild_id
    and c.id = p_character_id;

  if v_character_status is null then
    raise exception 'eligible Character not found for Event'
      using errcode = 'P0002';
  end if;

  if v_character_status <> 'active' then
    raise exception 'only active Guild Characters are eligible for new assignments'
      using errcode = '23514';
  end if;

  insert into public.event_assignments (
    guild_id,
    event_id,
    slot_id,
    character_id,
    created_by,
    updated_by
  )
  values (
    v_access.guild_id,
    v_access.event_id,
    p_slot_id,
    p_character_id,
    v_access.actor_id,
    v_access.actor_id
  )
  on conflict (guild_id, event_id, slot_id)
  do update
  set
    character_id = excluded.character_id,
    updated_by = excluded.updated_by
  returning id into v_assignment_id;

  update public.events
  set updated_by = v_access.actor_id
  where guild_id = v_access.guild_id
    and id = v_access.event_id;

  return v_assignment_id;
end;
$$;

revoke all on function public.assign_event_slot(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.assign_event_slot(uuid, uuid)
to authenticated;

create or replace function public.clear_event_slot(
  p_slot_id uuid
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
  from private.require_event_slot_manage(p_slot_id);

  delete from public.event_assignments
  where guild_id = v_access.guild_id
    and event_id = v_access.event_id
    and slot_id = p_slot_id;

  update public.events
  set updated_by = v_access.actor_id
  where guild_id = v_access.guild_id
    and id = v_access.event_id;
end;
$$;

revoke all on function public.clear_event_slot(uuid)
from public, anon, authenticated;
grant execute on function public.clear_event_slot(uuid)
to authenticated;

comment on function public.get_event_builder_characters(uuid) is
  'Returns the minimum Character roster needed by an events.manage Event Builder. Active Characters are eligible; inactive Characters are included only while already assigned to preserve visible draft references.';

comment on function public.assign_event_slot(uuid, uuid) is
  'Assigns or replaces one active Guild Character in one active Event Slot. The same Character may intentionally occupy multiple draft Slots for later duplicate-warning detection.';

comment on function public.clear_event_slot(uuid) is
  'Clears the current draft assignment from one Slot in an active Event.';
