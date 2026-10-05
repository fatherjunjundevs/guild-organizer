-- Phase 4.4A: Atomic Party metadata + seat-count editing.
--
-- Existing Parties can be resized from 1 to 8 seats. Shrinking removes only
-- trailing ordered Slot rows. If a removed Slot has a role requirement, the
-- caller must explicitly confirm that destructive removal. Growing preserves
-- all existing Slot UUIDs/roles and appends new open seats.

create or replace function public.update_event_template_party_layout(
  p_party_id uuid,
  p_name text,
  p_sort_order integer,
  p_seat_count integer,
  p_allow_role_removal boolean default false
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
  v_current_seat_count integer;
  v_removed_role_count integer;
  v_seat_index integer;
begin
  select p.template_id, p.guild_id
  into v_template_id, v_guild_id
  from public.event_template_parties p
  where p.id = p_party_id
  for update;

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
    raise exception 'Party name must be 1 to 80 trimmed characters'
      using errcode = '22023';
  end if;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'sort order must be a nonnegative integer'
      using errcode = '22023';
  end if;

  if p_seat_count is null or p_seat_count not between 1 and 8 then
    raise exception 'Party seat count must be between 1 and 8'
      using errcode = '22023';
  end if;

  perform 1
  from public.event_template_slots s
  where s.guild_id = v_access.guild_id
    and s.template_id = v_template_id
    and s.party_id = p_party_id
  for update;

  select count(*)
  into v_current_seat_count
  from public.event_template_slots s
  where s.guild_id = v_access.guild_id
    and s.template_id = v_template_id
    and s.party_id = p_party_id;

  if v_current_seat_count > p_seat_count then
    with ranked_slots as (
      select
        s.id,
        s.role_label,
        row_number() over (order by s.sort_order, s.id) as seat_rank
      from public.event_template_slots s
      where s.guild_id = v_access.guild_id
        and s.template_id = v_template_id
        and s.party_id = p_party_id
    )
    select count(*)
    into v_removed_role_count
    from ranked_slots
    where seat_rank > p_seat_count
      and role_label is not null;

    if v_removed_role_count > 0
       and not coalesce(p_allow_role_removal, false) then
      raise exception 'seat reduction would remove role requirements'
        using errcode = '23514';
    end if;

    with ranked_slots as (
      select
        s.id,
        row_number() over (order by s.sort_order, s.id) as seat_rank
      from public.event_template_slots s
      where s.guild_id = v_access.guild_id
        and s.template_id = v_template_id
        and s.party_id = p_party_id
    )
    delete from public.event_template_slots s
    using ranked_slots r
    where s.id = r.id
      and r.seat_rank > p_seat_count;
  elsif v_current_seat_count < p_seat_count then
    for v_seat_index in (v_current_seat_count + 1)..p_seat_count loop
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
        format('Seat %s', v_seat_index),
        null,
        v_seat_index - 1,
        v_access.actor_id,
        v_access.actor_id
      );
    end loop;
  end if;

  update public.event_template_parties
  set
    name = p_name,
    sort_order = p_sort_order,
    updated_by = v_access.actor_id
  where id = p_party_id
    and template_id = v_template_id;

  if not found then
    raise exception 'template Party not found'
      using errcode = 'P0002';
  end if;

  perform private.touch_event_template(
    v_template_id,
    v_access.actor_id
  );
end;
$$;

revoke all on function public.update_event_template_party_layout(
  uuid, text, integer, integer, boolean
)
from public, anon, authenticated;

grant execute on function public.update_event_template_party_layout(
  uuid, text, integer, integer, boolean
)
to authenticated;

comment on function public.update_event_template_party_layout(
  uuid, text, integer, integer, boolean
) is
  'Atomically updates one reusable Template Party and resizes it to 1-8 ordered seats, preserving retained Slot UUIDs/roles and requiring explicit confirmation before deleting role-bearing trailing seats.';
