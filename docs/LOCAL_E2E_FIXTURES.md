# Local E2E fixture lifecycle

Phase 6.3A.5B replaces ignored service-role DELETE results with checked local teardown. The service role intentionally cannot delete Guilds. Account-first removal also conflicts with the active Owner invariant and sealed publication immutability (`created_by` cannot be changed by a profile deletion). Populated Guild deletion additionally encounters restrictive assignment/Character, Event/Template/Event Type, and reconciliation foreign keys.

## Target and ownership

Authenticated specs import `fixtureTest` from `e2e/helpers/test.ts`. Its automatic per-test fixture starts a local run and reports teardown errors separately from the original test error. Existing helper `cleanup()` callbacks defer database removal to this teardown; they never perform an unchecked API deletion. All registered browser contexts close and clients stop before any database deletion. A failed resource close prevents deletion.

`verifiedLocalEnvironment` checks the repository package and real path, CLI project configuration, local Docker socket, container project/workdir labels, API and database port mappings, Auth/REST database destinations, loopback CLI endpoints, database name/OID and PostgreSQL system identifier. Remote Docker overrides and unexpected endpoints fail closed. Playwright starts a fresh server with the verified local public Supabase configuration; stop any port-3000 dev server first. Credentials are read in memory from CLI status, never printed or written into manifests.

Each run writes an atomic, fsynced JSON manifest under the current user's temp directory, `guild-organizer-e2e/<repository-hash>/<run-UUID>.json`. Exact creation intents are persisted **before** Auth Admin or `create_guild` requests. Auth accounts receive admin-controlled `app_metadata.go_e2e_fixture` with the run, intent and target fingerprint. Guilds use a unique run/intent name plus an exact registered creator. Registration records IDs and database creation timestamps before later seeding. Recovery matches these relationships, not a PID, prefix or name alone. Lost responses are reconciled through unique exact intents; creation requests are never automatically retried.

Manifests contain IDs, names, test emails, ownership markers, timestamps, target identity, liveness metadata and sanitized failures. They contain no passwords, keys, session tokens, bearer URLs, token digests or recovery envelopes. Do not move them into source control. Failed manifests and atomic-write temporary files remain as evidence. No creation request is made if its intent cannot be safely persisted.

Creation stages are persisted as planned, submitted, confirmed or definitively rejected. An empty read of a submitted request does not prove that a delayed server write cannot commit. Cleanup fails and retains that intent until exact ownership can be reconciled; if the outcome cannot be established, operator review is required. Transport failures never mark a request rejected or cause an automatic creation retry.

## Checked teardown

The local runner holds a PostgreSQL session advisory lock for the exact run across the database and Auth API phases. A second cleanup cannot own the same run. Distinct runs have distinct resources and locks. The live TCP lease and process liveness checks veto recovery of an active run; PIDs are only a conservative liveness check, never ownership evidence.

Cleanup first revalidates the original target and every recorded resource. Unexpected memberships, changed creators/names/timestamps, ambiguous intent matches or profile references outside registered Guilds stop deletion. A guarded, transactional, local `postgres` operation locks each verified Guild and its memberships, deletes restrictive dependents in order, then deletes the Guild and verifies all Guild-scoped tables are empty. Events cascade their sealed snapshots and share links without disabling triggers or changing publication contracts. Auth accounts are removed through the verified local Auth Admin API only after successful Guild cleanup. Every API failure is checked; Auth/profile deletion and Auth dependent records are verified. Exact-user flow/refresh records and audit records matching both recorded ID and test email are removed locally; no log payload or token material is exported. Unexpected SCIM associations require manual review.

All Guild deletion failures and all eligible account deletion failures are aggregated. Remaining records or failed verification make the test unsuccessful. Accounts remain when Guild removal fails. Cleanup failure cannot turn a failed test into a pass or hide its original error.

## Commands and recovery

```powershell
pnpm test:e2e:cleanup
pnpm test:fixtures:list
pnpm test:fixtures:recover <exact-run-UUID>
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/inventory-local-fixtures.mjs
```

Run the focused cleanup verifier before broader E2E. It checks successful populated deletion, a deliberately failed browser test plus teardown, real killed-child/lost-response recovery, two active runs, Auth deletion failure and repeated recovery. Its parent only recovers manifests carrying its unique batch identity. It verifies before/after local Guild/account counts; intentional failure probes must exit unsuccessfully and preserve both errors. Ordinary E2E skips the intentional failure probe.

After interruption, inspect the exact manifest and stop/confirm exit of its original runner. The recovery command rechecks target, host, lease and process inactivity, obtains the run lock, reconciles partial creation, rechecks ownership and resumes dependent-first removal. It is repeatable after partial or completed cleanup. A changed container/system identity, reused PID, busy former lease port, unavailable Docker/Auth or malformed manifest fails closed and preserves evidence; operator review is required, not a bypass flag.

## Historical inventory and prohibited operations

The inventory command uses a read-only repeatable-read snapshot. Detailed output stays **outside every Git repository**, under `%LOCALAPPDATA%\GuildOrganizer\local-only\fixture-inventories` on Windows (`~/.local/share/GuildOrganizer/local-only/fixture-inventories` on other platforms). Each invocation creates a new `snapshot-*` directory containing `PHASE_6_3A_5B_HISTORICAL_FIXTURES.json` and `PHASE_6_3A_5B_PROPOSED_DELETIONS.json`; it never overwrites a prior inventory or the reviewed candidate list. The console prints only allowlisted aggregate counts. Missing local storage, repository destinations, other worktrees/bare repositories and junctions into Git fail closed before database inspection. Command-line output overrides are unsupported. `.gitignore` also excludes these detailed filenames and inventory directories if someone manually copies them into a worktree; do not force-add them.

The unchanged original review files are preserved under `phase-6-3a5b-originals` within that local-only directory. Both copies were verified against the repository originals by SHA-256 and length before the repository copies were removed. Inspect these files locally for exact historical fixture metadata/dependent counts and the **separate, unapproved** deletion inventory. They contain memberships, Event/publication/share-link IDs and dates, outside references and unmatched records. They omit roster values, secrets and token/recovery material but still contain private local record identities: do not publish, attach to public reviews, or move them into source control. Earlier review archives containing them remain local-only. The [sanitized review summary](reviews/PHASE_6_3A_5B_HISTORICAL_REVIEW.md) contains aggregate/cohort counts, findings and limitations only.

To inspect locally without printing detailed records into shared logs:

```powershell
$inventoryRoot = Join-Path $env:LOCALAPPDATA 'GuildOrganizer\local-only\fixture-inventories'
Get-ChildItem -LiteralPath $inventoryRoot -Directory
```

Open the original or chosen snapshot with a local editor. Re-run inspection immediately before any separately approved historical repair; creation markers alone do not authorize deletion. Historical fixtures have no new ownership manifest and must never be adopted by automatic recovery. Local output assumes trusted user storage; filesystem permissions inherit the user's Windows account permissions (owner-only file modes on platforms supporting them). It is not encrypted storage or protection against another privileged local operator.

Prohibited: production targets, new production grants or cleanup RPC/endpoints, deleting by prefix, adopting unknown IDs, disabling triggers/RLS, removing another active run, printing credentials, persisting tokens, or deleting historical fixtures without independent exact-ID approval. Local privileged access assumes a trusted operator and uncompromised local PostgreSQL/Docker/manifest directory. Atomic file writes reduce interruption risk but cannot promise recovery from disk corruption, loss of manifests or filesystem failure. Schema changes introducing new restrictive/non-Guild dependencies must be reviewed and tested; cleanup fails rather than guessing.
