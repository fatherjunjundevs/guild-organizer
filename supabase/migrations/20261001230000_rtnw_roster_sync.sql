-- Phase 3.1C: RTNW Guild CSV roster synchronization engine.
-- The application parser normalizes the official RTNW export before calling
-- these RPCs. The CSV "Id" column is intentionally discarded and is never used
-- for character identity.
--
-- V1 identity rule:
--   exact Guild-scoped IGN match -> same character row
--   new IGN -> new character row
--   existing IGN absent from a confirmed export -> left_guild / inactive
-- No automatic rename guessing or character merging occurs.

-- ---------------------------------------------------------------------------
-- Applied sync history
-- ---------------------------------------------------------------------------

create table public.roster_sync_runs (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  source_type text not null default 'rtnw_csv',
  source_filename text not null,
  source_sha256 text not null,
  source_row_count integer not null,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  reactivated_count integer not null default 0,
  left_guild_count integer not null default 0,
  unchanged_count integer not null default 0,
  imported_by uuid references public.profiles(id) on delete set null,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint roster_sync_runs_source_type_valid
    check (source_type = 'rtnw_csv'),
  constraint roster_sync_runs_filename_length
    check (char_length(btrim(source_filename)) between 1 and 255),
  constraint roster_sync_runs_sha256_format
    check (source_sha256 ~ '^[0-9a-f]{64}$'),
  constraint roster_sync_runs_row_count_valid
    check (source_row_count between 1 and 1000),
  constraint roster_sync_runs_counts_nonnegative
    check (
      created_count >= 0
      and updated_count >= 0
      and reactivated_count >= 0
      and left_guild_count >= 0
      and unchanged_count >= 0
    ),
  constraint roster_sync_runs_payload_counts_consistent
    check (
      created_count
      + updated_count
      + reactivated_count
      + unchanged_count
      = source_row_count
    ),
  constraint roster_sync_runs_guild_id_id_unique
    unique (guild_id, id)
);

create index roster_sync_runs_guild_applied_idx
  on public.roster_sync_runs (guild_id, applied_at desc);

alter table public.roster_sync_runs enable row level security;

create policy roster_sync_runs_select_authorized
on public.roster_sync_runs
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'imports.manage')
  or private.has_guild_capability(guild_id, 'audit.view')
);

revoke all on table public.roster_sync_runs from anon, authenticated;
grant select on table public.roster_sync_runs to authenticated;

-- ---------------------------------------------------------------------------
-- Import authorization
-- ---------------------------------------------------------------------------

create or replace function private.require_import_manage(
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
    'imports.manage'
  ) then
    raise exception 'imports.manage authority required'
      using errcode = '42501';
  end if;

  return v_actor_id;
end;
$$;

revoke all on function private.require_import_manage(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Normalized payload validation
--
-- Expected object keys:
--   ign, level, class_name, title, gender, guild_position, gear_score,
--   weekly_activity, weekly_contribution, total_contribution, online_status
--
-- Extra keys are ignored. This means the game export's counting-only "Id"
-- field cannot affect identity even if a caller accidentally leaves it in the
-- normalized JSON object.
-- ---------------------------------------------------------------------------

create or replace function private.validate_rtnw_roster_payload(
  p_rows jsonb
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'RTNW roster payload must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) < 1 then
    raise exception 'RTNW roster payload cannot be empty'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'RTNW roster payload exceeds 1000 rows'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as item(value)
    where jsonb_typeof(item.value) <> 'object'
  ) then
    raise exception 'every RTNW roster row must be a JSON object'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as item(value)
    where item.value ->> 'ign' is null
      or char_length(btrim(item.value ->> 'ign')) = 0
      or item.value ->> 'ign' is distinct from btrim(item.value ->> 'ign')
      or char_length(item.value ->> 'ign') > 80
  ) then
    raise exception 'every RTNW roster row requires a valid exact IGN'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select item.value ->> 'ign' as ign
      from jsonb_array_elements(p_rows) as item(value)
      group by item.value ->> 'ign'
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'RTNW roster payload contains duplicate exact IGNs'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as item(value)
    where
      (
        item.value ? 'level'
        and item.value -> 'level' <> 'null'::jsonb
        and item.value ->> 'level' !~ '^[0-9]+$'
      )
      or
      (
        item.value ? 'gear_score'
        and item.value -> 'gear_score' <> 'null'::jsonb
        and item.value ->> 'gear_score' !~ '^[0-9]+$'
      )
      or
      (
        item.value ? 'weekly_activity'
        and item.value -> 'weekly_activity' <> 'null'::jsonb
        and item.value ->> 'weekly_activity' !~ '^[0-9]+$'
      )
      or
      (
        item.value ? 'weekly_contribution'
        and item.value -> 'weekly_contribution' <> 'null'::jsonb
        and item.value ->> 'weekly_contribution' !~ '^[0-9]+$'
      )
      or
      (
        item.value ? 'total_contribution'
        and item.value -> 'total_contribution' <> 'null'::jsonb
        and item.value ->> 'total_contribution' !~ '^[0-9]+$'
      )
  ) then
    raise exception 'RTNW numeric fields must be nonnegative integers or null'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_rtnw_roster_payload(jsonb)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Preview
--
-- Returns one row for each current or incoming character that would change.
-- "unchanged" rows are included so the UI can produce a complete summary.
-- Existing rows already marked left_guild and still absent are omitted because
-- the new sync would not change them.
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
-- Apply
--
-- Applies one confirmed current RTNW export transactionally and writes only
-- safe summary metadata to roster_sync_runs. The raw roster payload is not
-- duplicated into sync history.
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

  v_source_row_count := jsonb_array_length(p_rows);

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
  classified as (
    select
      i.*,
      c.id as character_id,
      c.status as existing_status,
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
      end as change_kind
    from incoming i
    left join public.characters c
      on c.guild_id = p_guild_id
     and c.ign = i.ign
  )
  select
    count(*) filter (where change_kind = 'new')::integer,
    count(*) filter (where change_kind = 'update')::integer,
    count(*) filter (where change_kind = 'reactivate')::integer,
    count(*) filter (where change_kind = 'unchanged')::integer
  into
    v_created_count,
    v_updated_count,
    v_reactivated_count,
    v_unchanged_count
  from classified;

  with incoming as (
    select row_data.ign
    from jsonb_to_recordset(p_rows) as row_data(ign text)
  )
  select count(*)::integer
  into v_left_guild_count
  from public.characters c
  where c.guild_id = p_guild_id
    and not (
      c.status = 'inactive'
      and c.inactive_reason = 'left_guild'
    )
    and not exists (
      select 1
      from incoming i
      where i.ign = c.ign
    );

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
    row_data.ign,
    row_data.level,
    nullif(row_data.class_name, ''),
    nullif(row_data.title, ''),
    nullif(row_data.gender, ''),
    nullif(row_data.guild_position, ''),
    row_data.gear_score,
    row_data.weekly_activity,
    row_data.weekly_contribution,
    row_data.total_contribution,
    nullif(row_data.online_status, ''),
    'active',
    null,
    null,
    'rtnw_export',
    v_sync_at,
    v_sync_at,
    v_actor_id
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
  on conflict (guild_id, ign)
  do update set
    level = excluded.level,
    class_name = excluded.class_name,
    title = excluded.title,
    gender = excluded.gender,
    guild_position = excluded.guild_position,
    gear_score = excluded.gear_score,
    weekly_activity = excluded.weekly_activity,
    weekly_contribution = excluded.weekly_contribution,
    total_contribution = excluded.total_contribution,
    online_status = excluded.online_status,
    status = 'active',
    inactive_reason = null,
    left_guild_at = null,
    rtnw_first_seen_at = coalesce(
      public.characters.rtnw_first_seen_at,
      excluded.rtnw_first_seen_at
    ),
    rtnw_last_seen_at = excluded.rtnw_last_seen_at;

  with incoming as (
    select row_data.ign
    from jsonb_to_recordset(p_rows) as row_data(ign text)
  )
  update public.characters c
  set
    status = 'inactive',
    inactive_reason = 'left_guild',
    left_guild_at = v_sync_at
  where c.guild_id = p_guild_id
    and not (
      c.status = 'inactive'
      and c.inactive_reason = 'left_guild'
    )
    and not exists (
      select 1
      from incoming i
      where i.ign = c.ign
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

comment on table public.roster_sync_runs is
  'Applied RTNW Guild roster sync metadata. Raw CSV contents are not duplicated into history.';

comment on function public.preview_rtnw_roster_sync(uuid, jsonb) is
  'Previews exact-IGN RTNW roster changes without mutation. No rename guessing is performed.';

comment on function public.apply_rtnw_roster_sync(
  uuid, jsonb, text, text
) is
  'Transactionally applies one confirmed RTNW Guild export using exact Guild-scoped IGN matching and records summary sync history.';
