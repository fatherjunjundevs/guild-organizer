-- Phase 3.1A: Master Guild Roster foundation.
-- The RTNW CSV export is authoritative for current game roster data.
-- Its "Id" column is intentionally NOT persisted as character identity.
-- Character identity for v1 sync is the exact Guild-scoped IGN.
--
-- Game-exported/current fields live on public.characters.
-- Organizer-maintained fields live separately on public.character_roster_profiles
-- so future RTNW syncs cannot overwrite officer-maintained metadata.

-- ---------------------------------------------------------------------------
-- Characters
-- ---------------------------------------------------------------------------

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,

  -- Exact RTNW IGN. Do not case-fold, transliterate, or strip Unicode/symbols.
  ign text not null,

  -- Current fields supplied by the RTNW Guild CSV export.
  level integer,
  class_name text,
  title text,
  gender text,
  guild_position text,
  gear_score bigint,
  weekly_activity bigint,
  weekly_contribution bigint,
  total_contribution bigint,
  online_status text,

  -- Current Guild-roster lifecycle.
  status text not null default 'active',
  inactive_reason text,
  left_guild_at timestamptz,

  -- Creation/source tracking. A manually created character may later be seen
  -- in an RTNW export; source_origin records only how this row originated.
  source_origin text not null default 'manual',
  rtnw_first_seen_at timestamptz,
  rtnw_last_seen_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint characters_ign_length
    check (char_length(btrim(ign)) between 1 and 80),
  constraint characters_level_nonnegative
    check (level is null or level >= 0),
  constraint characters_class_name_length
    check (class_name is null or char_length(class_name) between 1 and 80),
  constraint characters_title_length
    check (title is null or char_length(title) between 1 and 120),
  constraint characters_gender_length
    check (gender is null or char_length(gender) between 1 and 40),
  constraint characters_guild_position_length
    check (
      guild_position is null
      or char_length(guild_position) between 1 and 80
    ),
  constraint characters_gear_score_nonnegative
    check (gear_score is null or gear_score >= 0),
  constraint characters_weekly_activity_nonnegative
    check (weekly_activity is null or weekly_activity >= 0),
  constraint characters_weekly_contribution_nonnegative
    check (weekly_contribution is null or weekly_contribution >= 0),
  constraint characters_total_contribution_nonnegative
    check (total_contribution is null or total_contribution >= 0),
  constraint characters_online_status_length
    check (
      online_status is null
      or char_length(online_status) between 1 and 120
    ),
  constraint characters_status_valid
    check (status in ('active', 'inactive')),
  constraint characters_inactive_reason_valid
    check (
      inactive_reason is null
      or inactive_reason in ('left_guild', 'manual')
    ),
  constraint characters_lifecycle_consistent
    check (
      (
        status = 'active'
        and inactive_reason is null
        and left_guild_at is null
      )
      or
      (
        status = 'inactive'
        and inactive_reason = 'left_guild'
        and left_guild_at is not null
      )
      or
      (
        status = 'inactive'
        and inactive_reason = 'manual'
        and left_guild_at is null
      )
    ),
  constraint characters_source_origin_valid
    check (source_origin in ('manual', 'rtnw_export')),
  constraint characters_rtnw_seen_consistent
    check (
      (
        rtnw_first_seen_at is null
        and rtnw_last_seen_at is null
      )
      or
      (
        rtnw_first_seen_at is not null
        and rtnw_last_seen_at is not null
        and rtnw_first_seen_at <= rtnw_last_seen_at
      )
    ),
  constraint characters_rtnw_source_has_seen_time
    check (
      source_origin <> 'rtnw_export'
      or rtnw_first_seen_at is not null
    ),
  constraint characters_exact_ign_per_guild_unique
    unique (guild_id, ign),
  constraint characters_guild_id_id_unique
    unique (guild_id, id)
);

create index characters_guild_status_idx
  on public.characters (guild_id, status);

create index characters_guild_class_idx
  on public.characters (guild_id, class_name)
  where class_name is not null;

create index characters_guild_gear_score_idx
  on public.characters (guild_id, gear_score desc)
  where gear_score is not null;

create trigger characters_set_updated_at
before update on public.characters
for each row
execute function private.set_updated_at();

create or replace function private.prevent_character_guild_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.guild_id is distinct from old.guild_id then
    raise exception 'characters.guild_id is immutable';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_character_guild_change()
from public, anon, authenticated;

create trigger characters_guild_immutable
before update of guild_id on public.characters
for each row
execute function private.prevent_character_guild_change();

-- ---------------------------------------------------------------------------
-- Organizer-maintained roster metadata
--
-- Kept separate from RTNW-exported fields so a roster sync can safely update
-- game data without overwriting officer-maintained organization choices.
-- ---------------------------------------------------------------------------

create table public.character_roster_profiles (
  guild_id uuid not null,
  character_id uuid not null,
  designation text,
  role_label text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (guild_id, character_id),

  constraint character_roster_profiles_character_fk
    foreign key (guild_id, character_id)
    references public.characters(guild_id, id)
    on delete cascade,
  constraint character_roster_profiles_designation_valid
    check (designation is null or designation in ('main', 'sub')),
  constraint character_roster_profiles_role_label_length
    check (
      role_label is null
      or char_length(btrim(role_label)) between 1 and 80
    )
);

create trigger character_roster_profiles_set_updated_at
before update on public.character_roster_profiles
for each row
execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS / privileges
--
-- Master-roster tables are management data. Direct reads require roster.manage.
-- Direct writes remain unavailable to application roles; Phase 3 write/sync RPCs
-- will be the authoritative mutation surface.
-- ---------------------------------------------------------------------------

alter table public.characters enable row level security;
alter table public.character_roster_profiles enable row level security;

create policy characters_select_roster_managers
on public.characters
for select
to authenticated
using (private.has_guild_capability(guild_id, 'roster.manage'));

create policy character_roster_profiles_select_roster_managers
on public.character_roster_profiles
for select
to authenticated
using (private.has_guild_capability(guild_id, 'roster.manage'));

revoke all on table public.characters from anon, authenticated;
revoke all on table public.character_roster_profiles from anon, authenticated;

grant select on table public.characters to authenticated;
grant select on table public.character_roster_profiles to authenticated;

comment on table public.characters is
  'Permanent Guild-scoped character records. RTNW CSV Id is intentionally not stored as identity; exact IGN is the v1 Guild-scoped sync key.';

comment on table public.character_roster_profiles is
  'Officer-maintained roster metadata kept separate from RTNW-exported character fields so game roster syncs do not overwrite organizer choices.';

comment on column public.characters.ign is
  'Exact current IGN as supplied by RTNW or entered manually; Unicode and symbols are preserved and matching is case-sensitive in v1.';

comment on column public.characters.inactive_reason is
  'left_guild means absent from a confirmed current RTNW Guild export; manual is an organizer-controlled inactive state.';
