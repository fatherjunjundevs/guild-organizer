# Phase 6: isolated PostgreSQL startup diagnostic

Status: implemented and locally verified; awaiting independent source review. No staging, commit, push, deployment or hosted activation. The real failing startup stage remains unknown until a reviewed correction runs on GitHub.

## Baseline and CI #96 evidence

Branch: `feature/phase-6-publishing-sharing`. HEAD: `9a8b55001cfc7d723f0f20de211eae80ff2cb4da`. Initial index and working tree were clean. Repository instructions, the runner, concurrency entrypoint, bootstrap SQL, ownership unit tests, infrastructure lifecycle tests and CI workflow were reviewed before implementation.

[CI #96](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38183737947) completed with quality success and database failure. Quality included successful unit tests, build, dedicated public-viewer E2E, complete application E2E and cleanup. The database job passed migration reset, schema lint and pinned-image preparation, then failed the isolated execution step at `2026-10-11T23:19:51Z` with `Isolated Docker exec failed (details suppressed)`. Generated types were skipped. The runner reported `Verified isolated test container, database, roles and temporary storage removed.`; the workflow's Supabase stop step also passed.

There is no standalone-bootstrap success marker or SQL assertion result. That marker is printed only after `cluster.start()` returns, bounding the failure to startup. Neither the precise exec operation nor its underlying PostgreSQL error/SQLSTATE is available from that suppressed message. No speculative role, authentication, image, SQL or logging correction is justified by this evidence.

## Existing execution order

`createIsolatedCluster()` first verifies the pinned image/daemon, creates durable protected ownership evidence and an exact isolated container, then verifies and records its ID and timestamp. The caller invokes `start()` inside its existing try/catch/finally cleanup boundary.

The unchanged startup order is:

1. Verify exact ownership, persist `starting`, start the registered container and persist `started`.
2. Poll readiness and the existing Auth/non-superuser role prerequisite, with the original deadline and retry delay.
3. Execute the existing bootstrap SQL and its authority/version/role/Auth/extension assertions.
4. Generate the in-memory password and execute the existing SCRAM password configuration.
5. Verify ownership, write the existing private HBA configuration and reload it.
6. Verify the existing authentication rules assertions.
7. Verify ownership and perform mandatory wrong-password rejection and correct-password identity checks.
8. Create and mark the owned disposable database.
9. Read and persist its system/database identity, then mark it `ready`.

Application migrations, resolver setup, complete SQL regressions, concurrency and cryptographic checks occur later. Existing caller cleanup is unchanged and still executes after startup failure; `start()` does not introduce automatic resource removal.

## Minimal changes and diagnostic boundary

Exactly three intended paths:

- `scripts/isolated-postgres-test-cluster.mjs`: a module-private frozen nine-stage allowlist, a sanitized startup error constructor, and a try/catch plus fixed stage assignments around the existing startup body.
- `src/test/isolated-postgres-test-cluster.test.ts`: extend the existing mocked Docker fixture for startup operations and add 39 focused diagnostic/security regressions.
- `docs/reviews/PHASE_6_ISOLATED_POSTGRES_STARTUP_DIAGNOSTIC_VALIDATION.md`: this report.

Stage labels are selected from predefined literals, never process output, SQL, environment or options. Unknown labels produce a generic fixed startup error without echoing the supplied label. The constructor ignores arbitrary exception messages, including objects marked `safe`, malformed metadata and throwing getters. It creates a fresh error without retaining the original cause. The existing `safeError()`/caller logging paths can report the resulting fixed message without any workflow or entrypoint change.

Only an exact existing safely generated Docker error representation can contribute a SQLSTATE. The existing seven-state allowlist is preserved: `42501`, `42601`, `22023`, `42883`, `42703`, `P0001`, `58P01`. There is no new raw-stderr parser, broader SQLSTATE policy, debug mode, environment switch or command/SQL logging. Previously unclassified psql output stays suppressed.

## Exact safe failure messages verified

Each line below was asserted through the actual startup method with mocked Docker execution:

```text
Isolated PostgreSQL startup failed at container-start (details suppressed)
Isolated PostgreSQL startup failed at postgres-readiness (details suppressed)
Isolated PostgreSQL startup failed at bootstrap-sql (details suppressed)
Isolated PostgreSQL startup failed at postgres-password (details suppressed)
Isolated PostgreSQL startup failed at hba-configuration (details suppressed)
Isolated PostgreSQL startup failed at hba-verification (details suppressed)
Isolated PostgreSQL startup failed at scram-probe (details suppressed)
Isolated PostgreSQL startup failed at test-database-create (details suppressed)
Isolated PostgreSQL startup failed at database-identity (details suppressed)
```

The actual existing Docker classifier-to-startup-boundary path also produced exactly `Isolated PostgreSQL startup failed at bootstrap-sql (SQLSTATE 42501) (details suppressed)` from a simulated classified failure, without forwarding its stdout/stderr. Unknown stage input produced exactly `Isolated PostgreSQL startup failed (details suppressed)`.

Privacy regressions supply synthetic sensitive categories in error messages and simulated stdout/stderr: password, connection URI, token and SQL text. Assertions verify fixed thrown/logged output and absence of the original cause, without printing these inputs or bootstrap SQL. Further cases cover a supposedly-safe arbitrary exception, malformed identity JSON, unclassified/unknown SQLSTATE data, null/non-error exceptions and hostile metadata getters. No raw PostgreSQL configuration, command arguments, environment values or runtime credentials are emitted.

## Fresh local validation, 2026-10-11

| Check | Actual result |
| --- | --- |
| Focused PostgreSQL and HTTP ownership suites | PASS: 211 tests in two files, exit 0 |
| New diagnostic cases | 39 passed: nine stage failures/cleanup; two success target conventions; arbitrary exception; actual classified SQLSTATE path; malformed identity; seven supported states; seven untrusted metadata cases; five unknown labels; three authentication/HBA assertions; three changed ownership identities |
| `pnpm test` | PASS: 826 tests in 49 files, exit 0; zero failures |
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS without warnings, exit 0 |
| CRLF-aware whitespace validation | PASS for both modified files and this new report; tracked check exit 0 |
| Parsed source-operation comparison against HEAD | Startup statements identical after removing only diagnostic stage assignments and wrapper; all other cluster methods identical |

The successful-startup regressions execute the real coordinator with mocked Docker results. They preserve the operation order, both authentication controls, ready phase/identity, and exact owned cleanup. Windows named-pipe/CRLF and Linux Unix-socket/LF target conventions are exercised. These are simulated target conditions on the current Windows workstation, not a new native Linux or real PostgreSQL integration run. The previous committed Linux fixture fix remains intact; fresh Linux execution of this diagnostic awaits hosted CI.

All stage failures execute the caller-style finally cleanup and verify one removal of only the registered container. Changed image ID, daemon ID or container ID causes startup failure before any start operation; cleanup refuses removal until trusted test evidence is restored. Existing manifest, isolation, inactive-process/lease, tampering, recovery and HTTP-dependent tests remain unchanged and pass. Test-only clock advancement expires the existing readiness deadline without altering production timing.

No live Docker failure simulation, disposable creation or database suite was run. Docker/ACL subprocesses are mocked in the regression tests; real temporary unit ownership files and local leases are confined to their existing private test directories and cleaned up. Production build was not rerun because application/build sources are unaffected. All local checks passed on their first completed run; no assertion or privacy safeguard was weakened.

## Preservation and final review state

Read-only preservation checks match the unchanged baseline exactly: 12 development container identities/configuration/state fingerprints, 4 networks, 3 volumes and 15 image inventory entries. Only the original development containers exist; no disposable Docker resource remains. No development database connection/query, migration/reset, fixture mutation, container start/stop/delete, image pull/build, network/volume change or credential provisioning occurred. Preservation inspection did not simulate failures or overwrite the baseline. Historical network discrepancy remains unresolved Classification C and was not investigated or reclassified.

The immutable image pin, verified local image ID/platform, daemon identity checks, manifest schema/content, ownership labels, recovery authorization, cleanup code, network isolation, storage protections, roles/privileges, authentication enforcement, SQL authority and logging settings remain unchanged. Parsed source comparison confirms every original startup operation and every other cluster method is retained. The bootstrap SQL, concurrency runner, lifecycle runner, workflow, public application/migrations and hosted feature gates were not modified. Hosted public sharing remains disabled.

Final branch/HEAD remain the expected baseline, with an empty index: two modified tracked files and this one untracked report. The complete source-review ZIP contains only these three intended files and an embedded SHA-256 manifest, with an identical external manifest and separate ZIP checksum. Credentials, dependencies, raw CI/runtime logs, database data and Git internals are excluded. No staging, commit, push or deployment occurred. Stop for independent review; the next reviewed hosted run should identify the precise failing protected startup stage before any PostgreSQL behavior correction is considered.
