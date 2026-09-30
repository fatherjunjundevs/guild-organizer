-- Phase 3.2B: Core identity, guild, membership, capability, and RLS foundation.
-- This migration intentionally does not add roster, import, template, or event tables.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (
      display_name is null
      or char_length(btrim(display_name)) between 1 and 80
    )
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      ''
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user()
from public, anon, authenticated;

create trigger guild_organizer_on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_auth_user();

-- Backfill profiles if the migration is applied to an environment that already
-- contains auth users.
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  nullif(
    btrim(
      coalesce(
        u.raw_user_meta_data ->> 'display_name',
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  ),
  nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users as u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Guilds and memberships
-- ---------------------------------------------------------------------------

create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guilds_name_length
    check (char_length(btrim(name)) between 2 and 80),
  constraint guilds_status_valid
    check (status in ('active', 'archived'))
);

create trigger guilds_set_updated_at
before update on public.guilds
for each row
execute function private.set_updated_at();

create table public.guild_memberships (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_memberships_role_valid
    check (role in ('owner', 'admin', 'officer', 'member')),
  constraint guild_memberships_status_valid
    check (status in ('active', 'inactive')),
  constraint guild_memberships_unique_user_per_guild
    unique (guild_id, user_id),
  constraint guild_memberships_guild_id_id_unique
    unique (guild_id, id)
);

create index guild_memberships_user_id_idx
  on public.guild_memberships (user_id);

create index guild_memberships_guild_status_idx
  on public.guild_memberships (guild_id, status);

create unique index guild_memberships_one_active_owner_idx
  on public.guild_memberships (guild_id)
  where role = 'owner' and status = 'active';

create trigger guild_memberships_set_updated_at
before update on public.guild_memberships
for each row
execute function private.set_updated_at();

create or replace function private.prevent_membership_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.guild_id is distinct from old.guild_id then
    raise exception 'guild_memberships.guild_id is immutable';
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'guild_memberships.user_id is immutable';
  end if;

  return new;
end;
$$;

create trigger guild_memberships_identity_immutable
before update of guild_id, user_id on public.guild_memberships
for each row
execute function private.prevent_membership_identity_change();

-- Enforce exactly one active owner for every guild at transaction commit.
-- The deferred check allows a guild row and its owner membership to be created
-- in the same transaction and allows ownership transfer to be atomic.
create or replace function private.assert_guild_has_one_active_owner(
  p_guild_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  guild_exists boolean;
  owner_count integer;
begin
  select exists (
    select 1
    from public.guilds g
    where g.id = p_guild_id
  )
  into guild_exists;

  if not guild_exists then
    return;
  end if;

  select count(*)
  into owner_count
  from public.guild_memberships m
  where m.guild_id = p_guild_id
    and m.role = 'owner'
    and m.status = 'active';

  if owner_count <> 1 then
    raise exception
      'guild % must have exactly one active owner; found %',
      p_guild_id,
      owner_count;
  end if;
end;
$$;

revoke all on function private.assert_guild_has_one_active_owner(uuid)
from public, anon, authenticated;

create or replace function private.check_guild_owner_invariant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'guilds' then
    perform private.assert_guild_has_one_active_owner(new.id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform private.assert_guild_has_one_active_owner(old.guild_id);
    return old;
  end if;

  perform private.assert_guild_has_one_active_owner(new.guild_id);
  return new;
end;
$$;

revoke all on function private.check_guild_owner_invariant()
from public, anon, authenticated;

create constraint trigger guilds_require_exactly_one_owner
after insert or update on public.guilds
deferrable initially deferred
for each row
execute function private.check_guild_owner_invariant();

create constraint trigger guild_memberships_require_exactly_one_owner
after insert or update or delete on public.guild_memberships
deferrable initially deferred
for each row
execute function private.check_guild_owner_invariant();

-- ---------------------------------------------------------------------------
-- Capability model
-- Owner/Admin receive all active capabilities.
-- Officer capabilities are explicitly granted per guild.
-- Members do not receive management capabilities.
-- ---------------------------------------------------------------------------

create table public.capability_definitions (
  capability_key text primary key,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint capability_definitions_key_format
    check (
      capability_key ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*)+$'
    )
);

insert into public.capability_definitions (capability_key, description)
values
  ('roster.manage', 'Create and maintain the guild master roster.'),
  ('imports.manage', 'Run roster imports and review import changes.'),
  ('templates.manage', 'Create and maintain event templates.'),
  ('events.manage', 'Create events and edit event structures and assignments.'),
  ('publish.manage', 'Preview, publish, update, and unpublish event lineups.'),
  ('members.manage', 'Manage ordinary guild memberships and member access.'),
  ('guild.settings.manage', 'Manage guild-level settings and presentation.'),
  ('audit.view', 'View guild audit history.')
on conflict (capability_key) do nothing;

create table public.guild_officer_capabilities (
  guild_id uuid not null,
  membership_id uuid not null,
  capability_key text not null
    references public.capability_definitions(capability_key)
    on update cascade
    on delete restrict,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (guild_id, membership_id, capability_key),
  constraint guild_officer_capabilities_membership_fk
    foreign key (guild_id, membership_id)
    references public.guild_memberships(guild_id, id)
    on delete cascade
);

create index guild_officer_capabilities_membership_idx
  on public.guild_officer_capabilities (membership_id);

create or replace function private.enforce_officer_capability_target()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_role text;
  target_status text;
begin
  select m.role, m.status
  into target_role, target_status
  from public.guild_memberships m
  where m.guild_id = new.guild_id
    and m.id = new.membership_id;

  if target_role is distinct from 'officer'
     or target_status is distinct from 'active' then
    raise exception
      'capabilities may only be granted to active officer memberships';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_officer_capability_target()
from public, anon, authenticated;

create trigger guild_officer_capabilities_target_check
before insert or update on public.guild_officer_capabilities
for each row
execute function private.enforce_officer_capability_target();

create or replace function private.remove_capabilities_when_not_officer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.role <> 'officer' or new.status <> 'active' then
    delete from public.guild_officer_capabilities c
    where c.guild_id = new.guild_id
      and c.membership_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.remove_capabilities_when_not_officer()
from public, anon, authenticated;

create trigger guild_memberships_cleanup_officer_capabilities
after update of role, status on public.guild_memberships
for each row
when (
  old.role is distinct from new.role
  or old.status is distinct from new.status
)
execute function private.remove_capabilities_when_not_officer();

-- ---------------------------------------------------------------------------
-- Authorization helpers used by RLS and later transactional RPCs.
-- SECURITY DEFINER avoids recursive RLS lookups.
-- ---------------------------------------------------------------------------

create or replace function private.is_guild_member(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.guild_memberships m
    where m.guild_id = p_guild_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function private.current_guild_role(p_guild_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.role
  from public.guild_memberships m
  where m.guild_id = p_guild_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function private.has_guild_role(
  p_guild_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    private.current_guild_role(p_guild_id) = any(p_roles),
    false
  );
$$;

create or replace function private.has_guild_capability(
  p_guild_id uuid,
  p_capability_key text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with membership as (
    select m.id, m.role
    from public.guild_memberships m
    where m.guild_id = p_guild_id
      and m.user_id = auth.uid()
      and m.status = 'active'
    limit 1
  )
  select coalesce(
    (
      select
        case
          when membership.role in ('owner', 'admin') then
            exists (
              select 1
              from public.capability_definitions d
              where d.capability_key = p_capability_key
                and d.is_active = true
            )
          when membership.role = 'officer' then
            exists (
              select 1
              from public.guild_officer_capabilities c
              join public.capability_definitions d
                on d.capability_key = c.capability_key
               and d.is_active = true
              where c.guild_id = p_guild_id
                and c.membership_id = membership.id
                and c.capability_key = p_capability_key
            )
          else false
        end
      from membership
    ),
    false
  );
$$;

create or replace function private.shares_active_guild(
  p_other_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.guild_memberships mine
    join public.guild_memberships theirs
      on theirs.guild_id = mine.guild_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = p_other_user_id
      and theirs.status = 'active'
  );
$$;

revoke all on function private.is_guild_member(uuid)
from public, anon;

revoke all on function private.current_guild_role(uuid)
from public, anon;

revoke all on function private.has_guild_role(uuid, text[])
from public, anon;

revoke all on function private.has_guild_capability(uuid, text)
from public, anon;

revoke all on function private.shares_active_guild(uuid)
from public, anon;

grant execute on function private.is_guild_member(uuid)
to authenticated;

grant execute on function private.current_guild_role(uuid)
to authenticated;

grant execute on function private.has_guild_role(uuid, text[])
to authenticated;

grant execute on function private.has_guild_capability(uuid, text)
to authenticated;

grant execute on function private.shares_active_guild(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- Read access is intentionally narrow.
-- Critical guild/membership/capability writes will be added through RPCs.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.guilds enable row level security;
alter table public.guild_memberships enable row level security;
alter table public.capability_definitions enable row level security;
alter table public.guild_officer_capabilities enable row level security;

create policy profiles_select_self_or_shared_guild
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or private.shares_active_guild(id)
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy guilds_select_active_memberships
on public.guilds
for select
to authenticated
using (private.is_guild_member(id));

create policy guild_memberships_select_same_guild
on public.guild_memberships
for select
to authenticated
using (private.is_guild_member(guild_id));

create policy capability_definitions_select_authenticated
on public.capability_definitions
for select
to authenticated
using (true);

create policy guild_officer_capabilities_select_same_guild
on public.guild_officer_capabilities
for select
to authenticated
using (private.is_guild_member(guild_id));

-- Explicit privileges pair with RLS. Anonymous users receive no table access.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.guilds from anon, authenticated;
revoke all on table public.guild_memberships from anon, authenticated;
revoke all on table public.capability_definitions from anon, authenticated;
revoke all on table public.guild_officer_capabilities from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;
grant select on table public.guilds to authenticated;
grant select on table public.guild_memberships to authenticated;
grant select on table public.capability_definitions to authenticated;
grant select on table public.guild_officer_capabilities to authenticated;

comment on table public.profiles is
  'Application profile mapped one-to-one to auth.users.';

comment on table public.guilds is
  'Top-level guild tenant. Every guild must have exactly one active Owner membership.';

comment on table public.guild_memberships is
  'Links application users to guilds with Owner/Admin/Officer/Member authorization roles.';

comment on table public.capability_definitions is
  'Stable catalog of granular officer management capabilities.';

comment on table public.guild_officer_capabilities is
  'Guild-scoped explicit capability grants for active Officer memberships.';
