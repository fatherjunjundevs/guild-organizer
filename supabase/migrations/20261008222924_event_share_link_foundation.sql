-- Phase 6.3A.2: Event bearer-link database foundation only.
-- Raw tokens and encryption keys are never stored here. The server must generate
-- random tokens, encrypt with AES-256-GCM using scoped associated data, and check
-- decrypted bytes against token_digest before copying. PostgreSQL validates the
-- envelope shape, not its plaintext, authentication tag, or randomness.

create extension if not exists pgcrypto with schema extensions;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'extensions'
  ) then
    raise exception 'pgcrypto must already be in extensions; relocation is not automatic';
  end if;
end;
$$;

create table private.event_share_links (
  id uuid primary key,
  guild_id uuid not null,
  event_id uuid not null,
  token_digest text not null,
  token_ciphertext bytea,
  token_nonce bytea,
  token_auth_tag bytea,
  encryption_key_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  constraint event_share_links_event_fk
    foreign key (guild_id, event_id)
    references public.events(guild_id, id) on delete cascade,
  constraint event_share_links_digest_format
    check (token_digest collate pg_catalog."C" ~ '^[0-9a-f]{64}$'),
  constraint event_share_links_digest_unique unique (token_digest),
  constraint event_share_links_revocation_state check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or
    (revoked_at is not null and revoked_at >= created_at
      and revocation_reason is not null
      and revocation_reason in ('revoked', 'rotated'))
  ),
  constraint event_share_links_recovery_state check (
    (revoked_at is null
      and token_ciphertext is not null and octet_length(token_ciphertext) = 32
      and token_nonce is not null and octet_length(token_nonce) = 12
      and token_auth_tag is not null and octet_length(token_auth_tag) = 16
      and encryption_key_id is not null
      and encryption_key_id collate pg_catalog."C" ~ '^[A-Za-z0-9_-]{1,32}$')
    or
    (revoked_at is not null and token_ciphertext is null
      and token_nonce is null and token_auth_tag is null
      and encryption_key_id is null)
  )
);

create unique index event_share_links_one_active_per_event
  on private.event_share_links (guild_id, event_id) where revoked_at is null;
create index event_share_links_event_history_idx
  on private.event_share_links (guild_id, event_id, created_at desc, id);

alter table private.event_share_links enable row level security;
-- No policies: app roles have neither table privileges nor an RLS read/write path.
revoke all on table private.event_share_links
  from public, anon, authenticated, service_role;

create function private.guard_event_share_link_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.revoked_at is not null then
      raise exception 'share links must be created active' using errcode = '55000';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.guild_id is distinct from old.guild_id
    or new.event_id is distinct from old.event_id
    or new.token_digest is distinct from old.token_digest
    or new.created_at is distinct from old.created_at then
    raise exception 'share link identity and creation metadata are immutable'
      using errcode = '55000';
  end if;

  -- SET NULL from a deleted profile is the only actor-metadata exception.
  -- Checking parent absence prevents a privileged caller clearing a live actor.
  if new.created_by is distinct from old.created_by and not (
    new.created_by is null and old.created_by is not null and not exists (
      select 1 from public.profiles p where p.id = old.created_by
    )
  ) then
    raise exception 'share link creation actor is immutable' using errcode = '55000';
  end if;

  if old.revoked_at is not null then
    if new.revoked_at is distinct from old.revoked_at
      or new.revocation_reason is distinct from old.revocation_reason
      or new.token_ciphertext is distinct from old.token_ciphertext
      or new.token_nonce is distinct from old.token_nonce
      or new.token_auth_tag is distinct from old.token_auth_tag
      or new.encryption_key_id is distinct from old.encryption_key_id
      or (new.revoked_by is distinct from old.revoked_by and not (
        new.revoked_by is null and old.revoked_by is not null and not exists (
          select 1 from public.profiles p where p.id = old.revoked_by
        )
      )) then
      raise exception 'share link revocation is permanent' using errcode = '55000';
    end if;
  elsif new.revoked_at is null then
    if new.token_ciphertext is distinct from old.token_ciphertext
      or new.token_nonce is distinct from old.token_nonce
      or new.token_auth_tag is distinct from old.token_auth_tag
      or new.encryption_key_id is distinct from old.encryption_key_id then
      raise exception 'active share link recovery material is immutable'
        using errcode = '55000';
    end if;
  elsif new.revoked_by is null then
    raise exception 'share link revocation requires an actor' using errcode = '23514';
  end if;
  -- Constraints enforce complete envelope removal and revocation metadata.
  return new;
end;
$$;
revoke all on function private.guard_event_share_link_write()
  from public, anon, authenticated, service_role;
create trigger event_share_links_guard_write
  before insert or update on private.event_share_links
  for each row execute function private.guard_event_share_link_write();

create function public.get_event_share_link_state(p_guild_id uuid, p_event_id uuid)
returns table (link_id uuid, created_at timestamptz, available boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_publish_manage(p_guild_id);
  if not exists (select 1 from public.events e
    where e.guild_id = p_guild_id and e.id = p_event_id) then
    raise exception 'Event unavailable for this Guild' using errcode = 'P0002';
  end if;
  return query
  select l.id, l.created_at,
    coalesce(l.id is not null and e.status = 'active'
      and p.status = 'published' and v.sealed_at is not null, false)
  from public.events e
  left join private.event_share_links l
    on l.guild_id = e.guild_id and l.event_id = e.id and l.revoked_at is null
  left join public.event_publications p
    on p.guild_id = e.guild_id and p.event_id = e.id
  left join public.event_publication_versions v
    on v.guild_id = p.guild_id and v.event_id = p.event_id
    and v.publication_id = p.id and v.id = p.current_version_id
  where e.guild_id = p_guild_id and e.id = p_event_id;
end;
$$;

create function public.get_event_share_link_copy_payload(
  p_guild_id uuid, p_event_id uuid, p_link_id uuid
)
returns table (
  link_id uuid, token_digest text, token_ciphertext bytea, token_nonce bytea,
  token_auth_tag bytea, encryption_key_id text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_publish_manage(p_guild_id);
  if not exists (select 1 from public.events e
    where e.guild_id = p_guild_id and e.id = p_event_id) then
    raise exception 'Event unavailable for this Guild' using errcode = 'P0002';
  end if;
  return query select l.id, l.token_digest, l.token_ciphertext, l.token_nonce,
    l.token_auth_tag, l.encryption_key_id
  from private.event_share_links l
  where l.guild_id = p_guild_id and l.event_id = p_event_id
    and l.id = p_link_id and l.revoked_at is null;
end;
$$;

create function public.create_event_share_link(
  p_guild_id uuid, p_event_id uuid, p_link_id uuid, p_token_digest text,
  p_token_ciphertext bytea, p_token_nonce bytea, p_token_auth_tag bytea,
  p_encryption_key_id text
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
  select e.status into v_event_status from public.events e
  where e.guild_id = p_guild_id and e.id = p_event_id for update;
  if not found then
    raise exception 'Event unavailable for this Guild' using errcode = 'P0002';
  end if;
  if v_event_status <> 'active' then
    raise exception 'archived Events cannot create share links' using errcode = '55000';
  end if;

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

create function public.rotate_event_share_link(
  p_guild_id uuid, p_event_id uuid, p_expected_link_id uuid, p_new_link_id uuid,
  p_token_digest text, p_token_ciphertext bytea, p_token_nonce bytea,
  p_token_auth_tag bytea, p_encryption_key_id text
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
  select e.status into v_event_status from public.events e
  where e.guild_id = p_guild_id and e.id = p_event_id for update;
  if not found then
    raise exception 'Event unavailable for this Guild' using errcode = 'P0002';
  end if;
  if v_event_status <> 'active' then
    raise exception 'archived Events cannot rotate share links' using errcode = '55000';
  end if;
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

create function public.revoke_event_share_link(
  p_guild_id uuid, p_event_id uuid, p_link_id uuid
)
returns void
language plpgsql
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

create function public.resolve_event_share_link(p_token text)
returns table (
  event_name text, event_type_name text, version_number integer,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- 32 bytes have 43 unpadded base64url characters; the last character has two
  -- zero padding bits. Reject noncanonical encodings, not just alphabet/length.
  if p_token is null or octet_length(p_token) <> 46
    or p_token collate pg_catalog."C" !~ '^v1\.[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$' then
    return;
  end if;
  return query select v.event_name_snapshot, v.event_type_name_snapshot,
    v.version_number, p.published_at
  from private.event_share_links l
  join public.events e on e.guild_id = l.guild_id and e.id = l.event_id
  join public.guilds g on g.id = l.guild_id
  join public.event_publications p on p.guild_id = l.guild_id and p.event_id = l.event_id
  join public.event_publication_versions v
    on v.guild_id = p.guild_id and v.event_id = p.event_id
    and v.publication_id = p.id and v.id = p.current_version_id
  where l.token_digest = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex')
    and l.revoked_at is null and g.status = 'active' and e.status = 'active'
    and p.status = 'published' and v.sealed_at is not null;
end;
$$;

-- Pin owners to the same trusted migration role as existing publication RPCs.
alter table private.event_share_links owner to postgres;
alter function private.guard_event_share_link_write() owner to postgres;
alter function public.get_event_share_link_state(uuid, uuid) owner to postgres;
alter function public.get_event_share_link_copy_payload(uuid, uuid, uuid) owner to postgres;
alter function public.create_event_share_link(uuid, uuid, uuid, text, bytea, bytea, bytea, text) owner to postgres;
alter function public.rotate_event_share_link(uuid, uuid, uuid, uuid, text, bytea, bytea, bytea, text) owner to postgres;
alter function public.revoke_event_share_link(uuid, uuid, uuid) owner to postgres;
alter function public.resolve_event_share_link(text) owner to postgres;

revoke all on function public.get_event_share_link_state(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_event_share_link_copy_payload(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_event_share_link(uuid, uuid, uuid, text, bytea, bytea, bytea, text) from public, anon, authenticated, service_role;
revoke all on function public.rotate_event_share_link(uuid, uuid, uuid, uuid, text, bytea, bytea, bytea, text) from public, anon, authenticated, service_role;
revoke all on function public.revoke_event_share_link(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.resolve_event_share_link(text) from public, anon, authenticated, service_role;
grant execute on function public.get_event_share_link_state(uuid, uuid) to authenticated;
grant execute on function public.get_event_share_link_copy_payload(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_event_share_link(uuid, uuid, uuid, text, bytea, bytea, bytea, text) to authenticated;
grant execute on function public.rotate_event_share_link(uuid, uuid, uuid, uuid, text, bytea, bytea, bytea, text) to authenticated;
grant execute on function public.revoke_event_share_link(uuid, uuid, uuid) to authenticated;
grant execute on function public.resolve_event_share_link(text) to anon, authenticated;

comment on table private.event_share_links is
  'Event-scoped bearer-link digests and opaque server AES-256-GCM recovery envelopes. No direct app-role access. Revocation is permanent and scrubs the recovery envelope; encrypted plaintext integrity is a server responsibility.';
comment on function public.resolve_event_share_link(text) is
  'Bearer-only current sealed publication projection: Event name, Event Type name, version number and publication timestamp. Unavailable tokens return zero rows. Never exposes IDs, history, roster or draft data. Direct Data API calls require independent abuse protection and sensitive-parameter-safe logging.';
comment on function public.get_event_share_link_copy_payload(uuid, uuid, uuid) is
  'publish.manage-only encrypted active-link recovery. The server must authenticate AES-GCM scoped associated data and verify decrypted token bytes against the digest before returning a URL.';
