# Phase 6 CI quality: Linux fixture and local public-viewer E2E

Status: local quality corrections verified; independent source review required. No staging, commit, push or deployment. GitHub CI remains failed at the committed baseline; this unpushed correction is not a green hosted baseline.

## Baseline and scope

Branch: `feature/phase-6-publishing-sharing`. HEAD: `58361f6c5f62aaca8911eb748222d126326d0669`. Initial working tree and index were clean. The repository agent instructions and installed Next.js headers guide were reviewed.

Exactly four intended changed paths:

1. `src/test/isolated-postgres-test-cluster.test.ts`: complete private temporary Linux state tree and one cross-platform fixture regression.
2. `playwright.config.ts`: exclude only `public-event-viewer.spec.ts` from the development-server suite; it is explicitly required in the separate production-build CI step.
3. `.github/workflows/ci.yml`: run the existing dedicated public-viewer browser configuration after Build and before Supabase startup. Keep the complete authenticated application browser gate and all database steps unchanged.
4. `docs/reviews/PHASE_6_CI_QUALITY_GATE_VALIDATION.md`: this report.

No production PostgreSQL runner, image pin, ownership check, resolver permission, SQL migration, authentication control, public application implementation, admission configuration, dependency or historical fixture changed.

## Linux unit-fixture failure

[CI #95 quality job](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38181825692/job/114595829174) failed ten ownership lifecycle tests with `ENOENT` while examining a temporary `go-image-identity-unit-*` home's `.local` directory. Windows uses the existing temporary `LOCALAPPDATA` root, while Linux uses `homedir()/.local/state`. The fixture previously provided the home but not that Linux state tree. The production verifier correctly refused the missing path.

The fixture now creates `.local/state` recursively with mode `0700` inside its unique temporary home, before invoking the callback. Creation is inside the existing `try/finally`, so failure still runs the exact temporary-directory cleanup. Production directory existence, ownership, symlink, permission and deletion guards are untouched. One regression checks both directory levels on every OS, and checks private mode and current UID when running on Linux. Docker/Windows ACL subprocesses remain mocked in these ownership unit tests.

The focused suite passed on the current Windows workstation: 172 tests, including all previously passing lifecycle/identity checks. The Linux-specific filesystem path is now created on both platforms. Actual execution on a new Linux runner remains GitHub-only validation; no Linux pass is claimed from Windows tests.

## Viewer heading and actual HTTP headers

[CI #94 quality job](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38178073637) failed the two viewer cases in the ordinary Playwright suite. That suite starts `next dev` without the two viewer flags. The viewer requires both `SHARE_LINK_INTERFACE_ENABLED=true` and `PUBLIC_EVENT_VIEWER_ENABLED=true`, in addition to the existing local-only feature condition.

Two real Chromium reproductions against Next.js 16.3.8 on loopback, without application fixtures or database requests, showed:

| Runtime and child-process flags | Actual heading | Final page Cache-Control |
| --- | --- | --- |
| `next dev`, both flags disabled | `Event sharing is not available yet`; expected empty viewer heading absent | `no-cache, must-revalidate` |
| `next dev`, both flags enabled and `APP_ENV=local` | `Your lineup starts with a shared link` | `no-cache, must-revalidate` |

The installed `node_modules/next/dist/server/base-server.js` explicitly replaces rendered-page Cache-Control in development mode with `no-cache, must-revalidate` (except its HMR refresh path). The installed headers guide was reviewed; production response generation preserves the configured page header. Adding flags alone would fix the heading but leave the security assertion failing. No HMR-header workaround, assertion deletion, framework patch or logging/security relaxation was introduced.

The smallest correction uses the already reviewed `playwright.public-event.config.ts`. Its web server runs the built application with `next start --hostname 127.0.0.1 --port 3100`, `APP_ENV=local` and both flags scoped only to that child server. The public tests run in a required CI step immediately after `pnpm build`, before any Supabase database startup/reset. The ordinary development-server suite excludes that one file to avoid running it again in an unsuitable runtime. All three public cases execute in each of its existing desktop/mobile projects, and all original no-store, fragment, storage, referrer and token-confidentiality assertions remain unchanged.

Separate actual final-response checks on the same production runtime recorded:

| Request | Status | Cache-Control | Referrer-Policy | X-Robots-Tag |
| --- | --- | --- | --- | --- |
| GET `/share/event` | 200 | `no-store, max-age=0` | `no-referrer` | `noindex, nofollow, noarchive` |
| HEAD `/share/event` | 200 | `no-store, max-age=0` | `no-referrer` | `noindex, nofollow, noarchive` |
| GET `/api/share/event` | 405 | `no-store, max-age=0` | `no-referrer` | `noindex, nofollow, noarchive` |

No application/header implementation change was needed: the production response already meets the requirement. Development-mode page caching behavior still differs; it is not claimed to satisfy the production privacy gate. All temporary local web servers were stopped after verification. No flags were enabled in environment files, staging, hosted production or deployment configuration.

## Quality validation and coverage limits

| Check | Fresh local result |
| --- | --- |
| Focused PostgreSQL/HTTP ownership tests | PASS: 172 tests in two files, exit 0 |
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS without lint warnings, exit 0 |
| `pnpm test` | PASS: 787 tests across 49 files, exit 0 |
| `pnpm build` | PASS, exit 0 |
| `pnpm exec playwright test --config playwright.public-event.config.ts` | PASS: all 6 desktop/mobile browser tests, exit 0 |
| Actual production page/API header checks | PASS: GET/HEAD page and GET API retain no-store/referrer/index protection |
| Workflow YAML parse using the existing ESLint `js-yaml` dependency | VALID; public step is after Build and before database startup; complete application browser gate retained |
| CRLF-aware whitespace checks | PASS: tracked changes and the new report; no repository/global Git configuration change |

Four browser cases use synthetic published/unavailable API responses; two exercise the actual Next API's missing-configuration rejection (503 and GET 405). These results are not browser-to-live-database integration or hosted admission evidence. The complete public-viewer file remains required in CI and runs on desktop and mobile, expanding its previous single-project CI coverage rather than deleting a test.

The full authenticated application browser suite was **not run locally**. Its guarded helpers create users, Guilds, Events and publications in the existing development Supabase stack. No independent safe full-browser database environment is already running here; exercising that suite would violate the development-data preservation restriction. Its original CI command, fixture protections and teardown remain unchanged. A reviewed push and hosted execution are required for that gate.

The publication-history test was reviewed. CI #94 initially saw zero version cards where ten were expected at line 182, then passed on retry and was reported flaky. No deterministic issue was reproduced within the allowed non-mutating environment. Its data setup, expected page bounds, authorization checks, selectors and timeouts remain unchanged; no speculative wait increase or product change was made.

## CI #95 database result and separate blocker

[CI #95 database job](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38181825692/job/114595828891) completed with **failure**. Migration reset, schema lint and pinned-image preparation passed. The SQL/concurrency/cryptography step failed at `2026-10-11T22:50:11Z` with exactly:

```text
Isolated Docker exec failed (details suppressed)
```

Generated types were skipped; Supabase cleanup passed. The former pinned-image rejection is absent, but there is no bootstrap-success marker or SQL assertion result. The runner source places that marker only after `cluster.start()` completes, so the available evidence bounds the new failure to startup/bootstrap. The logs do not disclose which required exec failed, its SQLSTATE or its underlying stderr. This generic category is not sufficient to justify a PostgreSQL behavior change or declare any SQL assertions passed.

The smallest next investigation is an independently reviewed, bounded startup-stage diagnostic: attach a fixed allowlisted stage (readiness, role bootstrap, password/HBA setup, SCRAM controls or database creation) and safe exit/error classification to the existing failure, while retaining raw stderr/SQL/credential suppression and exact cleanup. If psql's prefix prevents the existing SQLSTATE classifier from matching, refine only that allowlisted classification. No password, role, HBA, image or permission workaround can be justified from the present log. This task does **not** apply that follow-up or alter the working image-identity model.

The database workflow block and `scripts/isolated-postgres-test-cluster.mjs` were explicitly verified unchanged from HEAD. The separate failure remains a blocker to a green complete GitHub baseline.

## Preservation and final state

Read-only before/final Docker inventory comparisons match the original preservation baseline: 12 development container identity/configuration/state fingerprints, 4 networks, 3 volumes and 15 image entries. No Docker lifecycle, image pull/build, development database query, migration/reset, fixture creation or privileged cleanup was executed. Browser traffic was confined to public loopback routes; the dedicated browser suite performs no Supabase discovery. The original baseline was not overwritten. Historical network uncertainty remains unresolved Classification C and was not investigated or reclassified.

The approved production runner, public feature gates, page metadata/header configuration, API/driver, admission controls, SQL projection/migrations, browser privacy assertions and publication-history test remain unchanged. Hosted public sharing remains disabled. No credentials/provider/proxy were provisioned, and no dependency was installed.

Final branch/HEAD remain the expected baseline. The index is empty; there are exactly three modified tracked files and this one untracked report. The independent review ZIP contains only these four intended source/documentation files plus its SHA-256 manifest; a separate checksum and external manifest are supplied. Raw CI logs, browser/runtime artifacts, credentials, dependency directories and Git internals are excluded. No staging, commit, push or deployment occurred. Stop for independent review.
