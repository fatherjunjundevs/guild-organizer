-- Phase 3.1B: Secure Master Roster mutation RPCs.
-- Direct table writes remain unavailable to application roles.
-- All roster mutations are capability-gated through SECURITY DEFINER RPCs.

-- ---------------------------------------------------------------------------
-- Authorization helper
-- ---------------------------------------------------------------------------

create or replace function private.require_roster_manage(
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

  if not private.has_guild_capability(
    p_guild_id,
    'roster.manage'
  ) then
    raise exception 'roster.manage authority required'
      using errcode = '42501';
  end if;

  return v_actor_id;
end;
$$;

revoke all on function private.require_roster_manage(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared character lookup / authorization helper
-- ---------------------------------------------------------------------------

create or replace function private.require_roster_character(
  p_character_id uuid
)
returns table (
  guild_id uuid,
  actor_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_actor_id uuid;
begin
  select c.guild_id
  into v_guild_id
  from public.characters c
  where c.id = p_character_id;

  if v_guild_id is null then
    raise exception 'character not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_roster_manage(v_guild_id);

  return query
  select v_guild_id, v_actor_id;
end;
$$;

revoke all on function private.require_roster_character(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a manual roster character.
--
-- This is for organizer-managed entry. RTNW import/sync will be a separate RPC
-- surface and will remain authoritative for current game-exported roster data.
-- ---------------------------------------------------------------------------

create or replace function public.create_roster_character(
  p_guild_id uuid,
  p_ign text,
  p_level integer default null,
  p_class_name text default null,
  p_title text default null,
  p_gender text default null,
  p_guild_position text default null,
  p_gear_score bigint default null,
  p_weekly_activity bigint default null,
  p_weekly_contribution bigint default null,
  p_total_contribution bigint default null,
  p_online_status text default null,
  p_designation text default null,
  p_role_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_character_id uuid;
begin
  v_actor_id := private.require_roster_manage(p_guild_id);

  if p_ign is null
     or char_length(btrim(p_ign)) = 0
     or p_ign is distinct from btrim(p_ign) then
    raise exception 'IGN must be non-empty and cannot have surrounding whitespace'
      using errcode = '22023';
  end if;

  insert into public.characters (
    guild_id,
    ign,
    level,
    class_name,
    title,
    gender,
    guild_position,
    gear_score,
    weekly_activity,
    weekly_contribution,
    total_contribution,
    online_status,
    source_origin,
    created_by
  )
  values (
    p_guild_id,
    p_ign,
    p_level,
    nullif(p_class_name, ''),
    nullif(p_title, ''),
    nullif(p_gender, ''),
    nullif(p_guild_position, ''),
    p_gear_score,
    p_weekly_activity,
    p_weekly_contribution,
    p_total_contribution,
    nullif(p_online_status, ''),
    'manual',
    v_actor_id
  )
  returning id into v_character_id;

  if p_designation is not null or p_role_label is not null then
    insert into public.character_roster_profiles (
      guild_id,
      character_id,
      designation,
      role_label,
      created_by
    )
    values (
      p_guild_id,
      v_character_id,
      p_designation,
      nullif(p_role_label, ''),
      v_actor_id
    );
  end if;

  return v_character_id;
end;
$$;

revoke all on function public.create_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text, text, text
) from public, anon, authenticated;

grant execute on function public.create_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Update current roster character fields.
--
-- Source provenance and RTNW first/last seen timestamps are intentionally not
-- editable here. A later RTNW sync RPC owns those fields.
-- ---------------------------------------------------------------------------

create or replace function public.update_roster_character(
  p_character_id uuid,
  p_ign text,
  p_level integer,
  p_class_name text,
  p_title text,
  p_gender text,
  p_guild_position text,
  p_gear_score bigint,
  p_weekly_activity bigint,
  p_weekly_contribution bigint,
  p_total_contribution bigint,
  p_online_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.require_roster_character(p_character_id);

  if p_ign is null
     or char_length(btrim(p_ign)) = 0
     or p_ign is distinct from btrim(p_ign) then
    raise exception 'IGN must be non-empty and cannot have surrounding whitespace'
      using errcode = '22023';
  end if;

  update public.characters
  set
    ign = p_ign,
    level = p_level,
    class_name = nullif(p_class_name, ''),
    title = nullif(p_title, ''),
    gender = nullif(p_gender, ''),
    guild_position = nullif(p_guild_position, ''),
    gear_score = p_gear_score,
    weekly_activity = p_weekly_activity,
    weekly_contribution = p_weekly_contribution,
    total_contribution = p_total_contribution,
    online_status = nullif(p_online_status, '')
  where id = p_character_id;
end;
$$;

revoke all on function public.update_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text
) from public, anon, authenticated;

grant execute on function public.update_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Manual lifecycle.
--
-- This does not hard-delete characters. "left_guild" remains reserved for the
-- RTNW sync engine when a character is absent from a confirmed current export.
-- ---------------------------------------------------------------------------

create or replace function public.set_character_manual_status(
  p_character_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.require_roster_character(p_character_id);

  if p_status not in ('active', 'inactive') then
    raise exception 'invalid character status'
      using errcode = '22023';
  end if;

  if p_status = 'active' then
    update public.characters
    set
      status = 'active',
      inactive_reason = null,
      left_guild_at = null
    where id = p_character_id;
  else
    update public.characters
    set
      status = 'inactive',
      inactive_reason = 'manual',
      left_guild_at = null
    where id = p_character_id;
  end if;
end;
$$;

revoke all on function public.set_character_manual_status(uuid, text)
from public, anon, authenticated;

grant execute on function public.set_character_manual_status(uuid, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Organizer-maintained metadata.
--
-- Passing both values as NULL clears the separate organizer profile row.
-- RTNW syncs will never touch this table.
-- ---------------------------------------------------------------------------

create or replace function public.set_character_roster_profile(
  p_character_id uuid,
  p_designation text,
  p_role_label text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_role_label text := nullif(p_role_label, '');
begin
  select *
  into v_access
  from private.require_roster_character(p_character_id);

  if p_designation is not null
     and p_designation not in ('main', 'sub') then
    raise exception 'designation must be main, sub, or null'
      using errcode = '22023';
  end if;

  if v_role_label is not null
     and (
       char_length(btrim(v_role_label)) = 0
       or char_length(btrim(v_role_label)) > 80
     ) then
    raise exception 'role label must be between 1 and 80 characters'
      using errcode = '22023';
  end if;

  if p_designation is null and v_role_label is null then
    delete from public.character_roster_profiles
    where guild_id = v_access.guild_id
      and character_id = p_character_id;

    return;
  end if;

  insert into public.character_roster_profiles (
    guild_id,
    character_id,
    designation,
    role_label,
    created_by
  )
  values (
    v_access.guild_id,
    p_character_id,
    p_designation,
    v_role_label,
    v_access.actor_id
  )
  on conflict (guild_id, character_id)
  do update set
    designation = excluded.designation,
    role_label = excluded.role_label;
end;
$$;

revoke all on function public.set_character_roster_profile(
  uuid, text, text
) from public, anon, authenticated;

grant execute on function public.set_character_roster_profile(
  uuid, text, text
) to authenticated;

comment on function public.create_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text, text, text
) is
  'Creates one manually managed Guild character after roster.manage authorization.';

comment on function public.update_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text
) is
  'Updates current character fields without changing RTNW sync provenance or seen timestamps.';

comment on function public.set_character_manual_status(uuid, text) is
  'Marks a character active or manually inactive without hard deletion; left_guild is reserved for RTNW sync.';

comment on function public.set_character_roster_profile(uuid, text, text) is
  'Upserts or clears organizer-maintained main/sub and role metadata, separate from RTNW-exported fields.';
