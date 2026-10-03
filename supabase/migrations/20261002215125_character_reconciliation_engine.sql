-- Phase 3.6B1: Explicit transactional Character reconciliation engine.
--
-- Reconciliation is an organizer-confirmed identity operation. The database
-- never infers a rename from IGN similarity. The source Character remains as
-- preserved history while organizer-owned metadata moves safely to the chosen
-- canonical target Character.
--
-- Current organizer-owned references covered by this migration:
--   character_roster_profiles
--   character_roster_tags
--   character_roster_custom_field_values
--
-- Historical import/reconciliation rows are intentionally not rewritten.

-- ---------------------------------------------------------------------------
-- Reconciled historical Characters are immutable through ordinary roster RPCs.
-- Import engines receive their own reconciliation guards in Phase 3.6B2.
-- ---------------------------------------------------------------------------

create or replace function private.require_roster_character(
  p_character_id uuid
)
returns table (
  guild_id uuid,
  actor_id uuid
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_actor_id uuid;
  v_reconciled_into_character_id uuid;
begin
  select
    c.guild_id,
    c.reconciled_into_character_id
  into
    v_guild_id,
    v_reconciled_into_character_id
  from public.characters c
  where c.id = p_character_id
  for update;

  if v_guild_id is null then
    raise exception 'character not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_roster_manage(v_guild_id);

  if v_reconciled_into_character_id is not null then
    raise exception 'reconciled historical character cannot be modified'
      using errcode = '55000';
  end if;

  return query
  select v_guild_id, v_actor_id;
end;
$$;

revoke all on function private.require_roster_character(uuid)
from public, anon, authenticated;

comment on function private.require_roster_character(uuid) is
  'Authorizes roster.manage access, locks the Character row for mutation serialization, and rejects historical Characters already reconciled into a canonical identity.';

-- ---------------------------------------------------------------------------
-- Explicit reconciliation
-- ---------------------------------------------------------------------------

create or replace function public.reconcile_roster_character(
  p_source_character_id uuid,
  p_target_character_id uuid,
  p_note text default null,
  p_triggering_sync_run_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source public.characters%rowtype;
  v_target public.characters%rowtype;
  v_source_guild_id uuid;
  v_target_guild_id uuid;
  v_actor_id uuid;
  v_reconciliation_id uuid;
  v_reconciled_at timestamptz := now();
  v_note text := nullif(btrim(p_note), '');
begin
  if p_source_character_id is null
     or p_target_character_id is null then
    raise exception 'source and target Character identifiers are required'
      using errcode = '22023';
  end if;

  if p_source_character_id = p_target_character_id then
    raise exception 'a Character cannot be reconciled into itself'
      using errcode = '22023';
  end if;

  select c.guild_id
  into v_source_guild_id
  from public.characters c
  where c.id = p_source_character_id;

  if v_source_guild_id is null then
    raise exception 'source character not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_roster_manage(v_source_guild_id);

  select c.guild_id
  into v_target_guild_id
  from public.characters c
  where c.id = p_target_character_id;

  if v_target_guild_id is null
     or v_target_guild_id <> v_source_guild_id then
    raise exception 'target Character must belong to the same Guild'
      using errcode = '42501';
  end if;

  -- Lock both Character rows in deterministic UUID order before evaluating
  -- mutable reconciliation state. This keeps opposite concurrent attempts from
  -- acquiring the two Character locks in conflicting orders.
  perform c.id
  from public.characters c
  where c.guild_id = v_source_guild_id
    and c.id in (p_source_character_id, p_target_character_id)
  order by c.id
  for update;

  select c.*
  into v_source
  from public.characters c
  where c.guild_id = v_source_guild_id
    and c.id = p_source_character_id;

  select c.*
  into v_target
  from public.characters c
  where c.guild_id = v_source_guild_id
    and c.id = p_target_character_id;

  if v_source.reconciled_into_character_id is not null then
    raise exception 'source Character is already reconciled'
      using errcode = '55000';
  end if;

  if v_target.reconciled_into_character_id is not null then
    raise exception 'target Character is already reconciled'
      using errcode = '55000';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'reconciliation note cannot exceed 500 characters'
      using errcode = '22023';
  end if;

  if p_triggering_sync_run_id is not null
     and not exists (
       select 1
       from public.roster_sync_runs r
       where r.guild_id = v_source_guild_id
         and r.id = p_triggering_sync_run_id
     ) then
    raise exception 'triggering import run must belong to the same Guild'
      using errcode = '22023';
  end if;

  -- Never guess how to resolve conflicting organizer-owned profile metadata.
  -- An organizer must resolve the conflict first, then retry reconciliation.
  if exists (
    select 1
    from public.character_roster_profiles source_profile
    join public.character_roster_profiles target_profile
      on target_profile.guild_id = source_profile.guild_id
     and target_profile.character_id = p_target_character_id
    where source_profile.guild_id = v_source_guild_id
      and source_profile.character_id = p_source_character_id
      and (
        (
          source_profile.designation is not null
          and target_profile.designation is not null
          and source_profile.designation
            is distinct from target_profile.designation
        )
        or
        (
          source_profile.role_label is not null
          and target_profile.role_label is not null
          and source_profile.role_label
            is distinct from target_profile.role_label
        )
      )
  ) then
    raise exception 'organizer profile conflict must be resolved before reconciliation'
      using errcode = '22023';
  end if;

  -- Custom-field values are also organizer-owned. Equal values are safe;
  -- differing values require explicit organizer resolution.
  if exists (
    select 1
    from public.character_roster_custom_field_values source_value
    join public.character_roster_custom_field_values target_value
      on target_value.guild_id = source_value.guild_id
     and target_value.character_id = p_target_character_id
     and target_value.field_id = source_value.field_id
    where source_value.guild_id = v_source_guild_id
      and source_value.character_id = p_source_character_id
      and source_value.value is distinct from target_value.value
  ) then
    raise exception 'custom field conflict must be resolved before reconciliation'
      using errcode = '22023';
  end if;

  -- Merge organizer profile values into missing target slots. Existing equal
  -- target values remain authoritative and are not rewritten.
  insert into public.character_roster_profiles (
    guild_id,
    character_id,
    designation,
    role_label,
    created_by
  )
  select
    source_profile.guild_id,
    p_target_character_id,
    source_profile.designation,
    source_profile.role_label,
    source_profile.created_by
  from public.character_roster_profiles source_profile
  where source_profile.guild_id = v_source_guild_id
    and source_profile.character_id = p_source_character_id
    and (
      source_profile.designation is not null
      or source_profile.role_label is not null
    )
  on conflict (guild_id, character_id)
  do update set
    designation = coalesce(
      public.character_roster_profiles.designation,
      excluded.designation
    ),
    role_label = coalesce(
      public.character_roster_profiles.role_label,
      excluded.role_label
    )
  where
    (
      public.character_roster_profiles.designation is null
      and excluded.designation is not null
    )
    or
    (
      public.character_roster_profiles.role_label is null
      and excluded.role_label is not null
    );

  delete from public.character_roster_profiles
  where guild_id = v_source_guild_id
    and character_id = p_source_character_id;

  -- Tags merge as a set. Existing target assignments win duplicate conflicts.
  insert into public.character_roster_tags (
    guild_id,
    character_id,
    tag_id,
    created_by,
    created_at
  )
  select
    source_tag.guild_id,
    p_target_character_id,
    source_tag.tag_id,
    source_tag.created_by,
    source_tag.created_at
  from public.character_roster_tags source_tag
  where source_tag.guild_id = v_source_guild_id
    and source_tag.character_id = p_source_character_id
  on conflict (guild_id, character_id, tag_id)
  do nothing;

  delete from public.character_roster_tags
  where guild_id = v_source_guild_id
    and character_id = p_source_character_id;

  -- Conflicting custom values were rejected above, so missing values can move
  -- to the target and equal duplicates can remain untouched.
  insert into public.character_roster_custom_field_values (
    guild_id,
    character_id,
    field_id,
    value,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  select
    source_value.guild_id,
    p_target_character_id,
    source_value.field_id,
    source_value.value,
    source_value.created_by,
    source_value.updated_by,
    source_value.created_at,
    source_value.updated_at
  from public.character_roster_custom_field_values source_value
  where source_value.guild_id = v_source_guild_id
    and source_value.character_id = p_source_character_id
  on conflict (guild_id, character_id, field_id)
  do nothing;

  delete from public.character_roster_custom_field_values
  where guild_id = v_source_guild_id
    and character_id = p_source_character_id;

  -- Flatten any existing historical aliases that already resolved to the
  -- source. This avoids reconciliation chains in current Character state while
  -- leaving append-only reconciliation audit rows untouched.
  update public.characters
  set reconciled_into_character_id = p_target_character_id
  where guild_id = v_source_guild_id
    and reconciled_into_character_id = p_source_character_id;

  -- Preserve the source Character row and its game/current field snapshots.
  update public.characters
  set
    status = 'inactive',
    inactive_reason = 'reconciled',
    left_guild_at = null,
    reconciled_into_character_id = p_target_character_id,
    reconciled_at = v_reconciled_at,
    reconciled_by = v_actor_id
  where guild_id = v_source_guild_id
    and id = p_source_character_id;

  insert into public.character_reconciliations (
    guild_id,
    source_character_id,
    target_character_id,
    source_ign_snapshot,
    target_ign_snapshot,
    triggering_sync_run_id,
    note,
    reconciled_by,
    reconciled_at
  )
  values (
    v_source_guild_id,
    p_source_character_id,
    p_target_character_id,
    v_source.ign,
    v_target.ign,
    p_triggering_sync_run_id,
    v_note,
    v_actor_id,
    v_reconciled_at
  )
  returning id into v_reconciliation_id;

  return v_reconciliation_id;
end;
$$;

revoke all on function public.reconcile_roster_character(
  uuid, uuid, text, uuid
) from public, anon, authenticated;

grant execute on function public.reconcile_roster_character(
  uuid, uuid, text, uuid
) to authenticated;

comment on function public.reconcile_roster_character(
  uuid, uuid, text, uuid
) is
  'Explicitly reconciles one independent Guild Character into another after roster.manage authorization. Preserves both Character UUIDs, rejects organizer-metadata conflicts, moves safe organizer metadata, flattens current reconciliation pointers, and records immutable audit history.';

-- ---------------------------------------------------------------------------
-- Phase 3.6B1 follow-up: serialize bulk mutations with reconciliation.
-- ---------------------------------------------------------------------------

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

  -- Lock every selected Character in deterministic UUID order so a bulk
  -- organizer mutation cannot race an explicit reconciliation.
  perform c.id
  from public.characters c
  where c.guild_id = v_guild_id
    and c.id = any(p_character_ids)
  order by c.id
  for update;

  select count(distinct c.id)
  into v_found_count
  from public.characters c
  where c.guild_id = v_guild_id
    and c.id = any(p_character_ids);

  if v_found_count <> v_requested_count then
    raise exception 'all selected characters must belong to one authorized Guild'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.characters c
    where c.guild_id = v_guild_id
      and c.id = any(p_character_ids)
      and c.reconciled_into_character_id is not null
  ) then
    raise exception 'reconciled historical characters cannot be modified'
      using errcode = '55000';
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
  'Transactionally applies one organizer-owned bulk action to mutable Characters only, locking selected rows in deterministic order and rejecting reconciled historical identities.';
