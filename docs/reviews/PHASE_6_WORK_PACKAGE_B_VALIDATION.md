# Phase 6 Work Package B — public Event viewer

Baseline: `feature/phase-6-publishing-sharing`, HEAD `4d9e0cd0613b07952e3daf4ee75f5129435aaa7a`. The index and working tree were empty before this assignment. No source was staged, committed, pushed or deployed. No development database operation or development Docker mutation is authorized or performed.

## Implementation state

The public viewer, private current-snapshot projection, strict public DTO, same-origin bounded handler, distributed admission integration boundary, dedicated `pg` adapter and `POST /api/share/event` route are implemented. The actual driver/route passed owned live integration checks described below. **Hosted access remains disabled; this source package is for independent review, not an enablement approval.**

Following independent approval of the 23-file draft, exactly these two dependency operations were executed successfully:

```text
pnpm add --save-exact pg@8.23.1
pnpm add --save-dev --save-exact @types/pg@8.23.1
```

Registry metadata identifies `pg` with the official `brianc/node-postgres` repository, and the types with DefinitelyTyped. Retrieved tarball integrity values:

- `pg@8.23.1`: `sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==`
- `@types/pg@8.23.1`: `sha512-fKVHpikPdg4GKks3JuLEhvwSyvwzF23hnabPy6DD8ljVbC7+6J5dQzdv4arV6jqq57djnMgs1HKBxX4P8aBI3A==`

`package.json` pins both versions exactly. `pnpm-lock.yaml` adds 15 package entries, with no upgrade, deletion or content change to any of the 647 existing package entries or their snapshots. The package-manager document and `pnpm-workspace.yaml` supply-chain policy are unchanged. All new registry integrity values match the lockfile; both direct tarballs were independently hashed before installation. All new packages have MIT/ISC licenses and no install/prepare lifecycle scripts. No `pg-native` package was installed. No other direct dependency was added.

New closure: `pg@8.23.1`, `@types/pg@8.23.1`, `pg-cloudflare@1.4.1`, `pg-connection-string@2.14.1`, `pg-int8@1.0.1`, `pg-pool@3.14.0`, `pg-protocol@1.16.1`, `pg-types@2.2.0`, `pgpass@1.0.5`, `postgres-array@2.0.0`, `postgres-bytea@1.0.1`, `postgres-date@1.0.7`, `postgres-interval@1.2.0`, `split2@4.2.0`, `xtend@4.0.2`.

Before/after `pnpm audit --json` reports the same three pre-existing advisories and no new advisory: uuid (moderate, GHSA-w5hq-g745-h8pq), braces (high, GHSA-vfj7-8cjw-p6xm), source-map-js (high, GHSA-68fv-2mgg-jv7q). They remain outside this dependency correction; this is not a clean-audit claim. The existing Vitest/@types/node peer mismatch remains unchanged. No install security setting was relaxed.

The adapter constructs a bounded lazy `pg.Pool`, consumes idle and checked-out socket errors without raw diagnostics, and destroys failed or cancelled backends. Every bearer query follows actual identity, privilege, effective privacy and ownership/TLS checks. The route runs only in Node, caches operator configuration for the process lifetime and creates no pool until a validated admitted POST reaches the database stage. Failed admission or configuration never falls back to Supabase/service-role resolution. Explicit adapter shutdown is idempotent; production idle/lifetime limits retire backends. An abort during acquisition remains bounded by the two-second connection deadline, and an acquired aborted backend is destroyed before any bearer query.

## Public data and authorization

`20261011181553_public_event_lineup_projection.sql` adds a private schema excluded from the existing PostgREST schema list. It changes neither the original metadata resolver nor its grants. Installation refuses elevated resolver attributes, outgoing resolver memberships, or request-role resolver membership. No LOGIN, password or application-role membership is installed by the migration.

`resolve_lineup(text, integer, integer, text)` is a fixed, qualified, read-only SECURITY DEFINER projection with an empty search path, owned by the existing trusted migration owner `postgres`. Elevated ownership is needed to read protected sealed snapshots and the private digest table, never to give callers generic table access. Only `go_event_share_resolver` receives schema USAGE and function EXECUTE. PUBLIC and all three request roles receive neither. All SQL is static. Inputs cannot name a database, Guild, Event, snapshot, table, field or function.

The digest lookup enforces the same canonical token and active/revoked, active Guild/Event, current published pointer and sealed-version conditions as the reviewed metadata resolver. The response contains only published Event/type names, publication number/time, area/team/Party labels, slot/role labels, and sealed IGN/class/character-role values. It includes no UUIDs, source IDs, accounts, notes, descriptions, designation/status fields, draft assignments, live roster data or recovery material.

Each response is one MVCC statement. A requested version guards pagination; it never selects historical snapshots. A committed update before the next query yields `updated`; a committed revocation before the query yields unavailable. A query already begun before a commit can return its complete prior authorized snapshot; revocation cannot retract bytes already read. Responses never combine publications.

Limits: 12 cards per page, 8 slots per Party (the current Party layout RPC maximum), 5,000 cards, pages 0–416, 80-character literal IGN search, a 1,024-byte request, and a 262,144-byte response. Unusual larger legacy Parties fail closed rather than silently truncate. Empty Teams/Areas/Parties are explicit display cards. Duplicate IGN matches show every matching Party.

`connection_private()` is an argument-free boolean-only SECURITY DEFINER check. It is callable only through the same restricted private schema, requires the actual dedicated reader session and resolver role, and inspects effective preload, core logging, statement tracking and log-destination state. Missing inspection authority or unknown settings return false. It grants no arbitrary settings reading. It accepts only an empty shared list or the already reviewed nine-library isolated HTTP profile; audit/auto-explain hooks, session/local preloads and unknown log sinks fail closed. This is evidence about the current backend, not proof of an entire hosted log pipeline.

## Member workflow and browser privacy

The generic `/share/event` shell has generic Discord metadata and no Event data or bearer in server HTML. Only a client effect reads `#token=…`; it immediately replaces the URL to discard fragment/query content, validates exact canonical encoding and retains a valid token only in a memory ref. Hash changes support opening another link in the same viewer. Pagehide and restored back-forward pages discard the token, search and lineup. No persistent storage, analytics, organizer controls or account round trip is used.

The intended transport is a protected same-origin POST body, credentials omitted, no-store and no-referrer. Search is explicit, not a request on every keypress. Cards show publication version/time, team/area/Party, published assignment labels and highlighted matching IGNs. Search results receive keyboard focus. Empty, loading, invalid, unavailable, updated, connection-failure and rate-limit states use safe generic wording. Rotation and revocation remain explicit authorized organizer actions; Copy still produces the fragment URL.

The page and handler have no-store, noindex/noarchive, no-referrer, nosniff and frame-denial protections. Production-build browser tests verify actual page headers. Next development overrides page cache headers to `no-cache, must-revalidate`; that generic shell contains no private data. Next development request logging excludes these paths, Server Function argument logging is disabled, and browser console forwarding is disabled. Hosted proxy/APM/body/error-log redaction remains an operator prerequisite.

## Admission and operator prerequisites

Production and staging stay disabled even if all flags are supplied. Local use additionally requires both existing share-management and new public-viewer flags. No operator configuration or secret is invented or silently installed.

The admission adapter requires an HTTPS Redis REST endpoint implementing atomic EVAL, a server-only credential, independent 32-byte HMAC and proxy keys, and a trusted edge that strips incoming `x-go-proxy-key`/`x-go-client-ip` and injects its own verified values. Arbitrary forwarded headers are not trusted. Atomic global/per-address limits are shared across instances: 1,000/minute globally and 60/minute per canonical address. Keys contain HMACs, never bearer tokens or plaintext addresses. Both keys use one Redis hash tag. Counters expire after 60 seconds; once the global limit is exceeded no new address key is created. Missing infrastructure, malformed results, service errors and deadlines deny admission. The external service has not been provisioned or exercised; there is no process-local production fallback.

Operator-only database provisioning must create `go_event_share_reader` with LOGIN, NOINHERIT, no elevated attributes and CONNECTION LIMIT between 2 and 16, a fresh high-entropy secret, and only the `go_event_share_resolver` membership with SET true, INHERIT false, ADMIN false. Do not grant it settings-reading or application-request roles. Configure genuinely empty login preloads without changing shared libraries blindly; preserve the reviewed logging protections for bootstrap, administrative and every runtime session. Review private-schema exposure, role authority, complete PostgreSQL/host/edge/APM logs and retention before any hosted enablement.

Server-only configuration names: `APP_ENV`, `APP_ORIGIN`, `SHARE_LINK_INTERFACE_ENABLED`, `PUBLIC_EVENT_VIEWER_ENABLED`, `PUBLIC_EVENT_DB_HOST`, `PUBLIC_EVENT_DB_PORT`, `PUBLIC_EVENT_DB_NAME`, `PUBLIC_EVENT_DB_PASSWORD`, optional `PUBLIC_EVENT_DB_CA`, `PUBLIC_EVENT_ADMISSION_URL`, `PUBLIC_EVENT_ADMISSION_CREDENTIAL`, `PUBLIC_EVENT_PROXY_KEY`, `PUBLIC_EVENT_ADMISSION_KEY`. Keys are canonical 32-byte base64. Database user is fixed, not configurable. No connection URL or service-role secret is accepted. Verified TLS and pool sizing follow the [official node-postgres documentation](https://node-postgres.com/features/ssl) and [pool API](https://node-postgres.com/apis/pool); hostname checking explicitly binds to the configured host using [Node TLS](https://nodejs.org/docs/latest-v24.x/api/tls.html#tlscheckserveridentityhostname-cert). The atomic admission command follows [Redis EVAL](https://redis.io/docs/latest/commands/eval/), with no bearer argument.

TLS verifies the server certificate and hostname, with TLS 1.2 minimum. A non-TLS exception exists only for an explicitly identified `go_share_test_<32hex>` database at loopback, verified by its exact disposable ownership marker, under the owned isolated coordinator. Never use that exception for development or hosted databases. Startup GUC overrides are rejected. Pool settings are two connections, two-second acquisition/statement limits, three-second query/idle-transaction limits, ten-second idle retirement and sixty-second maximum lifetime. More than two active requests per process are refused without a waiter queue; the database role connection limit bounds aggregate backends. Every actual backend must pass identity, membership, effective privacy, protected-table privilege and schema-creation checks before any bearer query. Failed backends must be destroyed.

## CI baseline limitation

[CI run 38161900345](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38161900345) for `4d9e0cd` is completed: quality PASS (including E2E and cleanup), database FAIL. Migration reset, schema lint and pinned-runner preparation passed. The isolated SQL step failed with the sanitized category `Pinned PostgreSQL image is unavailable or incompatible; no fallback/pull attempted` before SQL assertions. Generated-type verification was skipped; database cleanup passed. This is not a green baseline. No image-provenance guard was weakened or unrelated CI correction attempted here.

## Pre-driver checkpoint evidence

Evidence is stored outside the repository at `C:\Users\Miguel\AppData\Local\Temp\go-work-package-b-a39354d906e14aba826118606648c91b`. No raw secret-bearing diagnostics are included in this source report or review archive.

- Initial inventory: 12 development containers, exact fingerprints matching the previous preservation evidence; Linux Docker engine and both reviewed image identities verified.
- Production build passed at the viewer checkpoint; final build/quality results are recorded below after remaining changes.
- Full unit checkpoint: 732 tests passed; subsequent focused suite: 60 passed (five additional assertions/tests). Final totals are recorded below.
- Full owned SQL checkpoint: 1,442 assertions in 34 files, including all original 1,401 plus 41 new projection assertions; 16 concurrency, 130 authorization-concurrency and 31 cryptographic assertions passed. Later rotation coverage increases the new file to 42, verified in the focused runner.
- Work Package A HTTP regression: all 279 HTTP and 12 internal assertions passed, real 401/403 plus PostgreSQL 42501, cache reload, cold restart, rotation/revocation, both pool backends and privacy checks. Exact owned sidecar and cluster cleanup passed.
- New projection focused checkpoint: 42 SQL assertions passed, including real attested rotation and revocation, current version, cross-Guild isolation, immutable values, literal search, duplicate IGNs, pagination, empty structures, archived/unpublished behavior and actual application-role 42501 denial. Fresh dedicated reader TCP negative/positive SCRAM and the actual static production identity/privacy query passed. This uses psql, not the pending application driver.
- Browser checkpoint: four production-build Chromium tests passed across desktop and iPhone-sized layouts, generic metadata, anonymous/cookie-bearing visitors, no overflow, keyboard search, duplicate assignments, fragment cleanup, no storage, safe unavailable state and reduced motion. API responses are explicitly synthetic fixtures; these are UI tests, not live application/database E2E proof.
- Mobile/desktop screenshots were visually inspected. Primary button text was then adjusted to the design's dark contrast color; final revalidation is recorded below.

Owned failure evidence was retained as safe categories: an initial new SQL fixture attempted `publish_event` on an already-published Event (`55000`); it was corrected to the existing `update_event_publication` workflow. Browser testing found same-page fragment handling missing and exposed the Next development cache-header override. The former was corrected, and actual no-store headers were verified against a production build. Reduced-motion assertions were aligned with the unchanged global 0.01ms CSS rule.

The historical Docker network fingerprint discrepancy remains an unresolved Classification C observation. A later matching fingerprint is not evidence that the historical difference was harmless. It was not reinvestigated.

## Remaining hosted/operator acceptance work

1. Provision and independently validate the external distributed admission service and trusted edge; no real hosted admission evidence currently exists.
2. Review source and migration before operator provisioning or migration application. Do not apply to development automatically.
3. Verify hosted TLS, all host/database/edge/APM log sinks, credential rotation and resolver provisioning before any enablement. Local negative TLS tests are not a hosted certificate/connection validation.
4. Resolve the GitHub pinned-image failure under its own provenance review before claiming a green CI baseline.
5. Preserve the local-only/default-disabled gates until all required public access and hosted privacy prerequisites are approved. No public deployment is authorized.

## Prior draft checkpoint (superseded)

Final source checkpoint on 2026-10-11:

| Check | Fresh result |
| --- | --- |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS: 740 tests in 47 files |
| `pnpm build` | PASS; dynamic generic `/share/event` shell built |
| `pnpm exec playwright test --config playwright.public-event.config.ts` | PASS: 4 desktop/mobile production-build tests; mocked API only |
| Focused owned projection runner | PASS: 42 SQL assertions, 9 republish/revoke race assertions, fresh TCP negative/positive reader controls and actual backend identity/privacy query |
| Complete owned SQL runner checkpoint | PASS: 1,442 assertions across 34 files, 16 concurrency, 130 authorization-concurrency, 31 cryptographic assertions; precedes the additional rotation assertion subsequently verified in the focused 42-assertion run |
| Existing Work Package A HTTP runner | PASS: all 279 HTTP and 12 internal assertions |
| CRLF-aware whitespace checks | PASS; no repository line-ending configuration change |

The final browser screenshots were inspected at desktop and mobile sizes. The assignment button has dark text on the accent background, result focus is visible after keyboard search, duplicate assignments remain distinct, and neither viewport has horizontal overflow. These checks do not constitute a formal accessibility audit or live Member-authentication test.

The last focused owned run was `99203c8e94f6eca922abe3fb3971e336`, exact PostgreSQL container `a993d5e50d9dac6a6973c8cf707472b442586bd22a5afc294b4d4d6d7e5db31d`. Its safe report recorded complete 16,424-byte PostgreSQL log evidence with no sensitive matches and exact owned cleanup. Ownership tombstones and failed-run evidence remain outside the source archive. No fixture or development record was modified.

The final read-only Docker snapshot matches the original Work Package B snapshot exactly: 12 container identities/configuration/state fingerprints, 4 network fingerprints, 3 volume fingerprints, and 15 image inventory entries. No disposable test resource remains. The historical network discrepancy is still unresolved Classification C; it is not reclassified by this comparison. The snapshot evidence resides beside `baseline.json` as `final.json`; the original baseline was not overwritten.

Git remains on `feature/phase-6-publishing-sharing` at `4d9e0cd0613b07952e3daf4ee75f5129435aaa7a` with an empty index. There are exactly 23 intended changed/new paths, listed below. No package/lockfile, existing authorization test, historical fixture, or Work Package A implementation was changed.

```text
 M docs/QUALITY_GATES.md
 M docs/SHARE_LINK_SERVER_CONFIGURATION.md
 M next.config.ts
 M src/features/events/event-share-link-manager.tsx
 M src/proxy.ts
?? docs/reviews/PHASE_6_WORK_PACKAGE_B_DRIVER_PROPOSAL.patch
?? docs/reviews/PHASE_6_WORK_PACKAGE_B_VALIDATION.md
?? e2e/public-event-viewer.spec.ts
?? playwright.public-event.config.ts
?? scripts/test-public-event-lineup.mjs
?? src/app/(public)/share/event/page.tsx
?? src/features/events/public-bounded-json.ts
?? src/features/events/public-event-admission.ts
?? src/features/events/public-event-config.ts
?? src/features/events/public-event-handler.ts
?? src/features/events/public-event-resolver.ts
?? src/features/events/public-event-viewer.test.tsx
?? src/features/events/public-event-viewer.tsx
?? src/features/events/public-event.test.ts
?? src/features/events/public-lineup.ts
?? supabase/concurrency-tests/public_event_lineup.test.sql
?? supabase/migrations/20261011181553_public_event_lineup_projection.sql
?? supabase/tests/public_event_lineup.test.sql
```

The preceding 23-file inventory and results document the original draft checkpoint. Its ZIP remains unchanged and is superseded by the final integration review package. `PHASE_6_WORK_PACKAGE_B_DRIVER_PROPOSAL.patch` is retained as the historical proposal; actual source includes the subsequent type/lifecycle/cancellation refinements and is authoritative. Do not apply that old patch over the implemented adapter.

## Completed local driver/HTTP integration

`node scripts/test-public-event-driver.mjs` uses the existing pinned PostgreSQL privacy profile and reviewed Node sidecar, with their unchanged ownership contracts. It starts no PostgREST process in this run, creates no network/host port/bind mount, downloads/builds no image, and installs no package in either container. Actual reviewed source is transpiled with the existing TypeScript dependency and its installed runtime package closure is copied byte-for-byte into the sidecar's existing bounded private tmpfs. Credentials/configuration arrive through stdin, never Docker arguments or container configuration. Temporary source/dependency copies remain outside the repository and source ZIP and contain no runtime credentials.

The actual API route exports and `pg` adapter execute over real loopback HTTP and TCP PostgreSQL inside that owned network namespace. This is not a mock database test or a full Next/browser-to-database deployment. Separate production Next browser checks cover the generic page and actual missing-configuration API boundary. The admission adapter executes normally against scripted HTTPS REST results; no external Redis provider or trusted proxy was provisioned and no hosted distributed-admission claim is made.

Final live command exit code: **0**. **148 assertions passed**, 20 actual backend identity/privacy checks and 19 parameterized bearer projection attempts; both pool backends were independently confirmed by administrative `pg_stat_activity` counts. Evidence includes valid sealed IGN/Event data, empty unrelated-Guild publication, rejection of a caller-supplied Guild selector, canonical/invalid token handling, update/version notification, attested rotation, old-link rejection, revocation and unpublishing. Untrusted proxy proof, failed/unknown admission, rate limiting and non-POST/query-string requests fail closed with safe headers.

Fault evidence includes invalid reader table authority, disabled SET authority with actual PostgreSQL **42501**, mandatory incorrect-password **28P01**, TLS rejection limited to allowlisted TLS/protocol categories, a real two-second connection timeout, two-second statement timeout with **57014**, three-second driver query timeout, client HTTP cancellation while a table lock holds the resolver query, destroyed-backend recovery and killed-idle-backend recovery. The role/membership/default/HBA fingerprint is unchanged after temporary owned fault injection. No application identity received elevated authority. All reader backends were gone after pool shutdown.

Live runtime console/stderr evidence: **0 bytes**. The bounded protocol carried 2,777 bytes of safe assertion metadata only. Complete PostgreSQL log evidence: **16,598 bytes**, zero sensitive matches. After adding coverage for pg-pool's early acquisition error-listener interval, the final live run `1830aaeb19f6dbc8f75b648e6a32da2b` again passed all 148 assertions and removed exact PostgreSQL container `dcdb78b83f5983d6b926bcfd2d59f6b08af41e10a523df49ba922b564b73c442` and Node sidecar `cf1c4576cdb4b48187611c4c75ed372a1c151accc96b84f29734a7430c3987e4` through the existing verified cleanup coordinator. The earlier successful run `43ba2e06bb15d9cfe073ef0d9e600060` also has verified removed tombstones.

Failed development attempts were retained as safe evidence, not accepted as successful authorization checks. A missing brace in the starting proposal was caught by TypeScript and corrected. Initial HTTP controls failed because the test client incorrectly attached a JSON body to GET; Node rejected malformed HTTP before the route's 405, so GET/HEAD now send no body. The safe ordinal diagnostic identified assertion 44 in that control. The subsequent rotation setup failed with 42501 because a fresh transaction lacked its expected owner JWT claim; the test-only transaction now supplies that claim. No permission was relaxed. All failed owned pairs were removed: `e4bcaa19f7578468c9d43a11c1ae057c`, `093e3dedaceb8fe71b3489ef882ba53d`, `1d1374a8472c951e9d5c502995a60f9e`, `f1ae6696f77176243a99c94fd6fdfa8a`. Ownership tombstones remain preserved.

Fresh quality results after integration: TypeScript PASS, ESLint PASS without warnings, **748 unit/component tests across 49 files PASS**, production build PASS including `/api/share/event`, **6 production Next browser tests PASS** across desktop/mobile. Four viewer tests use synthetic API responses; two actual API tests prove missing resolver/admission configuration returns 503 and GET returns 405 with no-store/referrer/index protections. Full owned SQL replay passed **1,443 assertions in 34 files**, preserving all original 1,401 and all 42 new projection assertions, plus **16 concurrency**, **130 authorization-concurrency**, and **31 production-cryptographic assertions**, with exact cleanup. The prior focused nine projection republish/revoke races remain unchanged and passed at the preceding checkpoint; the new live HTTP run additionally exercises current publication transitions.

The complete Work Package A HTTP suite was also rerun successfully after integration: **279 HTTP and 12 internal assertions**, real 401/403 and PostgreSQL 42501, pre-/post-migration controls, schema-cache reload, cold restart, concurrent rotation/revocation and both pooled authenticator backends. Complete log evidence was 16,637 bytes with zero sensitive matches. Run `a9cfedf0dbe7386fefcbb0c934faf1cb` removed exact PostgreSQL `4b50ef5e2997ab591ce81beec1f78ef8772dc1c947ebbf420264ba326fb19140` and HTTP sidecar `0e494042947a4f914fc490b0f1a51704a18d23e3178c491027fa4fd33a5981d6`. Full SQL run `40b2a415bd40451b0a13805a332afffa` removed PostgreSQL `08a3c1ef03da7b2ab25c95f45e8259f373e28a18cc5b2e2f8caabc17b923c582`. All exact ownership records are `removed`; no leftover disposable container remains.

Final development preservation evidence is `integration-final.json` beside the unchanged original `baseline.json`: all **12 containers, 4 networks, 3 volumes and 15 image entries match exactly**, including container identities/configuration/state fingerprints. No development database operation, migration, restart or resource mutation occurred. The historical network event remains unresolved Classification C. No image was pulled/built and no hosted credential, Redis provider or proxy was provisioned.

CRLF-aware whitespace validation passed for all tracked modifications and new files, with the index empty throughout. No whitespace policy was disabled or configured globally. Git remains on the expected branch/HEAD; all changes are intentionally unstaged. The new SHA-256 source-review ZIP supersedes the draft and contains the following **31 paths**, plus its manifest, excluding dependencies, credentials, Git internals and runtime evidence:

```text
 M docs/QUALITY_GATES.md
 M docs/SHARE_LINK_SERVER_CONFIGURATION.md
 M next.config.ts
 M package.json
 M pnpm-lock.yaml
 M src/features/events/event-share-link-manager.tsx
 M src/proxy.ts
?? docs/reviews/PHASE_6_WORK_PACKAGE_B_DRIVER_PROPOSAL.patch
?? docs/reviews/PHASE_6_WORK_PACKAGE_B_VALIDATION.md
?? e2e/public-event-viewer.spec.ts
?? playwright.public-event.config.ts
?? scripts/public-event-driver-runtime.mjs
?? scripts/test-public-event-driver.mjs
?? scripts/test-public-event-lineup.mjs
?? src/app/(public)/share/event/page.tsx
?? src/app/api/share/event/route.test.ts
?? src/app/api/share/event/route.ts
?? src/features/events/public-bounded-json.ts
?? src/features/events/public-event-admission.ts
?? src/features/events/public-event-config.ts
?? src/features/events/public-event-handler.ts
?? src/features/events/public-event-postgres.test.ts
?? src/features/events/public-event-postgres.ts
?? src/features/events/public-event-resolver.ts
?? src/features/events/public-event-viewer.test.tsx
?? src/features/events/public-event-viewer.tsx
?? src/features/events/public-event.test.ts
?? src/features/events/public-lineup.ts
?? supabase/concurrency-tests/public_event_lineup.test.sql
?? supabase/migrations/20261011181553_public_event_lineup_projection.sql
?? supabase/tests/public_event_lineup.test.sql
```

The historical proposal is documentation only. Source and the current manifest are authoritative. No file was staged, committed, pushed, merged or deployed. Independent source review and the operator prerequisites above remain mandatory before public enablement.

## Final independent review: Strict Mode lifecycle regression

The expected branch and HEAD remain `feature/phase-6-publishing-sharing` and `4d9e0cd0613b07952e3daf4ee75f5129435aaa7a`; the index is empty. Before editing, all 31 paths and raw SHA-256 values matched the independently reviewed `GuildOrganizer_WorkPackageB_Integrated_Review_20261011_211617.zip`. The installed Next.js Strict Mode guide was read; Strict Mode remains enabled.

The reported loading-state defect was **not reproduced** with the installed React 19.2.8. A new test mounts the actual viewer inside root `StrictMode` with a deferred, abort-aware fetch mock. The mock rejects on cancellation and cannot return a successful response after its signal aborts. The test explicitly observes the real effect cleanup through removal of the `hashchange` listener, verifies that no request has started when that replay completes, then verifies one live request, its current published lineup and Version 3.

The existing `queueMicrotask` deferral is decisive: the first setup consumes and immediately removes the fragment, React synchronously replays cleanup/setup, and only then does the queued initial load start. Thus cleanup has no initial request to abort. The surviving microtask loads from the in-memory bearer after replay; `initialized.current` prevents a second consumption but does not suppress that queued load. No viewer implementation change is justified by this reproduction. This evidence applies to the installed implementation and React version, rather than assuming all future effect scheduling is identical.

Five new lifecycle regressions cover the real Strict Mode replay, cancellation on pagehide, cancellation on persisted pageshow, a replacement fragment aborting an older pending request, and a single request on a mount without replay. The cancellation cases attempt late completion and verify that the discarded lineup and bearer are not restored. Replacement-link coverage proves immediate fragment removal, the new body token, the new publication result and rejection of the older aborted result. The replay test checks no bearer in rendered HTML or browser storage; the existing request/privacy tests remain intact. All 16 existing viewer cases still pass.

Only these two paths differ from the integrated review archive:

- `src/features/events/public-event-viewer.test.tsx`: the abort-aware deferred mock, five regression cases, and restoration of listener spies during test cleanup.
- `docs/reviews/PHASE_6_WORK_PACKAGE_B_VALIDATION.md`: this actual verification evidence.

The other **29 files are byte-identical** to the accepted archive, including `public-event-viewer.tsx`, the private SQL projection, migrations, privileges, PostgreSQL driver, admission controls, Docker infrastructure, dependencies and lockfile. No server/database behavior changed, so complete SQL, driver and HTTP infrastructure suites were not rerun. Their results above remain historical evidence from the completed integration checkpoint.

Fresh validation on 2026-10-11:

| Command/check | Actual result |
| --- | --- |
| `pnpm exec vitest run src/features/events/public-event-viewer.test.tsx -t "Strict Mode"` before any viewer change | PASS: initial reproduction, 1 passed / 16 skipped, exit 0 |
| `pnpm exec vitest run src/features/events/public-event-viewer.test.tsx` | PASS: all 21 viewer cases, exit 0 |
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS without lint warnings, exit 0 |
| `pnpm test` | PASS: 753 tests in 49 files, exit 0 |
| `pnpm build` | PASS, exit 0 |
| `pnpm exec playwright test --config playwright.public-event.config.ts` | PASS: all 6 desktop/mobile production-build browser tests, exit 0 |
| CRLF-aware `git diff --check` and equivalent `--no-index --check` on every untracked file | PASS: tracked check exit 0; all 24 new-file checks clean; index remains empty |

The browser suite retains its existing scope: four viewer checks use synthetic API fixtures, and two exercise the actual Next API's fail-closed missing-configuration responses (503 and GET 405). It is not a fresh browser-to-live-database test. The Strict Mode reproduction is the React development component test, not the production browser run. No PostgreSQL or HTTP security infrastructure rerun, migration or test fixture mutation occurred.

Read-only Docker inspection again matches the untouched original baseline exactly: **12 development container identities/configuration/state fingerprints, 4 networks, 3 volumes and 15 image inventory entries**. No disposable container remains. Evidence is `strict-mode-final-20261011_213729.json` beside the original `baseline.json` in `go-work-package-b-a39354d906e14aba826118606648c91b`; the baseline was not overwritten. No database access, Docker lifecycle operation, image pull/build or development-resource mutation occurred. The historical network discrepancy remains unresolved Classification C, without a claim that it was harmless.

There are still exactly 31 intended Work Package B paths, listed in the preceding inventory, all unstaged. The new full source-review archive supersedes the integrated archive while preserving the originals. It includes all 31 source/documentation files plus a SHA-256 and expected Git-blob manifest, excluding credentials, dependency directories and runtime evidence. Hosted access remains disabled; provisioning and independent release-review requirements are unchanged. The baseline CI limitation recorded above is unchanged and is not claimed green by these local checks. No commit, push, deployment or Work Package B expansion was performed. Stop for final independent source review.
