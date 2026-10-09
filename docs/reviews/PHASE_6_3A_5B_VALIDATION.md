# Phase 6.3A.5B implementation review

Baseline: `feature/phase-6-publishing-sharing`, HEAD `9ef4ed2`, clean working tree. The remote branch was also verified at `9ef4ed2035536eb9936b6bbf2bf12cf4bf8fbfaf`. No staging, commit, push or deployment was performed.

## Correction

Previous helpers ignored Guild DELETE and Auth Admin errors. The service role has no Guild DELETE grant; account-first cleanup also encounters the Owner invariant and sealed publication actor immutability. Populated Guild cascades encounter restrictive assignment/Character, Event/Template/Event Type and reconciliation references.

The replacement uses durable pre-request intents and request stages, exact Auth ownership tags and Guild creator/name/timestamp checks, verified local target identity, browser/client shutdown, run advisory locks, transactional dependent-first Guild deletion, checked Auth Admin deletion and exact dependent verification. A submitted creation request with an unconfirmed outcome is retained as a failure rather than inferred absent from one read. Nullable creator comparisons and the empty-owned-Guild outside-reference boundary fail closed. There is no cleanup RPC, new grant, migration, trigger bypass or application permission change.

See [the lifecycle guide](../LOCAL_E2E_FIXTURES.md) for target checks, ownership, interruption recovery, failure handling and prohibited operations.

## Actual validation

| Check | Result |
|---|---|
| TypeScript (`pnpm exec tsc --noEmit`) | PASS |
| ESLint (`pnpm lint`) | PASS, no warnings |
| Unit/component (`pnpm test`) | 429 passed, 39 files; 39 lifecycle tests |
| Production build (`pnpm build`) | PASS |
| Focused guarded cleanup (`pnpm test:e2e:cleanup`) | PASS: 2 browser positives; intentional negative fails with both original/teardown errors; real child interruption, partial/lost responses, Auth failure/recovery, duplicate recovery, concurrent active-run isolation and target mismatches pass |
| Default E2E, serial (`pnpm test:e2e --workers=1 --reporter=line`) | 25 passed, 8 skipped, 7.9 minutes |
| Configured sharing (`pnpm test:e2e:sharing`) | 7 passed, 2 skipped, 2.6 minutes; exact temporary provisioning key removed |
| Enabled sharing without cryptographic configuration, targeted configuration-rejection test | 1 passed, 21 seconds |
| Database lint (`pnpm db:lint`) | PASS, no schema errors |
| Database regressions (`pnpm db:test`) | 1,367 passed, 32 files |
| Generated types (`pnpm db:types:check`) | PASS, unchanged/up to date |
| Guarded concurrency (`pnpm db:test:concurrency`) | 16 lifecycle + 130 authorization assertions passed; 31 server-integration SQL assertions passed; owned disposable database removed |
| Whitespace (`git diff --check`) | PASS |

The initial two-worker default E2E run had **24 passes, 8 skips and one Publication History loading assertion timeout** (5-second expectation, dialog still loading). It had no fixture cleanup failure. The complete serial rerun passed without changing that assertion or application code. Parallel local UI timing remains a follow-up; this checkpoint does not claim a production performance budget.

Skip accounting:

- Default E2E: seven enabled-sharing cases (configuration rejection, keyed Owner lifecycle, four role boundaries and cross-Guild/anonymous boundaries) require their separate gate/key environments; the intentional cleanup failure probe is also skipped.
- Configured sharing: the default-disabled visibility case and no-key configuration-rejection case require different environments. The latter was exercised separately.
- Focused cleanup positive invocation: intentional failure is skipped. Negative invocation: two positive cases are skipped and the deliberate test/teardown failure is required to exit nonzero. The guarded parent verifies that outcome and recovers only its own batch.

Coverage distinction: backend unit tests inject failures and malformed ownership/persistence conditions. Browser fixtures use real local Auth Admin creation, magic-link authentication, cookies, authenticated Server Actions and PostgREST. Successful cleanup/recovery uses real PostgreSQL and Auth Admin deletion. The Auth failure probe injects a backend rejection rather than breaking the actual GoTrue service. Local cleanup regressions use exact run-owned Guild/account isolation in the verified development stack, which retains historical data; the separate existing concurrency suite uses an ownership-verified disposable database. Read-only outside-reference regression uses an existing relationship solely as a witness and never modifies it.

## Data and scope verification

Across this checkpoint's validation, **136 durable run manifests recorded 116 created accounts and 89 created Guilds**. Every manifest finished complete. Final exact-ID checks across Guilds, profiles, Auth users and Guild-scoped tables found zero recorded resources remaining; new tagged account and fixture Auth-log counts were also zero. Before/after totals stayed **339 Guilds and 339 Auth accounts**. Historical exact IDs, inventoried metadata, memberships, dependent counts and outside references matched the earlier snapshot.

There are **338 intentionally preserved historical fixture pairs**, including the reported 19 and 17 Event Builder subsets, plus one unmatched Guild/account pair excluded from proposed deletion. This is not a claim that the database is clean. See the [sanitized aggregate review and approval/safety plan](PHASE_6_3A_5B_HISTORICAL_REVIEW.md) and [local-only detailed inventory storage/inspection instructions](../LOCAL_E2E_FIXTURES.md#historical-inventory-and-prohibited-operations). Detailed files are excluded from source control. No historical cleanup was performed; deletion remains unapproved.

Application source, existing migrations, database types and dependency lockfile remain unchanged. Environment-file timestamps predate this checkpoint; no secret files were modified. Remaining limitations include conservative refusal for reused PIDs/lease ports, unavailable or changed targets, corrupted/lost manifests, unsupported dependencies and unresolved submitted creation outcomes. These retain evidence for operator review; there is no bypass flag.

## Final inventory privacy correction

Both original detailed inventories were preserved in the documented user-local directory and verified by matching SHA-256 hashes and byte lengths (946,509 and 615,004 bytes) before repository removal. A fresh read-only generator run produced a new external snapshot: the entire detailed report and proposed/held candidate lists matched the preserved originals, excluding only capture time. Totals remain 339 Guilds/accounts, 338 proposed historical pairs and zero held pairs. No historical deletion occurred and deletion remains unapproved.

The generator rejects repository paths, other Git worktrees/bare repositories, junctions into Git, relative/network destinations and unavailable Git verification. Local output uses fresh exclusive, flushed and hash-verified files; prior snapshots and the original candidate list are never overwritten. Ignore checks pass for both detailed filenames. Neither detailed file exists in the repository or Git index. Console output is a numeric allowlist with fixed aggregate labels.

TypeScript and ESLint passed. The focused inventory/lifecycle unit run passed **50 tests across two files** (11 output/privacy tests plus the unchanged 39 lifecycle tests); the full unit/component suite also passed **440 tests across 40 files**. Inspection of all six changed Markdown documents found no exact inventory record identifiers, account emails, genuine Guild names, personal paths or database/container identities. Browser E2E and database mutation checks were not repeated for this generator/documentation-only correction; the earlier results above remain historical validation evidence.

## Changed files

After the inventory privacy correction, all 34 changes are unstaged: 21 modified files and 13 new files. The two detailed inventory JSON files are preserved locally and removed from the repository inventory.

```text
.gitignore
docs/ARCHITECTURE.md
docs/LOCAL_E2E_FIXTURES.md
docs/QUALITY_GATES.md
docs/SHARE_LINK_SERVER_CONFIGURATION.md
docs/reviews/PHASE_6_3A_5B_HISTORICAL_REVIEW.md
docs/reviews/PHASE_6_3A_5B_VALIDATION.md
e2e/character-reconciliation.spec.ts
e2e/event-builder-critical.spec.ts
e2e/event-builder-responsive.spec.ts
e2e/event-publication-history.spec.ts
e2e/event-publication-workflow.spec.ts
e2e/event-share-link.spec.ts
e2e/fixture-cleanup.spec.ts
e2e/generic-spreadsheet-import.spec.ts
e2e/helpers/local-fixture-lifecycle.ts
e2e/helpers/local-supabase.ts
e2e/helpers/test.ts
e2e/roster-authorization.spec.ts
e2e/roster-organization.spec.ts
e2e/roster-pagination.spec.ts
e2e/roster-responsive.spec.ts
e2e/rtnw-roster-lifecycle.spec.ts
e2e/template-authorization.spec.ts
e2e/template-lifecycle.spec.ts
package.json
playwright.config.ts
scripts/inventory-local-fixtures.mjs
scripts/local-inventory-output.mjs
scripts/local-fixture-probe-child.mjs
scripts/local-fixtures.mjs
scripts/test-local-fixture-cleanup.mjs
src/test/local-fixture-lifecycle.test.ts
src/test/local-inventory-output.test.ts
```

Existing spec body behavior is preserved; those specs import the automatic guarded fixture wrapper. The new cleanup spec and test infrastructure contain the lifecycle changes. Stop here for independent source review.
