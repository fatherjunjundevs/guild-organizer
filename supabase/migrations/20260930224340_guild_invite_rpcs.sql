-- Phase 3.3C-2: Transactional guild invitation RPCs.
-- Raw invite secrets remain outside PostgreSQL. The application passes only
-- SHA-256 digests to these functions.

-- ---------------------------------------------------------------------------
-- Shared validation / authorization helpers
-- ---------------------------------------------------------------------------

create or replace function private.require_invite_authority(
  p_guild_id uuid,
  p_invite_role text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := private.require_authenticated_user();
  v_actor_role text;
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

  v_actor_role := private.require_active_guild_role(p_guild_id);

  if p_invite_role = 'admin' then
    if v_actor_role <> 'owner' then
      raise exception 'only the Owner may manage Admin invites'
        using errcode = '42501';
    end if;
  elsif p_invite_role = 'officer' then
    if v_actor_role not in ('owner', 'admin') then
      raise exception 'Owner or Admin role required for Officer invites'
        using errcode = '42501';
    end if;
  elsif p_invite_role = 'member' then
    if v_actor_role in ('owner', 'admin') then
      null;
    elsif v_actor_role = 'officer'
      and private.has_guild_capability(p_guild_id, 'members.manage') then
      null;
    else
      raise exception 'members.manage authority required for Member invites'
        using errcode = '42501';
    end if;
  else
    raise exception 'invalid invite role'
      using errcode = '22023';
  end if;

  return v_actor_id;
end;
$$;

revoke all on function private.require_invite_authority(uuid, text)
from public, anon, authenticated;

create or replace function private.validate_invite_shape(
  p_invite_kind text,
  p_role text,
  p_token_digest text,
  p_expires_at timestamptz
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_invite_kind is null
     or p_invite_kind not in ('join_link', 'elevated') then
    raise exception 'invalid invite kind'
      using errcode = '22023';
  end if;

  if p_role is null
     or p_role not in ('member', 'officer', 'admin') then
    raise exception 'invalid invite role'
      using errcode = '22023';
  end if;

  if (p_invite_kind = 'join_link' and p_role <> 'member')
     or (p_invite_kind = 'elevated' and p_role not in ('officer', 'admin')) then
    raise exception 'invite kind and role are incompatible'
      using errcode = '22023';
  end if;

  if p_token_digest is null
     or p_token_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'token digest must be lowercase SHA-256 hex'
      using errcode = '22023';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'invite expiration must be in the future'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_invite_shape(text, text, text, timestamptz)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create
-- ---------------------------------------------------------------------------

create or replace function public.create_guild_invite(
  p_guild_id uuid,
  p_invite_kind text,
  p_role text,
  p_token_digest text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_invite_id uuid;
  v_max_uses integer;
begin
  perform private.validate_invite_shape(
    p_invite_kind,
    p_role,
    p_token_digest,
    p_expires_at
  );

  v_actor_id := private.require_invite_authority(p_guild_id, p_role);
  v_max_uses := case when p_invite_kind = 'elevated' then 1 else null end;

  insert into public.guild_invites (
    guild_id,
    invite_kind,
    role,
    token_digest,
    max_uses,
    expires_at,
    created_by
  )
  values (
    p_guild_id,
    p_invite_kind,
    p_role,
    p_token_digest,
    v_max_uses,
    p_expires_at,
    v_actor_id
  )
  returning id into v_invite_id;

  return v_invite_id;
end;
$$;

revoke all on function public.create_guild_invite(
  uuid, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.create_guild_invite(
  uuid, text, text, text, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- Revoke
-- ---------------------------------------------------------------------------

create or replace function public.revoke_guild_invite(
  p_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_guild_id uuid;
  v_role text;
  v_status text;
begin
  select i.guild_id, i.role, i.status
  into v_guild_id, v_role, v_status
  from public.guild_invites i
  where i.id = p_invite_id
  for update;

  if v_guild_id is null then
    raise exception 'invite not found'
      using errcode = 'P0002';
  end if;

  v_actor_id := private.require_invite_authority(v_guild_id, v_role);

  if v_status = 'revoked' then
    return;
  end if;

  update public.guild_invites
  set
    status = 'revoked',
    revoked_by = v_actor_id,
    revoked_at = now()
  where id = p_invite_id;
end;
$$;

revoke all on function public.revoke_guild_invite(uuid)
from public, anon, authenticated;

grant execute on function public.revoke_guild_invite(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Regenerate
-- Reuses the same logical invite row while rotating its digest and generation.
-- Any previously distributed URL becomes invalid immediately.
-- ---------------------------------------------------------------------------

create or replace function public.regenerate_guild_invite(
  p_invite_id uuid,
  p_token_digest text,
  p_expires_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guild_id uuid;
  v_invite_kind text;
  v_role text;
  v_new_generation integer;
begin
  select i.guild_id, i.invite_kind, i.role
  into v_guild_id, v_invite_kind, v_role
  from public.guild_invites i
  where i.id = p_invite_id
  for update;

  if v_guild_id is null then
    raise exception 'invite not found'
      using errcode = 'P0002';
  end if;

  perform private.validate_invite_shape(
    v_invite_kind,
    v_role,
    p_token_digest,
    p_expires_at
  );

  perform private.require_invite_authority(v_guild_id, v_role);

  update public.guild_invites
  set
    token_digest = p_token_digest,
    generation = generation + 1,
    status = 'active',
    use_count = 0,
    last_used_at = null,
    expires_at = p_expires_at,
    revoked_by = null,
    revoked_at = null
  where id = p_invite_id
  returning generation into v_new_generation;

  return v_new_generation;
end;
$$;

revoke all on function public.regenerate_guild_invite(
  uuid, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.regenerate_guild_invite(
  uuid, text, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- Resolve
-- Safe for anonymous invite landing pages. It returns only the minimum fields
-- needed to render an available invitation. Invalid, revoked, expired,
-- consumed, or stale-generation links resolve to zero rows.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_guild_invite(
  p_token_digest text,
  p_generation integer
)
returns table (
  invite_id uuid,
  guild_id uuid,
  guild_name text,
  invite_kind text,
  invite_role text,
  generation integer,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    i.id,
    i.guild_id,
    g.name,
    i.invite_kind,
    i.role,
    i.generation,
    i.expires_at
  from public.guild_invites i
  join public.guilds g
    on g.id = i.guild_id
  where p_token_digest ~ '^[0-9a-f]{64}$'
    and p_generation > 0
    and i.token_digest = p_token_digest
    and i.generation = p_generation
    and i.status = 'active'
    and i.expires_at > now()
    and (i.max_uses is null or i.use_count < i.max_uses)
    and g.status = 'active'
  limit 1;
$$;

revoke all on function public.resolve_guild_invite(text, integer)
from public, anon, authenticated;

grant execute on function public.resolve_guild_invite(text, integer)
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Accept
-- The invite row is locked for the whole operation so a single-use elevated
-- invite cannot be consumed concurrently by two users.
--
-- Existing memberships, including inactive ones, are rejected. This prevents
-- an invite from silently upgrading or reactivating a membership.
-- ---------------------------------------------------------------------------

create or replace function public.accept_guild_invite(
  p_token_digest text,
  p_generation integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := private.require_authenticated_user();
  v_invite_id uuid;
  v_guild_id uuid;
  v_role text;
  v_status text;
  v_expires_at timestamptz;
  v_max_uses integer;
  v_use_count integer;
  v_guild_status text;
  v_membership_id uuid;
begin
  if p_token_digest is null
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or p_generation is null
     or p_generation <= 0 then
    raise exception 'invite unavailable'
      using errcode = 'P0002';
  end if;

  select
    i.id,
    i.guild_id,
    i.role,
    i.status,
    i.expires_at,
    i.max_uses,
    i.use_count
  into
    v_invite_id,
    v_guild_id,
    v_role,
    v_status,
    v_expires_at,
    v_max_uses,
    v_use_count
  from public.guild_invites i
  where i.token_digest = p_token_digest
    and i.generation = p_generation
  for update;

  if v_invite_id is null then
    raise exception 'invite unavailable'
      using errcode = 'P0002';
  end if;

  select g.status
  into v_guild_status
  from public.guilds g
  where g.id = v_guild_id;

  if v_status <> 'active'
     or v_expires_at <= now()
     or v_guild_status is distinct from 'active'
     or (v_max_uses is not null and v_use_count >= v_max_uses) then
    raise exception 'invite unavailable'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.guild_memberships m
    where m.guild_id = v_guild_id
      and m.user_id = v_user_id
  ) then
    raise exception 'guild membership already exists'
      using errcode = '23505';
  end if;

  insert into public.guild_memberships (
    guild_id,
    user_id,
    role,
    status
  )
  values (
    v_guild_id,
    v_user_id,
    v_role,
    'active'
  )
  returning id into v_membership_id;

  insert into public.guild_invite_acceptances (
    guild_id,
    invite_id,
    invite_generation,
    user_id,
    membership_id,
    accepted_role
  )
  values (
    v_guild_id,
    v_invite_id,
    p_generation,
    v_user_id,
    v_membership_id,
    v_role
  );

  update public.guild_invites
  set
    use_count = use_count + 1,
    last_used_at = now()
  where id = v_invite_id;

  return v_membership_id;
end;
$$;

revoke all on function public.accept_guild_invite(text, integer)
from public, anon, authenticated;

grant execute on function public.accept_guild_invite(text, integer)
to authenticated;

comment on function public.create_guild_invite(
  uuid, text, text, text, timestamptz
) is
  'Creates a Member join link or elevated Officer/Admin invitation after role-aware authorization checks.';

comment on function public.revoke_guild_invite(uuid) is
  'Revokes an invitation with the same role-aware authority required to create that invite role.';

comment on function public.regenerate_guild_invite(
  uuid, text, timestamptz
) is
  'Rotates an invite digest, increments its generation, resets usage state, and invalidates previously distributed copies.';

comment on function public.resolve_guild_invite(text, integer) is
  'Returns minimal safe metadata for one currently available invitation; callable anonymously.';

comment on function public.accept_guild_invite(text, integer) is
  'Atomically accepts an available invitation without upgrading or reactivating an existing guild membership.';
