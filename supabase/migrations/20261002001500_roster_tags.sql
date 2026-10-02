-- Phase 3.4A: Organizer-owned roster tags.
--
-- Tags are Guild-scoped organizer metadata. They are deliberately separate
-- from RTNW-owned character fields and survive future RTNW roster syncs.

create table public.roster_tags (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint roster_tags_name_trimmed
    check (name = btrim(name)),
  constraint roster_tags_name_length
    check (char_length(name) between 1 and 40),
  constraint roster_tags_guild_id_id_unique
    unique (guild_id, id)
);

create unique index roster_tags_guild_name_ci_unique
  on public.roster_tags (guild_id, lower(name));

create trigger roster_tags_set_updated_at
before update on public.roster_tags
for each row
execute function private.set_updated_at();

create table public.character_roster_tags (
  guild_id uuid not null,
  character_id uuid not null,
  tag_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  primary key (guild_id, character_id, tag_id),

  constraint character_roster_tags_character_fk
    foreign key (guild_id, character_id)
    references public.characters(guild_id, id)
    on delete cascade,

  constraint character_roster_tags_tag_fk
    foreign key (guild_id, tag_id)
    references public.roster_tags(guild_id, id)
    on delete cascade
);

create index character_roster_tags_tag_idx
  on public.character_roster_tags (guild_id, tag_id);

alter table public.roster_tags enable row level security;
alter table public.character_roster_tags enable row level security;

create policy roster_tags_select_roster_managers
on public.roster_tags
for select
to authenticated
using (private.has_guild_capability(guild_id, 'roster.manage'));

create policy character_roster_tags_select_roster_managers
on public.character_roster_tags
for select
to authenticated
using (private.has_guild_capability(guild_id, 'roster.manage'));

revoke all on table public.roster_tags from anon, authenticated;
revoke all on table public.character_roster_tags from anon, authenticated;

grant select on table public.roster_tags to authenticated;
grant select on table public.character_roster_tags to authenticated;

create or replace function public.create_roster_tag(
  p_guild_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_tag_id uuid;
begin
  v_actor_id := private.require_roster_manage(p_guild_id);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 40 then
    raise exception 'tag name must be 1 to 40 trimmed characters'
      using errcode = '22023';
  end if;

  insert into public.roster_tags (
    guild_id,
    name,
    created_by
  )
  values (
    p_guild_id,
    p_name,
    v_actor_id
  )
  returning id into v_tag_id;

  return v_tag_id;
end;
$$;

create or replace function public.rename_roster_tag(
  p_tag_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
begin
  select t.guild_id
  into v_guild_id
  from public.roster_tags t
  where t.id = p_tag_id;

  if v_guild_id is null then
    raise exception 'roster tag not found'
      using errcode = 'P0002';
  end if;

  perform private.require_roster_manage(v_guild_id);

  if p_name is null
     or p_name is distinct from btrim(p_name)
     or char_length(p_name) not between 1 and 40 then
    raise exception 'tag name must be 1 to 40 trimmed characters'
      using errcode = '22023';
  end if;

  update public.roster_tags
  set name = p_name
  where id = p_tag_id;
end;
$$;

create or replace function public.delete_roster_tag(
  p_tag_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
begin
  select t.guild_id
  into v_guild_id
  from public.roster_tags t
  where t.id = p_tag_id;

  if v_guild_id is null then
    raise exception 'roster tag not found'
      using errcode = 'P0002';
  end if;

  perform private.require_roster_manage(v_guild_id);

  delete from public.roster_tags
  where id = p_tag_id;
end;
$$;

create or replace function public.set_character_roster_tags(
  p_character_id uuid,
  p_tag_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_access record;
  v_tag_ids uuid[] := coalesce(p_tag_ids, '{}'::uuid[]);
  v_requested_count integer;
  v_found_count integer;
begin
  select *
  into v_access
  from private.require_roster_character(p_character_id);

  if cardinality(v_tag_ids) > 20
     or array_position(v_tag_ids, null) is not null then
    raise exception 'a character may have at most 20 roster tags'
      using errcode = '22023';
  end if;

  select count(distinct tag_id)
  into v_requested_count
  from unnest(v_tag_ids) as tag_id;

  select count(distinct t.id)
  into v_found_count
  from public.roster_tags t
  where t.guild_id = v_access.guild_id
    and t.id = any(v_tag_ids);

  if v_found_count <> v_requested_count then
    raise exception 'all selected tags must belong to the character Guild'
      using errcode = '42501';
  end if;

  delete from public.character_roster_tags
  where guild_id = v_access.guild_id
    and character_id = p_character_id;

  insert into public.character_roster_tags (
    guild_id,
    character_id,
    tag_id,
    created_by
  )
  select
    v_access.guild_id,
    p_character_id,
    selected.tag_id,
    v_access.actor_id
  from (
    select distinct tag_id
    from unnest(v_tag_ids) as tag_id
  ) selected;

  return v_requested_count;
end;
$$;

revoke all on function public.create_roster_tag(uuid, text)
from public, anon, authenticated;
revoke all on function public.rename_roster_tag(uuid, text)
from public, anon, authenticated;
revoke all on function public.delete_roster_tag(uuid)
from public, anon, authenticated;
revoke all on function public.set_character_roster_tags(uuid, uuid[])
from public, anon, authenticated;

grant execute on function public.create_roster_tag(uuid, text)
to authenticated;
grant execute on function public.rename_roster_tag(uuid, text)
to authenticated;
grant execute on function public.delete_roster_tag(uuid)
to authenticated;
grant execute on function public.set_character_roster_tags(uuid, uuid[])
to authenticated;

comment on table public.roster_tags is
  'Guild-scoped organizer-created labels for Master Roster characters.';

comment on table public.character_roster_tags is
  'Organizer-owned character-to-tag assignments. RTNW sync never modifies this table.';

comment on function public.set_character_roster_tags(uuid, uuid[]) is
  'Transactionally replaces one character roster-tag set after roster.manage authorization.';
