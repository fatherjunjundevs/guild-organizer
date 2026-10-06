-- Phase 5.3B: Atomic drag/drop movement for Event assignments.
--
-- Moving an assignment between Slots is a single database transaction:
--   open target     -> move
--   occupied target -> swap
--   same Character already in target -> no-op
--
-- Draft duplicate Character assignments remain representable by design.

create or replace function public.move_event_slot_assignment(
  p_source_slot_id uuid,
  p_target_slot_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_event_id uuid;
  v_event_status text;
  v_actor_id uuid;

  v_target_guild_id uuid;
  v_target_event_id uuid;

  v_source_assignment_id uuid;
  v_source_character_id uuid;

  v_target_assignment_id uuid;
  v_target_character_id uuid;
begin
  if p_source_slot_id is null
     or p_target_slot_id is null
     or p_source_slot_id = p_target_slot_id then
    raise exception 'source and target Event Slots must be different'
      using errcode = '22023';
  end if;

  select s.guild_id, s.event_id, e.status
  into v_guild_id, v_event_id, v_event_status
  from public.event_slots s
  join public.events e
    on e.guild_id = s.guild_id
   and e.id = s.event_id
  where s.id = p_source_slot_id
  for update of s, e;

  if v_guild_id is null then
    raise exception 'source Event Slot not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_events_manage(v_guild_id);

  if v_event_status <> 'active' then
    raise exception 'archived Events cannot change assignments'
      using errcode = '55000';
  end if;

  select s.guild_id, s.event_id
  into v_target_guild_id, v_target_event_id
  from public.event_slots s
  where s.id = p_target_slot_id
  for update;

  if v_target_guild_id is null then
    raise exception 'target Event Slot not found'
      using errcode = 'P0002';
  end if;

  if v_target_guild_id <> v_guild_id
     or v_target_event_id <> v_event_id then
    raise exception 'source and target Slots must belong to the same Event'
      using errcode = '23514';
  end if;

  select a.id, a.character_id
  into v_source_assignment_id, v_source_character_id
  from public.event_assignments a
  where a.guild_id = v_guild_id
    and a.event_id = v_event_id
    and a.slot_id = p_source_slot_id
  for update;

  if v_source_assignment_id is null then
    raise exception 'source Slot has no Character assignment'
      using errcode = 'P0002';
  end if;

  select a.id, a.character_id
  into v_target_assignment_id, v_target_character_id
  from public.event_assignments a
  where a.guild_id = v_guild_id
    and a.event_id = v_event_id
    and a.slot_id = p_target_slot_id
  for update;

  if v_target_assignment_id is null then
    update public.event_assignments
    set
      slot_id = p_target_slot_id,
      updated_by = v_actor_id
    where id = v_source_assignment_id;

    update public.events
    set updated_by = v_actor_id
    where guild_id = v_guild_id
      and id = v_event_id;

    return 'moved';
  end if;

  if v_target_character_id = v_source_character_id then
    return 'same_character';
  end if;

  delete from public.event_assignments
  where id = v_target_assignment_id;

  update public.event_assignments
  set
    slot_id = p_target_slot_id,
    updated_by = v_actor_id
  where id = v_source_assignment_id;

  insert into public.event_assignments (
    guild_id,
    event_id,
    slot_id,
    character_id,
    created_by,
    updated_by
  )
  values (
    v_guild_id,
    v_event_id,
    p_source_slot_id,
    v_target_character_id,
    v_actor_id,
    v_actor_id
  );

  update public.events
  set updated_by = v_actor_id
  where guild_id = v_guild_id
    and id = v_event_id;

  return 'swapped';
end;
$$;

revoke all on function public.move_event_slot_assignment(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.move_event_slot_assignment(uuid, uuid)
to authenticated;

comment on function public.move_event_slot_assignment(uuid, uuid) is
  'Atomically moves one draft Event assignment to an open Slot or swaps two occupied Slots. Requires events.manage and an active Event.';
