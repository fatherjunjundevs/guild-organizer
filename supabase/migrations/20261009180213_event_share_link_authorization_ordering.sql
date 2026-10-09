-- Event-first authorization ordering for share-link mutations only.
-- READ COMMITTED fresh queries plus retained authority locks define the order:
-- a committed revocation is observed; otherwise it cannot commit before this
-- transaction ends. Contending authority locks fail closed rather than wait
-- behind Membership-first/Guild-first writers while retaining an Event lock.
create function private.lock_event_share_link_authority(p_guild_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_guild_status text;
  v_membership_id uuid;
  v_role text;
  v_membership_status text;
  v_capability_active boolean;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'share link transaction isolation unsupported' using errcode = '0A000';
  end if;

  -- Also avoid implicit authorization-table lock waits (for example during DDL).
  lock table public.guilds, public.profiles, public.guild_memberships,
    public.capability_definitions, public.guild_officer_capabilities
    in row share mode nowait;

  select g.status into v_guild_status from public.guilds g
  where g.id = p_guild_id for share nowait;
  if not found then
    raise exception 'guild not found' using errcode = 'P0002';
  end if;
  if v_guild_status <> 'active' then
    raise exception 'guild is not active' using errcode = '55000';
  end if;

  -- Protect created_by/revoked_by FKs before locking membership: account
  -- deletion must not hold the actor profile and then wait on our membership.
  perform 1 from public.profiles p where p.id = v_actor_id for key share nowait;
  if not found then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select m.id, m.role, m.status into v_membership_id, v_role, v_membership_status
  from public.guild_memberships m
  where m.guild_id = p_guild_id and m.user_id = v_actor_id for share nowait;
  if not found or v_membership_status <> 'active' then
    raise exception 'publish.manage authority required' using errcode = '42501';
  end if;

  select d.is_active into v_capability_active from public.capability_definitions d
  where d.capability_key = 'publish.manage' for share nowait;
  if not found or not v_capability_active then
    raise exception 'publish.manage authority required' using errcode = '42501';
  end if;

  if v_role = 'officer' then
    perform 1 from public.guild_officer_capabilities c
    where c.guild_id = p_guild_id and c.membership_id = v_membership_id
      and c.capability_key = 'publish.manage' for share nowait;
    if not found then
      raise exception 'publish.manage authority required' using errcode = '42501';
    end if;
  elsif v_role not in ('owner', 'admin') then
    raise exception 'publish.manage authority required' using errcode = '42501';
  end if;
  return v_actor_id;
exception when lock_not_available then
  raise exception 'share link authority is changing' using errcode = '55P03';
end;
$$;
alter function private.lock_event_share_link_authority(uuid) owner to postgres;
revoke all on function private.lock_event_share_link_authority(uuid)
  from public, anon, authenticated, service_role;


create or replace function public.create_event_share_link(
  p_guild_id uuid, p_event_id uuid, p_link_id uuid, p_token_digest text,
  p_token_ciphertext bytea, p_token_nonce bytea, p_token_auth_tag bytea,
  p_encryption_key_id text, p_provisioning_key_id text,
  p_provisioning_expires_at bigint, p_provisioning_mac bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := private.require_publish_manage(p_guild_id);
  v_event_status text;
  v_existing private.event_share_links%rowtype;
begin
  perform private.verify_event_share_link_provisioning(
    'create', v_actor_id, p_guild_id, p_event_id, p_link_id, null,
    p_token_digest, p_token_ciphertext, p_token_nonce, p_token_auth_tag,
    p_encryption_key_id, p_provisioning_key_id, p_provisioning_expires_at, p_provisioning_mac);
  select e.status into v_event_status from public.events e
  where e.guild_id = p_guild_id and e.id = p_event_id for update;
  if not found then
    raise exception 'Event unavailable for this Guild' using errcode = 'P0002';
  end if;
  v_actor_id := private.lock_event_share_link_authority(p_guild_id);
  if v_event_status <> 'active' then
    raise exception 'archived Events cannot create share links' using errcode = '55000';
  end if;

  -- Recheck proof/key validity after waiting for the Event lock.
  perform private.verify_event_share_link_provisioning(
    'create', v_actor_id, p_guild_id, p_event_id, p_link_id, null,
    p_token_digest, p_token_ciphertext, p_token_nonce, p_token_auth_tag,
    p_encryption_key_id, p_provisioning_key_id, p_provisioning_expires_at, p_provisioning_mac);
  select l.* into v_existing from private.event_share_links l
  where l.guild_id = p_guild_id and l.event_id = p_event_id and l.id = p_link_id;
  if found then
    if v_existing.revoked_at is null
      and v_existing.token_digest is not distinct from p_token_digest
      and v_existing.token_ciphertext is not distinct from p_token_ciphertext
      and v_existing.token_nonce is not distinct from p_token_nonce
      and v_existing.token_auth_tag is not distinct from p_token_auth_tag
      and v_existing.encryption_key_id is not distinct from p_encryption_key_id then
      return v_existing.id;
    end if;
    raise exception 'share link request conflicts with existing identity'
      using errcode = '55000';
  end if;
  if exists (select 1 from private.event_share_links l
    where l.guild_id = p_guild_id and l.event_id = p_event_id and l.revoked_at is null) then
    raise exception 'Event already has an active share link' using errcode = '55000';
  end if;
  insert into private.event_share_links (
    id, guild_id, event_id, token_digest, token_ciphertext,
    token_nonce, token_auth_tag, encryption_key_id, created_by
  ) values (
    p_link_id, p_guild_id, p_event_id, p_token_digest, p_token_ciphertext,
    p_token_nonce, p_token_auth_tag, p_encryption_key_id, v_actor_id
  );
  return p_link_id;
end;
$$;
alter function public.create_event_share_link(uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea) owner to postgres;
revoke all on function public.create_event_share_link(uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea) from public,anon,authenticated,service_role;
grant execute on function public.create_event_share_link(uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea) to authenticated;

create or replace function public.rotate_event_share_link(
  p_guild_id uuid, p_event_id uuid, p_expected_link_id uuid, p_new_link_id uuid,
  p_token_digest text, p_token_ciphertext bytea, p_token_nonce bytea,
  p_token_auth_tag bytea, p_encryption_key_id text, p_provisioning_key_id text,
  p_provisioning_expires_at bigint, p_provisioning_mac bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := private.require_publish_manage(p_guild_id);
  v_event_status text;
begin
  perform private.verify_event_share_link_provisioning(
    'rotate', v_actor_id, p_guild_id, p_event_id, p_new_link_id, p_expected_link_id,
    p_token_digest, p_token_ciphertext, p_token_nonce, p_token_auth_tag,
    p_encryption_key_id, p_provisioning_key_id, p_provisioning_expires_at, p_provisioning_mac);
  select e.status into v_event_status from public.events e
  where e.guild_id = p_guild_id and e.id = p_event_id for update;
  if not found then
    raise exception 'Event unavailable for this Guild' using errcode = 'P0002';
  end if;
  v_actor_id := private.lock_event_share_link_authority(p_guild_id);
  if v_event_status <> 'active' then
    raise exception 'archived Events cannot rotate share links' using errcode = '55000';
  end if;
  -- Recheck proof/key validity after waiting for the Event lock.
  perform private.verify_event_share_link_provisioning(
    'rotate', v_actor_id, p_guild_id, p_event_id, p_new_link_id, p_expected_link_id,
    p_token_digest, p_token_ciphertext, p_token_nonce, p_token_auth_tag,
    p_encryption_key_id, p_provisioning_key_id, p_provisioning_expires_at, p_provisioning_mac);
  -- Conditional transition after the Event lock defeats stale/competing callers.
  update private.event_share_links l set
    revoked_at = clock_timestamp(), revoked_by = v_actor_id,
    revocation_reason = 'rotated', token_ciphertext = null,
    token_nonce = null, token_auth_tag = null, encryption_key_id = null
  where l.guild_id = p_guild_id and l.event_id = p_event_id
    and l.id = p_expected_link_id and l.revoked_at is null;
  if not found then
    raise exception 'expected active share link is unavailable' using errcode = '55000';
  end if;
  -- Any insert failure rolls back the revocation in this same RPC transaction.
  insert into private.event_share_links (
    id, guild_id, event_id, token_digest, token_ciphertext,
    token_nonce, token_auth_tag, encryption_key_id, created_by
  ) values (
    p_new_link_id, p_guild_id, p_event_id, p_token_digest, p_token_ciphertext,
    p_token_nonce, p_token_auth_tag, p_encryption_key_id, v_actor_id
  );
  return p_new_link_id;
end;
$$;
alter function public.rotate_event_share_link(uuid,uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea) owner to postgres;
revoke all on function public.rotate_event_share_link(uuid,uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea) from public,anon,authenticated,service_role;
grant execute on function public.rotate_event_share_link(uuid,uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea) to authenticated;

create or replace function public.revoke_event_share_link(
  p_guild_id uuid, p_event_id uuid, p_link_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := private.require_publish_manage(p_guild_id);
begin
  perform 1 from public.events e
  where e.guild_id = p_guild_id and e.id = p_event_id for update;
  if not found then
    raise exception 'Event unavailable for this Guild' using errcode = 'P0002';
  end if;
  v_actor_id := private.lock_event_share_link_authority(p_guild_id);
  if not exists (select 1 from private.event_share_links l
    where l.guild_id = p_guild_id and l.event_id = p_event_id and l.id = p_link_id) then
    raise exception 'share link unavailable for this Event' using errcode = 'P0002';
  end if;
  update private.event_share_links l set
    revoked_at = clock_timestamp(), revoked_by = v_actor_id,
    revocation_reason = 'revoked', token_ciphertext = null,
    token_nonce = null, token_auth_tag = null, encryption_key_id = null
  where l.guild_id = p_guild_id and l.event_id = p_event_id
    and l.id = p_link_id and l.revoked_at is null;
end;
$$;
alter function public.revoke_event_share_link(uuid,uuid,uuid) owner to postgres;
revoke all on function public.revoke_event_share_link(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.revoke_event_share_link(uuid,uuid,uuid) to authenticated;
