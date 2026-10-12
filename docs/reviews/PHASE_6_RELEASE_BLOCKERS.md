# Phase 6 release blockers and independent decisions

Audit baseline: `feature/phase-6-publishing-sharing` / `123284c026eda640f61984f38b09cfcdc46b91f8`; 2026-10-12 UTC. [CI #97](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38186202893) quality and database jobs **PASSED**. This document summarizes [the full audit](PHASE_6_FINAL_AUDIT.md) and [requirement traceability](PHASE_6_REQUIREMENTS_TRACEABILITY.md). It does not authorize changes or deployment.

## Three independent decisions

### 1. Phase 6 implementation — BLOCKED

Most approved behavior is implemented and current CI is green. An unconditional local implementation-complete declaration is not supported while:

- **P6-A01**: request-body timeout cancellation leaves a rejected promise unhandled.
- **P6-A02**: large draft Builder/preview reads can silently truncate at the API row cap while publishing remains enabled.
- **P6-A03**: separately required real HTTP/driver/lifecycle and enabled sharing browser evidence is historical/skipped rather than current at this infrastructure revision.

The two reproduced defects can be addressed with small source corrections; no authorization migration or public DTO redesign is indicated. Record dependency risk disposition and reconcile present-state docs for the closure package. External infrastructure may remain intentionally absent while an explicitly scoped local implementation checkpoint is closed after its own gates pass.

### 2. Start Phase 7 implementation — BLOCKED pending bounded handoff

Resolve the local Phase 6 blockers, validate at the reviewed revision, then obtain the requested independent handoff review. This recommendation does not forbid read-only planning. A separately authorized package can address these corrections and evidence without creating another product phase.

Once that handoff is accepted, Phase 7 may own the roadmap's measured performance, WCAG/native-device review, dependency/security hardening, monitoring, backup/recovery, staging and hosted infrastructure verification. It need not wait for public sharing activation, provided gates remain closed and release blockers retain owners/acceptance criteria. Beginning Phase 7 is never permission to set hosted flags or provision real credentials.

### 3. Hosted public Event sharing — BLOCKED

Actual source accepts the sharing flags only with `APP_ENV=local`. Hosted access cannot safely be enabled by configuration alone. No real hosted reader, verified certificate connection, trusted edge or distributed admission provider evidence was supplied. Complete gateway/APM/PG log privacy, CSP/HSTS/security scanning, real browser-to-hosted-data and accessibility/performance release evidence is also absent. Green GitHub ephemeral tests are not that evidence.

Never simulate a hosted deployment as local or restore direct anon/authenticated/service-role RPC grants. A hosted gate/source evolution requires independent review after infrastructure and policy acceptance. No production credentials are to be invented or silently installed.

## Prioritized work

| Priority / finding | Minimal next work | Evidence to close | Blocks |
| --- | --- | --- | --- |
| P1 A01, source reliability/privacy | Handle detached timeout cancel rejection without awaiting cancellation or extending body deadline | Rejecting/never-settling cancel regressions; no unhandled/error logs; exact safe status/time bound | Phase 6, Phase 7 handoff, hosted |
| P1 A02, organizer preview integrity | Complete, counted, deterministic draft/roster reads or explicit validated size refusal; preserve Guild/RLS/consistency | >1,000 seats/roster, lower cap, missing batch and concurrent mutation; preview/publish correspondence | Phase 6, Phase 7 handoff, large-lineup hosted |
| P1 A03, retained integration proof | Reconcile relevant existing real owned runners at correction/release SHA; enabled sharing browser suite on an ephemeral target | Exact HTTP279+internal12, driver148 or documented maintained totals, projection races9, lifecycle27/22, 42501/status/privacy/cleanup, enabled role/copy/rotate/revoke cases | Unconditional closure/handoff and hosted |
| P1 A04, hosted transport/identity/admission | Approved dedicated PG17 LOGIN reader, narrow SET membership, TLS target/CA, trusted header-stripping edge and atomic Redis provider | Positive/negative cert/identity/grant tests; real two-instance admission, IPv6/spoof/outage tests; connection limits | Hosted |
| P1 A05, hosted log privacy | Sink inventory and complete bounded synthetic-secret evidence; approved compatible PG privacy configuration | Core/audit/auto-explain/parameter/bootstrap/admin/pool/notification checks plus gateway/APM/error/Redis output; no missing/truncated evidence | Hosted |
| P1 A06, browser/operational release gate | Approved CSP/HSTS serving policy, final cache/referrer/nosniff/Permissions headers, secret scan/session abuse/Security Advisor and operational recovery | Actual HTTPS/gateway/browser responses; auth/invite replay; backup restore/monitoring acceptance on separate target | Hosted preview/public release |
| P1 A07 for hosted sign-off, dependency disposition | Assess reachable paths and approved patched/mitigated versions or explicit risk acceptance; do not blindly upgrade | Current three-advisory inventory, import/build exposure, lockfile/security-policy validation and scanning plan | Hosted; tracked handoff disposition |
| P2 A08, browser flake | Reproduce current-version marker failure after republish/reload; repair demonstrated cause only | Stable repeated history browser behavior, retain assertion | Important release-confidence follow-up |
| P2 A09, accessibility/performance | Define budgets and perform representative native-device/AA/load/query measurements | Screen reader/keyboard/zoom/tablet/touch/long text; capacity and bounded timeout/pool behavior; measured budgets | Hosted UX/performance acceptance unless explicit reviewed deferral |
| P2 A10, accurate contracts | Update current summaries, preserve historical reports | No absent-page/null-pin/current-CI-failure claims presented as current; exact local/hosted status | Closure documentation/handoff |
| P2 A11, historical network uncertainty | Preserve Classification C; continue exact current checks | Current evidence remains matching; no speculative classification/repair | Observation; not independent blocker while current checks pass |
| P2 A12, retained publisher identity | Decide account-retirement/deletion semantics and test in disposable target | Preserve sealed content/history while proving approved actor-retirement behavior | Before providing retained-Guild publisher deletion; Phase 7 follow-up |
| P2 A13, Event workflow scope | Clarify assignment-edit versus metadata/archive UI scope; do not infer controls from status fixtures | Product acceptance decision and, only if required, separately reviewed authorized workflow tests | Product-scope follow-up before claiming the entire Event lifecycle complete |

No P0 finding was established. Missing verification is not reported as an established exploit. A01's unhandled rejection and A02's truncation were reproduced with current code using synthetic in-memory inputs; their real transport/large-database production impacts were not live-tested.

## Acceptance sequence for independent review

1. Approve a small A01/A02 correction scope and focused tests, retaining security architecture and immutable data contracts.
2. Run TypeScript, lint, unit/components, build and applicable UI regressions on that change. Fix only demonstrated failures. Preserve failed evidence.
3. Run A03's relevant retained integration gates on verified owned disposable targets. Do not touch development containers/data/network, reuse real credentials or pull unapproved images. Missing provenance or cleanup fails the run, not just a warning.
4. Reconcile current documentation, dependency disposition, flaky browser status and the Phase 6 handoff; independent source review decides closure and Phase 7 start separately.
5. Before hosted work, approve operator/infrastructure scope and exact deployment target. Apply/provision nothing automatically. Keep public gates closed during migrations and privilege/privacy checks.
6. Verify TLS, reader grants/options/default privileges, real trusted edge/Redis multi-instance admission and complete synthetic log evidence before any hosted bearer requests.
7. Verify hosted final HTTPS headers/CSP/HSTS/cache behavior, browser-to-real-data success/denial/revoke/rotate/update and pool/timeout/failure paths, accessibility/performance, scans, monitoring and recovery.
8. Independently approve the hosted gate/source transition and release. Disable/rollback must fail closed, never restore general resolver EXECUTE or delete publication history.

This is an ordered closure plan, not permission to execute it now. Audit mode stops after delivery.

## What is already proven and should not be reopened speculatively

- CI #97 passed the pinned PostgreSQL image/startup path, migrations, schema lint, all **34 files /1,443 SQL assertions**, **16 concurrency**, **130 authority concurrency**, **31 crypto**, generated types and cleanup.
- Quality passed **826 units /49 files**, build/lint, **six dedicated production-build public browser tests**, and the authenticated browser job with **24 passed, one flaky, eight skipped**.
- Original direct Data API resolver restrictions remain. Historical real HTTP evidence includes **279+12**, actual **401/403 and SQLSTATE42501**, both pooled backends, cache reload/cold restart and private resolver access. It is preserved as historical evidence, not newly rerun or claimed by #97.
- SCRAM serialization, wrong-password rejection and owned-cluster startup are no longer open failures. Stage diagnostics remain sanitized, and no PostgreSQL behavior was changed by this audit.
- No current cross-Guild/private-field projection or service-role fallback was found. Synthetic token/key/privacy tests do not establish external hosting privacy.

## Explicitly not verified or executed

No local suite/build/TypeScript/lint/Playwright/SQL/HTTP/lifecycle/driver test was rerun. No real-device, screen-reader, performance load, production secret scan, hosted Security Advisor, TLS provider, Redis provider, trusted gateway or hosted browser-to-database test was conducted. No development SQL, migrations, resets, fixtures or Docker lifecycle operations were used to obtain evidence.

Actual audit commands comprised read-only Git/source/GitHub/Docker inspection, `pnpm audit --json` (exit1 for three advisories), the two isolated in-memory probes and report/package verification. Current inventory matches the original preserved baseline: **12 development containers, four networks, three volumes, 15 image entries**, including unchanged database container identity and no disposable resources. Original baseline was not overwritten. Historical network discrepancy remains **Classification C, unresolved**.

Final source remains at the audited SHA with no tracked-source changes and an empty index. Only `PHASE_6_FINAL_AUDIT.md`, `PHASE_6_REQUIREMENTS_TRACEABILITY.md` and this report are new untracked repository files. Hosted sharing remains disabled. No staging, commit, push, deployment, credential provisioning or public feature activation occurred.
