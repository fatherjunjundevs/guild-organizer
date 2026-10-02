-- Phase 3.6A: Character reconciliation and import-history foundation.
--
-- Reconciliation is always explicit. Exact Guild-scoped IGN remains the only
-- automatic import identity rule. This migration does not guess renames and
-- does not expose a reconciliation mutation API.
--
-- A reconciled Character row remains preserved as historical identity and
-- points to the canonical Character UUID. Future reconciliation RPCs will
-- move organizer-owned references transactionally before marking a source
-- Character reconciled.
--
-- roster_sync_runs remains the import-level summary. roster_sync_run_changes
-- stores only meaningful per-Character changes, not a copy of the raw source.

-- ---------------------------------------------------------------------------
-- Character reconciliation state
-- ---------------------------------------------------------------------------

alter table public.characters
  add column reconciled_into_character_id uuid,
  add column reconciled_at timestamptz,
  add column reconciled_by uuid references public.profiles(id) on delete set null;

alter table public.characters
  drop constraint characters_inactive_reason_valid,
  drop constraint characters_lifecycle_consistent;

alter table public.characters
  add constraint characters_reconciled_target_not_self
    check (
      reconciled_into_character_id is null
      or reconciled_into_character_id <> id
    ),
  add constraint characters_reconciled_target_fk
    foreign key (guild_id, reconciled_into_character_id)
    references public.characters(guild_id, id),
  add constraint characters_inactive_reason_valid
    check (
      inactive_reason is null
      or inactive_reason in ('left_guild', 'manual', 'reconciled')
    ),
  add constraint characters_lifecycle_consistent
    check (
      (
        status = 'active'
        and inactive_reason is null
        and left_guild_at is null
        and reconciled_into_character_id is null
        and reconciled_at is null
        and reconciled_by is null
      )
      or
      (
        status = 'inactive'
        and inactive_reason = 'left_guild'
        and left_guild_at is not null
        and reconciled_into_character_id is null
        and reconciled_at is null
        and reconciled_by is null
      )
      or
      (
        status = 'inactive'
        and inactive_reason = 'manual'
        and left_guild_at is null
        and reconciled_into_character_id is null
        and reconciled_at is null
        and reconciled_by is null
      )
      or
      (
        status = 'inactive'
        and inactive_reason = 'reconciled'
        and left_guild_at is null
        and reconciled_into_character_id is not null
        and reconciled_at is not null
      )
    );

create index characters_guild_reconciled_target_idx
  on public.characters (guild_id, reconciled_into_character_id)
  where reconciled_into_character_id is not null;

comment on column public.characters.reconciled_into_character_id is
  'Canonical Character UUID selected by explicit organizer reconciliation. Null means this Character remains an independent identity.';

comment on column public.characters.reconciled_at is
  'Time this historical Character identity was explicitly reconciled into another Character.';

comment on column public.characters.reconciled_by is
  'Organizer account that performed the explicit reconciliation. May become null if that profile is later removed.';

comment on column public.characters.inactive_reason is
  'left_guild means absent from a confirmed RTNW export; manual is organizer-controlled inactivity; reconciled means this preserved historical identity was explicitly merged into another Character.';

-- ---------------------------------------------------------------------------
-- Immutable reconciliation history
-- ---------------------------------------------------------------------------

create table public.character_reconciliations (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,

  source_character_id uuid not null,
  target_character_id uuid not null,

  source_ign_snapshot text not null,
  target_ign_snapshot text not null,

  triggering_sync_run_id uuid,
  note text,

  reconciled_by uuid references public.profiles(id) on delete set null,
  reconciled_at timestamptz not null default now(),

  constraint character_reconciliations_distinct_characters
    check (source_character_id <> target_character_id),

  constraint character_reconciliations_source_ign_length
    check (
      char_length(btrim(source_ign_snapshot)) between 1 and 80
    ),

  constraint character_reconciliations_target_ign_length
    check (
      char_length(btrim(target_ign_snapshot)) between 1 and 80
    ),

  constraint character_reconciliations_note_valid
    check (
      note is null
      or (
        note = btrim(note)
        and char_length(note) between 1 and 500
      )
    ),

  constraint character_reconciliations_source_fk
    foreign key (guild_id, source_character_id)
    references public.characters(guild_id, id),

  constraint character_reconciliations_target_fk
    foreign key (guild_id, target_character_id)
    references public.characters(guild_id, id),

  constraint character_reconciliations_triggering_run_fk
    foreign key (guild_id, triggering_sync_run_id)
    references public.roster_sync_runs(guild_id, id),

  constraint character_reconciliations_source_once
    unique (guild_id, source_character_id)
);

create index character_reconciliations_guild_reconciled_idx
  on public.character_reconciliations (guild_id, reconciled_at desc);

create index character_reconciliations_target_idx
  on public.character_reconciliations (guild_id, target_character_id);

alter table public.character_reconciliations enable row level security;

create policy character_reconciliations_select_authorized
on public.character_reconciliations
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'roster.manage')
  or private.has_guild_capability(guild_id, 'imports.manage')
  or private.has_guild_capability(guild_id, 'audit.view')
);

revoke all on table public.character_reconciliations
from anon, authenticated;

grant select on table public.character_reconciliations
to authenticated;

comment on table public.character_reconciliations is
  'Append-oriented audit history of explicit Character identity reconciliation. Source and target Character UUIDs remain preserved; reconciliation is never inferred from IGN similarity.';

-- ---------------------------------------------------------------------------
-- Per-Character import history
--
-- roster_sync_runs remains the parent/import summary.
-- Only meaningful changes are recorded here. Unchanged rows remain represented
-- by roster_sync_runs.unchanged_count and do not need one history row each.
--
-- before_values / after_values contain only values relevant to the recorded
-- change and must never contain the complete uploaded source payload.
-- ---------------------------------------------------------------------------

create table public.roster_sync_run_changes (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  sync_run_id uuid not null,

  character_id uuid not null,
  character_ign text not null,

  change_kind text not null,
  changed_fields text[] not null,

  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,

  recorded_at timestamptz not null default now(),

  constraint roster_sync_run_changes_run_fk
    foreign key (guild_id, sync_run_id)
    references public.roster_sync_runs(guild_id, id)
    on delete cascade,

  constraint roster_sync_run_changes_character_fk
    foreign key (guild_id, character_id)
    references public.characters(guild_id, id),

  constraint roster_sync_run_changes_ign_length
    check (
      char_length(btrim(character_ign)) between 1 and 80
    ),

  constraint roster_sync_run_changes_kind_valid
    check (
      change_kind in (
        'new',
        'update',
        'reactivate',
        'left_guild'
      )
    ),

  constraint roster_sync_run_changes_fields_valid
    check (
      cardinality(changed_fields) between 1 and 32
      and array_position(changed_fields, null) is null
    ),

  constraint roster_sync_run_changes_before_object
    check (jsonb_typeof(before_values) = 'object'),

  constraint roster_sync_run_changes_after_object
    check (jsonb_typeof(after_values) = 'object'),

  constraint roster_sync_run_changes_run_ign_unique
    unique (sync_run_id, character_ign)
);

create index roster_sync_run_changes_run_idx
  on public.roster_sync_run_changes (guild_id, sync_run_id);

create index roster_sync_run_changes_character_idx
  on public.roster_sync_run_changes (guild_id, character_id);

create index roster_sync_run_changes_guild_recorded_idx
  on public.roster_sync_run_changes (guild_id, recorded_at desc);

alter table public.roster_sync_run_changes enable row level security;

create policy roster_sync_run_changes_select_authorized
on public.roster_sync_run_changes
for select
to authenticated
using (
  private.has_guild_capability(guild_id, 'imports.manage')
  or private.has_guild_capability(guild_id, 'audit.view')
);

revoke all on table public.roster_sync_run_changes
from anon, authenticated;

grant select on table public.roster_sync_run_changes
to authenticated;

comment on table public.roster_sync_run_changes is
  'Per-Character applied import history beneath roster_sync_runs. Stores meaningful changes and limited before/after values without duplicating raw uploaded roster files.';

comment on column public.roster_sync_run_changes.character_ign is
  'Exact IGN snapshot at the time of the import so history remains understandable after later Character reconciliation.';

comment on column public.roster_sync_run_changes.changed_fields is
  'Names of fields changed by this applied import row.';

comment on column public.roster_sync_run_changes.before_values is
  'Limited pre-change values for changed fields only; never the complete uploaded source row or file.';

comment on column public.roster_sync_run_changes.after_values is
  'Limited post-change values for changed fields only; never the complete uploaded source row or file.';
