-- Phase 3.6B2: Import reconciliation guards and per-Character import history.
--
-- Identity remains exact Guild-scoped IGN only. Imports never redirect an old
-- reconciled IGN to its canonical target and never infer a rename. If an
-- incoming row matches a reconciled historical Character, preview/apply stops
-- with a deterministic error so an organizer can review identity explicitly.
--
-- Applied imports also write meaningful per-Character history beneath
-- roster_sync_runs. Unchanged rows do not get history rows, and new-Character
-- history intentionally records only lifecycle/source metadata rather than a
-- copy of the uploaded row.

-- ---------------------------------------------------------------------------
-- RTNW preview
-- ---------------------------------------------------------------------------

create or replace function public.preview_rtnw_roster_sync(
  p_guild_id uuid,
  p_rows jsonb
)
returns table (
  change_kind text,
  character_id uuid,
  ign text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.require_import_manage(p_guild_id);
  perform private.validate_rtnw_roster_payload(p_rows);

  if exists (
    select 1
    from public.characters c
    join (
      select item.value ->> 'ign' as ign
      from jsonb_array_elements(p_rows) as item(value)
    ) incoming
      on incoming.ign = c.ign
    where c.guild_id = p_guild_id
      and c.reconciled_into_character_id is not null
  ) then
    raise exception 'import contains an IGN belonging to a reconciled historical Character; review Character identity explicitly before importing'
      using errcode = '55000';
  end if;

  return query
  with incoming as (
    select
      row_data.ign,
      row_data.level,
      nullif(row_data.class_name, '') as class_name,
      nullif(row_data.title, '') as title,
      nullif(row_data.gender, '') as gender,
      nullif(row_data.guild_position, '') as guild_position,
      row_data.gear_score,
      row_data.weekly_activity,
      row_data.weekly_contribution,
      row_data.total_contribution,
      nullif(row_data.online_status, '') as online_status
    from jsonb_to_recordset(p_rows) as row_data(
      ign text,
      level integer,
      class_name text,
      title text,
      gender text,
      guild_position text,
      gear_score bigint,
      weekly_activity bigint,
      weekly_contribution bigint,
      total_contribution bigint,
      online_status text
    )
  ),
  incoming_changes as (
    select
      case
        when c.id is null then 'new'
        when c.status = 'inactive' then 'reactivate'
        when
          c.level is distinct from i.level
          or c.class_name is distinct from i.class_name
          or c.title is distinct from i.title
          or c.gender is distinct from i.gender
          or c.guild_position is distinct from i.guild_position
          or c.gear_score is distinct from i.gear_score
          or c.weekly_activity is distinct from i.weekly_activity
          or c.weekly_contribution is distinct from i.weekly_contribution
          or c.total_contribution is distinct from i.total_contribution
          or c.online_status is distinct from i.online_status
          then 'update'
        else 'unchanged'
      end as change_kind,
      c.id as character_id,
      i.ign
    from incoming i
    left join public.characters c
      on c.guild_id = p_guild_id
     and c.ign = i.ign
  ),
  outgoing_changes as (
    select
      'left_guild'::text as change_kind,
      c.id as character_id,
      c.ign
    from public.characters c
    where c.guild_id = p_guild_id
      and c.reconciled_into_character_id is null
      and not (
        c.status = 'inactive'
        and c.inactive_reason = 'left_guild'
      )
      and not exists (
        select 1
        from incoming i
        where i.ign = c.ign
      )
  )
  select
    changes.change_kind,
    changes.character_id,
    changes.ign
  from (
    select * from incoming_changes
    union all
    select * from outgoing_changes
  ) changes
  order by
    case changes.change_kind
      when 'new' then 1
      when 'reactivate' then 2
      when 'update' then 3
      when 'left_guild' then 4
      else 5
    end,
    changes.ign;
end;
$$;

revoke all on function public.preview_rtnw_roster_sync(uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.preview_rtnw_roster_sync(uuid, jsonb)
to authenticated;

-- ---------------------------------------------------------------------------
-- RTNW apply
-- ---------------------------------------------------------------------------

create or replace function public.apply_rtnw_roster_sync(
  p_guild_id uuid,
  p_rows jsonb,
  p_source_filename text,
  p_source_sha256 text
)
returns table (
  sync_run_id uuid,
  source_row_count integer,
  created_count integer,
  updated_count integer,
  reactivated_count integer,
  left_guild_count integer,
  unchanged_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_sync_at timestamptz := now();
  v_sync_run_id uuid;
  v_source_row_count integer;
  v_created_count integer;
  v_updated_count integer;
  v_reactivated_count integer;
  v_left_guild_count integer;
  v_unchanged_count integer;
  v_new_igns text[] := array[]::text[];
begin
  v_actor_id := private.require_import_manage(p_guild_id);
  perform private.validate_rtnw_roster_payload(p_rows);

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

  -- Serialize applied imports for this Guild before locking Character rows.
  perform g.id
  from public.guilds g
  where g.id = p_guild_id
  for update;

  -- Lock the complete current Guild roster in deterministic UUID order because
  -- RTNW is authoritative and may mutate both incoming and omitted Characters.
  perform c.id
  from public.characters c
  where c.guild_id = p_guild_id
  order by c.id
  for update;

  -- Re-read reconciliation state after row locks. Never redirect an old IGN to
  -- its canonical target because the old IGN may later belong to someone else.
  if exists (
    select 1
    from public.characters c
    join (
      select item.value ->> 'ign' as ign
      from jsonb_array_elements(p_rows) as item(value)
    ) incoming
      on incoming.ign = c.ign
    where c.guild_id = p_guild_id
      and c.reconciled_into_character_id is not null
  ) then
    raise exception 'import contains an IGN belonging to a reconciled historical Character; review Character identity explicitly before importing'
      using errcode = '55000';
  end if;

  v_source_row_count := jsonb_array_length(p_rows);

  select
    count(*) filter (where preview.change_kind = 'new')::integer,
    count(*) filter (where preview.change_kind = 'update')::integer,
    count(*) filter (where preview.change_kind = 'reactivate')::integer,
    count(*) filter (where preview.change_kind = 'left_guild')::integer,
    count(*) filter (where preview.change_kind = 'unchanged')::integer
  into
    v_created_count,
    v_updated_count,
    v_reactivated_count,
    v_left_guild_count,
    v_unchanged_count
  from public.preview_rtnw_roster_sync(
    p_guild_id,
    p_rows
  ) as preview;

  with incoming as (
    select item.value ->> 'ign' as ign
    from jsonb_array_elements(p_rows) as item(value)
  )
  select coalesce(
    array_agg(i.ign order by i.ign)
      filter (where c.id is null),
    array[]::text[]
  )
  into v_new_igns
  from incoming i
  left join public.characters c
    on c.guild_id = p_guild_id
   and c.ign = i.ign;

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
    'rtnw_csv',
    p_source_filename,
    p_source_sha256,
    v_source_row_count,
    v_created_count,
    v_updated_count,
    v_reactivated_count,
    v_left_guild_count,
    v_unchanged_count,
    v_actor_id,
    v_sync_at
  )
  returning id into v_sync_run_id;

  -- Capture meaningful existing-row changes before mutation.
  with incoming as (
    select
      row_data.ign,
      row_data.level,
      nullif(row_data.class_name, '') as class_name,
      nullif(row_data.title, '') as title,
      nullif(row_data.gender, '') as gender,
      nullif(row_data.guild_position, '') as guild_position,
      row_data.gear_score,
      row_data.weekly_activity,
      row_data.weekly_contribution,
      row_data.total_contribution,
      nullif(row_data.online_status, '') as online_status
    from jsonb_to_recordset(p_rows) as row_data(
      ign text,
      level integer,
      class_name text,
      title text,
      gender text,
      guild_position text,
      gear_score bigint,
      weekly_activity bigint,
      weekly_contribution bigint,
      total_contribution bigint,
      online_status text
    )
  ),
  base as (
    select
      c.id as character_id,
      c.ign,
      c.status as before_status,
      c.inactive_reason as before_inactive_reason,
      c.left_guild_at as before_left_guild_at,
      c.level as before_level,
      c.class_name as before_class_name,
      c.title as before_title,
      c.gender as before_gender,
      c.guild_position as before_guild_position,
      c.gear_score as before_gear_score,
      c.weekly_activity as before_weekly_activity,
      c.weekly_contribution as before_weekly_contribution,
      c.total_contribution as before_total_contribution,
      c.online_status as before_online_status,
      i.level as after_level,
      i.class_name as after_class_name,
      i.title as after_title,
      i.gender as after_gender,
      i.guild_position as after_guild_position,
      i.gear_score as after_gear_score,
      i.weekly_activity as after_weekly_activity,
      i.weekly_contribution as after_weekly_contribution,
      i.total_contribution as after_total_contribution,
      i.online_status as after_online_status,
      case
        when c.status = 'inactive' then 'reactivate'
        when
          c.level is distinct from i.level
          or c.class_name is distinct from i.class_name
          or c.title is distinct from i.title
          or c.gender is distinct from i.gender
          or c.guild_position is distinct from i.guild_position
          or c.gear_score is distinct from i.gear_score
          or c.weekly_activity is distinct from i.weekly_activity
          or c.weekly_contribution is distinct from i.weekly_contribution
          or c.total_contribution is distinct from i.total_contribution
          or c.online_status is distinct from i.online_status
          then 'update'
        else 'unchanged'
      end as change_kind
    from incoming i
    join public.characters c
      on c.guild_id = p_guild_id
     and c.ign = i.ign
    where c.reconciled_into_character_id is null
  ),
  evaluated as (
    select
      base.*,
      array_remove(
        array[
          case when base.change_kind = 'reactivate' then 'status' end,
          case when base.change_kind = 'reactivate' then 'inactive_reason' end,
          case
            when base.change_kind = 'reactivate'
             and base.before_left_guild_at is not null
            then 'left_guild_at'
          end,
          case
            when base.before_level is distinct from base.after_level
            then 'level'
          end,
          case
            when base.before_class_name is distinct from base.after_class_name
            then 'class_name'
          end,
          case
            when base.before_title is distinct from base.after_title
            then 'title'
          end,
          case
            when base.before_gender is distinct from base.after_gender
            then 'gender'
          end,
          case
            when base.before_guild_position
              is distinct from base.after_guild_position
            then 'guild_position'
          end,
          case
            when base.before_gear_score is distinct from base.after_gear_score
            then 'gear_score'
          end,
          case
            when base.before_weekly_activity
              is distinct from base.after_weekly_activity
            then 'weekly_activity'
          end,
          case
            when base.before_weekly_contribution
              is distinct from base.after_weekly_contribution
            then 'weekly_contribution'
          end,
          case
            when base.before_total_contribution
              is distinct from base.after_total_contribution
            then 'total_contribution'
          end,
          case
            when base.before_online_status
              is distinct from base.after_online_status
            then 'online_status'
          end
        ]::text[],
        null
      ) as changed_fields
    from base
  )
  insert into public.roster_sync_run_changes (
    guild_id,
    sync_run_id,
    character_id,
    character_ign,
    change_kind,
    changed_fields,
    before_values,
    after_values,
    recorded_at
  )
  select
    p_guild_id,
    v_sync_run_id,
    e.character_id,
    e.ign,
    e.change_kind,
    e.changed_fields,
    '{}'::jsonb
      || case
        when 'status' = any(e.changed_fields)
        then jsonb_build_object('status', e.before_status)
        else '{}'::jsonb
      end
      || case
        when 'inactive_reason' = any(e.changed_fields)
        then jsonb_build_object('inactive_reason', e.before_inactive_reason)
        else '{}'::jsonb
      end
      || case
        when 'left_guild_at' = any(e.changed_fields)
        then jsonb_build_object('left_guild_at', e.before_left_guild_at)
        else '{}'::jsonb
      end
      || case
        when 'level' = any(e.changed_fields)
        then jsonb_build_object('level', e.before_level)
        else '{}'::jsonb
      end
      || case
        when 'class_name' = any(e.changed_fields)
        then jsonb_build_object('class_name', e.before_class_name)
        else '{}'::jsonb
      end
      || case
        when 'title' = any(e.changed_fields)
        then jsonb_build_object('title', e.before_title)
        else '{}'::jsonb
      end
      || case
        when 'gender' = any(e.changed_fields)
        then jsonb_build_object('gender', e.before_gender)
        else '{}'::jsonb
      end
      || case
        when 'guild_position' = any(e.changed_fields)
        then jsonb_build_object('guild_position', e.before_guild_position)
        else '{}'::jsonb
      end
      || case
        when 'gear_score' = any(e.changed_fields)
        then jsonb_build_object('gear_score', e.before_gear_score)
        else '{}'::jsonb
      end
      || case
        when 'weekly_activity' = any(e.changed_fields)
        then jsonb_build_object('weekly_activity', e.before_weekly_activity)
        else '{}'::jsonb
      end
      || case
        when 'weekly_contribution' = any(e.changed_fields)
        then jsonb_build_object(
          'weekly_contribution',
          e.before_weekly_contribution
        )
        else '{}'::jsonb
      end
      || case
        when 'total_contribution' = any(e.changed_fields)
        then jsonb_build_object(
          'total_contribution',
          e.before_total_contribution
        )
        else '{}'::jsonb
      end
      || case
        when 'online_status' = any(e.changed_fields)
        then jsonb_build_object('online_status', e.before_online_status)
        else '{}'::jsonb
      end,
    '{}'::jsonb
      || case
        when 'status' = any(e.changed_fields)
        then jsonb_build_object('status', 'active')
        else '{}'::jsonb
      end
      || case
        when 'inactive_reason' = any(e.changed_fields)
        then jsonb_build_object('inactive_reason', null)
        else '{}'::jsonb
      end
      || case
        when 'left_guild_at' = any(e.changed_fields)
        then jsonb_build_object('left_guild_at', null)
        else '{}'::jsonb
      end
      || case
        when 'level' = any(e.changed_fields)
        then jsonb_build_object('level', e.after_level)
        else '{}'::jsonb
      end
      || case
        when 'class_name' = any(e.changed_fields)
        then jsonb_build_object('class_name', e.after_class_name)
        else '{}'::jsonb
      end
      || case
        when 'title' = any(e.changed_fields)
        then jsonb_build_object('title', e.after_title)
        else '{}'::jsonb
      end
      || case
        when 'gender' = any(e.changed_fields)
        then jsonb_build_object('gender', e.after_gender)
        else '{}'::jsonb
      end
      || case
        when 'guild_position' = any(e.changed_fields)
        then jsonb_build_object('guild_position', e.after_guild_position)
        else '{}'::jsonb
      end
      || case
        when 'gear_score' = any(e.changed_fields)
        then jsonb_build_object('gear_score', e.after_gear_score)
        else '{}'::jsonb
      end
      || case
        when 'weekly_activity' = any(e.changed_fields)
        then jsonb_build_object('weekly_activity', e.after_weekly_activity)
        else '{}'::jsonb
      end
      || case
        when 'weekly_contribution' = any(e.changed_fields)
        then jsonb_build_object(
          'weekly_contribution',
          e.after_weekly_contribution
        )
        else '{}'::jsonb
      end
      || case
        when 'total_contribution' = any(e.changed_fields)
        then jsonb_build_object(
          'total_contribution',
          e.after_total_contribution
        )
        else '{}'::jsonb
      end
      || case
        when 'online_status' = any(e.changed_fields)
        then jsonb_build_object('online_status', e.after_online_status)
        else '{}'::jsonb
      end,
    v_sync_at
  from evaluated e
  where e.change_kind in ('update', 'reactivate');

  -- Capture authoritative departures before applying them. Reconciled history
  -- is excluded permanently from omission-based lifecycle changes.
  with incoming as (
    select item.value ->> 'ign' as ign
    from jsonb_array_elements(p_rows) as item(value)
  ),
  departing as (
    select
      c.id,
      c.ign,
      c.status,
      c.inactive_reason,
      c.left_guild_at,
      array_remove(
        array[
          case
            when c.status is distinct from 'inactive'
            then 'status'
          end,
          'inactive_reason',
          'left_guild_at'
        ]::text[],
        null
      ) as changed_fields
    from public.characters c
    where c.guild_id = p_guild_id
      and c.reconciled_into_character_id is null
      and not (
        c.status = 'inactive'
        and c.inactive_reason = 'left_guild'
      )
      and not exists (
        select 1
        from incoming i
        where i.ign = c.ign
      )
  )
  insert into public.roster_sync_run_changes (
    guild_id,
    sync_run_id,
    character_id,
    character_ign,
    change_kind,
    changed_fields,
    before_values,
    after_values,
    recorded_at
  )
  select
    p_guild_id,
    v_sync_run_id,
    d.id,
    d.ign,
    'left_guild',
    d.changed_fields,
    '{}'::jsonb
      || case
        when 'status' = any(d.changed_fields)
        then jsonb_build_object('status', d.status)
        else '{}'::jsonb
      end
      || jsonb_build_object('inactive_reason', d.inactive_reason)
      || jsonb_build_object('left_guild_at', d.left_guild_at),
    '{}'::jsonb
      || case
        when 'status' = any(d.changed_fields)
        then jsonb_build_object('status', 'inactive')
        else '{}'::jsonb
      end
      || jsonb_build_object('inactive_reason', 'left_guild')
      || jsonb_build_object('left_guild_at', v_sync_at),
    v_sync_at
  from departing d;

  -- Update existing exact-IGN matches. Historical reconciled rows are defended
  -- again at the mutation boundary even though the earlier guard already blocks.
  with incoming as (
    select
      row_data.ign,
      row_data.level,
      nullif(row_data.class_name, '') as class_name,
      nullif(row_data.title, '') as title,
      nullif(row_data.gender, '') as gender,
      nullif(row_data.guild_position, '') as guild_position,
      row_data.gear_score,
      row_data.weekly_activity,
      row_data.weekly_contribution,
      row_data.total_contribution,
      nullif(row_data.online_status, '') as online_status
    from jsonb_to_recordset(p_rows) as row_data(
      ign text,
      level integer,
      class_name text,
      title text,
      gender text,
      guild_position text,
      gear_score bigint,
      weekly_activity bigint,
      weekly_contribution bigint,
      total_contribution bigint,
      online_status text
    )
  )
  update public.characters c
  set
    level = i.level,
    class_name = i.class_name,
    title = i.title,
    gender = i.gender,
    guild_position = i.guild_position,
    gear_score = i.gear_score,
    weekly_activity = i.weekly_activity,
    weekly_contribution = i.weekly_contribution,
    total_contribution = i.total_contribution,
    online_status = i.online_status,
    status = 'active',
    inactive_reason = null,
    left_guild_at = null,
    rtnw_first_seen_at = coalesce(c.rtnw_first_seen_at, v_sync_at),
    rtnw_last_seen_at = v_sync_at
  from incoming i
  where c.guild_id = p_guild_id
    and c.ign = i.ign
    and c.reconciled_into_character_id is null;

  -- Insert exact IGNs that did not exist at classification time.
  with incoming as (
    select
      row_data.ign,
      row_data.level,
      nullif(row_data.class_name, '') as class_name,
      nullif(row_data.title, '') as title,
      nullif(row_data.gender, '') as gender,
      nullif(row_data.guild_position, '') as guild_position,
      row_data.gear_score,
      row_data.weekly_activity,
      row_data.weekly_contribution,
      row_data.total_contribution,
      nullif(row_data.online_status, '') as online_status
    from jsonb_to_recordset(p_rows) as row_data(
      ign text,
      level integer,
      class_name text,
      title text,
      gender text,
      guild_position text,
      gear_score bigint,
      weekly_activity bigint,
      weekly_contribution bigint,
      total_contribution bigint,
      online_status text
    )
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
    i.level,
    i.class_name,
    i.title,
    i.gender,
    i.guild_position,
    i.gear_score,
    i.weekly_activity,
    i.weekly_contribution,
    i.total_contribution,
    i.online_status,
    'active',
    null,
    null,
    'rtnw_export',
    v_sync_at,
    v_sync_at,
    v_actor_id
  from incoming i
  where i.ign = any(v_new_igns)
  on conflict (guild_id, ign) do nothing;

  -- New history intentionally stores only lifecycle/source metadata. The source
  -- row itself is not duplicated into history.
  insert into public.roster_sync_run_changes (
    guild_id,
    sync_run_id,
    character_id,
    character_ign,
    change_kind,
    changed_fields,
    before_values,
    after_values,
    recorded_at
  )
  select
    p_guild_id,
    v_sync_run_id,
    c.id,
    c.ign,
    'new',
    array['status', 'source_origin']::text[],
    '{}'::jsonb,
    jsonb_build_object(
      'status', c.status,
      'source_origin', c.source_origin
    ),
    v_sync_at
  from public.characters c
  where c.guild_id = p_guild_id
    and c.ign = any(v_new_igns)
    and c.reconciled_into_character_id is null;

  with incoming as (
    select item.value ->> 'ign' as ign
    from jsonb_array_elements(p_rows) as item(value)
  )
  update public.characters c
  set
    status = 'inactive',
    inactive_reason = 'left_guild',
    left_guild_at = v_sync_at
  where c.guild_id = p_guild_id
    and c.reconciled_into_character_id is null
    and not (
      c.status = 'inactive'
      and c.inactive_reason = 'left_guild'
    )
    and not exists (
      select 1
      from incoming i
      where i.ign = c.ign
    );

  return query
  select
    v_sync_run_id,
    v_source_row_count,
    v_created_count,
    v_updated_count,
    v_reactivated_count,
    v_left_guild_count,
    v_unchanged_count;
end;
$$;

revoke all on function public.apply_rtnw_roster_sync(
  uuid, jsonb, text, text
) from public, anon, authenticated;

grant execute on function public.apply_rtnw_roster_sync(
  uuid, jsonb, text, text
) to authenticated;

comment on function public.preview_rtnw_roster_sync(uuid, jsonb) is
  'Previews exact-IGN RTNW roster changes. Reconciled historical IGNs are blocked and omission logic ignores reconciled history.';

comment on function public.apply_rtnw_roster_sync(
  uuid, jsonb, text, text
) is
  'Transactionally applies one confirmed RTNW Guild export using exact Guild-scoped IGN matching, reconciliation guards, deterministic Character locking, and per-Character import history.';

-- ---------------------------------------------------------------------------
-- Generic spreadsheet preview
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

  if exists (
    select 1
    from public.characters c
    join (
      select item.value ->> 'ign' as ign
      from jsonb_array_elements(p_rows) as item(value)
    ) incoming
      on incoming.ign = c.ign
    where c.guild_id = p_guild_id
      and c.reconciled_into_character_id is not null
  ) then
    raise exception 'import contains an IGN belonging to a reconciled historical Character; review Character identity explicitly before importing'
      using errcode = '55000';
  end if;

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
-- Generic spreadsheet apply
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
  v_new_igns text[] := array[]::text[];
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

  -- Serialize applied imports for this Guild.
  perform g.id
  from public.guilds g
  where g.id = p_guild_id
  for update;

  -- Generic imports mutate only exact incoming matches. Lock those rows in UUID
  -- order so they serialize with explicit reconciliation and bulk mutations.
  perform c.id
  from public.characters c
  where c.guild_id = p_guild_id
    and c.ign in (
      select item.value ->> 'ign'
      from jsonb_array_elements(p_rows) as item(value)
    )
  order by c.id
  for update;

  if exists (
    select 1
    from public.characters c
    join (
      select item.value ->> 'ign' as ign
      from jsonb_array_elements(p_rows) as item(value)
    ) incoming
      on incoming.ign = c.ign
    where c.guild_id = p_guild_id
      and c.reconciled_into_character_id is not null
  ) then
    raise exception 'import contains an IGN belonging to a reconciled historical Character; review Character identity explicitly before importing'
      using errcode = '55000';
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

  with incoming as (
    select item.value ->> 'ign' as ign
    from jsonb_array_elements(p_rows) as item(value)
  )
  select coalesce(
    array_agg(i.ign order by i.ign)
      filter (where c.id is null),
    array[]::text[]
  )
  into v_new_igns
  from incoming i
  left join public.characters c
    on c.guild_id = p_guild_id
   and c.ign = i.ign;

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

  -- Existing-row history is captured from mapped fields only.
  with incoming as (
    select
      item.value ->> 'ign' as ign,
      item.value as row_data
    from jsonb_array_elements(p_rows) as item(value)
  ),
  evaluated as (
    select
      c.id as character_id,
      c.ign,
      i.row_data,
      c.level,
      c.class_name,
      c.title,
      c.gender,
      c.guild_position,
      c.gear_score,
      c.weekly_activity,
      c.weekly_contribution,
      c.total_contribution,
      c.online_status,
      p.designation,
      p.role_label,
      array_remove(
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
      ) as changed_fields
    from incoming i
    join public.characters c
      on c.guild_id = p_guild_id
     and c.ign = i.ign
    left join public.character_roster_profiles p
      on p.guild_id = p_guild_id
     and p.character_id = c.id
    where c.reconciled_into_character_id is null
  )
  insert into public.roster_sync_run_changes (
    guild_id,
    sync_run_id,
    character_id,
    character_ign,
    change_kind,
    changed_fields,
    before_values,
    after_values,
    recorded_at
  )
  select
    p_guild_id,
    v_sync_run_id,
    e.character_id,
    e.ign,
    'update',
    e.changed_fields,
    '{}'::jsonb
      || case
        when 'level' = any(e.changed_fields)
        then jsonb_build_object('level', e.level)
        else '{}'::jsonb
      end
      || case
        when 'class_name' = any(e.changed_fields)
        then jsonb_build_object('class_name', e.class_name)
        else '{}'::jsonb
      end
      || case
        when 'title' = any(e.changed_fields)
        then jsonb_build_object('title', e.title)
        else '{}'::jsonb
      end
      || case
        when 'gender' = any(e.changed_fields)
        then jsonb_build_object('gender', e.gender)
        else '{}'::jsonb
      end
      || case
        when 'guild_position' = any(e.changed_fields)
        then jsonb_build_object('guild_position', e.guild_position)
        else '{}'::jsonb
      end
      || case
        when 'gear_score' = any(e.changed_fields)
        then jsonb_build_object('gear_score', e.gear_score)
        else '{}'::jsonb
      end
      || case
        when 'weekly_activity' = any(e.changed_fields)
        then jsonb_build_object('weekly_activity', e.weekly_activity)
        else '{}'::jsonb
      end
      || case
        when 'weekly_contribution' = any(e.changed_fields)
        then jsonb_build_object(
          'weekly_contribution',
          e.weekly_contribution
        )
        else '{}'::jsonb
      end
      || case
        when 'total_contribution' = any(e.changed_fields)
        then jsonb_build_object(
          'total_contribution',
          e.total_contribution
        )
        else '{}'::jsonb
      end
      || case
        when 'online_status' = any(e.changed_fields)
        then jsonb_build_object('online_status', e.online_status)
        else '{}'::jsonb
      end
      || case
        when 'designation' = any(e.changed_fields)
        then jsonb_build_object('designation', e.designation)
        else '{}'::jsonb
      end
      || case
        when 'role_label' = any(e.changed_fields)
        then jsonb_build_object('role_label', e.role_label)
        else '{}'::jsonb
      end,
    '{}'::jsonb
      || case
        when 'level' = any(e.changed_fields)
        then jsonb_build_object(
          'level',
          (e.row_data ->> 'level')::integer
        )
        else '{}'::jsonb
      end
      || case
        when 'class_name' = any(e.changed_fields)
        then jsonb_build_object(
          'class_name',
          e.row_data ->> 'class_name'
        )
        else '{}'::jsonb
      end
      || case
        when 'title' = any(e.changed_fields)
        then jsonb_build_object('title', e.row_data ->> 'title')
        else '{}'::jsonb
      end
      || case
        when 'gender' = any(e.changed_fields)
        then jsonb_build_object('gender', e.row_data ->> 'gender')
        else '{}'::jsonb
      end
      || case
        when 'guild_position' = any(e.changed_fields)
        then jsonb_build_object(
          'guild_position',
          e.row_data ->> 'guild_position'
        )
        else '{}'::jsonb
      end
      || case
        when 'gear_score' = any(e.changed_fields)
        then jsonb_build_object(
          'gear_score',
          (e.row_data ->> 'gear_score')::bigint
        )
        else '{}'::jsonb
      end
      || case
        when 'weekly_activity' = any(e.changed_fields)
        then jsonb_build_object(
          'weekly_activity',
          (e.row_data ->> 'weekly_activity')::bigint
        )
        else '{}'::jsonb
      end
      || case
        when 'weekly_contribution' = any(e.changed_fields)
        then jsonb_build_object(
          'weekly_contribution',
          (e.row_data ->> 'weekly_contribution')::bigint
        )
        else '{}'::jsonb
      end
      || case
        when 'total_contribution' = any(e.changed_fields)
        then jsonb_build_object(
          'total_contribution',
          (e.row_data ->> 'total_contribution')::bigint
        )
        else '{}'::jsonb
      end
      || case
        when 'online_status' = any(e.changed_fields)
        then jsonb_build_object(
          'online_status',
          e.row_data ->> 'online_status'
        )
        else '{}'::jsonb
      end
      || case
        when 'designation' = any(e.changed_fields)
        then jsonb_build_object(
          'designation',
          e.row_data ->> 'designation'
        )
        else '{}'::jsonb
      end
      || case
        when 'role_label' = any(e.changed_fields)
        then jsonb_build_object(
          'role_label',
          e.row_data ->> 'role_label'
        )
        else '{}'::jsonb
      end,
    v_import_at
  from evaluated e
  where cardinality(e.changed_fields) > 0;

  -- Existing Characters: update only mapped game/current fields.
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
    and c.reconciled_into_character_id is null
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

  -- Missing exact IGNs become new non-RTNW/manual-origin Characters.
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
  where i.ign = any(v_new_igns)
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
    where c.reconciled_into_character_id is null
      and (
        'designation' = any(p_mapped_fields)
        or 'role_label' = any(p_mapped_fields)
      )
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

  insert into public.roster_sync_run_changes (
    guild_id,
    sync_run_id,
    character_id,
    character_ign,
    change_kind,
    changed_fields,
    before_values,
    after_values,
    recorded_at
  )
  select
    p_guild_id,
    v_sync_run_id,
    c.id,
    c.ign,
    'new',
    array['status', 'source_origin']::text[],
    '{}'::jsonb,
    jsonb_build_object(
      'status', c.status,
      'source_origin', c.source_origin
    ),
    v_import_at
  from public.characters c
  where c.guild_id = p_guild_id
    and c.ign = any(v_new_igns)
    and c.reconciled_into_character_id is null;

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

comment on function public.preview_generic_roster_import(
  uuid, jsonb, text[]
) is
  'Previews a non-authoritative generic spreadsheet import using exact Guild-scoped IGN matching. Reconciled historical IGNs are blocked rather than redirected.';

comment on function public.apply_generic_roster_import(
  uuid, jsonb, text[], text, text
) is
  'Transactionally applies a non-authoritative generic spreadsheet import with deterministic matching-row locks, reconciled-history guards, mapped-field semantics, and per-Character import history.';
