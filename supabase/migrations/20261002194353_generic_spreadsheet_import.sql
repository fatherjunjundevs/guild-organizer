-- Phase 3.5B: Generic spreadsheet roster import engine.
--
-- Generic spreadsheets are intentionally NOT authoritative Guild snapshots.
-- Only explicitly mapped fields are updated. Characters omitted from a generic
-- spreadsheet are not marked Left Guild, and matching inactive characters are
-- not automatically reactivated.
--
-- Identity remains the exact Guild-scoped IGN. No rename guessing occurs.

-- ---------------------------------------------------------------------------
-- Import history source
-- ---------------------------------------------------------------------------

alter table public.roster_sync_runs
  drop constraint roster_sync_runs_source_type_valid;

alter table public.roster_sync_runs
  add constraint roster_sync_runs_source_type_valid
  check (source_type in ('rtnw_csv', 'generic_spreadsheet'));

-- ---------------------------------------------------------------------------
-- Generic payload validation
--
-- p_mapped_fields controls the mutable columns for the whole import.
-- "ign" is always required as identity and is not included in mapped_fields.
-- A mapped field must be present on every row; JSON null means intentionally
-- clear that field. Unmapped keys are rejected rather than silently applied.
-- ---------------------------------------------------------------------------

create or replace function private.validate_generic_roster_payload(
  p_rows jsonb,
  p_mapped_fields text[]
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_allowed_fields constant text[] := array[
    'level',
    'class_name',
    'title',
    'gender',
    'guild_position',
    'gear_score',
    'weekly_activity',
    'weekly_contribution',
    'total_contribution',
    'online_status',
    'designation',
    'role_label'
  ];
  v_row jsonb;
  v_field text;
  v_value jsonb;
  v_text text;
  v_max_length integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'generic roster payload must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) < 1 then
    raise exception 'generic roster payload cannot be empty'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'generic roster payload exceeds 1000 rows'
      using errcode = '22023';
  end if;

  if p_mapped_fields is null then
    raise exception 'mapped fields must be provided'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_mapped_fields) as mapped(field_name)
    where mapped.field_name is null
      or not (mapped.field_name = any(v_allowed_fields))
  ) then
    raise exception 'mapped fields contain an unsupported roster field'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from unnest(p_mapped_fields) as mapped(field_name)
  ) <> (
    select count(distinct mapped.field_name)
    from unnest(p_mapped_fields) as mapped(field_name)
  ) then
    raise exception 'mapped fields contain duplicates'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as item(value)
    where jsonb_typeof(item.value) <> 'object'
  ) then
    raise exception 'every generic roster row must be a JSON object'
      using errcode = '22023';
  end if;

  for v_row in
    select item.value
    from jsonb_array_elements(p_rows) as item(value)
  loop
    if not (v_row ? 'ign')
       or jsonb_typeof(v_row -> 'ign') <> 'string'
       or char_length(v_row ->> 'ign') < 1
       or char_length(v_row ->> 'ign') > 80
       or (v_row ->> 'ign') is distinct from btrim(v_row ->> 'ign') then
      raise exception 'every generic roster row requires a valid exact IGN'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_row) as keys(key_name)
      where keys.key_name <> 'ign'
        and not (keys.key_name = any(p_mapped_fields))
    ) then
      raise exception 'generic roster row contains an unmapped field'
        using errcode = '22023';
    end if;

    foreach v_field in array p_mapped_fields
    loop
      if not (v_row ? v_field) then
        raise exception 'every mapped field must be present on every generic roster row'
          using errcode = '22023';
      end if;

      v_value := v_row -> v_field;

      if v_value = 'null'::jsonb then
        continue;
      end if;

      if v_field in (
        'level',
        'gear_score',
        'weekly_activity',
        'weekly_contribution',
        'total_contribution'
      ) then
        if jsonb_typeof(v_value) <> 'number'
           or v_value::text !~ '^[0-9]+$' then
          raise exception 'generic numeric fields must be nonnegative whole numbers or null'
            using errcode = '22023';
        end if;

        if v_field = 'level'
           and (v_value::text)::numeric > 2147483647 then
          raise exception 'generic level value is too large'
            using errcode = '22023';
        end if;

        if v_field <> 'level'
           and (v_value::text)::numeric > 9223372036854775807 then
          raise exception 'generic numeric value is too large'
            using errcode = '22023';
        end if;

        continue;
      end if;

      if v_field = 'designation' then
        v_text := v_row ->> v_field;

        if jsonb_typeof(v_value) <> 'string'
           or v_text not in ('main', 'sub') then
          raise exception 'designation must be main, sub, or null'
            using errcode = '22023';
        end if;

        continue;
      end if;

      if jsonb_typeof(v_value) <> 'string' then
        raise exception 'generic text fields must be strings or null'
          using errcode = '22023';
      end if;

      v_text := v_row ->> v_field;

      if v_text is distinct from btrim(v_text)
         or char_length(v_text) < 1 then
        raise exception 'generic text fields must contain trimmed nonempty text or null'
          using errcode = '22023';
      end if;

      v_max_length := case v_field
        when 'class_name' then 80
        when 'title' then 120
        when 'gender' then 40
        when 'guild_position' then 80
        when 'online_status' then 120
        when 'role_label' then 80
        else null
      end;

      if v_max_length is null
         or char_length(v_text) > v_max_length then
        raise exception 'generic text field exceeds its allowed length'
          using errcode = '22023';
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from (
      select item.value ->> 'ign' as ign
      from jsonb_array_elements(p_rows) as item(value)
      group by item.value ->> 'ign'
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'generic roster payload contains duplicate exact IGNs'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_generic_roster_payload(
  jsonb, text[]
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Preview
-- ---------------------------------------------------------------------------

create or replace function public.preview_generic_roster_import(
  p_guild_id uuid,
  p_rows jsonb,
  p_mapped_fields text[]
)
returns table (
  change_kind text,
  character_id uuid,
  ign text,
  changed_fields text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.require_import_manage(p_guild_id);
  perform private.validate_generic_roster_payload(
    p_rows,
    p_mapped_fields
  );

  return query
  with incoming as (
    select
      item.value ->> 'ign' as ign,
      item.value as row_data
    from jsonb_array_elements(p_rows) as item(value)
  ),
  evaluated as (
    select
      c.id as character_id,
      i.ign,
      case
        when c.id is null then p_mapped_fields
        else array_remove(
          array[
            case
              when 'level' = any(p_mapped_fields)
               and c.level is distinct from
                 (i.row_data ->> 'level')::integer
              then 'level'
            end,
            case
              when 'class_name' = any(p_mapped_fields)
               and c.class_name is distinct from
                 (i.row_data ->> 'class_name')
              then 'class_name'
            end,
            case
              when 'title' = any(p_mapped_fields)
               and c.title is distinct from
                 (i.row_data ->> 'title')
              then 'title'
            end,
            case
              when 'gender' = any(p_mapped_fields)
               and c.gender is distinct from
                 (i.row_data ->> 'gender')
              then 'gender'
            end,
            case
              when 'guild_position' = any(p_mapped_fields)
               and c.guild_position is distinct from
                 (i.row_data ->> 'guild_position')
              then 'guild_position'
            end,
            case
              when 'gear_score' = any(p_mapped_fields)
               and c.gear_score is distinct from
                 (i.row_data ->> 'gear_score')::bigint
              then 'gear_score'
            end,
            case
              when 'weekly_activity' = any(p_mapped_fields)
               and c.weekly_activity is distinct from
                 (i.row_data ->> 'weekly_activity')::bigint
              then 'weekly_activity'
            end,
            case
              when 'weekly_contribution' = any(p_mapped_fields)
               and c.weekly_contribution is distinct from
                 (i.row_data ->> 'weekly_contribution')::bigint
              then 'weekly_contribution'
            end,
            case
              when 'total_contribution' = any(p_mapped_fields)
               and c.total_contribution is distinct from
                 (i.row_data ->> 'total_contribution')::bigint
              then 'total_contribution'
            end,
            case
              when 'online_status' = any(p_mapped_fields)
               and c.online_status is distinct from
                 (i.row_data ->> 'online_status')
              then 'online_status'
            end,
            case
              when 'designation' = any(p_mapped_fields)
               and p.designation is distinct from
                 (i.row_data ->> 'designation')
              then 'designation'
            end,
            case
              when 'role_label' = any(p_mapped_fields)
               and p.role_label is distinct from
                 (i.row_data ->> 'role_label')
              then 'role_label'
            end
          ]::text[],
          null
        )
      end as changed_fields
    from incoming i
    left join public.characters c
      on c.guild_id = p_guild_id
     and c.ign = i.ign
    left join public.character_roster_profiles p
      on p.guild_id = p_guild_id
     and p.character_id = c.id
  )
  select
    case
      when evaluated.character_id is null then 'new'
      when cardinality(evaluated.changed_fields) > 0 then 'update'
      else 'unchanged'
    end as change_kind,
    evaluated.character_id,
    evaluated.ign,
    evaluated.changed_fields
  from evaluated
  order by
    case
      when evaluated.character_id is null then 1
      when cardinality(evaluated.changed_fields) > 0 then 2
      else 3
    end,
    evaluated.ign;
end;
$$;

revoke all on function public.preview_generic_roster_import(
  uuid, jsonb, text[]
) from public, anon, authenticated;

grant execute on function public.preview_generic_roster_import(
  uuid, jsonb, text[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- Apply
-- ---------------------------------------------------------------------------

create or replace function public.apply_generic_roster_import(
  p_guild_id uuid,
  p_rows jsonb,
  p_mapped_fields text[],
  p_source_filename text,
  p_source_sha256 text
)
returns table (
  sync_run_id uuid,
  source_row_count integer,
  created_count integer,
  updated_count integer,
  unchanged_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_import_at timestamptz := now();
  v_sync_run_id uuid;
  v_source_row_count integer;
  v_created_count integer;
  v_updated_count integer;
  v_unchanged_count integer;
begin
  v_actor_id := private.require_import_manage(p_guild_id);
  perform private.validate_generic_roster_payload(
    p_rows,
    p_mapped_fields
  );

  if p_source_filename is null
     or char_length(btrim(p_source_filename)) < 1
     or char_length(btrim(p_source_filename)) > 255
     or p_source_filename is distinct from btrim(p_source_filename) then
    raise exception 'source filename must be between 1 and 255 trimmed characters'
      using errcode = '22023';
  end if;

  if p_source_sha256 is null
     or p_source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'source SHA-256 must be lowercase hexadecimal'
      using errcode = '22023';
  end if;

  v_source_row_count := jsonb_array_length(p_rows);

  select
    count(*) filter (where preview.change_kind = 'new')::integer,
    count(*) filter (where preview.change_kind = 'update')::integer,
    count(*) filter (where preview.change_kind = 'unchanged')::integer
  into
    v_created_count,
    v_updated_count,
    v_unchanged_count
  from public.preview_generic_roster_import(
    p_guild_id,
    p_rows,
    p_mapped_fields
  ) as preview;

  -- Existing rows: update only mapped game/current fields that actually differ.
  with incoming as (
    select
      item.value ->> 'ign' as ign,
      item.value as row_data
    from jsonb_array_elements(p_rows) as item(value)
  )
  update public.characters c
  set
    level = case
      when 'level' = any(p_mapped_fields)
      then (i.row_data ->> 'level')::integer
      else c.level
    end,
    class_name = case
      when 'class_name' = any(p_mapped_fields)
      then i.row_data ->> 'class_name'
      else c.class_name
    end,
    title = case
      when 'title' = any(p_mapped_fields)
      then i.row_data ->> 'title'
      else c.title
    end,
    gender = case
      when 'gender' = any(p_mapped_fields)
      then i.row_data ->> 'gender'
      else c.gender
    end,
    guild_position = case
      when 'guild_position' = any(p_mapped_fields)
      then i.row_data ->> 'guild_position'
      else c.guild_position
    end,
    gear_score = case
      when 'gear_score' = any(p_mapped_fields)
      then (i.row_data ->> 'gear_score')::bigint
      else c.gear_score
    end,
    weekly_activity = case
      when 'weekly_activity' = any(p_mapped_fields)
      then (i.row_data ->> 'weekly_activity')::bigint
      else c.weekly_activity
    end,
    weekly_contribution = case
      when 'weekly_contribution' = any(p_mapped_fields)
      then (i.row_data ->> 'weekly_contribution')::bigint
      else c.weekly_contribution
    end,
    total_contribution = case
      when 'total_contribution' = any(p_mapped_fields)
      then (i.row_data ->> 'total_contribution')::bigint
      else c.total_contribution
    end,
    online_status = case
      when 'online_status' = any(p_mapped_fields)
      then i.row_data ->> 'online_status'
      else c.online_status
    end
  from incoming i
  where c.guild_id = p_guild_id
    and c.ign = i.ign
    and (
      (
        'level' = any(p_mapped_fields)
        and c.level is distinct from
          (i.row_data ->> 'level')::integer
      )
      or (
        'class_name' = any(p_mapped_fields)
        and c.class_name is distinct from
          (i.row_data ->> 'class_name')
      )
      or (
        'title' = any(p_mapped_fields)
        and c.title is distinct from
          (i.row_data ->> 'title')
      )
      or (
        'gender' = any(p_mapped_fields)
        and c.gender is distinct from
          (i.row_data ->> 'gender')
      )
      or (
        'guild_position' = any(p_mapped_fields)
        and c.guild_position is distinct from
          (i.row_data ->> 'guild_position')
      )
      or (
        'gear_score' = any(p_mapped_fields)
        and c.gear_score is distinct from
          (i.row_data ->> 'gear_score')::bigint
      )
      or (
        'weekly_activity' = any(p_mapped_fields)
        and c.weekly_activity is distinct from
          (i.row_data ->> 'weekly_activity')::bigint
      )
      or (
        'weekly_contribution' = any(p_mapped_fields)
        and c.weekly_contribution is distinct from
          (i.row_data ->> 'weekly_contribution')::bigint
      )
      or (
        'total_contribution' = any(p_mapped_fields)
        and c.total_contribution is distinct from
          (i.row_data ->> 'total_contribution')::bigint
      )
      or (
        'online_status' = any(p_mapped_fields)
        and c.online_status is distinct from
          (i.row_data ->> 'online_status')
      )
    );

  -- Missing exact IGNs become new non-RTNW/manual-origin characters.
  with incoming as (
    select
      item.value ->> 'ign' as ign,
      item.value as row_data
    from jsonb_array_elements(p_rows) as item(value)
  )
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
    status,
    inactive_reason,
    left_guild_at,
    source_origin,
    rtnw_first_seen_at,
    rtnw_last_seen_at,
    created_by
  )
  select
    p_guild_id,
    i.ign,
    case
      when 'level' = any(p_mapped_fields)
      then (i.row_data ->> 'level')::integer
      else null
    end,
    case
      when 'class_name' = any(p_mapped_fields)
      then i.row_data ->> 'class_name'
      else null
    end,
    case
      when 'title' = any(p_mapped_fields)
      then i.row_data ->> 'title'
      else null
    end,
    case
      when 'gender' = any(p_mapped_fields)
      then i.row_data ->> 'gender'
      else null
    end,
    case
      when 'guild_position' = any(p_mapped_fields)
      then i.row_data ->> 'guild_position'
      else null
    end,
    case
      when 'gear_score' = any(p_mapped_fields)
      then (i.row_data ->> 'gear_score')::bigint
      else null
    end,
    case
      when 'weekly_activity' = any(p_mapped_fields)
      then (i.row_data ->> 'weekly_activity')::bigint
      else null
    end,
    case
      when 'weekly_contribution' = any(p_mapped_fields)
      then (i.row_data ->> 'weekly_contribution')::bigint
      else null
    end,
    case
      when 'total_contribution' = any(p_mapped_fields)
      then (i.row_data ->> 'total_contribution')::bigint
      else null
    end,
    case
      when 'online_status' = any(p_mapped_fields)
      then i.row_data ->> 'online_status'
      else null
    end,
    'active',
    null,
    null,
    'manual',
    null,
    null,
    v_actor_id
  from incoming i
  where not exists (
    select 1
    from public.characters c
    where c.guild_id = p_guild_id
      and c.ign = i.ign
  )
  on conflict (guild_id, ign) do nothing;

  -- Organizer profile fields are changed only when explicitly mapped.
  with incoming as (
    select
      item.value ->> 'ign' as ign,
      item.value as row_data
    from jsonb_array_elements(p_rows) as item(value)
  ),
  profile_rows as (
    select
      c.id as character_id,
      p.character_id is not null as profile_exists,
      case
        when 'designation' = any(p_mapped_fields)
        then i.row_data ->> 'designation'
        else null
      end as designation,
      case
        when 'role_label' = any(p_mapped_fields)
        then i.row_data ->> 'role_label'
        else null
      end as role_label
    from incoming i
    join public.characters c
      on c.guild_id = p_guild_id
     and c.ign = i.ign
    left join public.character_roster_profiles p
      on p.guild_id = p_guild_id
     and p.character_id = c.id
    where
      'designation' = any(p_mapped_fields)
      or 'role_label' = any(p_mapped_fields)
  )
  insert into public.character_roster_profiles (
    guild_id,
    character_id,
    designation,
    role_label,
    created_by
  )
  select
    p_guild_id,
    profile_rows.character_id,
    profile_rows.designation,
    profile_rows.role_label,
    v_actor_id
  from profile_rows
  where profile_rows.profile_exists
     or profile_rows.designation is not null
     or profile_rows.role_label is not null
  on conflict (guild_id, character_id)
  do update set
    designation = case
      when 'designation' = any(p_mapped_fields)
      then excluded.designation
      else public.character_roster_profiles.designation
    end,
    role_label = case
      when 'role_label' = any(p_mapped_fields)
      then excluded.role_label
      else public.character_roster_profiles.role_label
    end
  where
    (
      'designation' = any(p_mapped_fields)
      and public.character_roster_profiles.designation
        is distinct from excluded.designation
    )
    or (
      'role_label' = any(p_mapped_fields)
      and public.character_roster_profiles.role_label
        is distinct from excluded.role_label
    );

  insert into public.roster_sync_runs (
    guild_id,
    source_type,
    source_filename,
    source_sha256,
    source_row_count,
    created_count,
    updated_count,
    reactivated_count,
    left_guild_count,
    unchanged_count,
    imported_by,
    applied_at
  )
  values (
    p_guild_id,
    'generic_spreadsheet',
    p_source_filename,
    p_source_sha256,
    v_source_row_count,
    v_created_count,
    v_updated_count,
    0,
    0,
    v_unchanged_count,
    v_actor_id,
    v_import_at
  )
  returning id into v_sync_run_id;

  return query
  select
    v_sync_run_id,
    v_source_row_count,
    v_created_count,
    v_updated_count,
    v_unchanged_count;
end;
$$;

revoke all on function public.apply_generic_roster_import(
  uuid, jsonb, text[], text, text
) from public, anon, authenticated;

grant execute on function public.apply_generic_roster_import(
  uuid, jsonb, text[], text, text
) to authenticated;

comment on table public.roster_sync_runs is
  'Applied roster import history for official RTNW CSV syncs and generic spreadsheet imports. Raw source contents are not duplicated into history.';

comment on function public.preview_generic_roster_import(
  uuid, jsonb, text[]
) is
  'Previews a non-authoritative generic spreadsheet import using exact Guild-scoped IGN matching and explicit mapped-field semantics.';

comment on function public.apply_generic_roster_import(
  uuid, jsonb, text[], text, text
) is
  'Transactionally applies a non-authoritative generic spreadsheet import. Only mapped fields change; omitted characters and existing lifecycle state are preserved.';
