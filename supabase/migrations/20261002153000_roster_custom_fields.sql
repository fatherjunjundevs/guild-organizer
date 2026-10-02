-- Phase 3.4B: Guild-defined organizer custom fields.
--
-- Custom fields are organizer-owned metadata. They are deliberately isolated
-- from RTNW-owned character data and are never touched by RTNW roster sync.

create table public.roster_custom_fields (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  name text not null,
  field_type text not null,
  select_options text[] not null default '{}'::text[],
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint roster_custom_fields_name_trimmed
    check (name = btrim(name)),
  constraint roster_custom_fields_name_length
    check (char_length(name) between 1 and 40),
  constraint roster_custom_fields_type
    check (field_type in ('text', 'number', 'boolean', 'select')),
  constraint roster_custom_fields_option_shape
    check (
      (
        field_type = 'select'
        and cardinality(select_options) between 2 and 20
      )
      or (
        field_type <> 'select'
        and cardinality(select_options) = 0
      )
    ),
  constraint roster_custom_fields_guild_id_id_unique
    unique (guild_id, id)
);

create unique index roster_custom_fields_guild_name_ci_unique
  on public.roster_custom_fields (guild_id, lower(name));

create trigger roster_custom_fields_set_updated_at
before update on public.roster_custom_fields
for each row
execute function private.set_updated_at();

create table public.character_roster_custom_field_values (
  guild_id uuid not null,
  character_id uuid not null,
  field_id uuid not null,
  value jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (guild_id, character_id, field_id),

  constraint character_roster_custom_field_values_character_fk
    foreign key (guild_id, character_id)
    references public.characters(guild_id, id)
    on delete cascade,

  constraint character_roster_custom_field_values_field_fk
    foreign key (guild_id, field_id)
    references public.roster_custom_fields(guild_id, id)
    on delete cascade,

  constraint character_roster_custom_field_values_scalar
    check (jsonb_typeof(value) in ('string', 'number', 'boolean'))
);

create index character_roster_custom_field_values_field_idx
  on public.character_roster_custom_field_values (guild_id, field_id);

create trigger character_roster_custom_field_values_set_updated_at
before update on public.character_roster_custom_field_values
for each row
execute function private.set_updated_at();

alter table public.roster_custom_fields enable row level security;
alter table public.character_roster_custom_field_values enable row level security;

create policy roster_custom_fields_select_roster_managers
on public.roster_custom_fields
for select
to authenticated
using (private.has_guild_capability(guild_id, 'roster.manage'));

create policy character_roster_custom_field_values_select_roster_managers
on public.character_roster_custom_field_values
for select
to authenticated
using (private.has_guild_capability(guild_id, 'roster.manage'));

revoke all on table public.roster_custom_fields from anon, authenticated;
revoke all on table public.character_roster_custom_field_values
from anon, authenticated;

grant select on table public.roster_custom_fields to authenticated;
grant select on table public.character_roster_custom_field_values
to authenticated;

create or replace function private.validate_roster_custom_field_options(
  p_field_type text,
  p_options text[]
)
returns text[]
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_options text[] := coalesce(p_options, '{}'::text[]);
begin
  if p_field_type not in ('text', 'number', 'boolean', 'select') then
    raise exception 'unsupported custom field type'
      using errcode = '22023';
  end if;

  if p_field_type <> 'select' then
    if cardinality(v_options) <> 0 then
      raise exception 'only select fields may define options'
        using errcode = '22023';
    end if;

    return '{}'::text[];
  end if;

  if cardinality(v_options) not between 2 and 20 then
    raise exception 'select fields require 2 to 20 options'
      using errcode = '22023';
  end if;

  if array_position(v_options, null) is not null
     or exists (
       select 1
       from unnest(v_options) as option_rows(option_value)
       where option_value is distinct from btrim(option_value)
          or char_length(option_value) not between 1 and 40
     ) then
    raise exception 'select options must be 1 to 40 trimmed characters'
      using errcode = '22023';
  end if;

  if (
    select count(*) <> count(distinct lower(option_value))
    from unnest(v_options) as option_rows(option_value)
  ) then
    raise exception 'select options must be unique case-insensitively'
      using errcode = '22023';
  end if;

  return v_options;
end;
$$;

revoke all on function private.validate_roster_custom_field_options(text, text[])
from public, anon, authenticated;

create or replace function public.create_roster_custom_field(
  p_guild_id uuid,
  p_name text,
  p_field_type text,
  p_select_options text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_field_id uuid;
  v_options text[];
begin
  v_actor_id := private.require_roster_manage(p_guild_id);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 40 then
    raise exception 'custom field name must be 1 to 40 trimmed characters'
      using errcode = '22023';
  end if;

  v_options := private.validate_roster_custom_field_options(
    p_field_type,
    p_select_options
  );

  if (
    select count(*)
    from public.roster_custom_fields
    where guild_id = p_guild_id
  ) >= 20 then
    raise exception 'a Guild may have at most 20 roster custom fields'
      using errcode = '22023';
  end if;

  insert into public.roster_custom_fields (
    guild_id,
    name,
    field_type,
    select_options,
    created_by
  )
  values (
    p_guild_id,
    p_name,
    p_field_type,
    v_options,
    v_actor_id
  )
  returning id into v_field_id;

  return v_field_id;
end;
$$;

create or replace function public.update_roster_custom_field(
  p_field_id uuid,
  p_name text,
  p_select_options text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_field_type text;
  v_options text[];
begin
  select f.guild_id, f.field_type
  into v_guild_id, v_field_type
  from public.roster_custom_fields f
  where f.id = p_field_id;

  if v_guild_id is null then
    raise exception 'roster custom field not found'
      using errcode = 'P0002';
  end if;

  perform private.require_roster_manage(v_guild_id);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 40 then
    raise exception 'custom field name must be 1 to 40 trimmed characters'
      using errcode = '22023';
  end if;

  v_options := private.validate_roster_custom_field_options(
    v_field_type,
    p_select_options
  );

  if v_field_type = 'select'
     and exists (
       select 1
       from public.character_roster_custom_field_values v
       where v.guild_id = v_guild_id
         and v.field_id = p_field_id
         and jsonb_typeof(v.value) = 'string'
         and not ((v.value #>> '{}') = any(v_options))
     ) then
    raise exception 'cannot remove a select option while characters still use it'
      using errcode = '23514';
  end if;

  update public.roster_custom_fields
  set
    name = p_name,
    select_options = v_options
  where id = p_field_id;
end;
$$;

create or replace function public.delete_roster_custom_field(
  p_field_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
begin
  select f.guild_id
  into v_guild_id
  from public.roster_custom_fields f
  where f.id = p_field_id;

  if v_guild_id is null then
    raise exception 'roster custom field not found'
      using errcode = 'P0002';
  end if;

  perform private.require_roster_manage(v_guild_id);

  delete from public.roster_custom_fields
  where id = p_field_id;
end;
$$;

create or replace function public.set_character_roster_custom_fields(
  p_character_id uuid,
  p_values jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_values jsonb := coalesce(p_values, '[]'::jsonb);
  v_item jsonb;
  v_field_id uuid;
  v_seen_field_ids uuid[] := '{}'::uuid[];
  v_field record;
  v_text text;
  v_number numeric;
  v_boolean boolean;
  v_saved integer := 0;
begin
  select *
  into v_access
  from private.require_roster_character(p_character_id);

  if jsonb_typeof(v_values) <> 'array'
     or jsonb_array_length(v_values) > 20 then
    raise exception 'custom field values must be an array of at most 20 items'
      using errcode = '22023';
  end if;

  delete from public.character_roster_custom_field_values
  where guild_id = v_access.guild_id
    and character_id = p_character_id;

  for v_item in
    select value
    from jsonb_array_elements(v_values)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'field_id')
       or not (v_item ? 'value')
       or (v_item - 'field_id' - 'value') <> '{}'::jsonb then
      raise exception 'each custom field item must contain only field_id and value'
        using errcode = '22023';
    end if;

    begin
      v_field_id := (v_item ->> 'field_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'custom field identifier is invalid'
          using errcode = '22023';
    end;

    if v_field_id = any(v_seen_field_ids) then
      raise exception 'custom field values cannot contain duplicate field identifiers'
        using errcode = '22023';
    end if;

    v_seen_field_ids := array_append(v_seen_field_ids, v_field_id);

    select
      f.id,
      f.field_type,
      f.select_options
    into v_field
    from public.roster_custom_fields f
    where f.guild_id = v_access.guild_id
      and f.id = v_field_id;

    if not found then
      raise exception 'all custom fields must belong to the character Guild'
        using errcode = '42501';
    end if;

    if (v_item -> 'value') = 'null'::jsonb then
      continue;
    end if;

    if v_field.field_type = 'text' then
      if jsonb_typeof(v_item -> 'value') <> 'string' then
        raise exception 'text custom field requires a string'
          using errcode = '22023';
      end if;

      v_text := v_item ->> 'value';

      if v_text is distinct from btrim(v_text)
         or char_length(v_text) not between 1 and 120 then
        raise exception 'text custom field must be 1 to 120 trimmed characters'
          using errcode = '22023';
      end if;

      insert into public.character_roster_custom_field_values (
        guild_id,
        character_id,
        field_id,
        value,
        created_by,
        updated_by
      )
      values (
        v_access.guild_id,
        p_character_id,
        v_field_id,
        to_jsonb(v_text),
        v_access.actor_id,
        v_access.actor_id
      );

    elsif v_field.field_type = 'number' then
      if jsonb_typeof(v_item -> 'value') <> 'number' then
        raise exception 'number custom field requires a JSON number'
          using errcode = '22023';
      end if;

      v_number := (v_item ->> 'value')::numeric;

      if v_number < -1000000000000
         or v_number > 1000000000000 then
        raise exception 'number custom field is outside the supported range'
          using errcode = '22023';
      end if;

      insert into public.character_roster_custom_field_values (
        guild_id,
        character_id,
        field_id,
        value,
        created_by,
        updated_by
      )
      values (
        v_access.guild_id,
        p_character_id,
        v_field_id,
        to_jsonb(v_number),
        v_access.actor_id,
        v_access.actor_id
      );

    elsif v_field.field_type = 'boolean' then
      if jsonb_typeof(v_item -> 'value') <> 'boolean' then
        raise exception 'boolean custom field requires true or false'
          using errcode = '22023';
      end if;

      v_boolean := (v_item ->> 'value')::boolean;

      insert into public.character_roster_custom_field_values (
        guild_id,
        character_id,
        field_id,
        value,
        created_by,
        updated_by
      )
      values (
        v_access.guild_id,
        p_character_id,
        v_field_id,
        to_jsonb(v_boolean),
        v_access.actor_id,
        v_access.actor_id
      );

    elsif v_field.field_type = 'select' then
      if jsonb_typeof(v_item -> 'value') <> 'string' then
        raise exception 'select custom field requires a string option'
          using errcode = '22023';
      end if;

      v_text := v_item ->> 'value';

      if not (v_text = any(v_field.select_options)) then
        raise exception 'select custom field value is not an allowed option'
          using errcode = '22023';
      end if;

      insert into public.character_roster_custom_field_values (
        guild_id,
        character_id,
        field_id,
        value,
        created_by,
        updated_by
      )
      values (
        v_access.guild_id,
        p_character_id,
        v_field_id,
        to_jsonb(v_text),
        v_access.actor_id,
        v_access.actor_id
      );
    end if;

    v_saved := v_saved + 1;
  end loop;

  return v_saved;
end;
$$;

revoke all on function public.create_roster_custom_field(uuid, text, text, text[])
from public, anon, authenticated;
revoke all on function public.update_roster_custom_field(uuid, text, text[])
from public, anon, authenticated;
revoke all on function public.delete_roster_custom_field(uuid)
from public, anon, authenticated;
revoke all on function public.set_character_roster_custom_fields(uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.create_roster_custom_field(uuid, text, text, text[])
to authenticated;
grant execute on function public.update_roster_custom_field(uuid, text, text[])
to authenticated;
grant execute on function public.delete_roster_custom_field(uuid)
to authenticated;
grant execute on function public.set_character_roster_custom_fields(uuid, jsonb)
to authenticated;

comment on table public.roster_custom_fields is
  'Guild-defined organizer metadata fields for Master Roster characters.';

comment on table public.character_roster_custom_field_values is
  'Organizer-owned custom field values. RTNW roster sync never modifies this table.';

comment on function public.set_character_roster_custom_fields(uuid, jsonb) is
  'Transactionally replaces one character custom-field values after roster.manage authorization.';
