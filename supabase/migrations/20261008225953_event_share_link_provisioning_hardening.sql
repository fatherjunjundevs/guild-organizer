-- Additive hardening. Apply with the foundation before opening Data API access.
-- No production provisioning or AES recovery key material belongs in migrations.
create table private.event_share_link_provisioning_keys (
  id text primary key check (id collate pg_catalog."C" ~ '^[A-Za-z0-9_-]{1,32}$'),
  key_material bytea not null check (octet_length(key_material) = 32),
  activated_at timestamptz not null,
  retired_at timestamptz,
  check (retired_at is null or retired_at >= activated_at)
);
alter table private.event_share_link_provisioning_keys owner to postgres;
alter table private.event_share_link_provisioning_keys enable row level security;
revoke all on private.event_share_link_provisioning_keys from public, anon, authenticated, service_role;

-- Protocol go.share.provision.v1: UTF-8 (ASCII subset), LF-separated fields,
-- no trailing LF. UUIDs lowercase PostgreSQL canonical text; bytes lowercase
-- hex; absent previous link is '-'; expiry is integer Unix seconds in decimal.
-- See ARCHITECTURE.md for exact field order and server implementation requirements.
create function private.verify_event_share_link_provisioning(
  p_operation text, p_actor_id uuid, p_guild_id uuid, p_event_id uuid,
  p_new_link_id uuid, p_previous_link_id uuid, p_token_digest text,
  p_token_ciphertext bytea, p_token_nonce bytea, p_token_auth_tag bytea,
  p_encryption_key_id text, p_provisioning_key_id text,
  p_provisioning_expires_at bigint, p_provisioning_mac bytea
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_epoch numeric;
  v_key bytea;
  v_message text;
  v_expected bytea;
  v_difference integer := 0;
begin
  v_epoch := extract(epoch from v_now);
  if p_operation is null or p_operation not in ('create', 'rotate')
    or p_actor_id is null or p_actor_id is distinct from auth.uid()
    or p_guild_id is null or p_event_id is null or p_new_link_id is null
    or (p_operation = 'create' and p_previous_link_id is not null)
    or (p_operation = 'rotate' and p_previous_link_id is null)
    or p_provisioning_expires_at is null
    or p_provisioning_expires_at < v_epoch - 5
    or p_provisioning_expires_at > v_epoch + 125
    or p_provisioning_mac is null or octet_length(p_provisioning_mac) <> 32
    or p_provisioning_key_id is null
    or p_provisioning_key_id collate pg_catalog."C" !~ '^[A-Za-z0-9_-]{1,32}$' then
    raise exception 'share link provisioning proof invalid' using errcode = '42501';
  end if;
  -- Keep the existing envelope constraint SQLSTATE for structurally invalid
  -- arguments. These bounded formats also make LF field encoding unambiguous.
  if p_token_digest is null or p_token_digest collate pg_catalog."C" !~ '^[0-9a-f]{64}$'
    or p_token_ciphertext is null or octet_length(p_token_ciphertext) <> 32
    or p_token_nonce is null or octet_length(p_token_nonce) <> 12
    or p_token_auth_tag is null or octet_length(p_token_auth_tag) <> 16
    or p_encryption_key_id is null
    or p_encryption_key_id collate pg_catalog."C" !~ '^[A-Za-z0-9_-]{1,32}$' then
    raise exception 'share link recovery envelope invalid' using errcode = '23514';
  end if;
  select k.key_material into v_key
  from private.event_share_link_provisioning_keys k
  where k.id = p_provisioning_key_id and k.activated_at <= v_now
    and (k.retired_at is null or k.retired_at > v_now);
  if not found then
    raise exception 'share link provisioning proof invalid' using errcode = '42501';
  end if;
  v_message := pg_catalog.array_to_string(array[
    'go.share.provision.v1', p_operation, p_actor_id::text,
    p_guild_id::text, p_event_id::text, p_new_link_id::text,
    coalesce(p_previous_link_id::text, '-'), p_token_digest,
    pg_catalog.encode(p_token_ciphertext, 'hex'), pg_catalog.encode(p_token_nonce, 'hex'),
    pg_catalog.encode(p_token_auth_tag, 'hex'), p_encryption_key_id,
    p_provisioning_key_id, p_provisioning_expires_at::text
  ], E'\n');
  v_expected := extensions.hmac(pg_catalog.convert_to(v_message, 'UTF8'), v_key, 'sha256');
  -- Fixed 32-byte comparison with no early exit. PL/pgSQL/the database runtime
  -- offers no formal constant-time execution guarantee; do not claim one.
  for i in 0..31 loop
    v_difference := v_difference | (pg_catalog.get_byte(v_expected, i) # pg_catalog.get_byte(p_provisioning_mac, i));
  end loop;
  if v_difference <> 0 then
    raise exception 'share link provisioning proof invalid' using errcode = '42501';
  end if;
end;
$$;
alter function private.verify_event_share_link_provisioning(text,uuid,uuid,uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea) owner to postgres;
revoke all on function private.verify_event_share_link_provisioning(text,uuid,uuid,uuid,uuid,uuid,text,bytea,bytea,bytea,text,text,bigint,bytea) from public,anon,authenticated,service_role;

-- Remove insecure entry points, rather than retaining callable overloads.
drop function public.create_event_share_link(uuid,uuid,uuid,text,bytea,bytea,bytea,text);
drop function public.rotate_event_share_link(uuid,uuid,uuid,uuid,text,bytea,bytea,bytea,text);

create function public.create_event_share_link(
  p_guild_id uuid, p_event_id uuid, p_link_id uuid, p_token_digest text,
  p_token_ciphertext bytea, p_token_nonce bytea, p_token_auth_tag bytea,
  p_encryption_key_id text, p_provisioning_key_id text,
  p_provisioning_expires_at bigint, p_provisioning_mac bytea
)
returns uuid
language plpgsql
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

create function public.rotate_event_share_link(
  p_guild_id uuid, p_event_id uuid, p_expected_link_id uuid, p_new_link_id uuid,
  p_token_digest text, p_token_ciphertext bytea, p_token_nonce bytea,
  p_token_auth_tag bytea, p_encryption_key_id text, p_provisioning_key_id text,
  p_provisioning_expires_at bigint, p_provisioning_mac bytea
)
returns uuid
language plpgsql
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
