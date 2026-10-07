-- Phase 6.1A: immutable Event publication-version data foundation.
--
-- Draft Events remain mutable planning state. Publishing creates a separate,
-- historical version whose metadata, structure, and Character display fields
-- are copied into publication-owned snapshot tables. Later Event/roster edits
-- therefore cannot silently rewrite what members previously saw.
--
-- This checkpoint creates the data model and immutability/security boundaries.
-- Atomic publish/update/unpublish RPCs are added in Phase 6.1B.

create table public.event_publications (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id uuid not null,
  status text not null default 'unpublished',
  current_version_id uuid,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_publications_event_fk
    foreign key (guild_id, event_id)
    references public.events(guild_id, id) on delete cascade,
  constraint event_publications_status_valid
    check (status in ('published', 'unpublished')),
  constraint event_publications_state_consistent
    check (
      (
        status = 'published'
        and current_version_id is not null
        and published_at is not null
        and unpublished_at is null
      )
      or
      (
        status = 'unpublished'
        and current_version_id is null
      )
    ),
  constraint event_publications_one_per_event
    unique (guild_id, event_id),
  constraint event_publications_scope_id_unique
    unique (guild_id, event_id, id)
);

create index event_publications_guild_status_idx
  on public.event_publications (guild_id, status, updated_at desc, id);

create trigger event_publications_set_updated_at
before update on public.event_publications
for each row execute function private.set_updated_at();

create table public.event_publication_versions (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  publication_id uuid not null,
  version_number integer not null,
  source_event_type_id uuid not null,
  source_template_id uuid not null,
  event_name_snapshot text not null,
  event_description_snapshot text,
  event_type_name_snapshot text not null,
  template_name_snapshot text not null,
  uses_areas boolean not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sealed_at timestamptz,
  constraint event_publication_versions_publication_fk
    foreign key (guild_id, event_id, publication_id)
    references public.event_publications(guild_id, event_id, id)
    on delete cascade,
  constraint event_publication_versions_number_positive
    check (version_number > 0),
  constraint event_publication_versions_event_name_trimmed
    check (event_name_snapshot = btrim(event_name_snapshot)),
  constraint event_publication_versions_event_name_length
    check (char_length(event_name_snapshot) between 1 and 120),
  constraint event_publication_versions_description_length
    check (
      event_description_snapshot is null
      or char_length(btrim(event_description_snapshot)) between 1 and 1000
    ),
  constraint event_publication_versions_event_type_name_trimmed
    check (event_type_name_snapshot = btrim(event_type_name_snapshot)),
  constraint event_publication_versions_event_type_name_length
    check (char_length(event_type_name_snapshot) between 1 and 80),
  constraint event_publication_versions_template_name_trimmed
    check (template_name_snapshot = btrim(template_name_snapshot)),
  constraint event_publication_versions_template_name_length
    check (char_length(template_name_snapshot) between 1 and 120),
  constraint event_publication_versions_sealed_after_create
    check (sealed_at is null or sealed_at >= created_at),
  constraint event_publication_versions_number_unique
    unique (publication_id, version_number),
  constraint event_publication_versions_event_number_unique
    unique (guild_id, event_id, version_number),
  constraint event_publication_versions_scope_id_unique
    unique (guild_id, event_id, id),
  constraint event_publication_versions_publication_scope_id_unique
    unique (guild_id, event_id, publication_id, id)
);

create index event_publication_versions_history_idx
  on public.event_publication_versions
    (guild_id, event_id, version_number desc, id);

alter table public.event_publications
  add constraint event_publications_current_version_fk
  foreign key (guild_id, event_id, id, current_version_id)
  references public.event_publication_versions(
    guild_id, event_id, publication_id, id
  )
  on delete no action
  deferrable initially deferred;

create table public.event_publication_areas (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  publication_version_id uuid not null,
  source_event_area_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint event_publication_areas_version_fk
    foreign key (guild_id, event_id, publication_version_id)
    references public.event_publication_versions(guild_id, event_id, id)
    on delete cascade,
  constraint event_publication_areas_name_trimmed
    check (name = btrim(name)),
  constraint event_publication_areas_name_length
    check (char_length(name) between 1 and 80),
  constraint event_publication_areas_sort_order_nonnegative
    check (sort_order >= 0),
  constraint event_publication_areas_scope_id_unique
    unique (guild_id, event_id, publication_version_id, id),
  constraint event_publication_areas_source_unique
    unique (publication_version_id, source_event_area_id)
);

create index event_publication_areas_order_idx
  on public.event_publication_areas
    (guild_id, event_id, publication_version_id, sort_order, id);

create table public.event_publication_sections (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  publication_version_id uuid not null,
  area_id uuid,
  source_event_section_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint event_publication_sections_version_fk
    foreign key (guild_id, event_id, publication_version_id)
    references public.event_publication_versions(guild_id, event_id, id)
    on delete cascade,
  constraint event_publication_sections_area_fk
    foreign key (guild_id, event_id, publication_version_id, area_id)
    references public.event_publication_areas(
      guild_id, event_id, publication_version_id, id
    )
    on delete cascade,
  constraint event_publication_sections_name_trimmed
    check (name = btrim(name)),
  constraint event_publication_sections_name_length
    check (char_length(name) between 1 and 80),
  constraint event_publication_sections_sort_order_nonnegative
    check (sort_order >= 0),
  constraint event_publication_sections_scope_id_unique
    unique (guild_id, event_id, publication_version_id, id),
  constraint event_publication_sections_source_unique
    unique (publication_version_id, source_event_section_id)
);

create index event_publication_sections_order_idx
  on public.event_publication_sections
    (guild_id, event_id, publication_version_id, area_id, sort_order, id);

create table public.event_publication_parties (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  publication_version_id uuid not null,
  section_id uuid not null,
  source_event_party_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint event_publication_parties_version_fk
    foreign key (guild_id, event_id, publication_version_id)
    references public.event_publication_versions(guild_id, event_id, id)
    on delete cascade,
  constraint event_publication_parties_section_fk
    foreign key (guild_id, event_id, publication_version_id, section_id)
    references public.event_publication_sections(
      guild_id, event_id, publication_version_id, id
    )
    on delete cascade,
  constraint event_publication_parties_name_trimmed
    check (name = btrim(name)),
  constraint event_publication_parties_name_length
    check (char_length(name) between 1 and 80),
  constraint event_publication_parties_sort_order_nonnegative
    check (sort_order >= 0),
  constraint event_publication_parties_scope_id_unique
    unique (guild_id, event_id, publication_version_id, id),
  constraint event_publication_parties_source_unique
    unique (publication_version_id, source_event_party_id)
);

create index event_publication_parties_order_idx
  on public.event_publication_parties
    (guild_id, event_id, publication_version_id, section_id, sort_order, id);

create table public.event_publication_slots (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  publication_version_id uuid not null,
  party_id uuid not null,
  source_event_slot_id uuid not null,
  name text not null,
  role_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint event_publication_slots_version_fk
    foreign key (guild_id, event_id, publication_version_id)
    references public.event_publication_versions(guild_id, event_id, id)
    on delete cascade,
  constraint event_publication_slots_party_fk
    foreign key (guild_id, event_id, publication_version_id, party_id)
    references public.event_publication_parties(
      guild_id, event_id, publication_version_id, id
    )
    on delete cascade,
  constraint event_publication_slots_name_trimmed
    check (name = btrim(name)),
  constraint event_publication_slots_name_length
    check (char_length(name) between 1 and 80),
  constraint event_publication_slots_role_label_trimmed
    check (role_label is null or role_label = btrim(role_label)),
  constraint event_publication_slots_role_label_length
    check (role_label is null or char_length(role_label) between 1 and 80),
  constraint event_publication_slots_sort_order_nonnegative
    check (sort_order >= 0),
  constraint event_publication_slots_scope_id_unique
    unique (guild_id, event_id, publication_version_id, id),
  constraint event_publication_slots_source_unique
    unique (publication_version_id, source_event_slot_id)
);

create index event_publication_slots_order_idx
  on public.event_publication_slots
    (guild_id, event_id, publication_version_id, party_id, sort_order, id);

create table public.event_publication_assignments (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  publication_version_id uuid not null,
  slot_id uuid not null,
  source_event_assignment_id uuid not null,
  source_character_id uuid not null,
  character_ign_snapshot text not null,
  character_class_snapshot text,
  character_role_snapshot text,
  character_designation_snapshot text,
  character_status_snapshot text not null,
  created_at timestamptz not null default now(),
  constraint event_publication_assignments_version_fk
    foreign key (guild_id, event_id, publication_version_id)
    references public.event_publication_versions(guild_id, event_id, id)
    on delete cascade,
  constraint event_publication_assignments_slot_fk
    foreign key (guild_id, event_id, publication_version_id, slot_id)
    references public.event_publication_slots(
      guild_id, event_id, publication_version_id, id
    )
    on delete cascade,
  constraint event_publication_assignments_one_character_per_slot
    unique (publication_version_id, slot_id),
  constraint event_publication_assignments_source_assignment_unique
    unique (publication_version_id, source_event_assignment_id),
  constraint event_publication_assignments_ign_trimmed
    check (character_ign_snapshot = btrim(character_ign_snapshot)),
  constraint event_publication_assignments_ign_length
    check (char_length(character_ign_snapshot) between 1 and 80),
  constraint event_publication_assignments_class_length
    check (
      character_class_snapshot is null
      or char_length(character_class_snapshot) between 1 and 80
    ),
  constraint event_publication_assignments_role_length
    check (
      character_role_snapshot is null
      or char_length(btrim(character_role_snapshot)) between 1 and 80
    ),
  constraint event_publication_assignments_designation_valid
    check (
      character_designation_snapshot is null
      or character_designation_snapshot in ('main', 'sub')
    ),
  constraint event_publication_assignments_status_valid
    check (character_status_snapshot in ('active', 'inactive')),
  constraint event_publication_assignments_scope_id_unique
    unique (guild_id, event_id, publication_version_id, id)
);

create index event_publication_assignments_character_idx
  on public.event_publication_assignments
    (guild_id, publication_version_id, source_character_id, id);

create index event_publication_assignments_ign_idx
  on public.event_publication_assignments
    (guild_id, publication_version_id, lower(character_ign_snapshot), id);

-- Publication identity belongs permanently to one Event.
create or replace function private.prevent_event_publication_scope_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.id is distinct from old.id
     or new.guild_id is distinct from old.guild_id
     or new.event_id is distinct from old.event_id then
    raise exception 'Event publication identity/scope is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_event_publication_scope_change()
from public, anon, authenticated;

create trigger event_publications_scope_immutable
before update of id, guild_id, event_id on public.event_publications
for each row execute function private.prevent_event_publication_scope_change();

-- A version is assembled while unsealed. The only allowed version-row update
-- is the one-way transition from sealed_at = null to a timestamp.
create or replace function private.guard_event_publication_version_write()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.sealed_at is not null then
      raise exception 'publication versions must be assembled before sealing'
        using errcode = '55000';
    end if;
    return new;
  end if;

  if old.sealed_at is not null then
    raise exception 'sealed publication versions are immutable'
      using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.guild_id is distinct from old.guild_id
     or new.event_id is distinct from old.event_id
     or new.publication_id is distinct from old.publication_id
     or new.version_number is distinct from old.version_number
     or new.source_event_type_id is distinct from old.source_event_type_id
     or new.source_template_id is distinct from old.source_template_id
     or new.event_name_snapshot is distinct from old.event_name_snapshot
     or new.event_description_snapshot is distinct from old.event_description_snapshot
     or new.event_type_name_snapshot is distinct from old.event_type_name_snapshot
     or new.template_name_snapshot is distinct from old.template_name_snapshot
     or new.uses_areas is distinct from old.uses_areas
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'publication version content is immutable'
      using errcode = '55000';
  end if;

  if new.sealed_at is null then
    raise exception 'publication version updates may only seal the version'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_event_publication_version_write()
from public, anon, authenticated;

create trigger event_publication_versions_guard_write
before insert or update on public.event_publication_versions
for each row execute function private.guard_event_publication_version_write();

-- Snapshot children may be assembled only while their version is unsealed.
-- Direct table writes remain unavailable to app roles. DELETE is intentionally
-- not blocked here so Guild/Event cascade cleanup can still function.
create or replace function private.guard_event_publication_snapshot_write()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_sealed_at timestamptz;
begin
  if tg_op = 'UPDATE'
     and (
       new.guild_id is distinct from old.guild_id
       or new.event_id is distinct from old.event_id
       or new.publication_version_id is distinct from old.publication_version_id
     ) then
    raise exception 'publication snapshot scope is immutable'
      using errcode = '55000';
  end if;

  select v.sealed_at
  into v_sealed_at
  from public.event_publication_versions v
  where v.guild_id = new.guild_id
    and v.event_id = new.event_id
    and v.id = new.publication_version_id;

  if not found then
    raise exception 'publication version not found'
      using errcode = 'P0002';
  end if;

  if v_sealed_at is not null then
    raise exception 'sealed publication snapshot is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_event_publication_snapshot_write()
from public, anon, authenticated;

create trigger event_publication_areas_guard_write
before insert or update on public.event_publication_areas
for each row execute function private.guard_event_publication_snapshot_write();

create trigger event_publication_sections_guard_write
before insert or update on public.event_publication_sections
for each row execute function private.guard_event_publication_snapshot_write();

create trigger event_publication_parties_guard_write
before insert or update on public.event_publication_parties
for each row execute function private.guard_event_publication_snapshot_write();

create trigger event_publication_slots_guard_write
before insert or update on public.event_publication_slots
for each row execute function private.guard_event_publication_snapshot_write();

create trigger event_publication_assignments_guard_write
before insert or update on public.event_publication_assignments
for each row execute function private.guard_event_publication_snapshot_write();

create or replace function private.validate_event_publication_area_mode()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_uses_areas boolean;
begin
  select v.uses_areas
  into v_uses_areas
  from public.event_publication_versions v
  where v.guild_id = new.guild_id
    and v.event_id = new.event_id
    and v.id = new.publication_version_id;

  if not found then
    return new;
  end if;

  if not v_uses_areas then
    raise exception 'published Event version does not use Areas'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_event_publication_area_mode()
from public, anon, authenticated;

create trigger event_publication_areas_validate_mode
before insert or update of guild_id, event_id, publication_version_id
on public.event_publication_areas
for each row execute function private.validate_event_publication_area_mode();

create or replace function private.validate_event_publication_section_area_mode()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_uses_areas boolean;
begin
  select v.uses_areas
  into v_uses_areas
  from public.event_publication_versions v
  where v.guild_id = new.guild_id
    and v.event_id = new.event_id
    and v.id = new.publication_version_id;

  if not found then
    return new;
  end if;

  if v_uses_areas and new.area_id is null then
    raise exception 'Area-based published Event Sections require an Area'
      using errcode = '23514';
  end if;

  if not v_uses_areas and new.area_id is not null then
    raise exception 'flat published Event Sections cannot reference an Area'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_event_publication_section_area_mode()
from public, anon, authenticated;

create trigger event_publication_sections_validate_area_mode
before insert or update of guild_id, event_id, publication_version_id, area_id
on public.event_publication_sections
for each row execute function private.validate_event_publication_section_area_mode();

-- An active/current publication pointer may reference only a sealed version
-- belonging to the same Event publication.
create or replace function private.validate_event_publication_current_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_sealed_at timestamptz;
begin
  if new.status = 'unpublished' then
    if new.current_version_id is not null then
      raise exception 'unpublished Event publication cannot have a current version'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.current_version_id is null then
    raise exception 'published Event publication requires a current version'
      using errcode = '23514';
  end if;

  select v.sealed_at
  into v_sealed_at
  from public.event_publication_versions v
  where v.guild_id = new.guild_id
    and v.event_id = new.event_id
    and v.publication_id = new.id
    and v.id = new.current_version_id;

  if not found or v_sealed_at is null then
    raise exception 'current publication version must exist and be sealed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_event_publication_current_version()
from public, anon, authenticated;

create trigger event_publications_validate_current_version
before insert or update of status, current_version_id
on public.event_publications
for each row execute function private.validate_event_publication_current_version();

-- Organizer-side publication history is management data. Direct writes are
-- revoked; Phase 6.1B SECURITY DEFINER RPCs will be the mutation surface.
-- Member/share access will use a separate narrow read surface in Phase 6.3.
alter table public.event_publications enable row level security;
alter table public.event_publication_versions enable row level security;
alter table public.event_publication_areas enable row level security;
alter table public.event_publication_sections enable row level security;
alter table public.event_publication_parties enable row level security;
alter table public.event_publication_slots enable row level security;
alter table public.event_publication_assignments enable row level security;

create policy event_publications_select_managers
on public.event_publications
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'events.manage')
  or private.has_guild_capability(guild_id, 'publish.manage')
);

create policy event_publication_versions_select_managers
on public.event_publication_versions
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'events.manage')
  or private.has_guild_capability(guild_id, 'publish.manage')
);

create policy event_publication_areas_select_managers
on public.event_publication_areas
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'events.manage')
  or private.has_guild_capability(guild_id, 'publish.manage')
);

create policy event_publication_sections_select_managers
on public.event_publication_sections
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'events.manage')
  or private.has_guild_capability(guild_id, 'publish.manage')
);

create policy event_publication_parties_select_managers
on public.event_publication_parties
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'events.manage')
  or private.has_guild_capability(guild_id, 'publish.manage')
);

create policy event_publication_slots_select_managers
on public.event_publication_slots
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'events.manage')
  or private.has_guild_capability(guild_id, 'publish.manage')
);

create policy event_publication_assignments_select_managers
on public.event_publication_assignments
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'events.manage')
  or private.has_guild_capability(guild_id, 'publish.manage')
);

revoke all on table public.event_publications from anon, authenticated;
revoke all on table public.event_publication_versions from anon, authenticated;
revoke all on table public.event_publication_areas from anon, authenticated;
revoke all on table public.event_publication_sections from anon, authenticated;
revoke all on table public.event_publication_parties from anon, authenticated;
revoke all on table public.event_publication_slots from anon, authenticated;
revoke all on table public.event_publication_assignments from anon, authenticated;

grant select on table public.event_publications to authenticated;
grant select on table public.event_publication_versions to authenticated;
grant select on table public.event_publication_areas to authenticated;
grant select on table public.event_publication_sections to authenticated;
grant select on table public.event_publication_parties to authenticated;
grant select on table public.event_publication_slots to authenticated;
grant select on table public.event_publication_assignments to authenticated;

comment on table public.event_publications is
  'Mutable per-Event publication state. current_version_id points only to a sealed immutable publication version while status=published.';

comment on table public.event_publication_versions is
  'Historical publication-version metadata snapshot. Once sealed, version content is immutable at the database boundary.';

comment on table public.event_publication_areas is
  'Immutable Area snapshot belonging to one published Event version.';

comment on table public.event_publication_sections is
  'Immutable Section snapshot belonging to one published Event version.';

comment on table public.event_publication_parties is
  'Immutable Party snapshot belonging to one published Event version.';

comment on table public.event_publication_slots is
  'Immutable Slot/required-role snapshot belonging to one published Event version.';

comment on table public.event_publication_assignments is
  'Immutable published assignment snapshot, including stable source Character UUID plus display fields needed independently of later roster edits.';
