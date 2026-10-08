-- Phase 6.1B: atomic publish / update / unpublish RPCs.
--
-- Publication lifecycle:
--   unpublished/no state -> publish_event() -> immutable version N, current
--   published            -> update_event_publication() -> immutable version N+1
--   published            -> unpublish_event() -> no current member-visible version
--   unpublished history  -> publish_event() -> immutable version N+1
--
-- Every publication version copies Event metadata, Event-owned structure, and
-- assignment/Character display data before sealing. The Event row is locked
-- first, which serializes publication against Phase 5 assignment mutations
-- that lock the same Event parent row.

-- Match published IGN snapshot validation to the source Character model.
-- Character identity intentionally preserves exact IGN text; do not trim or
-- normalize it at the publication boundary.
alter table public.event_publication_assignments
  drop constraint event_publication_assignments_ign_trimmed;

alter table public.event_publication_assignments
  drop constraint event_publication_assignments_ign_length;

alter table public.event_publication_assignments
  add constraint event_publication_assignments_ign_length
  check (char_length(btrim(character_ign_snapshot)) between 1 and 80);

create or replace function private.require_publish_manage(
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

  if not private.has_guild_capability(p_guild_id, 'publish.manage') then
    raise exception 'publish.manage authority required'
      using errcode = '42501';
  end if;

  return v_actor_id;
end;
$$;

revoke all on function private.require_publish_manage(uuid)
from public, anon, authenticated;

create or replace function private.create_event_publication_version(
  p_event_id uuid,
  p_publication_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event record;
  v_version_id uuid;
  v_version_number integer;
  v_source_count bigint;
  v_snapshot_count bigint;
begin
  select
    e.guild_id,
    e.id as event_id,
    e.event_type_id,
    e.source_template_id,
    e.name,
    e.description,
    e.event_type_name_snapshot,
    e.template_name_snapshot,
    e.uses_areas
  into v_event
  from public.events e
  join public.event_publications p
    on p.guild_id = e.guild_id
   and p.event_id = e.id
   and p.id = p_publication_id
  where e.id = p_event_id;

  if not found then
    raise exception 'Event publication state not found'
      using errcode = 'P0002';
  end if;

  select coalesce(max(v.version_number), 0) + 1
  into v_version_number
  from public.event_publication_versions v
  where v.guild_id = v_event.guild_id
    and v.event_id = p_event_id
    and v.publication_id = p_publication_id;

  insert into public.event_publication_versions (
    guild_id,
    event_id,
    publication_id,
    version_number,
    source_event_type_id,
    source_template_id,
    event_name_snapshot,
    event_description_snapshot,
    event_type_name_snapshot,
    template_name_snapshot,
    uses_areas,
    created_by
  )
  values (
    v_event.guild_id,
    p_event_id,
    p_publication_id,
    v_version_number,
    v_event.event_type_id,
    v_event.source_template_id,
    v_event.name,
    v_event.description,
    v_event.event_type_name_snapshot,
    v_event.template_name_snapshot,
    v_event.uses_areas,
    p_actor_id
  )
  returning id into v_version_id;

  insert into public.event_publication_areas (
    guild_id,
    event_id,
    publication_version_id,
    source_event_area_id,
    name,
    sort_order
  )
  select
    a.guild_id,
    a.event_id,
    v_version_id,
    a.id,
    a.name,
    a.sort_order
  from public.event_areas a
  where a.guild_id = v_event.guild_id
    and a.event_id = p_event_id
  order by a.sort_order, a.id;

  insert into public.event_publication_sections (
    guild_id,
    event_id,
    publication_version_id,
    area_id,
    source_event_section_id,
    name,
    sort_order
  )
  select
    s.guild_id,
    s.event_id,
    v_version_id,
    pa.id,
    s.id,
    s.name,
    s.sort_order
  from public.event_sections s
  left join public.event_publication_areas pa
    on pa.guild_id = s.guild_id
   and pa.event_id = s.event_id
   and pa.publication_version_id = v_version_id
   and pa.source_event_area_id = s.area_id
  where s.guild_id = v_event.guild_id
    and s.event_id = p_event_id
  order by s.sort_order, s.id;

  insert into public.event_publication_parties (
    guild_id,
    event_id,
    publication_version_id,
    section_id,
    source_event_party_id,
    name,
    sort_order
  )
  select
    p.guild_id,
    p.event_id,
    v_version_id,
    ps.id,
    p.id,
    p.name,
    p.sort_order
  from public.event_parties p
  join public.event_publication_sections ps
    on ps.guild_id = p.guild_id
   and ps.event_id = p.event_id
   and ps.publication_version_id = v_version_id
   and ps.source_event_section_id = p.section_id
  where p.guild_id = v_event.guild_id
    and p.event_id = p_event_id
  order by p.sort_order, p.id;

  insert into public.event_publication_slots (
    guild_id,
    event_id,
    publication_version_id,
    party_id,
    source_event_slot_id,
    name,
    role_label,
    sort_order
  )
  select
    s.guild_id,
    s.event_id,
    v_version_id,
    pp.id,
    s.id,
    s.name,
    s.role_label,
    s.sort_order
  from public.event_slots s
  join public.event_publication_parties pp
    on pp.guild_id = s.guild_id
   and pp.event_id = s.event_id
   and pp.publication_version_id = v_version_id
   and pp.source_event_party_id = s.party_id
  where s.guild_id = v_event.guild_id
    and s.event_id = p_event_id
  order by s.sort_order, s.id;

  insert into public.event_publication_assignments (
    guild_id,
    event_id,
    publication_version_id,
    slot_id,
    source_event_assignment_id,
    source_character_id,
    character_ign_snapshot,
    character_class_snapshot,
    character_role_snapshot,
    character_designation_snapshot,
    character_status_snapshot
  )
  select
    a.guild_id,
    a.event_id,
    v_version_id,
    ps.id,
    a.id,
    c.id,
    c.ign,
    c.class_name,
    rp.role_label,
    rp.designation,
    c.status
  from public.event_assignments a
  join public.event_publication_slots ps
    on ps.guild_id = a.guild_id
   and ps.event_id = a.event_id
   and ps.publication_version_id = v_version_id
   and ps.source_event_slot_id = a.slot_id
  join public.characters c
    on c.guild_id = a.guild_id
   and c.id = a.character_id
  left join public.character_roster_profiles rp
    on rp.guild_id = c.guild_id
   and rp.character_id = c.id
  where a.guild_id = v_event.guild_id
    and a.event_id = p_event_id
  order by ps.sort_order, ps.id, a.id;

  select count(*) into v_source_count
  from public.event_areas a
  where a.guild_id = v_event.guild_id
    and a.event_id = p_event_id;
  select count(*) into v_snapshot_count
  from public.event_publication_areas a
  where a.guild_id = v_event.guild_id
    and a.event_id = p_event_id
    and a.publication_version_id = v_version_id;
  if v_source_count <> v_snapshot_count then
    raise exception 'publication Area snapshot is incomplete'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.event_sections s
  where s.guild_id = v_event.guild_id
    and s.event_id = p_event_id;
  select count(*) into v_snapshot_count
  from public.event_publication_sections s
  where s.guild_id = v_event.guild_id
    and s.event_id = p_event_id
    and s.publication_version_id = v_version_id;
  if v_source_count <> v_snapshot_count then
    raise exception 'publication Section snapshot is incomplete'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.event_parties p
  where p.guild_id = v_event.guild_id
    and p.event_id = p_event_id;
  select count(*) into v_snapshot_count
  from public.event_publication_parties p
  where p.guild_id = v_event.guild_id
    and p.event_id = p_event_id
    and p.publication_version_id = v_version_id;
  if v_source_count <> v_snapshot_count then
    raise exception 'publication Party snapshot is incomplete'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.event_slots s
  where s.guild_id = v_event.guild_id
    and s.event_id = p_event_id;
  select count(*) into v_snapshot_count
  from public.event_publication_slots s
  where s.guild_id = v_event.guild_id
    and s.event_id = p_event_id
    and s.publication_version_id = v_version_id;
  if v_source_count <> v_snapshot_count then
    raise exception 'publication Slot snapshot is incomplete'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.event_assignments a
  where a.guild_id = v_event.guild_id
    and a.event_id = p_event_id;
  select count(*) into v_snapshot_count
  from public.event_publication_assignments a
  where a.guild_id = v_event.guild_id
    and a.event_id = p_event_id
    and a.publication_version_id = v_version_id;
  if v_source_count <> v_snapshot_count then
    raise exception 'publication assignment snapshot is incomplete'
      using errcode = '55000';
  end if;

  update public.event_publication_versions
  set sealed_at = clock_timestamp()
  where guild_id = v_event.guild_id
    and event_id = p_event_id
    and publication_id = p_publication_id
    and id = v_version_id;

  return v_version_id;
end;
$$;

revoke all on function private.create_event_publication_version(uuid, uuid, uuid)
from public, anon, authenticated;

create or replace function public.publish_event(
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event record;
  v_actor_id uuid;
  v_publication record;
  v_version_id uuid;
begin
  select e.guild_id, e.status
  into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_publish_manage(v_event.guild_id);

  if v_event.status <> 'active' then
    raise exception 'archived Events cannot be published'
      using errcode = '55000';
  end if;

  insert into public.event_publications (
    guild_id,
    event_id,
    status,
    created_by,
    updated_by
  )
  values (
    v_event.guild_id,
    p_event_id,
    'unpublished',
    v_actor_id,
    v_actor_id
  )
  on conflict (guild_id, event_id) do nothing;

  select p.id, p.status, p.current_version_id
  into v_publication
  from public.event_publications p
  where p.guild_id = v_event.guild_id
    and p.event_id = p_event_id
  for update;

  if v_publication.status = 'published' then
    raise exception 'Event is already published; update the publication instead'
      using errcode = '55000';
  end if;

  v_version_id := private.create_event_publication_version(
    p_event_id,
    v_publication.id,
    v_actor_id
  );

  update public.event_publications
  set
    status = 'published',
    current_version_id = v_version_id,
    published_at = clock_timestamp(),
    unpublished_at = null,
    updated_by = v_actor_id
  where guild_id = v_event.guild_id
    and event_id = p_event_id
    and id = v_publication.id;

  return v_version_id;
end;
$$;

revoke all on function public.publish_event(uuid)
from public, anon, authenticated;
grant execute on function public.publish_event(uuid)
to authenticated;

create or replace function public.update_event_publication(
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event record;
  v_actor_id uuid;
  v_publication record;
  v_version_id uuid;
begin
  select e.guild_id, e.status
  into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_publish_manage(v_event.guild_id);

  if v_event.status <> 'active' then
    raise exception 'archived Events cannot update a publication'
      using errcode = '55000';
  end if;

  select p.id, p.status, p.current_version_id
  into v_publication
  from public.event_publications p
  where p.guild_id = v_event.guild_id
    and p.event_id = p_event_id
  for update;

  if not found or v_publication.status <> 'published' then
    raise exception 'Event must be published before its publication can be updated'
      using errcode = '55000';
  end if;

  v_version_id := private.create_event_publication_version(
    p_event_id,
    v_publication.id,
    v_actor_id
  );

  update public.event_publications
  set
    current_version_id = v_version_id,
    published_at = clock_timestamp(),
    unpublished_at = null,
    updated_by = v_actor_id
  where guild_id = v_event.guild_id
    and event_id = p_event_id
    and id = v_publication.id;

  return v_version_id;
end;
$$;

revoke all on function public.update_event_publication(uuid)
from public, anon, authenticated;
grant execute on function public.update_event_publication(uuid)
to authenticated;

create or replace function public.unpublish_event(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event record;
  v_actor_id uuid;
  v_publication record;
begin
  select e.guild_id, e.status
  into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_publish_manage(v_event.guild_id);

  select p.id, p.status, p.current_version_id
  into v_publication
  from public.event_publications p
  where p.guild_id = v_event.guild_id
    and p.event_id = p_event_id
  for update;

  if not found or v_publication.status <> 'published' then
    raise exception 'Event is not currently published'
      using errcode = '55000';
  end if;

  update public.event_publications
  set
    status = 'unpublished',
    current_version_id = null,
    unpublished_at = clock_timestamp(),
    updated_by = v_actor_id
  where guild_id = v_event.guild_id
    and event_id = p_event_id
    and id = v_publication.id;
end;
$$;

revoke all on function public.unpublish_event(uuid)
from public, anon, authenticated;
grant execute on function public.unpublish_event(uuid)
to authenticated;

comment on function public.publish_event(uuid) is
  'Atomically snapshots one active draft Event into the next immutable publication version and makes it current. Requires publish.manage and an unpublished Event publication state.';

comment on function public.update_event_publication(uuid) is
  'Atomically snapshots the latest active draft Event into the next immutable publication version and replaces the current published pointer while preserving prior versions. Requires publish.manage.';

comment on function public.unpublish_event(uuid) is
  'Atomically removes the current member-visible publication pointer while preserving immutable publication history. Requires publish.manage.';
