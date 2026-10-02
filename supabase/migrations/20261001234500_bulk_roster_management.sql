-- Phase 3.3C: Transactional bulk organizer roster management.
--
-- Bulk actions are intentionally restricted to organizer-owned fields and
-- manual lifecycle state. RTNW-owned game fields are never part of this RPC.

create or replace function public.bulk_update_roster_characters(
  p_character_ids uuid[],
  p_action text,
  p_value text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_actor_id uuid;
  v_requested_count integer;
  v_found_count integer;
  v_value text := nullif(btrim(p_value), '');
begin
  if p_character_ids is null
     or cardinality(p_character_ids) = 0
     or cardinality(p_character_ids) > 500
     or array_position(p_character_ids, null) is not null then
    raise exception 'select between 1 and 500 characters'
      using errcode = '22023';
  end if;

  select count(distinct character_id)
  into v_requested_count
  from unnest(p_character_ids) as character_id;

  select c.guild_id
  into v_guild_id
  from public.characters c
  where c.id = p_character_ids[1];

  if v_guild_id is null then
    raise exception 'character not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_roster_manage(v_guild_id);

  select count(distinct c.id)
  into v_found_count
  from public.characters c
  where c.guild_id = v_guild_id
    and c.id = any(p_character_ids);

  if v_found_count <> v_requested_count then
    raise exception 'all selected characters must belong to one authorized Guild'
      using errcode = '42501';
  end if;

  if p_action = 'status' then
    if p_value not in ('active', 'inactive') then
      raise exception 'invalid character status'
        using errcode = '22023';
    end if;

    if p_value = 'active' then
      update public.characters
      set
        status = 'active',
        inactive_reason = null,
        left_guild_at = null
      where guild_id = v_guild_id
        and id = any(p_character_ids);
    else
      update public.characters
      set
        status = 'inactive',
        inactive_reason = 'manual',
        left_guild_at = null
      where guild_id = v_guild_id
        and id = any(p_character_ids);
    end if;

    return v_requested_count;
  end if;

  if p_action = 'designation' then
    if v_value is not null
       and v_value not in ('main', 'sub') then
      raise exception 'designation must be main, sub, or null'
        using errcode = '22023';
    end if;

    if v_value is null then
      update public.character_roster_profiles
      set designation = null
      where guild_id = v_guild_id
        and character_id = any(p_character_ids);

      delete from public.character_roster_profiles
      where guild_id = v_guild_id
        and character_id = any(p_character_ids)
        and designation is null
        and role_label is null;
    else
      insert into public.character_roster_profiles (
        guild_id,
        character_id,
        designation,
        role_label,
        created_by
      )
      select
        v_guild_id,
        c.id,
        v_value,
        null,
        v_actor_id
      from public.characters c
      where c.guild_id = v_guild_id
        and c.id = any(p_character_ids)
      on conflict (guild_id, character_id)
      do update set designation = excluded.designation;
    end if;

    return v_requested_count;
  end if;

  if p_action = 'role_label' then
    if v_value is not null
       and char_length(v_value) > 80 then
      raise exception 'role label must be 80 characters or fewer'
        using errcode = '22023';
    end if;

    if v_value is null then
      update public.character_roster_profiles
      set role_label = null
      where guild_id = v_guild_id
        and character_id = any(p_character_ids);

      delete from public.character_roster_profiles
      where guild_id = v_guild_id
        and character_id = any(p_character_ids)
        and designation is null
        and role_label is null;
    else
      insert into public.character_roster_profiles (
        guild_id,
        character_id,
        designation,
        role_label,
        created_by
      )
      select
        v_guild_id,
        c.id,
        null,
        v_value,
        v_actor_id
      from public.characters c
      where c.guild_id = v_guild_id
        and c.id = any(p_character_ids)
      on conflict (guild_id, character_id)
      do update set role_label = excluded.role_label;
    end if;

    return v_requested_count;
  end if;

  raise exception 'invalid bulk roster action'
    using errcode = '22023';
end;
$$;

revoke all on function public.bulk_update_roster_characters(
  uuid[], text, text
) from public, anon, authenticated;

grant execute on function public.bulk_update_roster_characters(
  uuid[], text, text
) to authenticated;

comment on function public.bulk_update_roster_characters(
  uuid[], text, text
) is
  'Transactionally applies one organizer-owned bulk action (designation, role_label, or manual status) to up to 500 characters in one authorized Guild.';
