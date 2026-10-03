-- Phase 4.1A: Event Template data foundation.
-- Reusable Guild-scoped templates are separate from future Events. Phase 5
-- Events will take structural snapshots so later Template edits cannot rewrite
-- historical Event structure.

create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_types_name_trimmed check (name = btrim(name)),
  constraint event_types_name_length check (char_length(name) between 1 and 80),
  constraint event_types_description_length
    check (description is null or char_length(btrim(description)) between 1 and 500),
  constraint event_types_status_valid check (status in ('active', 'archived')),
  constraint event_types_guild_id_id_unique unique (guild_id, id)
);

create unique index event_types_guild_name_ci_active_unique
  on public.event_types (guild_id, lower(name))
  where status <> 'archived';

create index event_types_guild_status_name_idx
  on public.event_types (guild_id, status, lower(name));

create trigger event_types_set_updated_at
before update on public.event_types
for each row execute function private.set_updated_at();

create table public.event_templates (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_type_id uuid not null,
  name text not null,
  description text,
  uses_areas boolean not null default false,
  status text not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_templates_event_type_fk
    foreign key (guild_id, event_type_id)
    references public.event_types(guild_id, id) on delete restrict,
  constraint event_templates_name_trimmed check (name = btrim(name)),
  constraint event_templates_name_length check (char_length(name) between 1 and 120),
  constraint event_templates_description_length
    check (description is null or char_length(btrim(description)) between 1 and 1000),
  constraint event_templates_status_valid check (status in ('draft', 'active', 'archived')),
  constraint event_templates_guild_id_id_unique unique (guild_id, id)
);

create unique index event_templates_event_type_name_ci_live_unique
  on public.event_templates (guild_id, event_type_id, lower(name))
  where status <> 'archived';

create index event_templates_guild_type_status_idx
  on public.event_templates (guild_id, event_type_id, status);

create trigger event_templates_set_updated_at
before update on public.event_templates
for each row execute function private.set_updated_at();

create table public.event_template_areas (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  template_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_template_areas_template_fk
    foreign key (guild_id, template_id)
    references public.event_templates(guild_id, id) on delete cascade,
  constraint event_template_areas_name_trimmed check (name = btrim(name)),
  constraint event_template_areas_name_length check (char_length(name) between 1 and 80),
  constraint event_template_areas_sort_order_nonnegative check (sort_order >= 0),
  constraint event_template_areas_scope_id_unique unique (guild_id, template_id, id)
);

create unique index event_template_areas_name_ci_unique
  on public.event_template_areas (guild_id, template_id, lower(name));
create index event_template_areas_order_idx
  on public.event_template_areas (guild_id, template_id, sort_order, id);
create trigger event_template_areas_set_updated_at
before update on public.event_template_areas
for each row execute function private.set_updated_at();

create table public.event_template_sections (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  template_id uuid not null,
  area_id uuid,
  name text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_template_sections_template_fk
    foreign key (guild_id, template_id)
    references public.event_templates(guild_id, id) on delete cascade,
  constraint event_template_sections_area_fk
    foreign key (guild_id, template_id, area_id)
    references public.event_template_areas(guild_id, template_id, id) on delete cascade,
  constraint event_template_sections_name_trimmed check (name = btrim(name)),
  constraint event_template_sections_name_length check (char_length(name) between 1 and 80),
  constraint event_template_sections_sort_order_nonnegative check (sort_order >= 0),
  constraint event_template_sections_scope_id_unique unique (guild_id, template_id, id)
);

create unique index event_template_sections_root_name_ci_unique
  on public.event_template_sections (guild_id, template_id, lower(name))
  where area_id is null;
create unique index event_template_sections_area_name_ci_unique
  on public.event_template_sections (guild_id, template_id, area_id, lower(name))
  where area_id is not null;
create index event_template_sections_order_idx
  on public.event_template_sections (guild_id, template_id, area_id, sort_order, id);
create trigger event_template_sections_set_updated_at
before update on public.event_template_sections
for each row execute function private.set_updated_at();

create table public.event_template_parties (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  template_id uuid not null,
  section_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_template_parties_template_fk
    foreign key (guild_id, template_id)
    references public.event_templates(guild_id, id) on delete cascade,
  constraint event_template_parties_section_fk
    foreign key (guild_id, template_id, section_id)
    references public.event_template_sections(guild_id, template_id, id) on delete cascade,
  constraint event_template_parties_name_trimmed check (name = btrim(name)),
  constraint event_template_parties_name_length check (char_length(name) between 1 and 80),
  constraint event_template_parties_sort_order_nonnegative check (sort_order >= 0),
  constraint event_template_parties_scope_id_unique unique (guild_id, template_id, id)
);

create unique index event_template_parties_name_ci_unique
  on public.event_template_parties (guild_id, template_id, section_id, lower(name));
create index event_template_parties_order_idx
  on public.event_template_parties (guild_id, template_id, section_id, sort_order, id);
create trigger event_template_parties_set_updated_at
before update on public.event_template_parties
for each row execute function private.set_updated_at();

create table public.event_template_slots (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  template_id uuid not null,
  party_id uuid not null,
  name text not null,
  role_label text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_template_slots_template_fk
    foreign key (guild_id, template_id)
    references public.event_templates(guild_id, id) on delete cascade,
  constraint event_template_slots_party_fk
    foreign key (guild_id, template_id, party_id)
    references public.event_template_parties(guild_id, template_id, id) on delete cascade,
  constraint event_template_slots_name_trimmed check (name = btrim(name)),
  constraint event_template_slots_name_length check (char_length(name) between 1 and 80),
  constraint event_template_slots_role_label_trimmed
    check (role_label is null or role_label = btrim(role_label)),
  constraint event_template_slots_role_label_length
    check (role_label is null or char_length(role_label) between 1 and 80),
  constraint event_template_slots_sort_order_nonnegative check (sort_order >= 0),
  constraint event_template_slots_scope_id_unique unique (guild_id, template_id, id)
);

create unique index event_template_slots_name_ci_unique
  on public.event_template_slots (guild_id, template_id, party_id, lower(name));
create index event_template_slots_order_idx
  on public.event_template_slots (guild_id, template_id, party_id, sort_order, id);
create trigger event_template_slots_set_updated_at
before update on public.event_template_slots
for each row execute function private.set_updated_at();

-- Tenant/template scope immutability.
create or replace function private.prevent_guild_scope_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.guild_id is distinct from old.guild_id then
    raise exception '%.guild_id is immutable', tg_table_name using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_guild_scope_change()
from public, anon, authenticated;

create trigger event_types_guild_immutable
before update of guild_id on public.event_types
for each row execute function private.prevent_guild_scope_change();
create trigger event_templates_guild_immutable
before update of guild_id on public.event_templates
for each row execute function private.prevent_guild_scope_change();
create trigger event_template_areas_guild_immutable
before update of guild_id on public.event_template_areas
for each row execute function private.prevent_guild_scope_change();
create trigger event_template_sections_guild_immutable
before update of guild_id on public.event_template_sections
for each row execute function private.prevent_guild_scope_change();
create trigger event_template_parties_guild_immutable
before update of guild_id on public.event_template_parties
for each row execute function private.prevent_guild_scope_change();
create trigger event_template_slots_guild_immutable
before update of guild_id on public.event_template_slots
for each row execute function private.prevent_guild_scope_change();

create or replace function private.prevent_template_child_scope_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.template_id is distinct from old.template_id then
    raise exception '%.template_id is immutable', tg_table_name using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_template_child_scope_change()
from public, anon, authenticated;

create trigger event_template_areas_template_immutable
before update of template_id on public.event_template_areas
for each row execute function private.prevent_template_child_scope_change();
create trigger event_template_sections_template_immutable
before update of template_id on public.event_template_sections
for each row execute function private.prevent_template_child_scope_change();
create trigger event_template_parties_template_immutable
before update of template_id on public.event_template_parties
for each row execute function private.prevent_template_child_scope_change();
create trigger event_template_slots_template_immutable
before update of template_id on public.event_template_slots
for each row execute function private.prevent_template_child_scope_change();

-- Area-mode integrity.
create or replace function private.validate_event_template_area()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_uses_areas boolean;
begin
  select t.uses_areas into v_uses_areas
  from public.event_templates t
  where t.guild_id = new.guild_id and t.id = new.template_id;

  if not found then return new; end if;

  if not v_uses_areas then
    raise exception 'template does not use Areas' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_event_template_area()
from public, anon, authenticated;

create trigger event_template_areas_validate_mode
before insert or update of guild_id, template_id on public.event_template_areas
for each row execute function private.validate_event_template_area();

create or replace function private.validate_event_template_section_area_mode()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_uses_areas boolean;
begin
  select t.uses_areas into v_uses_areas
  from public.event_templates t
  where t.guild_id = new.guild_id and t.id = new.template_id;

  if not found then return new; end if;

  if v_uses_areas and new.area_id is null then
    raise exception 'Area-based template Sections require an Area' using errcode = '23514';
  end if;

  if not v_uses_areas and new.area_id is not null then
    raise exception 'flat template Sections cannot reference an Area' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_event_template_section_area_mode()
from public, anon, authenticated;

create trigger event_template_sections_validate_area_mode
before insert or update of guild_id, template_id, area_id on public.event_template_sections
for each row execute function private.validate_event_template_section_area_mode();

create or replace function private.prevent_event_template_area_mode_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.uses_areas is not distinct from old.uses_areas then return new; end if;

  if exists (
    select 1 from public.event_template_areas a
    where a.guild_id = old.guild_id and a.template_id = old.id
  ) or exists (
    select 1 from public.event_template_sections s
    where s.guild_id = old.guild_id and s.template_id = old.id
  ) then
    raise exception 'template Area mode cannot change after structure exists'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_event_template_area_mode_change()
from public, anon, authenticated;

create trigger event_templates_area_mode_guard
before update of uses_areas on public.event_templates
for each row execute function private.prevent_event_template_area_mode_change();

-- RLS / privileges. Event managers may read reusable templates for future Event
-- creation, but Phase 4.1B mutation RPCs will require templates.manage.
alter table public.event_types enable row level security;
alter table public.event_templates enable row level security;
alter table public.event_template_areas enable row level security;
alter table public.event_template_sections enable row level security;
alter table public.event_template_parties enable row level security;
alter table public.event_template_slots enable row level security;

create policy event_types_select_template_consumers
on public.event_types for select to authenticated
using (
  private.has_guild_capability(guild_id, 'templates.manage')
  or private.has_guild_capability(guild_id, 'events.manage')
);
create policy event_templates_select_template_consumers
on public.event_templates for select to authenticated
using (
  private.has_guild_capability(guild_id, 'templates.manage')
  or private.has_guild_capability(guild_id, 'events.manage')
);
create policy event_template_areas_select_template_consumers
on public.event_template_areas for select to authenticated
using (
  private.has_guild_capability(guild_id, 'templates.manage')
  or private.has_guild_capability(guild_id, 'events.manage')
);
create policy event_template_sections_select_template_consumers
on public.event_template_sections for select to authenticated
using (
  private.has_guild_capability(guild_id, 'templates.manage')
  or private.has_guild_capability(guild_id, 'events.manage')
);
create policy event_template_parties_select_template_consumers
on public.event_template_parties for select to authenticated
using (
  private.has_guild_capability(guild_id, 'templates.manage')
  or private.has_guild_capability(guild_id, 'events.manage')
);
create policy event_template_slots_select_template_consumers
on public.event_template_slots for select to authenticated
using (
  private.has_guild_capability(guild_id, 'templates.manage')
  or private.has_guild_capability(guild_id, 'events.manage')
);

revoke all on table public.event_types from anon, authenticated;
revoke all on table public.event_templates from anon, authenticated;
revoke all on table public.event_template_areas from anon, authenticated;
revoke all on table public.event_template_sections from anon, authenticated;
revoke all on table public.event_template_parties from anon, authenticated;
revoke all on table public.event_template_slots from anon, authenticated;

grant select on table public.event_types to authenticated;
grant select on table public.event_templates to authenticated;
grant select on table public.event_template_areas to authenticated;
grant select on table public.event_template_sections to authenticated;
grant select on table public.event_template_parties to authenticated;
grant select on table public.event_template_slots to authenticated;

comment on table public.event_types is
  'Guild-defined reusable Event categories. Names and structures are never hard-coded globally.';
comment on table public.event_templates is
  'Reusable Guild Event templates. Future Events take independent structural snapshots so template edits do not rewrite Event history.';
comment on table public.event_template_areas is
  'Optional top-level reusable Template grouping. Only valid when the parent Template uses Areas.';
comment on table public.event_template_sections is
  'Reusable Template Section, either directly under a flat Template or under an Area.';
comment on table public.event_template_parties is
  'Reusable Template Party inside a Section.';
comment on table public.event_template_slots is
  'Reusable Template seat inside a Party. Slot row count is Party seat count; role_label is Guild-defined organizer metadata.';
