# Phase 6 requirements traceability

Baseline: `feature/phase-6-publishing-sharing` at `123284c026eda640f61984f38b09cfcdc46b91f8`. Audit: 2026-10-12 UTC. [CI #97](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38186202893) quality/database jobs both succeeded at this SHA. This matrix distinguishes current observed CI, historical local integration evidence, source inference and work not performed. It is not an implementation or deployment approval.

Legend:

- **C**: current CI #97 result observed, not independently rerun locally.
- **H**: historical real local integration recorded in reviewed reports; not fresh execution at this SHA.
- **M**: mocked/unit/component/browser boundary; does not prove a real hosted backend/provider.
- **S**: source review establishes design/behavior; runtime boundary remains unverified where specified.
- **A**: safe focused evidence actually executed during this audit.
- **N**: not run/not supplied; cannot be marked PASS.

Full paths are relative to the repository. Application module basenames refer to `src/features/events/`; `features/...` shorthand refers to `src/features/...`. Migration and SQL-test basenames refer to `supabase/migrations/` and `supabase/tests/`. Line anchors reference current source. Findings use the stable IDs in `PHASE_6_FINAL_AUDIT.md`.

## Product and data lifecycle

| Requirement / contract | Implementation and boundary | Relevant test/evidence | State, limitation and follow-up |
| --- | --- | --- | --- |
| Account, Guild membership and Character remain distinct | Guild access service; Event assignment UUIDs; publication snapshot source UUID and display copies | Foundational membership/roster/Event SQL among discovered 34 files | C/S; public DTO excludes all such identifiers. No hosted catalog read was performed. |
| Create draft from authorized active template | `features/events/actions.ts:43`; migration `20261005231500_event_creation_rpc.sql:51`; copied Event-owned hierarchy, capability and template lock | `event_creation_rpc.test.sql`; Builder critical/browser workflow | C; no development reset during audit. |
| Edit assignments with `events.manage`, not client-only permission | `assignment-actions.ts:39/74/122`; assignment/move RPC migrations `20261006004500` and `20261006013000`; Slot/Event locking | `event_assignment_rpcs.test.sql`, `event_assignment_move_rpc.test.sql`, Builder E2E | C; touch/keyboard actions accompany drag. |
| Distinguish draft assignment editing from metadata/archive UI | `actions.ts:43` creation; management status filter `event-management-view.tsx:204`; no metadata/archive mutation control found | Archived status exercised through SQL/admin fixtures, not organizer archive UI | S/C; scope distinction P6-A13. Do not claim an application archive workflow from resolver tests. |
| Cross-Guild draft selectors fail | Scoped queries and composite foreign keys; `require_events_manage`, `require_event_slot_manage` | Event creation/assignment/foundation SQL; management authorization component/browser checks | C/S; no cross-Guild bypass identified. |
| Eligible/inactive/duplicate Character handling | `get_event_builder_characters`; `event-assignment.ts`, `event-warnings.ts:8/172/225` | Assignment SQL; assignment/warnings unit tests; Builder critical E2E | C/M; inactive historical references remain visible. API row-cap incompleteness A02 affects large rosters. |
| Duplicate, open required role, absent/mismatched role, fullness warnings | `event-warnings.ts:172-268`; Builder board | `event-warnings.test.ts`; `event-builder-critical.spec.ts` | C/M; advisory, not hard publication blockers. Missing-Class warning is not separately implemented; blueprint broader intelligence is eventual. |
| Complete draft/preview, including large structures | `builder-server.ts:113-195`; `supabase/config.toml:18` | Audit mock: 1,008 seats capped to 1,000 accepted ready/publishable | **A/S defect, P6-A02**. No complete draft pagination/cap detection; historical snapshot paging does not fix it. |
| Only publishing capability may publish/update/unpublish | `publication-server.ts:61`; `publication-actions.ts:130/175/223`; `require_publish_manage` SQL | Publication foundation/RPC SQL; publication action/panel tests; publication workflow E2E | C/M/S; Owner/Admin and publish-capable Officer allowed, Member/events-only denied. |
| Atomic publication and immutable version numbering | `20261007174500_event_publication_rpcs.sql:386/472/527`; shared Event/publication locks and next version | `event_publication_rpcs.test.sql`; 16 real concurrency assertions | C; each explicit update creates a new version, no content-idempotency promise. |
| Snapshot exactly captures database draft values | Publication RPC child inserts/count checks `:225-358`; seal/current pointer in transaction | Publication SQL completeness/rollback assertions | C/S; current SQL input can differ from an older UI preview; A02 is a preview integrity blocker. |
| Draft/roster updates cannot rewrite historical snapshots | `20261007160000...:349/406` sealed write guards; copied display values; read uses snapshot rows | Foundation/RPC SQL, publication-history browser and components | C; browser test was flaky then passed. Trusted Guild/Event deletion cascades are intentionally permitted. |
| Historical snapshot access is managerial and Guild-scoped | Publication RLS `20261007160000...:610-685`; `publication-server.ts:167` explicit scope/sealed filter | SQL RLS/direct-write tests; history access E2E | C/S; Members/anonymous do not get raw historical snapshots. |
| History pages remain bounded under new publication | `publication-server.ts:302`; history dialog `:271`; max/before version anchor, page size 10 | `publication-server.test.ts`, `event-publication-history*.test.*`, history E2E pagination | C/M; current-version indicator flaked in #97, P6-A08. |
| Snapshot children complete beyond API row cap | `publication-pagination.ts:13`; size 500/exact-count/no repeated IDs; scope visibility recheck | `publication-server.test.ts:101`, pagination tests, >1,000-row fixture | C/M; accumulation remains proportional to selected full snapshot, not a measured performance pass. |
| Unpublish preserves history but removes member visibility | Publication RPC `:527`; public projection target requires published current seal | Publication SQL, share/public projection SQL, workflow E2E | C; no new bearer read when unpublished. Previously delivered data cannot be remotely erased. |
| Archived Event/inactive Guild links unavailable | Private projection `20261011181553...:73-83`; share management availability | `public_event_lineup.test.sql`; share state/links SQL | C; trusted bearer cannot select an archived/unpublished historical version. |
| Owner/Admin/publish-only Officer sharing, no Member management | Gated `share-link-actions.ts`; sharing route/access service; `share-link-server.ts:45` actual getUser; SQL actual JWT/capability | Share management SQL and current unit tests; enabled boundaries E2E | C/M plus H browser; seven enabled-sharing E2E cases **skipped in #97**. A03. |
| Create/rotate/revoke authenticated and attested | Crypto/provisioning SQL `20261008225953`; authority ordering `20261009180213`; expected link identity | 311 share-link SQL assertions, 101 management-state assertions, 130 authority concurrency | C; proof expiration/replay binding and fresh authority locks exercised. |
| Rotation/revocation invalidate old bearer and scrub recovery | Private share table constraints/mutation guards; atomic old revoke/new identity | Share SQL; public projection 42 assertions; H HTTP/driver transitions | C/H; not a promise to clear recipient screenshots or already in-flight MVCC responses. |
| Mutation retry/unknown outcome handled safely | `share-link-server.ts:148/164` retry(false); manager `:102-126`; publication panel `:307` recovery | Share-server/action/manager and publication action/panel components | C/M; read-only reload after unknown write, no automatic mutation retry. Installed PostgREST helper excludes POST retries. |
| Authorized Copy and generic Discord preview | `share-link-server.ts:80-108`; `share-link-crypto.ts:61`; manager `:128`; public page metadata `:6-9` | Crypto/config unit tests; historical enabled-sharing clipboard/fallback/mobile E2E; current public browser metadata | C/M/H; real Discord client preview is N. Copied URL is fragment-only. |
| Public metadata contains no bearer/member lineup | `/share/event/page.tsx:5-13`, client-only fragment/viewer | Public browser SSR/header/metadata tests | C/M; published content API is mocked in four of six cases. |
| Anonymous and logged-in Member can view by bearer | Public viewer cookie-free request; restricted dedicated server connection | Browser anonymous shell, mocked valid lineup; H actual driver/API tests | C/M/H; no hosted enablement or actual provider test. Bearer possession, not Guild identity, authorizes public access. |
| Published Area/team/Party/Slot/IGN/Class/role only | Private `resolve_lineup` `20261011181553...:73-132`; strict `public-lineup.ts` | 42 projection SQL assertions; strict DTO/unit tests; H real driver | C/M/H; no private IDs, notes, draft/current roster fallback, recovery data or historical selection. |
| Search identifies every matching Party/duplicate IGN | Projection `:103-108`; viewer `:125-146` | Projection pagination/duplicate SQL; public viewer components and browser | C/M; substring search, all matching assignments highlighted. Does not identify ownership of a Character account. |
| Empty structures and bounded pages | Projection union for empty Area/Team; 12 cards/page, eight slots/Party, max 5,000 | Projection SQL 15-card fixture, empty/duplicate component and DTO tests | C/M/S; full near-5,000-card workload/UTF-8 maximum response measurement N. A09. |
| Current publication update consistency | Version is guard, not historical selector; single materialized MVCC statement; viewer clears old state | Current 42 SQL assertions + viewer tests; H nine focused races | C/M/H; focused race runner absent from #97, A03. Manual Check for updates, no push/live subscription contract. |
| Fragment removed and retained only in memory | Viewer `:77-95`, immediate replaceState, strict canonical shape, bearer ref | Viewer StrictMode/fragment/storage/superseding/pagehide tests; browser URLs/storage/console assertions | C/M; real-device/BFCache/gateway leakage N. Immediate true-unmount before queued load is not explicitly tested. |
| Safe empty/loading/invalid/unavailable/retry states | Viewer message/state table, ticket/abort logic, strict DTO parsing | Component states and mocked browser tests | C/M; revoked/rotated/unpublished failures generic. A01 is a detached cancellation defect. |

## Security, deployment and infrastructure

| Requirement | Source implementation | Test/evidence | Status and external prerequisite |
| --- | --- | --- | --- |
| No direct anon/auth/service resolver escape | `20261010002444...:24`; resolver NOLOGIN/NOINHERIT; no request-role membership | 27 resolver-access SQL assertions in #97; H 279 HTTP + 12 internal controls | C/H; genuine SQL 42501 is checked. #97 did not run real PostgREST HTTP; A03. |
| Private schema not a public RPC surface | `20261011181553...:17/136-139`; `supabase/config.toml:13` | Actual role-denial projection SQL plus mocked backend tests | C/S; schema excluded; resolver-only functions, fixed empty search_path, qualified SQL. |
| No production reader/settings authority silently provisioned | Role collision checks; permanent migrations do not create LOGIN reader/password; fixed reader config | Source and SQL restriction tests; H fresh dedicated-reader SCRAM | C/S/H; actual target catalog/PG17 SET/INHERIT/ADMIN and PUBLIC/default grants N, A04. |
| No service-role resolver substitute | `public-event-config.ts:55`; resolver fixed identity; API uses pg adapter | Unit rejection of bad identity and H real driver 42501 | C/M/H; no service-role credential accepted by public resolver. |
| Verify effective session configuration, not merely role defaults | `public-event-resolver.ts:13-36/54-66`; boolean private privacy helper | H 20 real backend checks; current M unsafe-session rejection; C core bootstrap SCRAM | S/M/H; actual hosted sessions and both pooled backends with provider configuration N. |
| Cryptographic token shape, digest and AES integrity | `share-link-crypto.ts:19/33/48`; signed 14-field provisioning; private SQL key handling | Current crypto unit and 31 real crypto integration assertions | C; no raw keys/tokens stored in general DTO; long-lived bearer does not inherit proof TTL. |
| Request/payload/database work bounded | Handler max 1,024 body bytes, bounded JSON; DTO max 256 KiB; pg timeouts/pool max two | Current M bounds/cancel/overload; H real driver failure injection | C/M/H; **A01 audit probe emitted one unhandled rejection**, safe400 true. Fix required. |
| Dedicated PostgreSQL verified TLS | `public-event-config.ts:55-64`; ssl true/TLS1.2+ backend check | M TLS policy; H non-TLS isolated exception/ownership verification | S/M/H; positive real hosted cert/CA/hostname acceptance and rejection N. A04. |
| Loopback non-TLS restricted to exact owned tests | Config 32-hex run ID/db name/literal loopback; runtime exact marker | H live driver/lineup runner; current M missing/wrong marker rejection | C/M/H; not permission for development/hosted non-TLS. |
| Distributed admission, no local production counter | `public-event-admission.ts:7-41`; atomic EVAL, TTL/global+address, HMAC key | M atomic command/result/failclosed; H scripted HTTPS REST integration | M/H; real provider, multi-instance totals, IPv6/proxy spoof acceptance N. A04. |
| Trusted client identity not arbitrary forwarded headers | Proxy secret timingSafeEqual; canonical verified IP; ingress strip requirement | M forged/missing header denial | S/M; actual trusted edge configuration/credential separation N. A04. |
| Core/audit/auto-explain/parameter logging privacy | Permanent helper `20261011181553...:23-55`; HTTP profile/scripts | H complete Docker log scans, bootstrap/admin/authenticator/notification/request/pool controls; current M guards | S/M/H; real hosted PG configuration/log sinks unverified. No guard relaxation. A05. |
| Token-safe browser/cache/metadata | Next headers `:12`, public response headers, fragment/client POST | C production shell no-store, URL/storage/log and metadata tests; H API | C/M/H; hosted edge/CDN/error response/cache and real gateway privacy N. A05/A06. |
| CSP/HSTS/nosniff/referrer/Permissions Policy | Next share route implements latter three plus frame denial; architecture release checklist `:287` | Browser actual no-store/referrer/index results; source headers | Partial; no CSP/HSTS in source and no hosted header evidence, A06. |
| Secrets, dependencies, session/auth abuse review | Server-only private fields, env separation, frozen lockfile, denied build scripts | A pnpm audit: 2 high +1 moderate; no explicit CI scan; no secret scan here | Open A06/A07; package presence != reachable exploit. Session/invite hosted abuse and production Security Advisor N. |
| Immutable image registry/config identity | `isolated-postgres-test-cluster.mjs:156-183` exact RepoDigest, SHA image ID, Linux/amd64 | C image preparation/startup+current ownership mocks; A read-only actual localTarget success | C/M/A; actual image ID stored/rechecked, no tag fallback/pull by runner. |
| Manifest cannot select unrelated resource | Cluster `:79/106/113/265`; full IDs/timestamps/repo/daemon/isolation | Current mocked tamper/change/image/daemon/forged/unrelated-container tests | C/M; H real lifecycle checks. Trusted daemon/filesystem administrators remain trusted. |
| Exact cleanup/recovery, dependent before parent | Cluster `:348`; PostgREST registration/identity; inactive lease requirements | C SQL verified cleanup; H 27/22 lifecycle; current M failure/cleanup refusal | C/M/H; no current leftover resources; real recovery at current SHA N. |
| No development DB/network/volume use by isolated runner | Network none, no host ports/binds, bounded tmpfs, synthetic random credentials | C isolated execution; A preserved inventories/read-only provenance | C/A; 12 containers, 4 networks, 3 volumes, 15 images exactly match baseline. |
| Safe fixed startup-stage diagnostics | Cluster `:34-48`; allowlist and restricted SQLSTATE | C current unit stage/sanitization/ownership tests; CI startup succeeded | C/M; stage label alone would not prove a PostgreSQL cause. No raw stdout/stderr/SQL disclosure found in this boundary. |
| Hosted default-disabled gate remains closed | `share-link-feature.ts:4`; public page `:13`; config `:31` | Current tests reject production/staging even with flags true | C/M/S; enabling hosted use requires independent source/security review, not changing APP_ENV to local. |
| Preserve unexplained historical network event | Historical Classification C; baseline immutable | A current exact fingerprints before/after audit | Present preservation passes; historic event remains unresolved. A11. |
| Retain historical identity despite account lifecycle | Sealed `created_by` guard + ON DELETE SET NULL; fixture Guild-before-Auth cleanup | Source conflict; existing fixture lifecycle tests | S; no standalone retained-Guild publisher deletion performed. A12: explicit disposition/test before providing that operation. |

## Permanent quality gates and actual execution

| Gate | Observed result | Audit execution | Missing release evidence |
| --- | --- | --- | --- |
| TypeScript | Next production-build type work PASS C; earlier `tsc --noEmit` H | Not run | Standalone TSC at any subsequent correction revision; don't call it a CI step that does not exist. |
| ESLint | PASS C | Not run | Rerun for approved corrections. |
| Unit/component | 826/49 PASS C | Not rerun | Add rejecting-cancel and complete-draft regressions; old suite did not catch audit findings. |
| Production build | PASS C | Not run | Build any approved source correction. |
| Public viewer browser | 6 PASS C | Not run | Real published DB/provider/browser end-to-end, near-boundary and device/accessibility checks. |
| Authenticated browser | 24 passed, 1 flaky, 8 skipped C | Not run | Seven enabled-sharing cases, investigate history retry; intentional cleanup-failure probe handled separately. |
| Migration reset/schema lint | Both PASS C | Not run | Existing hosted-data migration compatibility only in separately approved safe target. |
| SQL regression | 1,443/34 PASS C | Not run | Preserve all discovered tests after any approved corrections. |
| Concurrency/authorization/crypto | 16/130/31 PASS C | Not run | Focused nine projection races H; missing publication/draft authority interleavings should not be claimed covered by share-only tests. |
| Generated types | PASS C | Not run | Retain after SQL changes. |
| PostgREST HTTP/internal boundary | 279+12 H | Not run | Fresh retained runtime gate at reviewed SHA, actual statuses/42501 and complete privacy. |
| Driver/actual handler | 148 H | Not run | Fresh live adapter with cancellation/logging and exact cleanup; actual Next+hosted DB browser composition N. |
| PG/HTTP lifecycle | 27/22 H; current M ownership tests passed C | Not run | Real owned lifecycle/recovery evidence at reviewed revision. |
| Dependency advisory inspection | 3 advisories, exit1 A | Executed read-only | Reachability/approved mitigation; scanning gate. |
| Two focused source probes | Cancel safe400 +1 unhandled; cap1,008->1,000 ready A | Executed in memory | Regressions and fixes await review; no live database reproduction claimed. |
| Whitespace and archive integrity | Recorded in final package | Reports only | No code edits, test reruns, stage/commit/push. |
| Manual WCAG/native devices/performance/hosted release | N | Not run | A04-A09 acceptance checklist; no performance numbers fabricated. |

## Documentation reconciliation

Current summaries should be amended in a later approved package, not during this audit:

1. `ARCHITECTURE.md:174/275/314-318`: supersede absent public page/adapter and null-runtime-pin assertions with implemented gated Work B and reviewed Work A provenance, retaining previous decisions as historical.
2. `QUALITY_GATES.md:120`: replace the obsolete current image-failure pointer with #97 and precise historical-versus-current gate coverage.
3. `SHARE_LINK_SERVER_CONFIGURATION.md`: make current internal private projection/driver and default-disabled restrictions prominent; qualify older future-route paragraphs.
4. `ROADMAP.md`: do not mark Phase 6 closed until local P1 corrections/evidence and independent handoff review; keep Phase 7 release-hardening distinct from hosted activation.
5. Historical validation reports should retain failures/skips as recorded and receive a current-summary link if later authorized, rather than silently rewriting past results.

No future public Event-page feature, Discord bot, analytics, attendance or icons are required to resolve these findings. The original approved architecture should be retained.
