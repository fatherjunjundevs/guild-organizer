-- Phase 3.3D-2: Safe Guild invite-management read surface.
-- Invite secrets/digests remain inaccessible to application roles.

create or replace function public.list_manageable_guild_invites(
  p_guild_id uuid
)
returns table (
  invite_id uuid,
  invite_kind text,
  invite_role text,
  generation integer,
  status text,
  use_count integer,
  max_uses integer,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_allowed_roles text[];
  v_guild_status text;
begin
  v_actor_role := private.require_active_guild_role(p_guild_id);

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

  if v_actor_role = 'owner' then
    v_allowed_roles := array['member', 'officer', 'admin']::text[];
  elsif v_actor_role = 'admin' then
    v_allowed_roles := array['member', 'officer']::text[];
  elsif v_actor_role = 'officer'
    and private.has_guild_capability(p_guild_id, 'members.manage') then
    v_allowed_roles := array['member']::text[];
  else
    raise exception 'invite management authority required'
      using errcode = '42501';
  end if;

  return query
  select
    i.id,
    i.invite_kind,
    i.role,
    i.generation,
    i.status,
    i.use_count,
    i.max_uses,
    i.expires_at,
    i.created_at,
    i.updated_at
  from public.guild_invites i
  where i.guild_id = p_guild_id
    and i.role = any(v_allowed_roles)
  order by
    case when i.status = 'active' then 0 else 1 end,
    i.created_at desc,
    i.id;
end;
$$;

revoke all on function public.list_manageable_guild_invites(uuid)
from public, anon, authenticated;

grant execute on function public.list_manageable_guild_invites(uuid)
to authenticated;

comment on function public.list_manageable_guild_invites(uuid) is
  'Lists only safe invitation metadata the current Guild actor is authorized to manage. Raw token digests are never returned.';
