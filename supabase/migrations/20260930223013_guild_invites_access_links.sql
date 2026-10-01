-- Phase 3.3C-1: Guild invitation/access-link schema.
-- Raw invite secrets are never stored. token_digest contains only a SHA-256
-- digest; generation lets regenerated links invalidate older copies.
-- Creation, revocation, resolution, and acceptance RPCs are added in 3.3C-2.

create table public.guild_invites (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  invite_kind text not null,
  role text not null,
  token_digest text not null,
  generation integer not null default 1,
  status text not null default 'active',
  max_uses integer,
  use_count integer not null default 0,
  last_used_at timestamptz,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint guild_invites_kind_valid
    check (invite_kind in ('join_link', 'elevated')),
  constraint guild_invites_role_valid
    check (role in ('member', 'officer', 'admin')),
  constraint guild_invites_token_digest_format
    check (token_digest ~ '^[0-9a-f]{64}$'),
  constraint guild_invites_token_digest_unique
    unique (token_digest),
  constraint guild_invites_generation_positive
    check (generation > 0),
  constraint guild_invites_status_valid
    check (status in ('active', 'revoked')),
  constraint guild_invites_max_uses_positive
    check (max_uses is null or max_uses > 0),
  constraint guild_invites_use_count_valid
    check (
      use_count >= 0
      and (max_uses is null or use_count <= max_uses)
    ),
  constraint guild_invites_last_used_consistent
    check (
      (use_count = 0 and last_used_at is null)
      or (use_count > 0 and last_used_at is not null)
    ),
  constraint guild_invites_expiration_after_creation
    check (expires_at > created_at),
  constraint guild_invites_kind_role_usage_valid
    check (
      (
        invite_kind = 'join_link'
        and role = 'member'
        and max_uses is null
      )
      or
      (
        invite_kind = 'elevated'
        and role in ('officer', 'admin')
        and max_uses = 1
      )
    ),
  constraint guild_invites_revocation_consistent
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    ),
  constraint guild_invites_guild_id_id_unique
    unique (guild_id, id)
);

create index guild_invites_guild_status_idx
  on public.guild_invites (guild_id, status);

create index guild_invites_active_expiration_idx
  on public.guild_invites (expires_at)
  where status = 'active';

create trigger guild_invites_set_updated_at
before update on public.guild_invites
for each row
execute function private.set_updated_at();

create table public.guild_invite_acceptances (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null,
  invite_id uuid not null,
  invite_generation integer not null,
  user_id uuid references public.profiles(id) on delete set null,
  membership_id uuid references public.guild_memberships(id) on delete set null,
  accepted_role text not null,
  accepted_at timestamptz not null default now(),

  constraint guild_invite_acceptances_generation_positive
    check (invite_generation > 0),
  constraint guild_invite_acceptances_role_valid
    check (accepted_role in ('member', 'officer', 'admin')),
  constraint guild_invite_acceptances_invite_fk
    foreign key (guild_id, invite_id)
    references public.guild_invites(guild_id, id)
    on delete cascade,
  constraint guild_invite_acceptances_once_per_generation
    unique (invite_id, invite_generation, user_id)
);

create index guild_invite_acceptances_guild_idx
  on public.guild_invite_acceptances (guild_id, accepted_at desc);

create index guild_invite_acceptances_user_idx
  on public.guild_invite_acceptances (user_id, accepted_at desc);

create or replace function private.enforce_invite_acceptance_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_membership_guild_id uuid;
  v_membership_user_id uuid;
  v_membership_role text;
  v_invite_generation integer;
  v_invite_role text;
begin
  if new.user_id is null or new.membership_id is null then
    raise exception 'invite acceptance requires a user and membership'
      using errcode = '23502';
  end if;

  select m.guild_id, m.user_id, m.role
  into v_membership_guild_id, v_membership_user_id, v_membership_role
  from public.guild_memberships m
  where m.id = new.membership_id;

  if v_membership_guild_id is null then
    raise exception 'invite acceptance membership not found'
      using errcode = '23503';
  end if;

  if v_membership_guild_id is distinct from new.guild_id then
    raise exception 'invite acceptance membership belongs to another guild'
      using errcode = '23514';
  end if;

  if v_membership_user_id is distinct from new.user_id then
    raise exception 'invite acceptance membership belongs to another user'
      using errcode = '23514';
  end if;

  select i.generation, i.role
  into v_invite_generation, v_invite_role
  from public.guild_invites i
  where i.guild_id = new.guild_id
    and i.id = new.invite_id;

  if v_invite_generation is null then
    raise exception 'invite acceptance invite not found'
      using errcode = '23503';
  end if;

  if v_invite_generation is distinct from new.invite_generation then
    raise exception 'invite acceptance generation does not match invite'
      using errcode = '23514';
  end if;

  if v_invite_role is distinct from new.accepted_role then
    raise exception 'invite acceptance role does not match invite'
      using errcode = '23514';
  end if;

  if v_membership_role is distinct from new.accepted_role then
    raise exception 'invite acceptance role does not match membership'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_invite_acceptance_snapshot()
from public, anon, authenticated;

create trigger guild_invite_acceptances_snapshot_check
before insert on public.guild_invite_acceptances
for each row
execute function private.enforce_invite_acceptance_snapshot();

alter table public.guild_invites enable row level security;
alter table public.guild_invite_acceptances enable row level security;

revoke all on table public.guild_invites from anon, authenticated;
revoke all on table public.guild_invite_acceptances from anon, authenticated;

comment on table public.guild_invites is
  'Guild-scoped member join links and single-use elevated invitations. Raw invite secrets are never stored.';

comment on table public.guild_invite_acceptances is
  'Append-oriented history of successful invite acceptances, including invite generation and accepted role snapshots.';
