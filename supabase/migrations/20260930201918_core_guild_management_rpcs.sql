-- Phase 3.2D: Transactional guild-management RPCs.
-- Critical guild authorization writes are exposed only through SECURITY DEFINER
-- functions. Authenticated users continue to have no direct write privileges
-- on guild, membership, or officer-capability tables.

-- ---------------------------------------------------------------------------
-- Authentication / authorization helpers
-- ---------------------------------------------------------------------------

create or replace function private.require_authenticated_user()
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  return v_user_id;
end;
$$;

revoke all on function private.require_authenticated_user()
from public, anon, authenticated;

grant execute on function private.require_authenticated_user()
to authenticated;

create or replace function private.require_active_guild_role(
  p_guild_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  select m.role
  into v_role
  from public.guild_memberships m
  where m.guild_id = p_guild_id
    and m.user_id = v_user_id
    and m.status = 'active'
  limit 1;

  if v_role is null then
    raise exception 'active guild membership required'
      using errcode = '42501';
  end if;

  return v_role;
end;
$$;

revoke all on function private.require_active_guild_role(uuid)
from public, anon, authenticated;

grant execute on function private.require_active_guild_role(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Create a guild and its initial Owner atomically.
-- ---------------------------------------------------------------------------

create or replace function public.create_guild(
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := private.require_authenticated_user();
  v_guild_id uuid;
  v_name text := btrim(p_name);
begin
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'guild name must contain at least 2 characters'
      using errcode = '22023';
  end if;

  insert into public.guilds (
    name,
    created_by
  )
  values (
    v_name,
    v_user_id
  )
  returning id into v_guild_id;

  insert into public.guild_memberships (
    guild_id,
    user_id,
    role,
    status
  )
  values (
    v_guild_id,
    v_user_id,
    'owner',
    'active'
  );

  perform private.assert_guild_has_one_active_owner(v_guild_id);

  return v_guild_id;
end;
$$;

revoke all on function public.create_guild(text)
from public, anon;

grant execute on function public.create_guild(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Membership role changes.
--
-- Owner:
--   - may change any non-Owner membership to Admin/Officer/Member.
--
-- Admin:
--   - may change Member <-> Officer.
--   - may not target Owner/Admin.
--   - may not assign Owner/Admin.
--
-- Officer/Member:
--   - may not change membership roles.
--
-- Ownership changes must use transfer_guild_ownership().
-- ---------------------------------------------------------------------------

create or replace function public.set_guild_membership_role(
  p_membership_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := private.require_authenticated_user();
  v_guild_id uuid;
  v_target_role text;
  v_actor_role text;
begin
  if p_role is null or p_role not in ('admin', 'officer', 'member') then
    raise exception 'invalid target role'
      using errcode = '22023';
  end if;

  select
    m.guild_id,
    m.role
  into
    v_guild_id,
    v_target_role
  from public.guild_memberships m
  where m.id = p_membership_id
  for update;

  if v_guild_id is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  select m.role
  into v_actor_role
  from public.guild_memberships m
  where m.guild_id = v_guild_id
    and m.user_id = v_actor_id
    and m.status = 'active'
  limit 1;

  if v_actor_role is null then
    raise exception 'active guild membership required'
      using errcode = '42501';
  end if;

  if v_target_role = 'owner' then
    raise exception 'Owner role changes require ownership transfer'
      using errcode = '42501';
  end if;

  if v_actor_role = 'owner' then
    null;
  elsif v_actor_role = 'admin' then
    if v_target_role = 'admin' or p_role = 'admin' then
      raise exception 'Admins cannot assign or modify Admin/Owner roles'
        using errcode = '42501';
    end if;
  else
    raise exception 'insufficient permission to change membership roles'
      using errcode = '42501';
  end if;

  update public.guild_memberships
  set role = p_role
  where id = p_membership_id;
end;
$$;

revoke all on function public.set_guild_membership_role(uuid, text)
from public, anon;

grant execute on function public.set_guild_membership_role(uuid, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Membership lifecycle changes.
--
-- Owner:
--   - may activate/deactivate any non-Owner membership.
--
-- Admin:
--   - may activate/deactivate Officer/Member memberships only.
--
-- Officer with members.manage:
--   - may activate/deactivate Member memberships only.
--
-- The active Owner cannot be deactivated through this RPC.
-- ---------------------------------------------------------------------------

create or replace function public.set_guild_membership_status(
  p_membership_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := private.require_authenticated_user();
  v_guild_id uuid;
  v_target_role text;
  v_actor_role text;
begin
  if p_status is null or p_status not in ('active', 'inactive') then
    raise exception 'invalid membership status'
      using errcode = '22023';
  end if;

  select
    m.guild_id,
    m.role
  into
    v_guild_id,
    v_target_role
  from public.guild_memberships m
  where m.id = p_membership_id
  for update;

  if v_guild_id is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  select m.role
  into v_actor_role
  from public.guild_memberships m
  where m.guild_id = v_guild_id
    and m.user_id = v_actor_id
    and m.status = 'active'
  limit 1;

  if v_actor_role is null then
    raise exception 'active guild membership required'
      using errcode = '42501';
  end if;

  if v_target_role = 'owner' then
    raise exception 'the active Owner cannot be deactivated'
      using errcode = '42501';
  end if;

  if v_actor_role = 'owner' then
    null;
  elsif v_actor_role = 'admin' then
    if v_target_role not in ('officer', 'member') then
      raise exception 'Admins may only change Officer/Member status'
        using errcode = '42501';
    end if;
  elsif v_actor_role = 'officer'
    and v_target_role = 'member'
    and private.has_guild_capability(v_guild_id, 'members.manage') then
    null;
  else
    raise exception 'insufficient permission to change membership status'
      using errcode = '42501';
  end if;

  update public.guild_memberships
  set status = p_status
  where id = p_membership_id;
end;
$$;

revoke all on function public.set_guild_membership_status(uuid, text)
from public, anon;

grant execute on function public.set_guild_membership_status(uuid, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Officer capability grants.
-- Only active Owners/Admins may grant or revoke Officer capabilities.
-- ---------------------------------------------------------------------------

create or replace function public.grant_officer_capability(
  p_membership_id uuid,
  p_capability_key text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := private.require_authenticated_user();
  v_guild_id uuid;
  v_target_role text;
  v_target_status text;
  v_actor_role text;
begin
  select
    m.guild_id,
    m.role,
    m.status
  into
    v_guild_id,
    v_target_role,
    v_target_status
  from public.guild_memberships m
  where m.id = p_membership_id
  for update;

  if v_guild_id is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  select m.role
  into v_actor_role
  from public.guild_memberships m
  where m.guild_id = v_guild_id
    and m.user_id = v_actor_id
    and m.status = 'active'
  limit 1;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'Owner or Admin role required'
      using errcode = '42501';
  end if;

  if v_target_role <> 'officer' or v_target_status <> 'active' then
    raise exception 'capabilities may only be granted to active Officers'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.capability_definitions d
    where d.capability_key = p_capability_key
      and d.is_active = true
  ) then
    raise exception 'capability is missing or inactive'
      using errcode = '22023';
  end if;

  insert into public.guild_officer_capabilities (
    guild_id,
    membership_id,
    capability_key,
    granted_by
  )
  values (
    v_guild_id,
    p_membership_id,
    p_capability_key,
    v_actor_id
  )
  on conflict (guild_id, membership_id, capability_key)
  do update set
    granted_by = excluded.granted_by;
end;
$$;

revoke all on function public.grant_officer_capability(uuid, text)
from public, anon;

grant execute on function public.grant_officer_capability(uuid, text)
to authenticated;

create or replace function public.revoke_officer_capability(
  p_membership_id uuid,
  p_capability_key text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := private.require_authenticated_user();
  v_guild_id uuid;
  v_actor_role text;
begin
  select m.guild_id
  into v_guild_id
  from public.guild_memberships m
  where m.id = p_membership_id
  for update;

  if v_guild_id is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  select m.role
  into v_actor_role
  from public.guild_memberships m
  where m.guild_id = v_guild_id
    and m.user_id = v_actor_id
    and m.status = 'active'
  limit 1;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'Owner or Admin role required'
      using errcode = '42501';
  end if;

  delete from public.guild_officer_capabilities c
  where c.guild_id = v_guild_id
    and c.membership_id = p_membership_id
    and c.capability_key = p_capability_key;
end;
$$;

revoke all on function public.revoke_officer_capability(uuid, text)
from public, anon;

grant execute on function public.revoke_officer_capability(uuid, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Ownership transfer.
-- Only the current active Owner can transfer ownership.
-- The previous Owner becomes an active Admin.
-- ---------------------------------------------------------------------------

create or replace function public.transfer_guild_ownership(
  p_guild_id uuid,
  p_new_owner_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := private.require_authenticated_user();
  v_current_owner_id uuid;
  v_new_owner_user_id uuid;
  v_new_owner_status text;
begin
  perform 1
  from public.guilds g
  where g.id = p_guild_id
  for update;

  if not found then
    raise exception 'guild not found'
      using errcode = 'P0002';
  end if;

  select m.id
  into v_current_owner_id
  from public.guild_memberships m
  where m.guild_id = p_guild_id
    and m.user_id = v_actor_id
    and m.role = 'owner'
    and m.status = 'active'
  for update;

  if v_current_owner_id is null then
    raise exception 'only the current Owner may transfer ownership'
      using errcode = '42501';
  end if;

  select
    m.user_id,
    m.status
  into
    v_new_owner_user_id,
    v_new_owner_status
  from public.guild_memberships m
  where m.guild_id = p_guild_id
    and m.id = p_new_owner_membership_id
  for update;

  if v_new_owner_user_id is null then
    raise exception 'new Owner membership not found in this guild'
      using errcode = 'P0002';
  end if;

  if p_new_owner_membership_id = v_current_owner_id then
    raise exception 'new Owner must be a different membership'
      using errcode = '22023';
  end if;

  if v_new_owner_status <> 'active' then
    raise exception 'new Owner membership must be active'
      using errcode = '22023';
  end if;

  -- Demote first so the immediate unique partial index is never violated.
  -- The deferred exact-owner constraint allows the temporary zero-owner state
  -- within this transaction.
  update public.guild_memberships
  set role = 'admin'
  where id = v_current_owner_id;

  update public.guild_memberships
  set role = 'owner',
      status = 'active'
  where id = p_new_owner_membership_id;

  perform private.assert_guild_has_one_active_owner(p_guild_id);
end;
$$;

revoke all on function public.transfer_guild_ownership(uuid, uuid)
from public, anon;

grant execute on function public.transfer_guild_ownership(uuid, uuid)
to authenticated;

comment on function public.create_guild(text) is
  'Creates a guild and its initial active Owner membership atomically.';

comment on function public.set_guild_membership_role(uuid, text) is
  'Changes non-Owner guild roles with anti-escalation authorization checks.';

comment on function public.set_guild_membership_status(uuid, text) is
  'Activates/deactivates non-Owner memberships according to guild authority.';

comment on function public.grant_officer_capability(uuid, text) is
  'Grants an active capability to an active Officer; Owner/Admin only.';

comment on function public.revoke_officer_capability(uuid, text) is
  'Revokes an Officer capability; Owner/Admin only.';

comment on function public.transfer_guild_ownership(uuid, uuid) is
  'Atomically transfers Owner to another active membership and demotes the previous Owner to Admin.';
