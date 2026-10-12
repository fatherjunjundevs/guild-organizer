# Phase 6 final independent audit

Audit date: 2026-10-12 UTC / 2026-10-11 America/New_York. Baseline: `feature/phase-6-publishing-sharing`, local and remote HEAD `123284c026eda640f61984f38b09cfcdc46b91f8`. Initial working tree and index were clean. This is a read-only source/evidence audit; only the three new audit reports and external review artifacts were created. No remediation is implemented or authorized by this report.

## Conclusions

The publishing and restricted sharing architecture is substantially implemented. CI #97 is genuinely green, including the complete discovered SQL suite, concurrency, cryptography, build, generated types and browser jobs. It does not establish production security approval or a fresh pass of every separately maintained integration gate.

Two defects were reproduced safely without a database or Docker lifecycle operation: an unhandled rejection in request-body timeout cancellation, and an incomplete Builder read accepted as publishable under the configured API row cap. These prevent an unqualified Phase 6 implementation PASS. No P0 vulnerability was established. Hosted sharing remains deliberately disabled and requires separate infrastructure, privacy and release verification.

| Decision | Recommendation now | Reason |
| --- | --- | --- |
| Phase 6 implementation closure | **BLOCKED** | P6-A01/A02 require small corrections; P6-A03 requires reconciliation of retained runtime gates at the release revision. |
| Start Phase 7 implementation | **BLOCKED** | Clear those local closure conditions and review the handoff first. Hosted infrastructure can remain disabled and be tracked separately; its absence does not require redesigning Phase 6. Read-only planning is distinct from implementation authorization. |
| Hosted public Event sharing | **BLOCKED** | Local-only code gates, unprovisioned/unverified reader/TLS/admission/edge/privacy controls and remaining release checks. Do not set `APP_ENV=local` on a hosted deployment to bypass this boundary. |

These are recommendations for independent review, not permission to fix, start another phase or deploy. A bounded correction/evidence package is appropriate; reopening the solved SCRAM or resolver grant architecture is not indicated.

## Evidence method and limits

Primary contracts reviewed: `PROJECT_BLUEPRINT.md`, `ARCHITECTURE.md`, `QUALITY_GATES.md`, `ROADMAP.md`, share-link configuration, Phase 6 publication/sharing decisions and review reports. Current application source, migrations, SQL/component/browser tests, isolated infrastructure and CI workflow were inspected. Historical reports are labeled historical, not independently rerun proof.

Authoritative current CI: [GitHub Actions #97](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38186202893), matching the audited SHA. Job metadata and sanitized log summaries were read through GitHub. Quality job `114608937218` and database job `114608937033` concluded `success`. Raw sensitive logs were not reproduced in these reports.

Actually executed during this audit:

- Read-only Git branch/HEAD/remote/status/index checks and source searches.
- Read-only Docker inventory fingerprint comparisons and the existing PostgreSQL/PostgREST image-inspection verification functions. Neither creates resources.
- `pnpm audit --json`: exit **1**, three advisories (two high, one moderate). This queries registry advisory metadata; it is not a test-suite rerun or dependency change.
- Two in-memory Node probes using the current TypeScript source transpiled in memory: rejecting cancellation, and Builder reads with a simulated 1,000-row API cap. No files, credentials, network requests or database records were used by either probe.
- Report/archive integrity and whitespace checks, recorded in the final delivery.

Not executed here: unit/component suites, TypeScript, ESLint, builds, Playwright, SQL, concurrency, HTTP, lifecycle, live driver, hosted TLS/Redis/proxy tests, migrations, resets, fixture cleanup, production Security Advisor or production scanning. No real-device or screen-reader session was conducted. The two probes are narrowly scoped reproductions, not live integration tests.

## Current CI and historical gate reconciliation

| Gate | Current SHA evidence | Interpretation |
| --- | --- | --- |
| ESLint | CI #97 successful lint step | Current CI PASS; not locally rerun. |
| Unit/component | **826 tests in 49 files passed** | Includes mocked identity, ownership, privacy and UI regression tests. |
| Production build/type checking | Successful `pnpm build` | Next build passed its TypeScript work. CI has no separate `tsc --noEmit` step; prior standalone local passes are historical. |
| Dedicated public viewer browser | **6 passed**, desktop and mobile Chromium emulation | Four tests use mocked published/unavailable API responses; two test the actual Next API's missing-configuration 503 and GET 405. Actual production-build page headers are checked. |
| Authenticated application browser | **24 passed, 1 flaky, 8 skipped** | Job passed after retry; not every declared test passed on the first attempt or ran. |
| Migration replay and schema lint | Both successful in ephemeral GitHub runner | Not a development/production migration or compatibility proof for an existing hosted database. |
| Complete SQL regression | **1,443 assertions in 34 files passed** | All original 33 files/1,401 assertions plus 42 public projection assertions. |
| Concurrency | **16 passed** | Real isolated SQL sessions, not UI mocks. |
| Authorization concurrency | **130 passed** | Real session/authority serialization tests, including hardened share mutations. |
| Production cryptography integration | **31 SQL assertions passed** | Encrypted RPC recovery with production TypeScript, synthetic credentials. |
| Generated database types | Successful type-check step | No skipped type gate in #97. The informational unformatted-output message is not a failure. |
| CI cleanup | Database runner verified removal; both Supabase stop steps succeeded | GitHub-owned resources only. Does not prove hosted operational recovery. |
| PostgREST HTTP | Historical **279 HTTP + 12 internal** assertions | Real 401/403 and PostgreSQL 42501, pool/cache/restart/rotation/revocation evidence in Work A/B reports. **Not run by #97 or this audit.** |
| Real driver/API | Historical **148 assertions**, 20 actual backend privacy checks | Real `pg` and Node HTTP/owned PostgreSQL; Redis responses scripted. **Not a real hosted provider test.** |
| Projection races | Historical **9** dedicated MVCC/republish/revoke assertions | Separate runner; not the ordinary #97 SQL/concurrency step. |
| Infrastructure lifecycle | Historical **27 PostgreSQL / 22 HTTP** checks | Current CI unit mocks cover guards; separate real lifecycle commands did not run in #97. |

The eight authenticated-suite skips are seven enabled-sharing tests in `e2e/event-share-link.spec.ts` (missing local gate/ephemeral key configuration) and the deliberately isolated cleanup-failure probe in `e2e/fixture-cleanup.spec.ts:23`. The default-disabled sharing test ran. Do not describe these skips as successful enabled-sharing coverage.

The flaky test is `e2e/event-publication-history.spec.ts:4`; its failed attempt timed out at line 154 waiting for v3's `Current member version` indicator after republish/reload. The retry passed. This audit did not reproduce its cause and does not attribute it to database corruption or a specific caching bug.

## Product workflow trace

Paths below are relative to the repository. Line references anchor the relevant boundary; see the companion traceability report for tests and evidence status.

| Workflow | Entry point and actor | Server/database boundary and integrity | Coverage and remaining concern |
| --- | --- | --- | --- |
| Draft creation | Event management; Owner/Admin or Officer with `events.manage`; `actions.ts:43` | UUID/input validation, session client, `create_event_from_template`; template row lock, Guild capability, copied Event-owned hierarchy. No generic application table-write grant. | Creation SQL and Builder E2E in #97; drafts are separate from reusable templates and publications. |
| Draft editing/assignment | `event-builder-board.tsx`, `assignment-actions.ts:39/74/122` | `assign_event_slot`, move and clear RPCs; same-Guild active-character checks, Slot/Event locks and `events.manage`. Touch/keyboard Picker/Change/Clear coexist with drag. | Assignment/move SQL and critical/mobile/tablet E2E passed. Builder completeness is defective above the API cap: A02. |
| Validation/warnings | `event-warnings.ts:8/172/190/215/225` | Duplicate UUID assignments, open required roles, absent/mismatched role, inactive assignments and Party fullness. Warnings are advisory, not an authorization boundary. | Unit and critical Builder tests passed. Missing class information is displayed as unknown but has no dedicated warning code; blueprint calls the broader intelligence list eventual, not all mandatory Phase 6 features. |
| Publication preview | `event-publication-panel.tsx:255/461` | Read-only draft preview with explicit publish/update confirmation. `canPublishEvent` distinguishes `publish.manage` from `events.manage`. | Component and workflow browser coverage. Preview uses loaded draft data; A02 can hide seats/characters. Another organizer can change the draft before confirmation; RPC intentionally snapshots latest database draft, not an immutable client preview. |
| Publish/update | `publication-actions.ts:130/175` | `20261007174500...:386/472`: Event `FOR UPDATE`, server-side `require_publish_manage`, publication lock, complete snapshot insert/count checks, seal and current pointer in one RPC transaction. | Publication SQL, 16 concurrent assertions and E2E passed. Repeated update is intentionally a new version; not an idempotent write. |
| Historical preservation | Publication foundation `:349/406` | Sealed version and child INSERT/UPDATE guards; composite Guild/Event/version relationships; source values copied, not joined from current roster on public reads. | Foundation/RPC/history tests. Trusted destructive Guild/Event cleanup cascades are permitted; immutability is not an absolute defense against trusted administrators. A12 notes account-deletion interaction. |
| Unpublish/archive | `publication-actions.ts:223`; publication RPC `:527` | Current pointer cleared transactionally; history retained. Resolver requires active Guild/Event and a published sealed current version. | SQL and browser tests cover unavailable behavior. Existing delivered lineup cannot be erased from a recipient's memory or screenshot. |
| History/read permissions | `publication-server.ts:167/302`; history dialog | `events.manage` or `publish.manage` RLS; explicit Guild/Event/version selectors, 10-version anchored pages, 500-row complete child batches, exact counts/duplicate checks and visibility recheck. | >1,000 snapshot component fixtures and pagination/access E2E. Current-version marker was flaky in #97: A08. |
| Sharing management | Dedicated Sharing route; Builder additional publishing permission | All five gated Server Actions delegate to authenticated `getUser` session operations. Database checks actual `auth.uid`, active membership/Guild and publishing capability. Publisher-only Officer does not gain Builder management. | SQL/current components; enabled real browser lifecycle historical, skipped in #97: A03. |
| Create/rotate/revoke | `share-link-server.ts:118/157`; manager confirmations | Attested synthetic-proof protocol, private digest/envelope storage, expected link identity, Event locks, fresh authority/table/membership/capability locks in `20261009180213...`; old recovery material scrubbed permanently. | Share SQL and 130 authority-concurrency assertions current. No automatic mutation retry; unknown outcome requires read-only reload. |
| Discord Copy | `share-link-server.ts:80`; manager `:128` | State check, authenticated encrypted payload, scoped AES-GCM recovery/digest comparison and final state/identity recheck. Trusted origin creates `/share/event#token=...`. Clipboard fallback is temporary dialog state. | Crypto tests/current components; enabled clipboard/mobile keyboard E2E historical. No bot or token-bearing preview metadata. |
| Anonymous/Member viewer | `/share/event`, `public-event-viewer.tsx` | Public means possession of the bearer, not membership identity verification. Client-only fragment consumption/removal; memory-only token; same-origin POST; private restricted SQL projection, no direct anon/auth/service RPC. | Mocked browser/current components and historical real driver. A04-A07 block hosted use. |
| IGN/assignment presentation | Viewer `:125/138`; private projection `:103` | Published IGN substring search; every matching Party, including duplicate IGNs, area/team/Party/Slot/role/Class labels; no live roster fallback or organizer controls. | Current components, 42 SQL assertions, mocked mobile/desktop. It is not an account-to-Character claim or uniqueness guarantee. |
| Current version changes | Viewer `:69/113/122`; projection `:125` | Version input is a consistency guard, never historical selector; mismatch clears old lineup and requires explicit latest load. Check-for-updates is manual, not push subscription. | Components/current SQL; historical real transition/race tests. An already displayed version is not instantly purged when an organizer revokes it. |
| Errors/repeated requests | Manager request tickets/write lock; viewer AbortController/tickets | Out-of-order responses ignored; pagehide/persisted pageshow clear token/lineup; failed DB backend destroyed; confirmed write/read failure distinct from unknown mutation. POST writes are not automatically retried by the installed PostgREST retry helper (idempotent methods only). | Current mocked cancellation/Strict Mode coverage. Timeout cancel rejection is missing: A01; actual unmount microtask case remains unverified in the lifecycle notes below. |

The snapshot SQL copies IGN/Class/role/designation/status at publication. The public DTO deliberately omits private description/notes, account/member/Guild/Character UUIDs, draft assignments, recovery material and unrelated records. Composite keys plus token-selected current version prevent cross-Guild selectors. No verified cross-Guild bypass was found.

## Security boundaries

### Application and database authorization

Owner/Admin have organizer rights; Officers require explicit relevant capabilities; Members do not gain management via UI visibility or authenticated status. Server session validation and PostgreSQL authorization are independent of client buttons. Read RLS grants `authenticated` managers scoped access, not anonymous publication-table access. Private share storage and signing keys have no direct application grants.

The additive resolver migration `20261010002444_event_share_link_resolver_access_boundary.sql:3/24` rejects role collisions and revokes PUBLIC/anon/authenticated/service_role execution. It creates `go_event_share_resolver` as NOLOGIN/NOINHERIT without elevated attributes; no request role membership is introduced. New lineup functions live in `go_event_share_private`, excluded by `supabase/config.toml:13` exposed schemas, with owner `postgres`, fixed empty search path, schema-qualified operations and resolver-only execution. The private privacy function returns booleans, not arbitrary setting data.

Older publishing definers use fixed `pg_catalog, public` search paths and qualified application relations. Source and current SQL tests support the intended authorization contract; this is not proof about every PUBLIC/extension/default grant in an independently provisioned hosted cluster. Runtime reader checks reject table/column privileges, schema creation, inherited elevated roles and unexpected memberships. Actual target catalog/default-privilege review remains required.

The permanent migration does not provision the LOGIN reader or a password. Deployment must separately verify PostgreSQL 17 membership `SET`/`INHERIT`/`ADMIN` options, narrow schema/function grants, role connection limits and exact identity. Do not grant `pg_read_all_settings` to authenticator or the reader. Disposable helper/settings authority is not a production application-role grant.

### Token cryptography and lifetime

`share-link-crypto.ts:33` generates 32 random bytes, AES-256-GCM uses a fresh 12-byte nonce and scope-bound associated data, and recovery checks the SHA-256 digest using `timingSafeEqual`. Key material lives in private server fields and private signing-key rows; errors are fixed, never envelope/token dumps. Create/rotate proofs bind 14 fields including actual actor, operation, previous/new identity, digest and envelope with HMAC-SHA256 and bounded expiry. Current cryptography/SQL integration passed.

The **proof** expires after roughly 120 seconds with bounded clock tolerance. The **bearer link** has no automatic TTL: it remains usable until revoke/rotate/unpublish/archive/inactive Guild prevents resolution. This is an intentional long-lived sharing contract, not a short-lived login token. PostgreSQL indexed digest equality is not claimed constant-time; the high-entropy canonical bearer and admission limits protect guessing. No low-entropy secret comparison vulnerability was established. Link recipients can forward it, and revocation does not recover plaintext already delivered. These residual properties must be communicated before real-user distribution.

### Browser and HTTP boundary

No server consumes a fragment token or renders it in HTML/metadata. Viewer code strips query/fragment immediately on effect consumption, validates canonical token shape, uses same-origin JSON POST with omitted cookies, `no-store` and `no-referrer`, never persistent storage/analytics. DTO parsing is strict. Query strings and unsupported methods are rejected; responses have bounded size and generic failure states. The real production-build shell's no-store header passed in CI; Next dev's different generic-shell cache header is not substituted for that result.

Configuration is private/server-only. The dedicated fixed reader uses parameterized SQL, verified TLS configuration, at most two connections, two-second acquisition/statement deadlines, three-second query/idle-transaction limits and no unlimited request waiter queue. Every checked-out backend runs a read-only transaction, explicitly switches to resolver, and verifies actual session identity, role options, effective privacy and TLS/owned-local identity **before** sending the token. Failed/cancelled backends are destroyed rather than returned healthy. No Supabase service-role fallback exists.

Distributed admission uses atomic Redis EVAL, global and per-canonical-IP expiring counters, independent HMAC keys and a trusted-edge secret. Missing/unknown Redis response, timeout, absent/forged edge headers or missing configuration fails closed. The edge must strip incoming copies and inject verified client IP and key; accepting arbitrary forwarding headers is not an implementation option. Scripted Redis tests do not prove actual multi-instance admission.

Production log privacy is not guaranteed by suppressing application `console` or ordinary PG statement logging alone. The runtime privacy helper excludes audit/auto-explain hooks, checks effective preload/core/parameter/statistics/log-destination controls, and fails closed. Trusted proxy, server/APM/error collection, Redis gateway and PostgreSQL operator/log sinks remain external responsibilities. Hosted default libraries may reject all resolution safely until a reviewed compatible configuration exists.

### Infrastructure and diagnostics

PostgreSQL immutable reference remains `public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9`. Read-only `localTarget()` verification passed on Linux/amd64; this local image ID happens to equal that digest. `:156` requires exact RepoDigest plus formatted configuration image ID and platform, rather than assuming registry/config digests always match. The actual verified ID is recorded and compared to the container. Target is reverified on execution and cleanup.

PostgREST 16.3 local image/source/binary provenance verification also passed by read-only inspection. That is not execution of its HTTP suite.

`isolated-postgres-test-cluster.mjs:79/113/265/348` verifies durable manifest shape, repository/daemon identity, full container ID/creation identity, immutable image reference/actual ID, labels, no Supabase ownership labels, no host ports/binds/shared network, resource limits and exact tmpfs. Manifest changes, changed daemon/image or unrelated containers fail closed. Recovery requires an inactive exact run and intact evidence; no broad cleanup selector authorizes removal. Registered HTTP dependent removal/absence precedes parent removal. These controls assume trusted filesystem/daemon administrators; they are not a defense against an attacker who already controls Docker itself.

HTTP privacy startup preserves the reviewed nine-library Supabase allowlist while excluding pgaudit/auto_explain. Effective checks cover administrative, fresh authenticator, notification and request-role/pool sessions; bounded complete Docker log collection requires sink/sentinel evidence and scans for synthetic secret representations. The standalone SQL CI profile is not this HTTP privacy profile and carries no token-bearing public HTTP traffic. Do not equate its pass with Gate B.

Startup diagnostics `:34-48` choose nine fixed stages and only narrowly allowlisted SQLSTATEs from existing classifiers. Unknown stages/raw exceptions do not supply arbitrary labels or messages. CI #97 proves startup progressed through bootstrap, SCRAM and database identity to the SQL suite; it does not retrospectively establish the cause of #96's failure. Current mocked tests cover sensitive error suppression and unchanged exact cleanup guards.

## Findings

### P6-A01 — P1: timeout cancellation produces an unhandled rejection

- Workflow/source: public request parsing, `src/features/events/public-bounded-json.ts:9`; handler `public-event-handler.ts:30`; related test `public-event.test.ts:47`.
- Evidence: timeout invokes `void reader.cancel()` without a rejection handler, while `finally` correctly catches its separate cancel. The in-memory current-source probe with a stalled stream/rejecting underlying cancellation returned sanitized status 400 **and emitted one unhandledRejection**. Raw error was intercepted and never printed; no network/database was involved.
- Preconditions/impact: deadline expiry plus a rejecting cancellation source. This is a demonstrated promise-handling defect, not a proven remotely exploitable Next transport crash. Depending on runtime handling it can bypass sanitized error handling, expose a raw exception to diagnostics or terminate a Node process; [Node's default behavior](https://nodejs.org/docs/latest-v24.x/api/process.html#event-uncaughtexception) supports that consequence.
- Existing protection: bounded body/time and safe response catch; it does not catch a detached rejected promise.
- Minimal remedy: consume the timeout cancel rejection without awaiting it or extending the deadline; retain fixed errors and bounded finalization.
- Required test: rejecting as well as never-settling cancellation; assert deadline, safe status, zero unhandled rejection/console output, released lock and no secret-bearing diagnostics.
- Blocks: Phase 6 closure, then Phase 7 handoff, hosted sharing. No implementation applied.

### P6-A02 — P1: capped Builder data is treated as a complete publish preview

- Workflow/source: `src/features/events/builder-server.ts:113-143/166-195`, `server.ts:113` (related aggregate reads), `supabase/config.toml:18`, publication snapshot SQL `20261007174500_event_publication_rpcs.sql:225-245/330-340`.
- Evidence: REST structure queries and the roster RPC have no complete paging/exact-count check; configured maximum is 1,000 rows. A source probe simulated 126 valid eight-seat Parties: **1,008 source seats, 1,000 rendered seats, status ready, canPublish true**. Database publication copies/counts all source seats without that cap. This is a mocked cap reproduction, not a new live PG test.
- Preconditions/impact: a valid draft or Guild roster exceeds a per-request row limit (or target uses a lower cap). Preview, warnings, eligible picker and counts can omit seats/characters while publishing a larger complete lineup. The public viewer cannot repair a misleading organizer preview. No cross-Guild disclosure or lost immutable records was demonstrated.
- Existing protection: sealed-history loading already uses complete 500-row batches and fails closed on missing rows; publication SQL completeness is strong.
- Minimal remedy: extend complete-read/fail-closed semantics to the draft structure and roster read, with deterministic paging and consistency/recheck boundaries; alternatively an explicit validated supported-size limit, not silent truncation. Do not merely raise the API cap or weaken snapshot assertions.
- Required test: >1,000 seats/eligible characters, cap below expected batch size, partial/missing batch, concurrent assignment change, exact preview/published identity/count correspondence. Cover manager aggregate counts as appropriate.
- Blocks: Phase 6 closure, Phase 7 handoff and large-lineup hosted correctness.

### P6-A03 — P1: retained runtime gates lack current-revision execution evidence

- Source: `.github/workflows/ci.yml:61/129`, `docs/QUALITY_GATES.md:118-122`, `e2e/event-share-link.spec.ts:25/54/127/188`, separate HTTP/driver/lifecycle scripts.
- Evidence: #97 ran SQL/crypto but not the 279+12 PostgREST, 148 driver, nine projection-race or real 27/22 lifecycle gates. Seven enabled-sharing browser cases skipped. Latest live evidence is historical Work A/B, preceding infrastructure fixes, although application behavior was independently reviewed.
- Preconditions/impact: declaring all permanent/runtime gates passed based solely on the green job would conceal integration regressions. This is missing evidence, not evidence those gates currently fail.
- Existing protection: substantial historical real runs plus 826 current unit tests and verified image provenance.
- Minimal remedy: run the retained relevant commands at the reviewed correction/release SHA in verified disposable infrastructure and record exact totals/cleanup; establish enabled synthetic-key browser coverage on an owned ephemeral target, not this development database. Decide explicitly which gates must continuously run in CI versus approved release verification. No assertion deletion or duplicated full SQL replay is necessary.
- Required verification: actual 42501/401/403, negative JWT/role controls, cold/cache reload, both pools, real driver failure/cancel/log privacy, lifecycle ownership recovery and enabled copy/rotate/revoke browser flow; no token traces.
- Blocks: unconditional Phase 6 closure/Phase 7 handoff and hosted release. Not rerun during this audit.

### P6-A04 — P1: hosted resolver/transport/admission infrastructure is not verified

- Source: `share-link-feature.ts:4`, `public-event-config.ts:29-64`, `public-event-admission.ts:17-41`, `public-event-resolver.ts:38-83`, private migration `20261011181553...:23-55`.
- Evidence: only `APP_ENV=local` permits the feature. No hosted reader/proxy/Redis secrets or real hosted TLS/provider verification was supplied. Prior live integration used verified isolated non-TLS loopback and scripted Redis responses.
- Preconditions/impact: attempting hosted activation before least-privilege membership/default-grant review, certificate verification and authenticated trusted IP admission risks bypassed throttling/privacy or unavailable service. No actual hosted exploit was tested or established.
- Existing protection: configuration/runtime fail-closed behavior; no service-role fallback, parameterized query, max-two pool, mandatory privacy/identity checks.
- Minimal remedy: independently approve/provision dedicated reader with narrow PostgreSQL 17 SET authority, trusted verified TLS target, separate secret keys and atomic Redis service; validate edge header stripping, origin and multi-instance limits. Approve a hosted gate evolution only after evidence; never disguise hosted mode as local.
- Required test: valid and invalid certificates/hostname/CA; positive hosted connection under exact identity; wrong role/options/grants rejected before token query; real two-instance global/per-address admission, spoofed headers, canonical IPv6, Redis timeout/outage/malformed response, pool and connection limits.
- Blocks: hosted sharing only; compatible with closed-gate local implementation after A01-A03 are resolved.

### P6-A05 — P1: end-to-end hosted log/privacy acceptance is absent

- Source: `public-event-resolver.ts:13-36`, private privacy function `20261011181553...:23-55`, `next.config.ts:5-10`, `scripts/http-postgres-privacy.mjs:61-80`.
- Evidence: effective backend checks and historical local complete synthetic-secret log scans exist. No inventory/complete collection of hosted gateway/APM/error/PG/Redis sinks, bootstrap/operator connections or notification/pool sessions was provided. Ordinary disabled statement logging does not prove pgAudit/auto_explain inactivity.
- Preconditions/impact: a provider that records bodies/parameters/exceptions can persist long-lived bearer links, keys or credentials even if application code avoids logging them. This is an unverified external trust boundary, not demonstrated leakage.
- Existing protection: privacy predicate fails closed before bearer SQL; local tests exclude audit/auto-explain hooks and bound complete log evidence.
- Minimal remedy: approve a compatible hosted PostgreSQL privacy profile and sink-by-sink body/parameter/redaction policy; retain the audit/auto-explain prohibition unless independently reviewed equivalent controls are explicitly approved. Include administrative provisioning and failure paths.
- Required test: synthetic credentials/JWTs/bearers in success, timeout, parsing, permission and startup errors across all sinks; complete bounded evidence including sentinels, not a truncated sample or an absent log asserted clean.
- Blocks: hosted sharing. Known external architecture choice, not permission to relax a guard.

### P6-A06 — P1: hosted browser/release security policy remains incomplete

- Source: `next.config.ts:12-23`; `docs/ARCHITECTURE.md:287-306`.
- Evidence: share routes provide no-store/referrer/noindex/nosniff/frame/Permissions Policy; no source CSP or HSTS configuration was found. No final hosted gateway headers, CSP evaluation, secret scan, production Security Advisor, session/invite abuse acceptance, monitoring/backup recovery evidence was supplied.
- Preconditions/impact: real-user deployment without the stated release gate leaves browser containment, secure transport persistence and operational recovery unverified. Absence of CSP is not itself a demonstrated XSS flaw.
- Existing protection: React escaping, restricted strict DTO, verified DB TLS configuration, local-only gates and actual production-build shell header tests.
- Minimal remedy: establish tested framework-compatible CSP/HSTS at the correct serving layer, including API errors/redirects; verify header policies across protected and public routes. Complete security/scanning/session/backup/monitoring checklist with trusted operators. No unsafe inline-policy workaround is prescribed here.
- Required test: final HTTPS responses, redirects, CSP violations/nonce compatibility, no private caching, proxy referrer and browser history behavior, secret scan and session/invite replay/abuse tests, backup restoration drill on a separate target.
- Blocks: hosted preview/public release. These are appropriate Phase 7 readiness tasks, not evidence that existing local source is compromised.

### P6-A07 — P1 for hosted release: dependency advisories need reachability and disposition

- Source: `pnpm-lock.yaml:1465/2905/3114`; `.github/workflows/ci.yml` has no explicit dependency/secret scan step.
- Evidence: this audit's `pnpm audit --json` exited 1: high `braces@3.0.3` through eslint tooling ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)), high `source-map-js@1.2.1` through build/test/Next dependencies ([GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)), moderate `uuid@8.3.2` through exceljs-hardened ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). Registry metadata and official advisory pages were checked. No critical advisory was reported.
- Preconditions/impact: vulnerable parsing APIs require attacker-influenced inputs. Public sharing DTO/query paths were not shown to call these APIs. The observed ExcelJS UUID call uses v4, whereas that advisory concerns v3/v5/v6 output buffers; no reachable exploit is established. Build/tooling reachability also needs separate analysis. Do not equate advisory severity with a proven public endpoint vulnerability.
- Existing protection: frozen lockfile, exact pg pin and `pnpm-workspace.yaml` denied build scripts; no dependency changes performed.
- Minimal remedy: approved reachability/upgrade or constrained documented risk disposition, preserving dependency policies; source-map-js has a published fixed range, braces advisory presently lists no patch. Do not install unapproved dependencies or suppress advisories silently.
- Required test: rerun advisory inventory after approved changes, exercise affected import/build paths, record exposure/mitigation and scanning policy. Secret scanning is a separate unverified gate, not a claim of committed secrets.
- Blocks: hosted security sign-off; Phase 6 handoff needs an explicit tracked disposition, not necessarily a speculative major dependency upgrade.

### P6-A08 — P2: current publication-history browser check is flaky

- Source/evidence: `e2e/event-publication-history.spec.ts:149-154`, history component `event-publication-history.tsx:271`; #97's first attempt could not find v3's Current member version indicator after reload, retry passed.
- Impact/precondition: republish/reload/history transition can fail its UI assertion; underlying product versus timing/fixture cause is unknown. No history loss was established.
- Protection/remedy: immutable SQL and complete history loading remain tested; reproduce with bounded safe browser fixtures, determine status/data versus test synchronization, correct the demonstrated cause without replacing assertions with long sleeps.
- Test/decision: repeated deterministic republish/reload and current/historical indicator tests; follow up before release confidence claims. P2 does not independently block Phase 7 once local P1 conditions are cleared.

### P6-A09 — P2: WCAG, real-device and performance acceptance is incomplete

- Source: `PROJECT_BLUEPRINT.md:165-172`, `QUALITY_GATES.md:20-37`, `public-event-viewer.tsx:125-155`, `builder-server.ts:113`, `publication-pagination.ts:13`.
- Evidence: desktop/mobile Chromium, Builder tablet viewport, labels/focus, keyboard, overflow assertion and reduced-motion tests exist. No native iOS/Android, other engines, screen reader, complete WCAG 2.2 AA contrast/focus/zoom/reflow or measured public query/render budgets were supplied. Snapshot complete reads accumulate all rows; search counts/sorts a whole snapshot before paging. Timeouts bound duration, not measured capacity.
- Impact/preconditions: large Guilds, long unbroken labels, zoom/mobile keyboards and assistive technology may reveal usability/latency issues. `viewer.tsx:145` Slot/role spans lack the break-word treatment used by surrounding labels; overflow is a targeted unverified case, not a measured failure.
- Protection/remedy: 12 cards/page, eight seats/Party, 5,000-card cap, max payloads/timeouts, accessible native controls and reduced-motion CSS. Perform representative realistic-data EXPLAIN/load/render measurements and manual accessibility/device review; minimally fix verified failures, not redesign.
- Required verification: low-end mobile/touch, tablet, keyboard/focus/modal Escape, screen reader, 200-400% zoom, long multibyte labels, duplicate IGN pagination, exact cap and over-cap, pool/Redis outage load and retention growth. Define budgets before claiming they pass.
- Blocks: full hosted UX/performance sign-off, unless independently accepted bounded deferrals; can be explicit Phase 7 work after source P1 fixes. Native-device simulation is not real-device evidence.

### P6-A10 — P2: current-state documentation contradicts completed checkpoints

- Evidence/source: `ARCHITECTURE.md:174/275/314-318` still says public page/adapter absent and PostgREST pin null/runtime blocked; earlier sections describe superseded anon grants. `QUALITY_GATES.md:120` still points to the known image mismatch. `SHARE_LINK_SERVER_CONFIGURATION.md:1` and its future-route paragraphs are historical while later paragraphs describe Work B. Work B validation lines 63-65/236 record failed old CI; that was accurate at its checkpoint, not #97. `ROADMAP.md:111-116` Phase 6 is not closed yet.
- Impact: operators/reviewers may misunderstand the present grant boundary or release state. Current source correctly denies direct access, so outdated prose is not a runtime bypass.
- Remedy/test: update current architecture/configuration/gate summaries to exact source/CI state and link historical reports as dated evidence; preserve historical results rather than rewrite them as current success. Review doc/source/command consistency and explicit hosted restrictions.
- Decision: needed for a truthful closure/handoff package; no existing tracked document was changed by this audit.

### P6-A11 — P2: historical network change remains unexplained

- Evidence: approved historical observation for `supabase_network_guild-organizer` remains **Classification C**. Both read-only current inventory comparisons match the preserved baseline; no disposable endpoint/resource exists.
- Impact/precondition: no present ownership/configuration failure was detected. Historic matching-again hashes do not explain the past event or prove it harmless; no Vector attribution is justified.
- Protection/remedy/test: retain this observation and exact-resource checks. Further investigation only with preserved comparable evidence and separate authorization, not reconstruction or lifecycle experiments. Validate current identities before future infrastructure work.
- Decision: does not independently block current source review when current preservation passes; never dismiss it or use broad cleanup.

### P6-A12 — P2: publisher account-deletion semantics need explicit disposition

- Source/evidence: publication foundation `20261007160000...:68` references `profiles` with ON DELETE SET NULL; the sealed version guard `:364-366` rejects any UPDATE once sealed, including that referential actor change. Existing fixture lifecycle deliberately deletes Guild dependents before Auth users (`ARCHITECTURE.md:310`).
- Preconditions/impact: deleting a publisher profile while retaining its Guild/version would conflict with the guard. This is a source-level referential/trigger conflict; no deletion was executed here. It does not mean normal unpublish/leave-Guild loses history, and this audit does not assume a currently exposed account-deletion feature.
- Protection/remedy/test: history is preserved and fixtures use the safe approved order. Decide retained-history/account-retirement behavior explicitly. Reproduce only in an owned disposable transaction before proposing a narrow actor-retirement rule or retaining tombstones; do not weaken content immutability or delete historical snapshots.
- Decision: Phase 7/operator account-retirement follow-up and prerequisite before offering such deletion; not a blocker to the current bearer resolver itself.

### P6-A13 — P2: distinguish assignment editing from Event metadata/archive controls

- Source/evidence: `src/features/events/actions.ts:43` exposes Event creation; `assignment-actions.ts:39/74/122` exposes assignment editing. `event-management-view.tsx:204/298` filters status and opens Builder, but no organizer rename/description-edit/archive mutation control was found. Archived-Event resolver tests change status through privileged test fixtures.
- Impact/precondition: an organizer expecting to rename or archive an existing Event cannot infer that capability from a filter or SQL denial test. Assignment editing is implemented; an application archive workflow was not demonstrated.
- Existing protection: status restrictions are enforced by SQL, draft assignment editing and publication update work, and historical metadata snapshots remain immutable.
- Minimal remedy/test: clarify the approved checkpoint's product scope in current documentation. If metadata/archive controls are required, schedule a separately reviewed narrow workflow with capability, historical-preservation and bearer-unavailability tests; do not add features during this audit or count a fixture UPDATE as UI coverage.
- Decision: product-scope follow-up, not automatically a Phase 6 blocker because no explicit mandatory metadata/archive UI acceptance criterion was found in the reviewed Phase 6 contracts. Independent product review should resolve this distinction before calling the entire Event lifecycle complete.

## Additional bounded uncertainties, not established vulnerabilities

- Viewer cleanup `public-event-viewer.tsx:85/95` invalidates/aborts requests but deliberately preserves the in-memory ref for Strict Mode replay. The immediate real-unmount-before-queued-load case has no explicit regression. Existing pagehide/BFCache/superseding tests pass. Add a focused lifecycle check before claiming every unmount timing is proven; no extra browser reproduction was executed here.
- Publication authority is checked after Event locking; share-link mutation authority has additional fresh NOWAIT locks and explicit concurrent revocation tests. The 130-assertion share authority result should not be represented as covering every publication/draft membership-revocation interleaving. No publication authorization bypass was established.
- Private projection transaction snapshots intentionally permit a read that began before a committed revocation to finish with that snapshot. New reads fail; already delivered data cannot be retracted. This must not be marketed as instant remote data erasure.
- Sealed snapshots retain historical rows without automatic pruning. Publication version numbers are integer, and update creates another version even for identical content. Finite capacity/retention and organizer write-admission should be measured in Phase 7; no observed exhaustion or accidental retry was found.
- Exact 5,000-card/eight-slot caps and response byte limits are implemented, but existing SQL pagination fixtures exercise 15 cards, not a measured maximum-scale load. Over-limit responses fail unavailable rather than disclose partial data. Explicit product limits and near-cap tests remain necessary.
- Discord metadata is generic and token-free; no live Discord preview/client-platform test was performed. Fragment removal from the loaded page cannot guarantee a chat app/browser/OS has never retained the originally clicked URL.
- No source evidence of an unintended Master Roster or private notes projection was found. This is not an assurance that unrelated application dependencies, every ambient extension function or all future hosted operational policies have been exhaustively verified.

## Preservation and audit scope

The original Work B preserved inventory was compared without overwrite using the existing read-only snapshot script. Container, network, volume and image fingerprint arrays matched exactly: **12 / 4 / 3 / 15**. The database container retained full ID `6cfbbecb879f21ea1f615a37bcc1031988d9e48761a5b65f6837c0e724598b05`. Inventory contains only the expected development Supabase containers, with no disposable PostgreSQL/PostgREST/driver resources. Existing exited/restarting container states were not modified or interpreted as this audit causing a fault. No secret inspector fields were emitted.

No development database query, migration/reset, credential read, Docker lifecycle/network/volume operation, image pull/build, test fixture mutation or cleanup was performed. Hosted feature gates and all source bytes remained unchanged. Historical network discrepancy stays Classification C, unresolved. HEAD and remote remain the baseline. Final expected Git changes are only the three new untracked reports; index remains empty.

The final repeat preservation comparison also matched all four inventory categories. Tracked `git diff --check` returned 0, with no tracked diff or staged content. CRLF-aware `git diff --no-index --check -- NUL <report>` found no whitespace errors in each new report; each returned 1 for the new-file difference and emitted only Git's ordinary LF-to-CRLF working-copy warning. That is not reported as exit-0 staged validation. No line-ending configuration was changed.

## Review handoff

Resolve A01/A02 through a small independently reviewed correction; validate its focused regressions, then reconcile A03 at the reviewed revision with verified owned resources. Disposition A07 and update current-state documentation without erasing history. Review the Phase 7 handoff separately from the hosted security checklist. A04-A06/A09 require real operator/provider/browser evidence before any hosted enablement. No public activation, remediation or Phase 7 work is authorized by this audit.

Companion reports: [requirements traceability](PHASE_6_REQUIREMENTS_TRACEABILITY.md) and [prioritized release blockers](PHASE_6_RELEASE_BLOCKERS.md).
