-- Phase 5.1A: Event-owned structural snapshot + assignment data foundation.
--
-- Events are independent planning records created from reusable Templates.
-- The Event keeps provenance to its source Template/Event Type, but owns copied
-- Area -> Section -> Party -> Slot rows so later Template edits cannot silently
-- restructure the Event.
--
-- Assignment rows intentionally enforce one Character per Slot, but do NOT
-- enforce one Slot per Character. Draft duplicate assignments are therefore
-- representable and can be surfaced by the Phase 5 warning engine.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_type_id uuid not null,
  source_template_id uuid not null,
  name text not null,
  description text,
  event_type_name_snapshot text not null,
  template_name_snapshot text not null,
  uses_areas boolean not null,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_event_type_fk
    foreign key (guild_id, event_type_id)
    references public.event_types(guild_id, id) on delete restrict,
  constraint events_source_template_fk
    foreign key (guild_id, source_template_id)
    references public.event_templates(guild_id, id) on delete restrict,
  constraint events_name_trimmed check (name = btrim(name)),
  constraint events_name_length check (char_length(name) between 1 and 120),
  constraint events_description_length check (
    description is null or char_length(btrim(description)) between 1 and 1000
  ),
  constraint events_event_type_name_snapshot_trimmed
    check (event_type_name_snapshot = btrim(event_type_name_snapshot)),
  constraint events_event_type_name_snapshot_length
    check (char_length(event_type_name_snapshot) between 1 and 80),
  constraint events_template_name_snapshot_trimmed
    check (template_name_snapshot = btrim(template_name_snapshot)),
  constraint events_template_name_snapshot_length
    check (char_length(template_name_snapshot) between 1 and 120),
  constraint events_status_valid check (status in ('active', 'archived')),
  constraint events_guild_id_id_unique unique (guild_id, id)
);

create index events_guild_status_updated_idx
  on public.events (guild_id, status, updated_at desc, id);
create index events_guild_event_type_idx
  on public.events (guild_id, event_type_id, status, id);
create index events_source_template_idx
  on public.events (guild_id, source_template_id, id);

create trigger events_set_updated_at
before update on public.events
for each row execute function private.set_updated_at();

create or replace function private.capture_event_source_provenance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_template record;
begin
  select
    t.guild_id,
    t.event_type_id,
    t.name as template_name,
    t.uses_areas,
    t.status as template_status,
    et.name as event_type_name,
    et.status as event_type_status
  into v_template
  from public.event_templates t
  join public.event_types et
    on et.guild_id = t.guild_id
   and et.id = t.event_type_id
  where t.id = new.source_template_id;

  if not found then
    raise exception 'source event Template not found'
      using errcode = 'P0002';
  end if;

  if new.guild_id <> v_template.guild_id then
    raise exception 'source event Template must belong to the Event Guild'
      using errcode = '23514';
  end if;

  if v_template.template_status <> 'active'
     or v_template.event_type_status <> 'active' then
    raise exception 'Event creation requires an active Template and Event Type'
      using errcode = '23514';
  end if;

  if new.event_type_id is not null
     and new.event_type_id <> v_template.event_type_id then
    raise exception 'Event Type must match the source Template'
      using errcode = '23514';
  end if;

  new.event_type_id := v_template.event_type_id;
  new.event_type_name_snapshot := v_template.event_type_name;
  new.template_name_snapshot := v_template.template_name;
  new.uses_areas := v_template.uses_areas;
  return new;
end;
$$;

revoke all on function private.capture_event_source_provenance()
from public, anon, authenticated;

create trigger events_capture_source_provenance
before insert on public.events
for each row execute function private.capture_event_source_provenance();

create or replace function private.prevent_event_provenance_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.guild_id is distinct from old.guild_id then
    raise exception 'events.guild_id is immutable' using errcode = '55000';
  end if;

  if new.event_type_id is distinct from old.event_type_id
     or new.source_template_id is distinct from old.source_template_id
     or new.event_type_name_snapshot is distinct from old.event_type_name_snapshot
     or new.template_name_snapshot is distinct from old.template_name_snapshot
     or new.uses_areas is distinct from old.uses_areas then
    raise exception 'Event source provenance is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_event_provenance_change()
from public, anon, authenticated;

create trigger events_provenance_immutable
before update of guild_id, event_type_id, source_template_id,
  event_type_name_snapshot, template_name_snapshot, uses_areas
on public.events
for each row execute function private.prevent_event_provenance_change();

create table public.event_areas (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_areas_event_fk
    foreign key (guild_id, event_id)
    references public.events(guild_id, id) on delete cascade,
  constraint event_areas_name_trimmed check (name = btrim(name)),
  constraint event_areas_name_length check (char_length(name) between 1 and 80),
  constraint event_areas_sort_order_nonnegative check (sort_order >= 0),
  constraint event_areas_scope_id_unique unique (guild_id, event_id, id)
);
create unique index event_areas_name_ci_unique
  on public.event_areas (guild_id, event_id, lower(name));
create index event_areas_order_idx
  on public.event_areas (guild_id, event_id, sort_order, id);
create trigger event_areas_set_updated_at
before update on public.event_areas
for each row execute function private.set_updated_at();

create table public.event_sections (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  area_id uuid,
  name text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_sections_event_fk
    foreign key (guild_id, event_id)
    references public.events(guild_id, id) on delete cascade,
  constraint event_sections_area_fk
    foreign key (guild_id, event_id, area_id)
    references public.event_areas(guild_id, event_id, id) on delete cascade,
  constraint event_sections_name_trimmed check (name = btrim(name)),
  constraint event_sections_name_length check (char_length(name) between 1 and 80),
  constraint event_sections_sort_order_nonnegative check (sort_order >= 0),
  constraint event_sections_scope_id_unique unique (guild_id, event_id, id)
);
create unique index event_sections_root_name_ci_unique
  on public.event_sections (guild_id, event_id, lower(name)) where area_id is null;
create unique index event_sections_area_name_ci_unique
  on public.event_sections (guild_id, event_id, area_id, lower(name)) where area_id is not null;
create index event_sections_order_idx
  on public.event_sections (guild_id, event_id, area_id, sort_order, id);
create trigger event_sections_set_updated_at
before update on public.event_sections
for each row execute function private.set_updated_at();

create table public.event_parties (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  section_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_parties_event_fk
    foreign key (guild_id, event_id)
    references public.events(guild_id, id) on delete cascade,
  constraint event_parties_section_fk
    foreign key (guild_id, event_id, section_id)
    references public.event_sections(guild_id, event_id, id) on delete cascade,
  constraint event_parties_name_trimmed check (name = btrim(name)),
  constraint event_parties_name_length check (char_length(name) between 1 and 80),
  constraint event_parties_sort_order_nonnegative check (sort_order >= 0),
  constraint event_parties_scope_id_unique unique (guild_id, event_id, id)
);
create unique index event_parties_name_ci_unique
  on public.event_parties (guild_id, event_id, section_id, lower(name));
create index event_parties_order_idx
  on public.event_parties (guild_id, event_id, section_id, sort_order, id);
create trigger event_parties_set_updated_at
before update on public.event_parties
for each row execute function private.set_updated_at();

create table public.event_slots (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  party_id uuid not null,
  name text not null,
  role_label text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_slots_event_fk
    foreign key (guild_id, event_id)
    references public.events(guild_id, id) on delete cascade,
  constraint event_slots_party_fk
    foreign key (guild_id, event_id, party_id)
    references public.event_parties(guild_id, event_id, id) on delete cascade,
  constraint event_slots_name_trimmed check (name = btrim(name)),
  constraint event_slots_name_length check (char_length(name) between 1 and 80),
  constraint event_slots_role_label_trimmed check (role_label is null or role_label = btrim(role_label)),
  constraint event_slots_role_label_length check (role_label is null or char_length(role_label) between 1 and 80),
  constraint event_slots_sort_order_nonnegative check (sort_order >= 0),
  constraint event_slots_scope_id_unique unique (guild_id, event_id, id)
);
create unique index event_slots_name_ci_unique
  on public.event_slots (guild_id, event_id, party_id, lower(name));
create index event_slots_order_idx
  on public.event_slots (guild_id, event_id, party_id, sort_order, id);
create trigger event_slots_set_updated_at
before update on public.event_slots
for each row execute function private.set_updated_at();

create table public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  event_id uuid not null,
  slot_id uuid not null,
  character_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_assignments_event_fk
    foreign key (guild_id, event_id)
    references public.events(guild_id, id) on delete cascade,
  constraint event_assignments_slot_fk
    foreign key (guild_id, event_id, slot_id)
    references public.event_slots(guild_id, event_id, id) on delete cascade,
  constraint event_assignments_character_fk
    foreign key (guild_id, character_id)
    references public.characters(guild_id, id) on delete restrict,
  constraint event_assignments_one_character_per_slot
    unique (guild_id, event_id, slot_id),
  constraint event_assignments_scope_id_unique unique (guild_id, event_id, id)
);
create index event_assignments_character_idx
  on public.event_assignments (guild_id, event_id, character_id, id);
create trigger event_assignments_set_updated_at
before update on public.event_assignments
for each row execute function private.set_updated_at();

create or replace function private.prevent_event_child_scope_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.guild_id is distinct from old.guild_id then
    raise exception '%.guild_id is immutable', tg_table_name using errcode = '55000';
  end if;
  if new.event_id is distinct from old.event_id then
    raise exception '%.event_id is immutable', tg_table_name using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_event_child_scope_change()
from public, anon, authenticated;

create trigger event_areas_scope_immutable
before update of guild_id, event_id on public.event_areas
for each row execute function private.prevent_event_child_scope_change();
create trigger event_sections_scope_immutable
before update of guild_id, event_id on public.event_sections
for each row execute function private.prevent_event_child_scope_change();
create trigger event_parties_scope_immutable
before update of guild_id, event_id on public.event_parties
for each row execute function private.prevent_event_child_scope_change();
create trigger event_slots_scope_immutable
before update of guild_id, event_id on public.event_slots
for each row execute function private.prevent_event_child_scope_change();
create trigger event_assignments_scope_immutable
before update of guild_id, event_id on public.event_assignments
for each row execute function private.prevent_event_child_scope_change();

create or replace function private.validate_event_area()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_uses_areas boolean;
begin
  select e.uses_areas into v_uses_areas
  from public.events e
  where e.guild_id = new.guild_id and e.id = new.event_id;
  if not found then return new; end if;
  if not v_uses_areas then
    raise exception 'Event does not use Areas' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_event_area()
from public, anon, authenticated;
create trigger event_areas_validate_mode
before insert or update of guild_id, event_id on public.event_areas
for each row execute function private.validate_event_area();

create or replace function private.validate_event_section_area_mode()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_uses_areas boolean;
begin
  select e.uses_areas into v_uses_areas
  from public.events e
  where e.guild_id = new.guild_id and e.id = new.event_id;
  if not found then return new; end if;
  if v_uses_areas and new.area_id is null then
    raise exception 'Area-based Event Sections require an Area' using errcode = '23514';
  end if;
  if not v_uses_areas and new.area_id is not null then
    raise exception 'flat Event Sections cannot reference an Area' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_event_section_area_mode()
from public, anon, authenticated;
create trigger event_sections_validate_area_mode
before insert or update of guild_id, event_id, area_id on public.event_sections
for each row execute function private.validate_event_section_area_mode();

alter table public.events enable row level security;
alter table public.event_areas enable row level security;
alter table public.event_sections enable row level security;
alter table public.event_parties enable row level security;
alter table public.event_slots enable row level security;
alter table public.event_assignments enable row level security;

create policy events_select_managers on public.events for select to authenticated
using (private.has_guild_capability(guild_id, 'events.manage') or private.has_guild_capability(guild_id, 'publish.manage'));
create policy event_areas_select_managers on public.event_areas for select to authenticated
using (private.has_guild_capability(guild_id, 'events.manage') or private.has_guild_capability(guild_id, 'publish.manage'));
create policy event_sections_select_managers on public.event_sections for select to authenticated
using (private.has_guild_capability(guild_id, 'events.manage') or private.has_guild_capability(guild_id, 'publish.manage'));
create policy event_parties_select_managers on public.event_parties for select to authenticated
using (private.has_guild_capability(guild_id, 'events.manage') or private.has_guild_capability(guild_id, 'publish.manage'));
create policy event_slots_select_managers on public.event_slots for select to authenticated
using (private.has_guild_capability(guild_id, 'events.manage') or private.has_guild_capability(guild_id, 'publish.manage'));
create policy event_assignments_select_managers on public.event_assignments for select to authenticated
using (private.has_guild_capability(guild_id, 'events.manage') or private.has_guild_capability(guild_id, 'publish.manage'));

revoke all on table public.events from anon, authenticated;
revoke all on table public.event_areas from anon, authenticated;
revoke all on table public.event_sections from anon, authenticated;
revoke all on table public.event_parties from anon, authenticated;
revoke all on table public.event_slots from anon, authenticated;
revoke all on table public.event_assignments from anon, authenticated;

grant select on table public.events to authenticated;
grant select on table public.event_areas to authenticated;
grant select on table public.event_sections to authenticated;
grant select on table public.event_parties to authenticated;
grant select on table public.event_slots to authenticated;
grant select on table public.event_assignments to authenticated;

comment on table public.events is
  'Guild Event planning record created from an active reusable Template. Event-owned structure is copied into independent snapshot tables.';
comment on table public.event_areas is
  'Optional Event-owned top-level Area snapshot copied from the source Template and independently editable by later Event RPCs.';
comment on table public.event_sections is
  'Event-owned Section snapshot stored directly under a flat Event or under an Event Area.';
comment on table public.event_parties is
  'Event-owned Party snapshot inside an Event Section.';
comment on table public.event_slots is
  'Event-owned Slot snapshot inside an Event Party, including a required-role label copied from the source Template.';
comment on table public.event_assignments is
  'Current draft Event Slot assignment. One Character per Slot; the same Character may occupy multiple Slots so duplicate assignments can be detected as warnings.';
