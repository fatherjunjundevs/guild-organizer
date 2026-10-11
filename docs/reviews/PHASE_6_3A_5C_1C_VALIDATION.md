# Phase 6.3A.5C.1C — Isolated PostgREST validation

## Status and starting baseline

**Static implementation validated; runtime and compatibility gates BLOCKED. This checkpoint is not HTTP-security approval or release approval.**

Starting branch was `feature/phase-6-publishing-sharing`, exact HEAD `7dcad86906834475029b20076ffd9697f6f3ab66`, with a clean worktree and empty index. The committed Phase 6.3A.5C.1B isolated PostgreSQL implementation and its validation report were reviewed before editing. AGENTS.md, installed Next.js testing documentation, ARCHITECTURE.md, QUALITY_GATES.md, LOCAL_E2E_FIXTURES.md and previous checkpoint reports were consulted.

Docker Desktop's Linux engine pipe was unavailable (`npipe:////./pipe/dockerDesktopLinuxEngine`; Docker Server metadata unavailable). No daemon was started. No development database credential discovery, Supabase status command, connection, migration, reset, restore or fixture cleanup was performed. No image was pulled, built, upgraded or substituted. No containers, Docker networks or persistent volumes were created or removed. No npm dependency or lockfile change, CI workflow change, staging, commit, push, merge or deployment occurred.

## Binary provenance and compatibility

The preserved PostgreSQL pin is `public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9`, previously reviewed as Supabase PostgreSQL `17.6.1.171`. Availability and actual running version could not be reverified in this checkpoint. It is not silently upgraded to a newer PostgreSQL patch.

Read-only configuration inspection found project `guild-organizer`, PostgreSQL major 17, public/graphql_public development API schemas, public/extensions extra search path, 1,000 maximum rows, `auto_expose_new_tables=false`, and disabled pooler. Development ports 55421/55422 are not used by this harness. Installed CLI `2.118.0`, Node `24.19.0` and pnpm `12.8.1` were observed; no upgrade was performed.

**Exact installed PostgREST binary version, official manifest digest, executable SHA-256 and harness image identity: UNRESOLVED.** `scripts/postgrest-http-image.mjs` deliberately exports `null`. Both new runtime commands fail before ownership intent or resource creation. No release is inferred from CLI version or the current documentation. Unit fixtures use fabricated digests and version 14.6 only to exercise contract validation; these are not selected runtime pins.

Before enabling the runner, the operator must make Docker available, inspect existing image metadata without reading container environment secrets, and establish the actual PostgREST version and digest. Any needed pull or build requires explicit approval of the concrete image preparation operation. The Dockerfile has no base-image defaults and installs no packages. Official PostgREST and Node base references must contain manifest SHA-256 digests. The copied binary must pass SHA-256 and `--version` checks both during preparation and at runtime. Verify its binary path, architecture, libc/library compatibility and all used configuration settings against that exact release; `/bin/postgrest` is a proposed copy location, not an observed installed path.

The hybrid harness is addressed by an immutable registry manifest digest or its exact local `sha256:` image config ID. These digest types must be recorded distinctly in the subsequent runtime report. The full image ID, official base digest labels, binary version/hash and source hash must match. Source hashing covers the Dockerfile, container harness and shared HTTP contract. There is no tag fallback, command-line image override or automatic preparation. Unknown/stale metadata fails closed.

Current [PostgREST authentication](https://docs.postgrest.org/en/stable/references/auth.html), [error mapping](https://docs.postgrest.org/en/stable/references/errors.html), [schema cache](https://docs.postgrest.org/en/stable/references/schema_cache.html) and [versioned configuration](https://docs.postgrest.org/en/v14/references/configuration.html) documentation informed the assertions. Current stable documentation identifies version 16; that does not identify the installed executable. Version 14.6 upstream Config/Database.hs, Query/PreQuery.hs and Error.hs were also reviewed as comparison evidence, not installed provenance. The exact selected source must be reviewed again before runtime approval.

PostgreSQL 17 [role membership](https://www.postgresql.org/docs/17/role-membership.html) supports separate INHERIT and SET membership options used by the bootstrap. [Logging documentation](https://www.postgresql.org/docs/17/runtime-config-logging.html) informed statement, parameter, duration and sampling suppression. These controls need actual pool verification, not inference from one administrative session.

## Implemented topology and ownership

The following is implemented configuration and unit-tested ownership logic, **not an observed running topology**:

```text
host coordinator: Docker CLI over the verified local daemon, private stdin protocol
  independently owned PostgreSQL: --network none, no published ports, PG tmpfs
    same exact network namespace: --network container:<full-postgres-ID>
      non-root Node harness -> 127.0.0.1:3000 PostgREST
      PostgREST -> 127.0.0.1:5432 owned PostgreSQL, authenticator + SCRAM
```

The sidecar has no host ports, bridge/development network, bind mounts, database mounts, Docker socket, device requests or persistent shared storage. Root filesystem is read-only; UID/GID is 10001; capabilities are dropped; no-new-privileges is required. Private IPC, no restart/autoremove, 512 MiB memory, one CPU, 64 PIDs, disabled Docker logging and a private 16 MiB tmpfs are verified. Temporary configuration is created exclusively with mode 0600 under `/run/go-http`. PostgREST binds IPv4 loopback only. [Docker networking documentation](https://docs.docker.com/engine/network/) supports using another container's network stack; [resource constraints](https://docs.docker.com/engine/containers/resource_constraints/) inform the limits. Runtime enforcement still needs inspection and probes.

Version-1 manifests retain their existing exact schema. Version-2 manifests add a registered HTTP dependent, durable phases, intent time, exact full ID/creation timestamp, parent ID/system/database identity and public provenance metadata. Secret fields and unexpected keys are rejected. Creation intent precedes submission. An uncertain creation response is reconciled only to one candidate carrying complete matching ownership/configuration evidence; names or labels alone do not authorize adoption.

Parent cleanup runs under the existing exclusive lock. It first closes owned requests/processes, verifies and stops/removes the exact HTTP sidecar, proves its absence and persists the dependent removal state. Only then may PostgreSQL removal begin. Sidecar uncertainty blocks parent removal. Missing containers count as reconciled removal only after recorded removal intent. Incomplete evidence is retained; cleanup errors yield nonzero status. Recovery accepts one exact run ID and retains the existing PID/lease active-run veto, daemon/repository checks, protected local manifests and repeatable removed tombstones. No broad pruning, shared-cluster role deletion or historical recovery is added.

## Authentication, pool and privacy controls

HTTP processing uses restricted `authenticator`, never postgres/supabase_admin. Privileged SQL bootstrap and migration application are separate Docker-exec operations targeting only the verified disposable database. Fresh passwords are installed as SCRAM verifiers; wrong/correct TCP password probes are required. Authenticator can SET only anon, authenticated and service_role, with INHERIT false; unexpected SET authority is rejected. It receives no internal resolver membership.

Fresh 32-byte signing keys produce HS256 JWTs with a test audience and 120-second expiry. Requests cover no JWT, signed anon, authenticated synthetic user and service_role. The config uses the matching base64-encoded raw signing key. Passwords, keys and JWTs travel over private stdin, not Docker create arguments/environment, image layers or manifests. No production keys are used.

The test-only SECURITY INVOKER identity RPC returns only session_user, current request role, auth.uid(), backend PID and a logging-safe boolean. It checks actual pooled sessions for disabled statement/parameter/duration/sampling logging, disabled pg_stat_statements tracking and absent audit/auto-explain preload hooks. A bounded concurrent batch must exercise both pool connections and alternating users/roles, including clearing claims for anonymous/service requests, before token-bearing GET/HEAD controls. It never returns raw JWT claims.

SQL role defaults protect authenticator logins; a single bootstrap-session setting is not treated as pool evidence. In reviewed version-14 sources, some privileged role settings are ignored unless the login has parameter SET authority, so safety assertions inspect effective session values. The test API receives no new parameter privileges. Real logging behavior remains unverified until the pinned runtime passes these controls.

Raw PostgREST stdout/stderr is bounded and retained only in harness memory, never forwarded to Docker/console artifacts. Tokens and encoded variants are checked against captured diagnostics and responses. The host accepts only bounded allowlisted aggregate protocol results; failures expose fixed messages, not actual bodies, URLs, SQL or credential-bearing diagnostics. Commands, requests, response bytes, pending requests, child output, pool acquisition and total harness lifetime are bounded. The harness has no telemetry integration; environment allowlisting rejects unexpected injected configuration. Verification does not establish immunity from Docker administrators, host instrumentation or memory inspection. tmpfs can be swapped; no secure memory-erasure claim is made.

## Resolver HTTP contract and cache transitions

No real HTTP response was obtained in this checkpoint. The following are **strict expected assertions**, not measured outcomes:

| Stage / caller | GET / POST | HEAD |
|---|---|---|
| Before migration: no JWT, signed anon, authenticated | 200, exact four-field sealed publication projection | 200, empty body |
| Before migration: service_role | 403 + resolver permission error 42501 under existing grants | 403, empty body + Proxy-Status 42501 |
| After migration: no JWT or signed anon | 401 + resolver permission error 42501 | 401, empty body + Proxy-Status 42501 |
| After migration: authenticated or service_role | 403 + resolver permission error 42501 | 403, empty body + Proxy-Status 42501 |

PostgREST documents 42501 as 401 for anonymous and 403 for authenticated requests. The runner additionally requires `Proxy-Status: PostgREST; error=42501`; GET/POST must contain the exact resolver EXECUTE permission message with no extra detail/hint. Signed anon is expected to retain anonymous status semantics. These details, especially HEAD headers and signed-anon classification, must be verified against the actual pinned source/binary; a difference is a failed check requiring investigation, never automatic relaxation.

The matrix includes valid, unknown canonical and malformed synthetic tokens in correctly formed `p_token` GET/HEAD/POST requests: 36 cases per stage. It runs immediately after committed migration, after reload request, after verified reload completion and after a fresh PostgREST process/pool restart. A newly named test-only sentinel RPC proves cache generation visibility; NOTIFY alone is not proof. Timeout/missing sentinel is failure. The restart is a cold child-process restart within the same verified sidecar, not a claim of image/container recreation.

The unchanged committed access migration is applied only in the owned database. Effective PUBLIC/API EXECUTE revocations, retained internal-role EXECUTE, prohibited authenticator SET membership and identical `pg_get_functiondef` are asserted. Role collision replay must remain rejected. Missing routes, stale caches, JWT/role-switch/parser errors, timeouts and successful empty results cannot pass resolver-denial assertions. Parser, invalid-JWT and attempted internal-role switching controls are classified separately.

## Internal and concurrent regression coverage

Production cryptography modules are loaded in memory by the existing loader, with fresh test AES/provisioning keys. Synthetic fixtures contain published metadata, a draft canary and roster canary. Dedicated-role SQL resolution requires exactly event_name, event_type_name, version_number and published_at, excluding private data and identifiers. Positive, unknown/malformed, draft-versus-sealed, rotated-old/new, unpublished/republished, Event/Guild archived and revoked cases are scripted. Unsealed/missing current-version attempts must fail integrity triggers and leave sealed metadata unchanged; triggers are never disabled.

The actual HTTP management RPC remains an authenticated positive control. Concurrent HTTP denial batches are dispatched around rotation/revocation and after their commits. Denial must hold for every response regardless of which committed snapshot it observes. Their timing is not asserted to establish exact request/commit overlap. Existing SQL concurrency tests continue to provide deterministic internal statement-snapshot race coverage. Failure coverage includes malformed requests, JWT failure, prohibited SET, transport/protocol bounds and cache-completion rejection. Forced real transport failure during an observed rotation/revocation overlap and forced real cache-listener/reload failure still need pinned-runtime design/validation; a unit rejection is not claimed as either real probe.

The real HTTP lifecycle script is present but blocked. It is designed to probe two independent runs, name collision, active recovery, corrupt manifest refusal, parent preservation on sidecar failure, uncertain sidecar and parent removal responses, repeated cleanup/recovery and killed-child created/submitted creation windows. Ownership/configuration failures, missing/ambiguous reconciliation, source/image mismatch, response privacy, error classification, JWT signing and runtime configuration are exercised by unit tests. Existing v1 missing-manifest, persistence and lease tests remain intact.

## Validation results

| Check | Actual result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS: 592 tests / 43 files; 93 new HTTP tests + unchanged 44 existing isolated PostgreSQL tests |
| `pnpm build` | PASS: Next.js 16.3.8 production build |
| `pnpm db:test:http` | BLOCKED, exit 1 before resources: unresolved binary/image provenance |
| `pnpm db:test:http:isolation` | BLOCKED, exit 1 before resources: unresolved binary/image provenance |
| `pnpm db:test:concurrency` | BLOCKED, exit 1 at Docker info before resources |
| `pnpm db:test:isolation` | BLOCKED, exit 1 at Docker inventory before resources |
| SQL / lifecycle / auth concurrency / real crypto integration | NOT RERUN: preserved prior baselines 1,401 / 16 / 130 / 31 respectively |
| Real HTTP / schema cache / internal SQL / sidecar cleanup | NOT RUN |
| `git diff --check` | PASS; see final verification below |

The previous checkpoint's real 27 infrastructure assertions and 1,401/16/130/31 results remain historical evidence only. They are not carried forward as passes for this changed lifecycle/helper. Existing SQL files, concurrency assertions, production cryptographic code and application security tests were not weakened or removed. Database lint/types and browser gates were not redirected to the development database to work around Docker unavailability.

No newly owned runtime resources exist because execution stopped before creation; there is no new cleanup/recovery run identifier. A daemon-wide inventory/absence check cannot be claimed while Docker is unavailable. Unit temporary files were removed by test teardown. Development data and historical fixtures were untouched.

## Exact file inventory

Modified:

- `package.json`: three local HTTP validation/lifecycle/exact-run recovery scripts; no dependencies.
- `scripts/isolated-postgres-test-cluster.mjs`: v2 dependent registration validation, ordered cleanup, shared trusted primitives and stronger owned-cluster logging defaults.
- `scripts/test-share-link-concurrency.mjs`: shared unchanged-migration preparation; existing regression bodies retained.
- `scripts/test-isolated-postgres-lifecycle.mjs`: non-test inventory comparison excludes independently owned HTTP runs as well as PostgreSQL runs; deletion checks remain exact.
- `docs/ARCHITECTURE.md`, `docs/LOCAL_E2E_FIXTURES.md`, `docs/QUALITY_GATES.md`: local topology, recovery and blocked-gate documentation.

Added:

- `scripts/postgrest-http-image.mjs`: unresolved provenance pin, fail closed.
- `scripts/postgrest-http-contract.mjs`: exact ownership, JWT, redaction and response contracts.
- `scripts/isolated-postgrest-test-service.mjs`: registered dependent creation/attachment/reconciliation/recovery/cleanup.
- `scripts/docker/postgrest-http/Dockerfile`: operator-approved immutable-image preparation definition.
- `scripts/docker/postgrest-http/harness.mjs`: private runtime configuration, bounded PostgREST process/HTTP protocol.
- `scripts/share-link-test-database.mjs`: isolated migration replay with deferred unchanged access boundary.
- `scripts/sql/event-share-link-http-bootstrap.sql`: test-only authentication, logging and identity RPC.
- `scripts/sql/event-share-link-http-fixtures.sql`: new synthetic records in empty owned databases only.
- `scripts/test-share-link-http.mjs`: pre/post HTTP matrix, cache transitions and internal controls.
- `scripts/test-isolated-postgrest-lifecycle.mjs`: real owned lifecycle/failure probes, currently blocked.
- `src/test/isolated-postgrest-test-service.test.ts`: new HTTP unit coverage.
- `docs/reviews/PHASE_6_3A_5C_1C_VALIDATION.md`: this report.

## Next validation and release blockers

1. Independently review this uncommitted static source. Restore Docker availability through the local operator; do not start or alter the development stack as part of this runner.
2. Record exact installed PostgREST metadata/source compatibility. Present concrete digest-pinned preparation commands for explicit local operator approval if any image is missing. Only then prepare and record the reviewed pins.
3. Re-run static gates, existing isolated lifecycle and full 1,401/16/130/31 baselines; run the HTTP lifecycle suite and full pre/post authorization/cache/internal matrix. Verify pool logging, status/header details, real partial initialization and complete exact-resource cleanup. Resolve real reload-failure and observed transport-failure probes before claiming complete failure coverage.
4. Record actual image/binary hashes, topology inspections, assertion counts, safe error evidence and cleanup results in a follow-up report. Separate CI approval follows successful local runtime validation; `.github/workflows/ci.yml` remains unchanged.
5. Hosted Supabase gateway testing remains separate: opaque publishable/secret keys are not JWTs and map to API database roles through the gateway; synthetic direct PostgREST JWTs do not prove gateway/API-key/GoTrue behavior. See [Supabase API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys). Browser GET/HEAD behavior, origin controls, hosted logging and public-sharing hardening still require separately approved validation.

The development access-boundary migration remains unapplied. Public sharing remains disabled, no public Event page or production resolver endpoint exists, and security/release approval remains blocked. No source commit or push is authorized by this report.

## Final verification

HEAD remains `7dcad86906834475029b20076ffd9697f6f3ab66` on `feature/phase-6-publishing-sharing`. The index is empty; the worktree intentionally contains only the inventory above, awaiting independent source review. Production source, committed application migrations, SQL regression fixtures, environment files, historical fixture tooling/reports, lockfile and CI workflow are unchanged. No development data or historical fixtures were touched.

## Resumed validation — 2026-10-10

The resumed checkpoint verified the same branch and exact HEAD, an empty index, and the existing seven modified plus twelve untracked HTTP files. The job-class/analytics audit remains deferred. Existing implementation, assertions, fixtures and completed work were preserved. The only edit during this resumed turn is this appended evidence; no implementation files or image pins were changed.

Read-only Docker checks returned context `desktop-linux`, no Server metadata, and failure to open `//./pipe/dockerDesktopLinuxEngine` because the named pipe does not exist. Both `docker version --format '{{json .Server}}'` and `docker info --format '{{json .ID}} {{json .ServerVersion}} {{json .OSType}}'` failed. No daemon was started and no development containers were inspected or changed. Exact PostgREST binary/version/hash and immutable image provenance remain unresolved; `httpImagePins` remains `null`. Installed image availability and binary compatibility cannot be established without the daemon. Current official PostgREST error/cache documentation was rechecked; its stable version is documentation evidence only, not a runtime selection.

Fresh results:

| Check | Resumed result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test` | PASS, exit 0: 592 tests / 43 files |
| `pnpm build` | PASS, exit 0: Next.js 16.3.8 production build |
| `pnpm db:test:http` | BLOCKED, exit 1: verified PostgREST image/binary provenance unavailable; stopped before resource intent/creation |
| `pnpm db:test:http:isolation` | BLOCKED, exit 1: same provenance prerequisite; stopped before resource intent/creation |
| `pnpm db:test:concurrency` | BLOCKED, exit 1: isolated Docker info failed before cluster creation |
| `pnpm db:test:isolation` | BLOCKED, exit 1: initial Docker inventory returned exit 1; its existing assertion expected exit 0; stopped before cluster creation |
| `git diff --check` | PASS, exit 0 |
| Real HTTP statuses/errors, pooled identity/logging, cache transitions, internal SQL and runtime cleanup | NOT RUN; no runtime passes claimed |
| SQL / lifecycle / authorization concurrency / real cryptography baselines | NOT RERUN: historical 1,401 / 16 / 130 / 31 remain required |

The full unit suite includes the existing HTTP and PostgreSQL infrastructure tests; unit doubles are not substituted for real HTTP results. Strict 42501/status/header assertions are unchanged. Forced real transport failure during an observed rotation/revocation overlap and forced real cache-reload failure remain outstanding as documented above. Hosted gateway/browser requirements also remain outstanding.

Before this report append, the aggregate SHA-256 of all 323 tracked and nonignored untracked repository files exactly matched the completed read-only audit fingerprint (`7a7448d01cce559c53729fd8edef26e2da31b369661edd15ca03510efb8fc0ad`); the Git index fingerprint also matched. Static checks did not change those source files. Final verification checks the same inventory and empty index after this append.

No runtime resources or new run identifiers were created: the HTTP commands stopped at provenance validation, and the PostgreSQL commands stopped at unavailable Docker before creation. No new runtime cleanup is required. A daemon-wide absence/inventory verification is unavailable and is not claimed. No recovery of historical or other runs was attempted. No development database connection, migration, reset, fixture cleanup, credential discovery, image pull/build, dependency installation, CI edit, staging, commit, push, merge or deployment occurred.

Safest next action: the local operator restores the intended Docker Linux daemon without changing the development stack. Then inspect only necessary image provenance metadata, verify the exact PostgREST executable/version/hash, architecture and runtime compatibility, and present any concrete missing-image pull/build operation for the previously required explicit operator approval. Populate pins only from verified evidence. Resume the owned runtime gates and outstanding real failure probes, record measured HTTP/cleanup results, and obtain independent source review before any Git commit. This resumed checkpoint remains BLOCKED, not complete or release-approved.

## Docker recovery and provenance inspection — 2026-10-10

**Docker recovered; installed PostgREST executable identified; HTTP runtime still BLOCKED pending approved image preparation.** This section supersedes the earlier unavailable-daemon and unidentified-installed-executable findings. No runtime authorization pass is claimed.

Branch/HEAD and the empty index still match the expected baseline. The existing seven modified and twelve untracked HTTP files remain. No implementation, assertion, fixture, Dockerfile or pin was changed; only this report received additional evidence.

### Read-only Docker evidence and existing resources

- Context: `desktop-linux`; endpoint: `npipe:////./pipe/dockerDesktopLinuxEngine`.
- Daemon ID: `cb374f58-5462-4dcb-a911-693e713d916d`.
- Docker Engine/client: `29.8.1`; Docker Desktop: `4.93.0`; server: Linux amd64/x86_64.
- Existing `localTarget()` validation passed, including repository/configuration identity, local endpoint, daemon identity and the unchanged pinned PostgreSQL image.
- Twelve existing containers were inventoried: `supabase_db`, `supabase_studio`, `supabase_pg_meta`, `supabase_edge_runtime`, `supabase_storage`, `supabase_rest`, `supabase_realtime`, `supabase_inbucket`, `supabase_auth`, `supabase_kong`, `supabase_vector`, and `supabase_analytics`, each suffixed `_guild-organizer`. Edge runtime was exited; Vector was restarting; the remaining ten were running. No lifecycle operation was performed on them.
- Four networks: `bridge`, `host`, `none`, `supabase_network_guild-organizer`. Three existing volumes: `supabase_db_guild-organizer`, `supabase_edge_runtime_guild-organizer`, `supabase_storage_guild-organizer`.
- Thirteen installed image rows were inspected. One PostgREST candidate was present; no official Node base or prepared HTTP harness image was present. Exact isolated PostgreSQL/PostgREST ownership-label inventories returned no containers.
- Existing REST container uses the development bridge network, with no mounts and no directly published port. It is not an acceptable test service or namespace parent.

### Actual installed PostgREST provenance

| Evidence | Observed value |
|---|---|
| Installed tag | `public.ecr.aws/supabase/postgrest:v16.3` |
| Immutable repository reference | `public.ecr.aws/supabase/postgrest@sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962` |
| Docker-reported image ID | `sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962` |
| Saved OCI config blob digest | `sha256:c1cd7547cfad75e1f48d05c5b8199ff5d257254da190d55b494143a3d580990d` |
| Executable path | `/bin/postgrest` |
| Actual `--version` output | `PostgREST 16.3` |
| Executable bytes | `20502640` |
| Executable SHA-256 | `0cf367dc2ee47d5c648baa2952e25bdf299de4e1998d31e251bb00d129262d71` |
| ELF | Linux x86-64; no PT_INTERP program header |
| Uncompressed image layer hash | `sha256:2787fe6f1b33b2ffbe3e87dde9928fda30bd011a4ed725a45452c1f5a9ae6707` |

The exact full REST container ID was verified against the installed image. A non-root, read-only `/bin/postgrest --version` invocation made no SQL/HTTP request. `docker cp -L <exact-ID>:/bin/postgrest -` and `docker image save <exact-digest>` were inspected in bounded host memory; no archive or executable was written to disk. The executable extracted from the installed image exactly matched the container executable hash, and the uncompressed layer hash matched image metadata. Initial metadata-template and archive-path diagnostics were corrected without changing resources. No development container environment, credentials, raw logs or database were read. This establishes local image/executable consistency, not an independent publisher signature or reproducible-build attestation.

The official [v16.3 release](https://github.com/PostgREST/postgrest/releases/tag/v16.3) and [version-16 configuration documentation](https://docs.postgrest.org/en/v16/references/configuration.html) were consulted. The observed executable version replaces the earlier comparison-only v14.6 evidence. Exact role/status/header behavior, effective pool logging and schema-cache behavior still require the real pinned harness; they are not inferred from documentation or ELF inspection.

### Missing Node/harness image and exact approval boundary

Read-only registry manifest inspection resolved `docker.io/library/node:24.19.0-bookworm-slim` to Linux amd64 platform manifest `sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174`. Its OCI config digest is `sha256:622f209f6c16ba5af4d9a337cae6577d096f17174b904cfc6a5b0c81a2679c24`; source annotation points to Docker Node commit `fd1bf45c51970427bc899084b5381f6827722246`. The [Dockerfile at that commit](https://raw.githubusercontent.com/nodejs/docker-node/fd1bf45c51970427bc899084b5381f6827722246/24/bookworm-slim/Dockerfile) declares Node `24.19.0` and Debian bookworm-slim. A local image inspection confirmed that the pinned Node image is absent. Registry metadata inspection downloaded no image layers and did not pull, build or tag an image.

The exact next operation requiring explicit local operator approval is:

```powershell
docker pull --platform linux/amd64 docker.io/library/node@sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174
```

**This operation was proposed, not executed.** It adds the missing pinned Node base; it does not start, replace or update any existing container. A subsequent harness build also requires its own concrete operation and explicit approval. Its build context must contain only the Dockerfile, harness and shared contract; do not send repository environment files or credentials. Build with no network and no automatic pulls, using the installed PostgREST digest above, the approved Node digest, version `16.3`, the observed executable SHA-256, and current harness source SHA-256 `64bc4bd73e2de9f6d37d2157564e1ba7f8cf6d645f6598f7cb3654213083c493`. Record and verify the resulting image identity/labels and copied executable before populating pins. Source changes invalidate that hash. Actual execution in the final Node base remains unverified until preparation succeeds.

`httpImagePins` remains `null`; the plain PostgREST image cannot satisfy the required Node harness entrypoint, source/provenance labels or private stdin protocol. No development image was substituted as a Node base. Neither HTTP runtime runner was started in this inspection turn because the missing prepared image cannot pass its prerequisite checks.

### Isolation, ownership, recovery and final status

Reviewed source requires a new independently owned PostgreSQL container with network `none`, no published ports/bind mounts/shared volumes, and an ephemeral database. The HTTP dependent must use `container:<exact-owned-PostgreSQL-full-ID>`, never the development PostgreSQL/REST ID or bridge. Its root is read-only; user is `10001:10001`; all capabilities are dropped; no-new-privileges, private runtime tmpfs, disabled Docker logging and bounded CPU/memory/PIDs are checked. Fresh test credentials remain private stdin/runtime configuration, never development credentials.

Ownership requires durable pre-creation intent, exact IDs/timestamps, daemon/repository/run identities, immutable image/source provenance, labels, namespace/mount/security settings and the owned database system/OID identity. Recovery takes an explicit run ID, refuses active runs, and retains uncertain evidence. Parent cleanup holds the exclusive lock and cannot remove PostgreSQL until the registered sidecar is verified stopped, removed and absent. Version-1 manifests remain supported. These are unchanged reviewed/unit-tested safeguards; new runtime enforcement/recovery results are not claimed.

No test containers, databases, networks, volumes, manifests or run IDs were created. No cleanup/recovery was performed, and existing development resources/data/historical fixtures were untouched. No pull/build/update, dependency installation, migration/reset, staging, commit, push, merge or deployment occurred. Final verification retains the same nineteen-file inventory, empty index and exact HEAD; `git diff --check` passes. Stop for independent review and concrete image-operation approval before runtime continuation.


## Approved isolated HTTP harness build - 2026-10-10 EDT / 2026-10-11 UTC

**BUILD PASS; image identity and executable verification PASS. Runtime HTTP/security gates remain paused and unapproved.** This append supersedes earlier missing Node/harness image findings only. The user explicitly resumed the previously approved isolated image build; no new approval was inferred for runtime tests or implementation changes.

### Verified environment and allowlisted input

- Branch: `feature/phase-6-publishing-sharing`. HEAD: `7dcad86906834475029b20076ffd9697f6f3ab66`. Both matched the requested baseline before and after the build.
- Index empty and unchanged; index-file SHA-256: `341d1f05de3a893b379faf1ce94801c0a9b51f2a6420c195fd963f9f111f35e5`. The seven modified and twelve untracked files were preserved.
- Before this append, every one of the 323 tracked/nonignored untracked repository files had its original SHA-256; no file was added or removed. This append is the sole repository content change in this resumed build turn. Implementation and source pins were not changed.
- Docker context/builder: `desktop-linux`; local Linux daemon `cb374f58-5462-4dcb-a911-693e713d916d`, Engine `29.8.1`, architecture x86_64; builder running, Docker driver, BuildKit `v0.33.0`.
- Both approved base images were already locally present as Linux amd64. Node: `docker.io/library/node@sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174`. PostgREST: `public.ecr.aws/supabase/postgrest@sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962`. Their Docker-reported IDs matched the respective approved digests. No pull or package installation was performed.
- The target tag did not exist immediately before the build. Exactly one build was executed.

Only these three regular files were included; no directory entries, unrelated files, environment files, credentials, build secrets, SSH forwarding or additional contexts were supplied:

| File | Bytes | SHA-256 |
|---|---:|---|
| `scripts/docker/postgrest-http/Dockerfile` | 1609 | `a2045a1a171068a0b8af7c83a6f4c7864f050f5b7d4430fb57bf09751dd33f30` |
| `scripts/docker/postgrest-http/harness.mjs` | 8091 | `f3a11393916b2f7c1d72dbb9443252ea3c22c931efcc3d41ef070a8a14226542` |
| `scripts/postgrest-http-contract.mjs` | 9718 | `4c7fd09d63245fb7e928d6faeac4ce4060c2fa446940ea48c77da9412444b0d8` |

Source SHA-256: `64bc4bd73e2de9f6d37d2157564e1ba7f8cf6d645f6598f7cb3654213083c493`. It was recomputed using the existing `httpSourceHash()` algorithm: ordered script-relative path, NUL, exact file bytes, NUL for each file.

Tar-context SHA-256: `59eec648c50f0461daa066ee582f7ec553c2110b3753cec233c49ec40a09842c`; length 22,528 bytes. Deterministic USTAR headers used the three repository-relative paths in the order above, mode 0644, UID/GID 0, mtime 0, empty owner/group names, regular-file type, 512-byte padding and two trailing zero blocks. Both hashes exactly matched the approval, and were recalculated again immediately before Docker submission.

### Executed command and binary stdin

The exact Docker child-process argument vector renders as:

```text
docker build --builder desktop-linux --platform linux/amd64 --pull=false --network=none --build-arg NODE_IMAGE=docker.io/library/node@sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174 --build-arg POSTGREST_IMAGE=public.ecr.aws/supabase/postgrest@sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962 --build-arg POSTGREST_VERSION=16.3 --build-arg POSTGREST_SHA256=0cf367dc2ee47d5c648baa2952e25bdf299de4e1998d31e251bb00d129262d71 --build-arg SOURCE_SHA256=64bc4bd73e2de9f6d37d2157564e1ba7f8cf6d645f6598f7cb3654213083c493 --file scripts/docker/postgrest-http/Dockerfile --tag guild-organizer-http-test:phase-6-3a-5c-1c-64bc4bd73e2d -
```

The trailing `-` is the tar context input. Host Node generated the verified tar as a `Buffer` in memory and used `spawn("docker", args, {stdio:["pipe","pipe","pipe"], windowsHide:true, shell:false})`, followed by `child.stdin.end(tar)`. No PowerShell text pipeline carried archive bytes, no stdin was omitted, and no tar or executable was written to disk. PowerShell supplied only the orchestration JavaScript to host Node.

Docker exited 0; signal `null`; stdin errors `null`. The COPY steps and the Dockerfile's executable-hash/version verification RUN completed successfully, with RUN networking disabled. BuildKit exported the approved tag and its ordinary build cache/provenance output. Its two `InvalidDefaultArgInFrom` warnings reflect the existing deliberately absent default base-image arguments; the exact pinned values were supplied and successfully resolved. The Dockerfile was preserved.

### Image and executable identity

| Evidence | Verified value |
|---|---|
| Target tag | `guild-organizer-http-test:phase-6-3a-5c-1c-64bc4bd73e2d` |
| Docker-reported image ID | `sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa` |
| Docker-reported local RepoDigest | `guild-organizer-http-test@sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa` |
| OS / architecture | Linux / amd64 |
| Exported platform manifest | `sha256:b9eb0d427566280484bfebd7cac091f0a41f81adfbc21bf762992c6c14a083aa` |
| Exported OCI config blob | `sha256:c9eeb9bd69a08c26c0c90dd4bb6dd3841ebb71c8d5ad6f562aeeea4027673d94` |
| Actual Node version | `v24.19.0` |
| Actual PostgREST output | `PostgREST 16.3`; exit 0 |
| Executable path / bytes | `/usr/local/bin/postgrest` / 20502640 |
| Executable SHA-256 | `0cf367dc2ee47d5c648baa2952e25bdf299de4e1998d31e251bb00d129262d71` |
| UID / GID | 10001 / 10001 |
| Image working directory | `/opt/go-http` |
| Image entrypoint | `["node","/opt/go-http/scripts/docker/postgrest-http/harness.mjs"]`; no CMD arguments |

The Docker-reported ID above is the exported manifest-list/index identity in this Docker image store; it is distinct from the platform manifest and OCI config-blob hashes. The local RepoDigest is not evidence of a registry push; nothing was pushed.

All five `go.http.*` labels exactly matched the approved Node/PostgREST references, version 16.3, executable SHA-256 and source SHA-256. Both copied JavaScript files independently matched the host file hashes listed above.

An explicitly image-identity-only probe ran against the full immutable Docker-reported ID with `--rm --pull=never --network none --read-only --user 10001:10001 --cap-drop ALL --security-opt no-new-privileges --memory 512m --cpus 1 --pids-limit 64 --log-driver none --ipc private --restart no --entrypoint node`. It printed Node's version, hashed the executable/copied files and invoked PostgREST only with `--version`. It did not launch the harness, start a PostgREST listener, make HTTP requests, connect to PostgreSQL or mount development resources. Its full container ID was `556a65bba64da16f71b538cddf5c53b7cb127f9dd694f5e41d519332aee2da76`; subsequent exact-ID inspection confirmed its absence after automatic removal. This probe is not runtime HTTP validation.

### Resource and repository preservation

The following full container IDs, creation timestamps, image IDs and SHA-256 fingerprints of Config, HostConfig, Mounts and network attachments matched before and after. Raw container environment/configuration was neither printed nor saved; only safe identifiers and fingerprints were retained.

| Existing container | Full ID | Identity/configuration |
|---|---|---|
| `supabase_realtime_guild-organizer` | `0df7713e8d1bba2273902f78baa4da58090510c068e6539514f5f20f768fec36` | unchanged |
| `supabase_auth_guild-organizer` | `3b0a20ee3abb85253c0bc01600ed06633f3923c25aece14fac7c75c6aa2a5e9b` | unchanged |
| `supabase_vector_guild-organizer` | `482206a596eccd9ea337a983a43a759b8db8e01d60ca01665a11d1f5ac1b6416` | unchanged |
| `supabase_pg_meta_guild-organizer` | `5a787283f5b53d7849133d22f2c6ef94cbd04d3d0904e1087cd8175b5d66b4a5` | unchanged |
| `supabase_db_guild-organizer` | `6cfbbecb879f21ea1f615a37bcc1031988d9e48761a5b65f6837c0e724598b05` | unchanged |
| `supabase_inbucket_guild-organizer` | `8ef759f03f8381382c597a9085fa76ba0693f8f7c7c35b85b1f38958cd07e7eb` | unchanged |
| `supabase_analytics_guild-organizer` | `aa920937e136b19540816487b6737a41a620bf038025e04f0b36a05c5dddb396` | unchanged |
| `supabase_storage_guild-organizer` | `af9481f10a14aa51ee4bb62f3c750b92a5821c5ae0b52230a578e9545a6cd52d` | unchanged |
| `supabase_edge_runtime_guild-organizer` | `bf2169a10c021f9bced131b46fce62d5341efa2c9fd82c8593167e5451efd895` | unchanged |
| `supabase_kong_guild-organizer` | `caf855f53fccfafae89f5c1afcc6c39372c98c28b7ec087286af8f17f15880a6` | unchanged |
| `supabase_rest_guild-organizer` | `db98e109358a07487c4b495025076a97d74659a1a433dec4e8aa8bb6285005fe` | unchanged |
| `supabase_studio_guild-organizer` | `ee0f5f1709a76557a0d04d54d3d259fbe816557e6319a95f6ed52158d65c46a0` | unchanged |

Aggregate SHA-256 of the ordered stable container records: `38c2dbd5745a3cbaeba1a8d8cbe69dfbd239f7e85a28ce3bc1ab2e42645af8e2`. No existing container was created, removed, stopped, started, reconfigured or executed into by this turn. There were twelve containers before and after. Vector was already restarting/unhealthy; its automatic restart count changed from 12 to 13 and its StartedAt advanced. Its ID and configuration remained unchanged. Edge runtime remained exited; the other ten remained running. This pre-existing Vector condition was not repaired as part of the approved build.

All four network names/full IDs matched, including the existing Supabase network; all three volume names matched. The image inventory gained exactly the approved harness image/tag; no pre-existing image row disappeared or changed, and no other image was added. The version-only probe was removed. Final `go.test.kind` container inventory was empty. Expected image export/build-cache/provenance changes are accounted for; no unexpected persistent container, network, volume or image changes were observed.

No runtime HTTP testing, database migration, development database connection/reset/data change, recovery, fixture cleanup, dependency installation, staging, commit, push, merge or deployment was performed. No test database, PostgreSQL container, runtime manifest or runtime run identifier was created. `scripts/postgrest-http-image.mjs` still exports `null`.

Evidence captured at `C:/Users/Miguel/AppData/Local/Temp/go-http-approved-build-3TJLcp` comprises safe before/after snapshots, the build log/result and identity-only probe result/CID; these temporary evidence files are outside the repository and were not part of the build context.

### Remaining blockers and review stop

There is no remaining image-build blocker. Independent ChatGPT review is the next checkpoint. Runtime HTTP work remains explicitly paused. Verified pins have not been populated; changing them and resuming owned PostgreSQL/HTTP execution requires a subsequent authorized task. Source/version compatibility review, real isolated lifecycle and regression gates, HTTP authorization/pool/cache/internal checks, real failure probes, and hosted gateway/browser validation remain outstanding as described in earlier sections. This build does not confer HTTP-security, release, CI or deployment approval.

**STOP for independent ChatGPT review.** Final Git verification retains the expected branch/HEAD, empty index and the same nineteen-file status inventory; only this report's contents were appended in this turn.

Final post-append verification: all 323 repository files inventoried; the original report prefix is byte-identical, and the report is the only changed file relative to this turn's baseline. Branch/HEAD and the empty index are unchanged; `git diff --check` passes. Container identities/configuration, network/volume inventories and the sole expected image addition were reverified.

Final `git status --short --untracked-files=all`:

```text
 M docs/ARCHITECTURE.md
 M docs/LOCAL_E2E_FIXTURES.md
 M docs/QUALITY_GATES.md
 M package.json
 M scripts/isolated-postgres-test-cluster.mjs
 M scripts/test-isolated-postgres-lifecycle.mjs
 M scripts/test-share-link-concurrency.mjs
?? docs/reviews/PHASE_6_3A_5C_1C_VALIDATION.md
?? scripts/docker/postgrest-http/Dockerfile
?? scripts/docker/postgrest-http/harness.mjs
?? scripts/isolated-postgrest-test-service.mjs
?? scripts/postgrest-http-contract.mjs
?? scripts/postgrest-http-image.mjs
?? scripts/share-link-test-database.mjs
?? scripts/sql/event-share-link-http-bootstrap.sql
?? scripts/sql/event-share-link-http-fixtures.sql
?? scripts/test-isolated-postgrest-lifecycle.mjs
?? scripts/test-share-link-http.mjs
?? src/test/isolated-postgrest-test-service.test.ts
```


## Approved pin configuration and first real HTTP attempt - 2026-10-10 EDT / 2026-10-11 UTC

**STATIC GATES PASS; FIRST AUTHORIZATION-RUN ATTEMPT FAILS AT AUTHENTICATOR SCRAM CONTROLS. NO HTTP AUTHORIZATION RESULT IS CLAIMED.** Independent review of the exact 90,324-byte ZIP was accepted, and the operator authorized the two source edits, the five existing static gates, and exactly one `pnpm db:test:http` attempt. No failure repair or retry was authorized or performed.

### Baseline, source edits and preflight

Branch `feature/phase-6-publishing-sharing`, HEAD `7dcad86906834475029b20076ffd9697f6f3ab66`, and the empty index matched before editing. The nineteen-file inventory matched the independently reviewed archive. The archive SHA-256 remained `d15b45fde1c661c5194ccdcd5be045bb9b3a9df5e91deb269899b1cbfecc0738`; it was not regenerated or replaced.

Only the approved source edits were applied:

- `scripts/postgrest-http-image.mjs`: replaced only the null export with the seven approved immutable pin values. Before SHA-256 `810c446682e0360a5fdf491413e108e616f221893d0f98ab721ad0c8e1213b2b`; after `c7a6ea439f6b1770c8c579fee217102ffeb94632f14db82ea113ca70094d7f55`.
- `src/test/isolated-postgrest-test-service.test.ts`: inserted the explicit Vitest mock exporting null beside the existing mocking setup. Before SHA-256 `d16f51e1b0d4da5561070a212850ec234c93d87b003dc24f06c5072570cb8cd4`; after `f57ddc97cd4821aa9b9e56c2d4a531d02d631c28fecac1de08add775c136b7ff`. Explicit pin-verification tests and all ownership/HTTP/JWT/cleanup assertions were preserved.

Byte-reversal verification confirmed that removing the insertion and restoring the null export exactly recovered the original files. All other 321 repository files remained byte-identical before this documentation append. No dependency, lockfile, application migration, production implementation, historical fixture or CI change occurred. The original header comments in the pin file were preserved with the surrounding bytes; the configured export now selects the approved image.

The real non-mocked `verifyLocalHttpImage()` passed. Harness Docker-reported ID: `sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa`; Linux amd64; tag `guild-organizer-http-test:phase-6-3a-5c-1c-64bc4bd73e2d`. Source SHA-256 remained `64bc4bd73e2de9f6d37d2157564e1ba7f8cf6d645f6598f7cb3654213083c493`. Neither edited file is part of the three-file image context, so no rebuild was needed or performed. The approved Node/PostgREST references, PostgREST version 16.3 and executable SHA-256 labels matched. Version evidence remains the accepted version-only probe for this same immutable image: Node 24.19.0 / PostgREST 16.3; no extra probe container was created.

The approved local `desktop-linux` endpoint/daemon `cb374f58-5462-4dcb-a911-693e713d916d` and pinned PostgreSQL image were available. All twelve development container identities/configurations matched. No existing test containers, incomplete manifests, atomic temporary files or cleanup locks were present. Twenty-nine existing manifests were completed removed tombstones; all passed the manifest validator. The existing manifest directory was local, not a link, and protected by an owner-only Windows ACL. Reviewed creation/network/ownership/recovery code remained unchanged. PostgreSQL creation requires network none, and any sidecar would require only its exact owned PostgreSQL namespace. No development port/network/volume/container/database was selected.

### Static quality gates

| Command | Actual result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test` | PASS, exit 0: 592 tests / 43 files |
| `pnpm build` | PASS, exit 0: Next.js 16.3.8 production build |
| `git diff --check` | PASS, exit 0 |

Every gate completed before runtime preflight and execution. PowerShell formatted native stderr package-command announcements and Git's existing line-ending warnings as diagnostic records; actual process exit statuses above were zero. They were not test failures, and no source line-ending normalization occurred.

### Exactly one runtime attempt and first failure

Command: `pnpm db:test:http`. Attempts: 1. Started `2026-10-11T03:36:54.5203817Z`; finished `2026-10-11T03:38:03.7878895Z`. Exit code: **1**.

The first emitted failure was exactly **`HTTP SCRAM login controls failed`**, at `scripts/test-share-link-http.mjs:50`. The unchanged check requires the wrong-password probe to fail and the correct-password probe to return exactly `authenticator`:

```js
if (await probe(randomBytes(32).toString("hex")) !== null
    || (await probe(password))?.trim() !== "authenticator") {
  httpFail("HTTP SCRAM login controls failed");
}
```

The bounded/sanitized diagnostic does not disclose which subcondition failed; that distinction is **UNRESOLVED**, not inferred. No raw SQL/Docker stderr, password, JWT, signing key, token or response body was exposed. No SQL probe, repair, assertion relaxation or runtime retry was performed after failure.

The owned PostgreSQL cluster reached ready, and its system/database identity was observed. Pre-boundary migration preparation and HTTP bootstrap returned before the failing SCRAM pair. The restricted-authenticator catalog/membership assertion completed; this does not establish a successful authenticator TCP login or an HTTP pooled identity. Execution stopped before fixture installation, crypto/link provisioning, sidecar creation, access-boundary application and HTTP requests.

| Requested runtime behavior | Actual observed result |
|---|---|
| Owned PostgreSQL readiness/identity | PASS: ready manifest and actual running container observed |
| Restricted authenticator SQL catalog/membership control | Completed before the failure |
| Authenticator wrong/correct-password SCRAM pair | FAIL: HTTP SCRAM login controls failed; subcondition unresolved |
| Pre-migration GET / HEAD / POST controls | NOT RUN |
| Post-migration anonymous / signed-anon denial | NOT RUN |
| Post-migration authenticated denial | NOT RUN |
| Post-migration service-role denial | NOT RUN |
| Real HTTP 401 / 403 and SQLSTATE 42501 evidence | NOT OBTAINED |
| HTTP session/pool identity, JWT and role-switch controls | NOT RUN |
| Schema reload / new sentinel / verified cache completion | NOT RUN |
| Cold PostgREST process restart | NOT RUN |
| Internal restricted-role resolver checks | NOT RUN |
| Rotation / revocation HTTP tests | NOT RUN |
| HTTP sidecar creation or cleanup | NOT APPLICABLE: no sidecar was created |
| Owned PostgreSQL cleanup | PASS: exact container absent and manifest removed |

The script printed `Verified HTTP sidecar and PostgreSQL cluster removed.`. That is its generic cleanup-success message. The retained manifest is version 1 with no HTTP dependent, and the failure occurs before `createHttpService()`; **one PostgreSQL container, zero HTTP sidecars** were created. The generic message is not treated as evidence that HTTP ran.

### Exact resources and cleanup evidence

- Run ID: `0c497bd4f46ab58eac19902f7f24e67b`.
- PostgreSQL container: `go-security-pg-0c497bd4f46ab58eac19902f7f24e67b`; full ID `c8ab955c439e4ae516dd12944d4065bc6fe7d83c662aef55358b9b3ec9993249`; creation `2026-10-11T03:36:56.854003624Z`.
- Disposable database: `go_share_test_0c497bd4f46ab58eac19902f7f24e67b`; system identifier `7695249173370187812`; database OID `16663`.
- Live read-only topology inspection observed network `none`, empty published-port bindings, no mounts, and only the configured PostgreSQL-data tmpfs. No development network/storage was shared.
- The script's normal exact-owned-container cleanup completed. A successful daemon-wide full-ID listing after execution proved the exact PostgreSQL ID absent. No test-labelled or test-named container remained.
- Manifest: `C:\Users\Miguel\AppData\Local\guild-organizer-isolated-postgres\1bda25be0a348d032b04574830e8b422b39d1bce2bdfc84c53ab60d0499d5afc\0c497bd4f46ab58eac19902f7f24e67b.json`; validated version 1, phase `removed`, no HTTP dependent. This is a retained secret-free removal tombstone, not an active-resource recovery requirement.
- Sanitized Docker event history corroborated kill/die/destroy of this exact PostgreSQL ID. Docker's retained event history is bounded and did not include the beginning of this attempt; it is not claimed as a complete event trace. Live observations and the ownership manifest establish creation and topology.

No active resources were retained; no explicit recovery or manual force-clean action was needed or attempted.

### Development preservation and review stop

All twelve development Supabase container full IDs, creation timestamps, image IDs, Config/HostConfig hashes, mounts and network attachments matched the starting baseline. Stable aggregate fingerprint remained `38c2dbd5745a3cbaeba1a8d8cbe69dfbd239f7e85a28ce3bc1ab2e42645af8e2`. Four networks, three volumes and the complete image inventory were unchanged. Edge runtime remained exited; Vector remained restarting/unhealthy and its existing automatic restart count advanced from 83 to 89; the other ten remained running. No lifecycle action was issued against any development container.

No image pull/build, development database migration/reset, historical fixture modification, additional HTTP/SQL/concurrency/lifecycle suite, stage, commit, push, merge or deployment occurred. The access-boundary migration was not applied to the development database, and its application point in this isolated HTTP attempt was not reached. Existing reviewed assertions were not weakened.

Safe evidence/logs are retained outside the repository at `C:/Users/Miguel/AppData/Local/Temp/go-http-first-validation-Khbp0b`. Static results, runtime exit/failure, live topology observation, sanitized event identifiers, removed ownership manifest and before/after fingerprints are recorded. The original review ZIP remains preserved as the reviewed pre-edit snapshot.

**STOP for independent review.** The SCRAM-control failure requires investigation in a separately authorized task before another runtime attempt. HTTP security, pool, cache, internal-role, rotation/revocation and runtime sidecar gates remain unvalidated.


## Diagnostic-only HTTP SCRAM precheck - 2026-10-10 local / 2026-10-11 UTC

### Verified preconditions

Branch `feature/phase-6-publishing-sharing`; HEAD `7dcad86906834475029b20076ffd9697f6f3ab66`. Index empty and byte-for-byte unchanged. All 323 tracked/nonignored file hashes initially matched the prior accepted pin/mock/report checkpoint. Inventory remained 7 modified tracked files and 12 untracked HTTP implementation/report files. Only the runner's diagnostic precheck was edited before testing; this report is appended after actual results.

Docker context `desktop-linux`; local Linux endpoint `npipe:////./pipe/dockerDesktopLinuxEngine`; daemon ID `cb374f58-5462-4dcb-a911-693e713d916d`. Harness tag `guild-organizer-http-test:phase-6-3a-5c-1c-64bc4bd73e2d` stayed Linux/amd64, exact ID `sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa`. PostgreSQL remained pinned to `public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9`, ID `sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9`. The actual runner's exact HTTP image/provenance verification passed before and after execution, including the accepted base-image/executable/version labels. Harness source SHA-256 remained `64bc4bd73e2de9f6d37d2157564e1ba7f8cf6d645f6598f7cb3654213083c493`. No image pull, build or replacement occurred.

Previous run `0c497bd4f46ab58eac19902f7f24e67b` had a validated `removed` tombstone and its exact container was absent. All 30 existing manifests were removal tombstones; no temporary manifest, cleanup lock or active test-labelled/named container remained. All development resource identities/configurations matched the previous checkpoint and this task's baseline.

Source review confirmed PostgreSQL uses `--network none`, no host ports or bind/named-volume mounts, and only its disposable data tmpfs. The HTTP sidecar arguments use `--network container:<owned PostgreSQL ID>`, its private runtime tmpfs and no published ports. Manifest/database/container/daemon identity checks, cleanup refusal for uncertain ownership and exact-run recovery remain intact. Recovery was not invoked. No development target is selected by these helpers.

### Exact diagnostic-only code change

Only `scripts/test-share-link-http.mjs` precheck lines 50-83 changed. Originally, one `negative || positive` assertion emitted an indistinguishable message for either failure and could skip the positive probe when the negative condition failed. Now both probes complete independently; eight safe findings and separate failures identify each condition. Both probes still target `postgres`; eventual PostgREST still targets `cluster.record.database`.

Added SQL runs in `BEGIN READ ONLY` through the existing owned-cluster SQL method after database identity verification. It returns only allowlisted booleans for LOGIN, CONNECT, password expiry and HBA/reload checks. No password, password verifier, JWT, connection string or raw sensitive stderr is emitted. The exact replacement is:

```js
    // Read-only diagnostics use the verified owned cluster; never select secret fields.
    cluster.verifyDatabase();
    const diagnostics=JSON.parse(cluster.rawSql("postgres",`begin read only;
      select json_build_object(
        'loginEnabled', (select rolcanlogin from pg_roles where rolname='authenticator'),
        'connectPostgres', has_database_privilege('authenticator','postgres','CONNECT'),
        'connectDisposable', has_database_privilege('authenticator',${literal(database)},'CONNECT'),
        'accountExpired', (select coalesce(rolvaliduntil < current_timestamp,false) from pg_roles where rolname='authenticator'),
        'loopbackScramVerified',
          not exists(select 1 from pg_hba_file_rules where error is not null)
          and (select count(*) from pg_hba_file_rules)=4
          and exists(select 1 from pg_hba_file_rules where rule_number=2 and type='host'
            and database=array['all']::text[] and user_name=array['all']::text[]
            and address='127.0.0.1' and netmask='255.255.255.255' and auth_method='scram-sha-256')
          and pg_read_file(current_setting('hba_file'))=E'local all all trust\nhost all all 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n'
          and pg_conf_load_time() >= (pg_stat_file(current_setting('hba_file'))).modification
      );commit;`));
    if(!exactKeys(diagnostics,["loginEnabled","connectPostgres","connectDisposable","accountExpired","loopbackScramVerified"])
      || ["loginEnabled","connectPostgres","connectDisposable","loopbackScramVerified"].some(k=>typeof diagnostics[k]!=="boolean")
      || (diagnostics.accountExpired!==null && typeof diagnostics.accountExpired!=="boolean"))httpFail("HTTP SCRAM diagnostics unavailable");
    // Run both controls independently; neither result can short-circuit the other.
    const wrongPasswordAccepted=await probe(randomBytes(32).toString("hex"))!==null;
    const correctPasswordAuthenticated=(await probe(password))?.trim()==="authenticator";
    const yesNo=value=>value?"YES":"NO";
    console.log(`Wrong password unexpectedly accepted: ${yesNo(wrongPasswordAccepted)}`);
    console.log(`Correct password successfully authenticated as authenticator: ${yesNo(correctPasswordAuthenticated)}`);
    console.log("Probe database target: postgres");
    console.log(`Authenticator LOGIN enabled: ${yesNo(diagnostics.loginEnabled)}`);
    console.log(`Authenticator connection permitted to postgres database: ${yesNo(diagnostics.connectPostgres)}`);
    console.log(`Authenticator connection permitted to disposable test database: ${yesNo(diagnostics.connectDisposable)}`);
    console.log(`Authenticator account expired: ${diagnostics.accountExpired===null?"UNKNOWN":yesNo(diagnostics.accountExpired)}`);
    console.log(`Effective loopback HBA SCRAM configuration verified: ${yesNo(diagnostics.loopbackScramVerified)}`);
    if(wrongPasswordAccepted)httpFail("HTTP SCRAM negative-password control failed: wrong password unexpectedly accepted");
    if(!correctPasswordAuthenticated)httpFail("HTTP SCRAM positive-password control failed: correct password did not authenticate as authenticator");
```

Runner before SHA-256: `43d80971e90c05c61f26cf0c506fc7727b7e82e928315f3051bc0c0843d57a81`; after: `00588e99ed6e846cd7e09899f4891571f36fdcd45fffb4269960a62c47d8c7c4`. Reversing this single replacement reproduces the original file bytes. The probe implementation, bootstrap SQL, cluster helper, harness, role privileges/authentication settings, migrations, historical fixtures, HTTP/JWT/SQLSTATE/ownership/cleanup assertions and other implementation files were preserved.

### Static validation

| Command | Observed result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test` | PASS, exit 0; 592 tests / 43 files |
| `git diff --check` | PASS, exit 0 |

All gates passed before runtime. No build or extra SQL/concurrency/lifecycle suite was run. Native package-command stderr announcements and existing Git line-ending warnings did not alter the observed zero exit codes.

### Single runtime attempt and measured findings

Command `pnpm db:test:http`; attempts **1**; exit **1**. Started `2026-10-11T03:52:52.0994195Z`; finished `2026-10-11T03:54:08.9657281Z`.

| Diagnostic | Observed result |
|---|---|
| Wrong password unexpectedly accepted | NO |
| Correct password successfully authenticated as authenticator | NO |
| Probe database target | postgres |
| Authenticator LOGIN enabled | YES |
| Authenticator connection permitted to postgres database | YES |
| Authenticator connection permitted to disposable test database | YES |
| Authenticator account expired | NO |
| Effective loopback HBA SCRAM configuration verified | YES |

First failure: **`HTTP SCRAM positive-password control failed: correct password did not authenticate as authenticator`**, `scripts/test-share-link-http.mjs:83`. The wrong-password command was rejected. The correct-password command did not satisfy successful `authenticator` identity. Both probes were executed; the negative acceptance condition was false and the positive success condition was false. No raw sensitive error was exposed or inspected.

LOGIN is enabled, password validity is not expired and CONNECT is permitted on both `postgres` and `go_share_test_bed0b7ff5b421d149d8443fbdb915409`. The database target difference exists in source, but the proposed **CONNECT-permission mismatch is rejected by the measured privileges**. A target change is not a demonstrated correction. Root cause remains unresolved: the helper collapses any process/nonzero failure to null, while unexpected identity on a zero-exit result would also fail. These results cannot distinguish password handshake failure from session-startup, transport or query failure and do not establish that the positive password itself is wrong.

The HBA flag was YES: exact four-rule contents, parsed loopback SCRAM rule, absence of parse errors and reload timestamp after file modification matched. Cluster startup had passed its existing real wrong/correct-password controls for the PostgreSQL role. The rule view alone reports disk contents rather than the last-loaded configuration; file/reload checks and the real startup controls corroborate the configuration but do not prove authenticator login. See [PostgreSQL 17 HBA rules](https://www.postgresql.org/docs/17/view-pg-hba-file-rules.html), [role attributes](https://www.postgresql.org/docs/17/view-pg-roles.html) and [privilege/reload functions](https://www.postgresql.org/docs/17/functions-info.html).

Stage reached: cluster ready and identity verified; pre-access-boundary migration preparation, HTTP bootstrap and restricted-authenticator catalog/membership checks completed. Execution stopped before HTTP fixtures, link/JWT provisioning, sidecar creation, boundary application or any HTTP request. HTTP GET/HEAD/POST controls, anonymous/authenticated/service-role denials, actual 401/403/42501 evidence, HTTP session controls, cache/sentinel reload, cold restart, internal restricted-role resolver validation and rotation/revocation are **NOT RUN / NOT OBTAINED**. Missing tests are not passed.

### Owned resources and cleanup

- Run ID: `bed0b7ff5b421d149d8443fbdb915409`.
- Container: `go-security-pg-bed0b7ff5b421d149d8443fbdb915409`; full ID `e62b6f64ddc3d38e2a689766e06fc5ed9bf82af487c734c2cfdcfcb7e606c622`.
- Disposable database: `go_share_test_bed0b7ff5b421d149d8443fbdb915409`; system identifier `7695253284342550564`; database OID `16663`.
- Live ownership verification observed approved image, network `none`, empty port bindings, no bind mounts and only PostgreSQL-data tmpfs. No development network/mount/volume was shared.
- One PostgreSQL container, zero HTTP sidecars were created. The generic cleanup-success message does not prove HTTP execution; the manifest is version 1 with no HTTP dependent.
- Normal verified cleanup completed. A successful daemon-wide full-ID listing proved the exact PostgreSQL ID absent; no test-labelled/named container remains.
- Retained validated removal tombstone: `C:\Users\Miguel\AppData\Local\guild-organizer-isolated-postgres\1bda25be0a348d032b04574830e8b422b39d1bce2bdfc84c53ab60d0499d5afc\bed0b7ff5b421d149d8443fbdb915409.json`, phase `removed`. All 31 manifests validate as removal tombstones, with no ambiguous cleanup/temporary residue. No active resources are retained, and manual force-clean/recovery was neither required nor attempted.

### Development preservation and next step

All 12 development container full IDs, creation timestamps, image IDs, Config/HostConfig hashes, mounts and network attachments matched baseline. Stable aggregate fingerprint `38c2dbd5745a3cbaeba1a8d8cbe69dfbd239f7e85a28ce3bc1ab2e42645af8e2`; four networks, three volumes and all 15 image inventory rows unchanged. Edge remained exited; Vector kept its pre-existing restarting/unhealthy state and automatic restart count advanced 98 to 104; the other ten remained running. No development lifecycle operation or database SQL/migration/reset was performed. All migration/fixture source bytes stayed intact.

No evidence-based authentication/configuration correction is established. The smallest recommended next authorized diagnostic change is to distinguish process failure/nonzero exit from unexpected successful identity for this same positive probe, returning only numeric exit status and/or a strictly allowlisted failure class/SQLSTATE without raw stderr. Read-only safe checks of relevant role/database startup settings and a boolean indicating SCRAM verifier presence could then be considered, without exposing any verifier. This recommendation was **not applied**. CONNECT grants, probe target, password/settings and security assertions remain unchanged; no retry occurred.

Safe evidence/logs are outside the repository at `C:/Users/Miguel/AppData/Local/Temp/go-http-scram-diagnostic-coFX0z`. The accepted 90,324-byte review ZIP remains unchanged. Only this runner precheck and this report append differ from this task's starting 323-file baseline. No image download/build, extra runtime suite, stage, commit, push, merge or deployment occurred.

Final `git status --short --untracked-files=all`:

```text
 M docs/ARCHITECTURE.md
 M docs/LOCAL_E2E_FIXTURES.md
 M docs/QUALITY_GATES.md
 M package.json
 M scripts/isolated-postgres-test-cluster.mjs
 M scripts/test-isolated-postgres-lifecycle.mjs
 M scripts/test-share-link-concurrency.mjs
?? docs/reviews/PHASE_6_3A_5C_1C_VALIDATION.md
?? scripts/docker/postgrest-http/Dockerfile
?? scripts/docker/postgrest-http/harness.mjs
?? scripts/isolated-postgrest-test-service.mjs
?? scripts/postgrest-http-contract.mjs
?? scripts/postgrest-http-image.mjs
?? scripts/share-link-test-database.mjs
?? scripts/sql/event-share-link-http-bootstrap.sql
?? scripts/sql/event-share-link-http-fixtures.sql
?? scripts/test-isolated-postgrest-lifecycle.mjs
?? scripts/test-share-link-http.mjs
?? src/test/isolated-postgrest-test-service.test.ts
```

**STOP for independent ChatGPT review.** Positive authenticator login remains the blocker; no further correction or runtime attempt was performed.


## SCRAM root-cause diagnosis checkpoint - 2026-10-11 UTC

### Baseline and isolation

Branch `feature/phase-6-publishing-sharing`; HEAD `7dcad86906834475029b20076ffd9697f6f3ab66`; empty index, index bytes unchanged. Starting 323 tracked/nonignored files matched the accepted previous checkpoint. Previous run `bed0b7ff5b421d149d8443fbdb915409` had a valid `removed` tombstone and its exact container was absent. All 31 pre-existing manifests were valid removal tombstones, without temporary/cleanup-lock residue or active test-labelled/named containers.

Approved local Linux Docker context `desktop-linux`, endpoint `npipe:////./pipe/dockerDesktopLinuxEngine`, daemon ID `cb374f58-5462-4dcb-a911-693e713d916d`. Harness tag `guild-organizer-http-test:phase-6-3a-5c-1c-64bc4bd73e2d` remained Linux/amd64 with exact ID `sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa`. Existing runner provenance verification passed before and after execution; pinned PostgreSQL ID/digest, base-image/executable/version labels and harness source SHA-256 `64bc4bd73e2de9f6d37d2157564e1ba7f8cf6d645f6598f7cb3654213083c493` stayed unchanged. No image was pulled or built.

### Exact diagnostic code changes

1. Added `scripts/scram-probe-diagnostics.mjs`: an allowlisted classifier, an owned-container-only diagnostic probe, read-only role/configuration inspection, and fail-closed probe assertions. The classifier returns only `processState`, numeric/null `exitCode`, allowlisted/null `sqlState`, fixed `category`, allowlisted/null `parameter`, fixed `output` shape and boolean `credentialDelivered`. No raw output escapes this helper.
2. The diagnostic probe retains `postgres`, loopback, `authenticator`, `psql -X -qAt -w` and `select current_user`. It adds psql verbose/ON_ERROR_STOP flags for diagnostic visibility, C locale for fixed message recognition, a 180-second process timeout and a 1-MiB capture bound. Raw output exists only transiently in memory. Buffer input/stdout/stderr are zeroed in `finally`.
3. Credential input remains a UTF-8 Buffer through Docker child-process stdin. A transient digest follows the password on stdin, is compared with the shell-read password in memory, and yields only the fixed delivery marker. Neither credential nor digest appears in argv, ordinary logs, repository files or persistent environment configuration. PGPASSWORD exists only in the executed child, as in the existing probe.
4. Role inspection uses `BEGIN READ ONLY` through existing verified owned-cluster SQL. It checks LOGIN, connection limit/current count, validity deadline, a boolean SCRAM-format verifier check, database availability/CONNECT/limits, and safe startup-setting metadata. Verifier contents and setting values are never selected into the returned JSON. Unknown setting names/values are represented only by a count. Catalog output is shape/type/allowlist-validated before logging.
5. Updated `scripts/test-share-link-http.mjs` with exactly four insertions/replacements: diagnostic-module import; optional `diagnosticOnly=false` parameter; branch after existing HBA diagnostics and before HTTP fixtures; strict CLI handling of `--diagnose-scram`. The branch runs both diagnostic probes, prints safe metadata, enforces both controls and returns before HTTP setup even if they pass. Failure uses the same normal owned-resource cleanup. The original full HTTP probes/assertions and Docker helper remain unchanged.
6. Added `src/test/scram-probe-diagnostics.test.ts`: 23 tests for spawn/timeout/process failure versus authentication rejection, allowlisted SQLSTATE/category/setting name, expected/empty/unexpected identity, nonleaking diagnostics, exact-owned execution, binary stdin and buffer clearing, malformed catalog refusal, negative rejection, and mocked passing/failing diagnostic paths that both clean up without creating a sidecar.

Runner SHA-256 before `00588e99ed6e846cd7e09899f4891571f36fdcd45fffb4269960a62c47d8c7c4`; after `c165b1a9598c10d7a2dd064ff8c711db677ba5ac0608dda2fdd8433369caeb4f`. Reversing the four edits reproduces the prior runner bytes. Current diagnostic source hashes:

| File | SHA-256 |
|---|---|
| scripts/test-share-link-http.mjs | c165b1a9598c10d7a2dd064ff8c711db677ba5ac0608dda2fdd8433369caeb4f |
| scripts/scram-probe-diagnostics.mjs | 115866cca9adb3700122475d28e76b0c3224a5ebc0c1321b7225efe4120d778a |
| src/test/scram-probe-diagnostics.test.ts | 1915b1fc70b043827969da8c70d24ab9a9ae12f8c34873233b75ea8b59b1ec06 |

Unchanged normal infrastructure initialized its new disposable cluster, synthetic credential and existing HTTP bootstrap exactly as before. The diagnostics added no role/privilege/password/HBA/configuration writes. Bootstrap SQL, migrations, fixtures, image pins, contract/harness sources, existing tests and ownership/cleanup protections were preserved.

### Static validation

| Check | Final result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test` | PASS, exit 0; 615 tests / 44 files, including all prior 592 tests |
| `git diff --check` | PASS, exit 0 |

Initial TypeScript validation returned exit 2 because the new injected test executor inherited the entire overloaded spawnSync type. A narrow explicit executor type annotation corrected that diagnostic/test interface; final TypeScript validation passed. No authentication or assertion correction was made. No production build or extra database/lifecycle/concurrency suite ran.

### Exactly one diagnostic-only execution

Command: `node scripts/test-share-link-http.mjs --diagnose-scram`. Attempts **1**. Start `2026-10-11T04:23:58.6084779Z`; finish `2026-10-11T04:25:20.2869789Z`; runner exit **1**. The full `pnpm db:test:http` suite was not executed.

| Probe field | Negative password | Positive password |
|---|---|---|
| Process state | completed | completed |
| Docker exec / child exit code | 2 | 2 |
| Safe category | password-authentication-rejected | unclassified-process-failure |
| SQLSTATE directly obtained | UNAVAILABLE | UNAVAILABLE |
| Output shape | empty | empty |
| Exact stdin credential delivery verified | YES | YES |
| Expected authenticator identity | NO | NO |

Negative rejection is established by completed nonzero execution plus the allowlisted password-authentication-rejection message. Positive execution completed with exit 2 and empty stdout; its transient stderr matched none of the implemented safe categories. It is **unclassified**, not treated as password mismatch, permission denial, successful authentication or SQL execution success. No directly exposed allowlisted SQLSTATE was available; none was inferred. psql documents exit 2 as a connection-related failure, but this exit alone does not identify the exact server rejection. See [PostgreSQL 17 psql exit statuses](https://www.postgresql.org/docs/17/app-psql.html#APP-PSQL-EXIT-STATUS).

First runner failure: **`Diagnostic positive-password authenticator login failed`**, at the diagnostic control invoked from `scripts/test-share-link-http.mjs:74`. Both probes completed. Normal cluster readiness, owned database identity, pre-boundary migration preparation and existing HTTP bootstrap completed. No HTTP fixtures, tokens/JWT provisioning, PostgREST sidecar, access-boundary application or HTTP request was reached. All HTTP security/cache/session/rotation/revocation assertions remain unvalidated.

### Read-only role and database findings

- LOGIN: YES.
- Role connection limit: -1; current authenticator sessions: 0. No finite role limit was present.
- Validity deadline: NULL (no password expiration); existing expiry check returned NOT EXPIRED.
- SCRAM-format verifier configured: YES. This confirms format/presence, not equality with the intended password; the verifier was not returned.
- Effective loopback SCRAM verification: YES, using the existing exact-file/rule/error/reload-timestamp checks. Existing cluster-startup wrong/correct PostgreSQL-role SCRAM controls passed before readiness. No reload/configuration change was added.

| Database target | Accepts connections | CONNECT permitted | Connection limit | Active connections at catalog snapshot |
|---|---|---|---|---|
| disposable | YES | YES | -1 | 0 |
| postgres | YES | YES | -1 | 3 |

Both databases are eligible and unlimited at the measured snapshot. The CONNECT mismatch and finite role/database connection-limit hypotheses are not supported. Exact delivery is verified; no spawn failure, timeout, termination, successful unexpected-output condition or expected identity was observed. The positive probe did not classify as connection refusal, authentication rejection, database permission rejection or query error, but **failure to match a category does not rule out an unrecognized form of those errors**.

Role-specific startup-setting findings (no values emitted):

| Setting | Scope | Stored value matches intended bootstrap literal | Recognized | Context | SET ACL flag |
|---|---|---|---|---|---|
| idle_in_transaction_session_timeout | role | YES | YES | user | NO |
| local_preload_libraries | role | NO | YES | user | NO |
| log_duration | role | YES | YES | superuser | NO |
| log_min_duration_sample | role | YES | YES | superuser | NO |
| log_min_duration_statement | role | YES | YES | superuser | NO |
| log_min_error_statement | role | YES | YES | superuser | NO |
| log_min_messages | role | YES | YES | superuser | NO |
| log_parameter_max_length | role | YES | YES | superuser | NO |
| log_parameter_max_length_on_error | role | YES | YES | user | NO |
| log_statement | role | YES | YES | superuser | NO |
| log_statement_sample_rate | role | YES | YES | superuser | NO |
| log_transaction_sample_rate | role | YES | YES | superuser | NO |
| pg_stat_statements.track | role | YES | YES | superuser | NO |
| session_preload_libraries | role | NO | YES | superuser | NO |
| statement_timeout | role | YES | YES | user | NO |

Unlisted relevant startup settings: **1**; names/values were suppressed. The two preload settings' stored values differ from the intended empty bootstrap strings. All 13 other allowlisted setting values match. All measured SET ACL flags are false; these flags do not by themselves prove that startup application or ordinary user-context setting changes are forbidden, so no role-permission cause is asserted.

### Root cause and smallest proposed next step

**Root cause remains UNKNOWN.** The positive failure is now separated from incorrect stdin delivery, spawn failure, timeout and unexpected successful output, but its server/client error is outside this classifier's allowlist. Raw material was intentionally not retained, and the removed cluster cannot be queried again. No retry occurred.

The strongest remaining source-review hypothesis concerns preload list representation. Existing bootstrap uses SQL `ALTER ROLE ... SET session_preload_libraries = ''` and the corresponding local setting. PostgreSQL 17.6 marks these as quoted list inputs; the SQL argument-flattening code quotes non-identifier string literals, so a quoted empty SQL item can differ from a truly empty GUC list. PostgreSQL documents failed session/local library loads as connection failures. This is an **inference from upstream source and the measured preload mismatches**, not proof that it caused this image's observed positive failure. The diagnostic did not return the parsed preload-list shape or a library-load classification. See [17.6 SQL GUC argument handling](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/utils/misc/guc_funcs.c), [17.6 GUC definitions](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/utils/misc/guc_tables.c) and [PostgreSQL preload behavior](https://www.postgresql.org/docs/17/runtime-config-client.html#RUNTIME-CONFIG-CLIENT-PRELOAD).

No authentication/configuration correction is justified as confirmed by this attempt. The smallest proposed follow-up is another separately approved diagnostic change that classifies known library-access/load failures and returns only safe booleans distinguishing an empty preload list from a quoted empty list item, plus safe metadata for the one omitted startup setting. If that establishes an empty-list serialization failure, a narrowly scoped isolated-bootstrap change to store a true empty preload value could be proposed without changing SCRAM/HBA, passwords, privileges or denial assertions. **No such change was applied.**

### Resources, cleanup and development preservation

- Run ID `e6e7b65d9c1c75a395ac9f45adc67230`.
- PostgreSQL container `go-security-pg-e6e7b65d9c1c75a395ac9f45adc67230`, full ID `f3a0ba3016d7b5771a6fbbb276303d6376a4b87fdc5d36a3b1bfffe03c4986fb`.
- Owned disposable database `go_share_test_e6e7b65d9c1c75a395ac9f45adc67230`; system ID `7695261303339020324`; database OID `16663`.
- Live verified container topology: `network=none`, empty port bindings, no binds/shared mounts and only its disposable PostgreSQL-data tmpfs. No development network or storage was shared.
- One PostgreSQL container, zero HTTP sidecars. Existing verified cleanup completed; successful full-ID Docker listing proved the exact container absent, and no test-labelled/named container remained.
- Secret-free validated tombstone `C:\Users\Miguel\AppData\Local\guild-organizer-isolated-postgres\1bda25be0a348d032b04574830e8b422b39d1bce2bdfc84c53ab60d0499d5afc\e6e7b65d9c1c75a395ac9f45adc67230.json`: version 1, phase `removed`, no HTTP dependent. All 32 manifests are removal tombstones; no cleanup lock or temporary manifest remains. No retained active resources or manual recovery/force cleanup.
- All 12 development Supabase container full IDs, creation timestamps, image IDs, Config/HostConfig hashes, mount hashes and network attachments matched baseline. Aggregate fingerprint `38c2dbd5745a3cbaeba1a8d8cbe69dfbd239f7e85a28ce3bc1ab2e42645af8e2`; four networks, three volumes and all 15 image inventory rows unchanged.
- Edge remained exited; Vector's pre-existing restarting/unhealthy condition continued, with its automatic restart count 128 to 136 by the post-run inspection. Other ten containers remained running. No development SQL or lifecycle operation was issued.
- All original source bytes except the four approved diagnostic-path edits are preserved. New files are the diagnostic module and unit test. This report's prior bytes are retained as an unchanged prefix. The original review ZIP was not modified. No stage, commit, push, merge, deployment, image pull/build or additional runtime suite occurred.

Safe evidence/logs: `C:/Users/Miguel/AppData/Local/Temp/go-http-scram-root-cause-xZt6TE` outside the repository. Persistent artifacts contain safe classifications, catalog metadata, hashes and ownership evidence; raw stderr/password/digest/verifier material was not persisted.

Final `git status --short --untracked-files=all`:

```text
 M docs/ARCHITECTURE.md
 M docs/LOCAL_E2E_FIXTURES.md
 M docs/QUALITY_GATES.md
 M package.json
 M scripts/isolated-postgres-test-cluster.mjs
 M scripts/test-isolated-postgres-lifecycle.mjs
 M scripts/test-share-link-concurrency.mjs
?? docs/reviews/PHASE_6_3A_5C_1C_VALIDATION.md
?? scripts/docker/postgrest-http/Dockerfile
?? scripts/docker/postgrest-http/harness.mjs
?? scripts/isolated-postgrest-test-service.mjs
?? scripts/postgrest-http-contract.mjs
?? scripts/postgrest-http-image.mjs
?? scripts/scram-probe-diagnostics.mjs
?? scripts/share-link-test-database.mjs
?? scripts/sql/event-share-link-http-bootstrap.sql
?? scripts/sql/event-share-link-http-fixtures.sql
?? scripts/test-isolated-postgrest-lifecycle.mjs
?? scripts/test-share-link-http.mjs
?? src/test/isolated-postgrest-test-service.test.ts
?? src/test/scram-probe-diagnostics.test.ts
```

**STOP for independent ChatGPT review.** Root cause remains unresolved; no correction or second diagnostic execution was performed.

## Controlled preload authentication checkpoint — 2026-10-11 UTC

**STOPPED before the conditional RESET experiment. Malformed empty preload entries are confirmed; the corrective authentication experiment is incomplete. This checkpoint does not approve HTTP security or a permanent bootstrap correction.**

### 1. Git baseline and initial state

Read-only checks confirmed branch `feature/phase-6-publishing-sharing`, exact HEAD `7dcad86906834475029b20076ffd9697f6f3ab66`, and an empty Git index. Baseline evidence was recorded at `2026-10-11T12:50:32.036Z`. All 325 tracked/nonignored files were hashed before execution; the initial status is identical to the final status reproduced below. Existing implementation and diagnostic files were preserved.

Docker Desktop Linux context `desktop-linux`, endpoint `npipe:////./pipe/dockerDesktopLinuxEngine`, daemon ID `cb374f58-5462-4dcb-a911-693e713d916d` matched the approved local target. All 32 previous manifests validated as removal tombstones with no lock/temporary residue; their exact PostgreSQL/HTTP container IDs were absent. Previous diagnostic run `e6e7b65d9c1c75a395ac9f45adc67230` was confirmed removed. The initial full container inventory consisted exclusively of the 12 development Supabase containers.

The existing provenance verifier passed before and after execution. Immutable identities remained:

| Artifact | Verified identity |
|---|---|
| PostgreSQL image digest/config ID | `sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9` |
| HTTP harness image config ID | `sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa` |
| PostgREST base digest/config ID | `sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962` |
| Node base digest/config ID | `sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174` |
| Harness source SHA-256 | `64bc4bd73e2de9f6d37d2157564e1ba7f8cf6d645f6598f7cb3654213083c493` |
| Recorded PostgREST executable SHA-256/version labels | `0cf367dc2ee47d5c648baa2952e25bdf299de4e1998d31e251bb00d129262d71` / `16.3` |

The temporary preflight initially rejected Docker's shortened `node@…` repository alias. Read-only inspection resolved it as the equivalent `docker.io/library/node@…` identity with the exact approved digest and Linux/amd64 platform. Only that temporary alias check was corrected, before cluster creation. No image was substituted, pulled, built, or executed to remeasure the PostgREST executable; its existing provenance labels were verified.

### 2. Original preload classifications

Only the new manifest-owned disposable cluster was queried. Setup reused the existing `createIsolatedCluster`, `cluster.start`, `prepareShareLinkTestDatabase`, and `installHttpBootstrap` functions. Initial fresh disposable credentials/HBA were installed by these existing setup functions; no password, HBA, membership, CONNECT privilege, or other setting was changed after the baseline snapshot.

Read-only catalog queries returned fixed categories rather than raw configuration values:

| Setting | Authenticator role override | Database-specific role override | Effective fresh administrative session, both databases | Administrative reset value, both databases |
|---|---|---|---|---|
| `session_preload_libraries` | `quoted-empty-item` | Absent | `other-nonempty` | `other-nonempty` |
| `local_preload_libraries` | `quoted-empty-item` | Absent | `true-empty` | `true-empty` |

`quoted-empty-item` means the stored value consists of one double-quoted empty list item, rather than a truly empty library list. Both authenticator overrides had this representation at database scope `all`. The other three roles configured by the unchanged HTTP bootstrap also had the same two quoted-empty entries. No database-specific preload override was found for any role or for all roles.

The effective-session observations above belong to fresh `supabase_admin` sessions in `postgres` and the disposable database. **An effective authenticator session could not be inspected because the positive login failed.** No library identity was emitted for the nonempty administrative setting, and no claim is made that this category identifies an audit hook or proves what an authenticator session would inherit after RESET.

### 3–4. Baseline authentication and safe failure classifications

The existing `diagnosticScramProbe` ran once per credential, with its unchanged loopback target, `authenticator` login, `postgres` database, stdin credential delivery, and `select current_user` query. The temporary coordinator supplied an execution wrapper that classified library failures before the existing helper erased captured buffers. Only constants/booleans escaped that transient capture; raw stderr, credentials, delivery hashes, and verifiers were not persisted.

| Probe | Exit | Existing category | Supplemental library category | Empty library name | Credential delivered | Output shape |
|---|---|---|---|---|---|---|
| Incorrect password | 2 | `password-authentication-rejected` | `none` | NO | YES | `empty` |
| Correct password | 2 | `unclassified-process-failure` | `library-file-not-found` | YES | YES | `empty` |

Both processes completed normally. SQLSTATE remained `null` in both existing and supplemental classifications: no SQLSTATE was parsed from the actual connection diagnostic, and none was inferred from its message. No retry was made. The supplement recognized only a fixed fatal file-access/load message shape and the boolean presence of an empty library name.

Authenticator LOGIN was enabled; its connection limit was `-1`, validity unrestricted, SCRAM verifier configured, and active authenticator connections zero at the catalog snapshot. Both databases accepted connections, permitted authenticator CONNECT, and had unlimited database connection limits. All 13 other allowlisted role-setting values matched their bootstrap literals; one unlisted setting remained suppressed.

A server-side fingerprint compared role attributes/verifiers, memberships, database metadata/ACLs, parameter ACLs, nonexperimental role settings, HBA contents, and administrative effective configuration before/after the baseline. Fingerprints remained equal and were compared only in coordinator memory. Preload classifications also remained identical. The initial cluster startup's existing PostgreSQL-role SCRAM controls passed; authenticator acceptance did not pass.

### 5–8. Conditional experiment, executed SQL, and hypothesis status

The measured quoted-empty overrides and the empty-library file-access failure **support the preload hypothesis**. However, the temporary coordinator additionally required both administrative effective/reset values to classify as `true-empty` before allowing RESET. Its `session_preload_libraries` precondition failed with `other-nonempty`, so the coordinator deliberately exited 1 with the fixed message `Preload experiment not justified by evidence; stop` and proceeded directly to owned cleanup.

This empty-administrative-fallback condition was a conservative coordinator guard, **not an explicit requirement in the user's instructions**. A nonempty administrative value alone does not prove that authenticator RESET is unsafe. The failed guard prevented the authorized intervention from being tested; it was not relaxed or corrected after the run because the user required stopping on failure without further fixes.

**Experimental SQL executed: NONE.** Neither of the authorized statements below was submitted:

```sql
ALTER ROLE authenticator RESET session_preload_libraries;
ALTER ROLE authenticator RESET local_preload_libraries;
```

Post-experiment incorrect/correct probes and effective authenticator verification: **NOT RUN**. No other correction, password change, HBA change, role grant, database grant, configuration reload, fixture installation, or subsequent runtime attempt was made after the baseline. No PostgREST sidecar was registered or created, and no HTTP request was issued.

The bootstrap's malformed empty-list representation is **confirmed**. The hypothesis that removing these entries restores successful authenticator login is **supported but neither confirmed nor rejected by a controlled intervention**. The observation narrows the failure to an empty-library file-access diagnostic; it does not establish a successful permanent correction.

### 9. Static checks

| Check | Result |
|---|---|
| Temporary coordinator `node --check` | PASS before execution |
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm exec vitest run src/test/scram-probe-diagnostics.test.ts` | PASS, 23 tests / 1 file, exit 0 |
| `git diff --check` | PASS after final report append, exit 0 |

No full HTTP security suite, additional database lifecycle/concurrency suite, build, dependency installation, or development-database check was run. Existing probe unit tests were exercised without modifying them or the diagnostic implementation.

### 10. Exact resources and cleanup

- Run ID: `d9692979df4934220bea99ba3a9595f0`.
- Container: `go-security-pg-d9692979df4934220bea99ba3a9595f0`.
- Exact full ID: `41c503ef27838de1c098e496186908fb398eb945732a291bb3cdc04bbe756312`.
- Creation time: `2026-10-11T12:52:22.898912578Z`; ownership intent `2026-10-11T12:52:22.417Z` preceded creation.
- Disposable database: `go_share_test_d9692979df4934220bea99ba3a9595f0`; system ID `7695392308409249828`; database OID `16663`; observed PostgreSQL version `17.6`.
- Established verification checked exact container ID, creation timestamp, ownership labels, immutable image/daemon identity, `network=none`, no host port bindings, no binds/shared mounts, private IPC, resource limits, and PostgreSQL-data tmpfs. Database system ID/OID/owner/marker were rechecked before SQL and during cleanup.
- Existing cleanup acquired the exact-run cleanup lock, verified ownership/database identity, recorded removal intent, removed only the exact container, proved its full ID absent through successful Docker inventory, and persisted a version-1 `removed` tombstone with no HTTP dependent.
- Tombstone: `C:/Users/Miguel/AppData/Local/guild-organizer-isolated-postgres/1bda25be0a348d032b04574830e8b422b39d1bce2bdfc84c53ab60d0499d5afc/d9692979df4934220bea99ba3a9595f0.json`.
- All 33 manifests now validate as removal tombstones. No cleanup lock, temporary manifest, test container, additional network, or persistent test volume remains. Cleanup is verified; no force recovery or uncertain retained resource exists.
- The temporary workspace coordinator was removed after verifying an exact-byte evidence copy. Its task-owned safe evidence directory remains deliberately retained for review: `C:/Users/Miguel/AppData/Local/Temp/go-preload-auth-Bh3EtB` (`baseline.json`, `result.json`, `coordinator.mjs`). These are owned review artifacts, not active resources or raw-secret captures.

### 11. Development Supabase preservation

Before/after evidence matched all 12 development container full IDs, creation timestamps, immutable image IDs, Config/HostConfig hashes, mount hashes, and network-attachment hashes. All four network identities/configuration hashes, all three volume metadata hashes, and all 15 image inventory rows matched. The database container remained `6cfbbecb879f21ea1f615a37bcc1031988d9e48761a5b65f6837c0e724598b05`. Detailed identities/fingerprints are retained in `baseline.json` and `result.json`.

Edge remained exited. Vector remained in its pre-existing restarting state, with automatic restart count 40 → 43 during the experiment; that volatile counter was not treated as a configuration mutation. The other ten containers remained running. The coordinator issued only inventory inspections against development resources; all SQL, authentication, start/create/remove operations targeted the disposable manifest-owned cluster. It never opened a development database connection or invoked Supabase discovery, migration, reset, restore, or fixture cleanup. Database-content preservation is established by this operation boundary and lack of shared network/storage, not by querying or hashing live development data.

All 325 pre-existing tracked/nonignored file hashes matched immediately after runtime cleanup; index bytes matched baseline. No permanent bootstrap, implementation, test, or manifest schema was edited. Only this report receives a permanent workspace change in this checkpoint; its prior content is retained as an unchanged prefix.

### 12. Smallest permanent correction recommendation

No fully verified permanent correction is recommended yet. The narrow correction area is the two empty-string preload assignments in `scripts/sql/event-share-link-http-bootstrap.sql`: a future correction must store a true empty library list rather than a quoted empty item. Blindly replacing them with RESET is not validated by this run because the administrative fallback is nonempty and no post-reset authenticator session was obtained. Independent review should first assess the extra coordinator guard and determine the expected inherited configuration before authorizing another controlled run. Keep existing logging/pool checks, authentication rules, privileges, and denial assertions intact.

This identifies a candidate serialization correction, not approval to edit the permanent bootstrap or repeat runtime validation.

### 13. Final Git status

Branch and HEAD remained exactly as requested; the index remained empty. Final status matches the initial status:

```text
 M docs/ARCHITECTURE.md
 M docs/LOCAL_E2E_FIXTURES.md
 M docs/QUALITY_GATES.md
 M package.json
 M scripts/isolated-postgres-test-cluster.mjs
 M scripts/test-isolated-postgres-lifecycle.mjs
 M scripts/test-share-link-concurrency.mjs
?? docs/reviews/PHASE_6_3A_5C_1C_VALIDATION.md
?? scripts/docker/postgrest-http/Dockerfile
?? scripts/docker/postgrest-http/harness.mjs
?? scripts/isolated-postgrest-test-service.mjs
?? scripts/postgrest-http-contract.mjs
?? scripts/postgrest-http-image.mjs
?? scripts/scram-probe-diagnostics.mjs
?? scripts/share-link-test-database.mjs
?? scripts/sql/event-share-link-http-bootstrap.sql
?? scripts/sql/event-share-link-http-fixtures.sql
?? scripts/test-isolated-postgrest-lifecycle.mjs
?? scripts/test-share-link-http.mjs
?? src/test/isolated-postgrest-test-service.test.ts
?? src/test/scram-probe-diagnostics.test.ts
```

Final byte verification matched the report's original 86,489-byte prefix to its baseline SHA-256, all other 324 file hashes matched, no new workspace file remained, and index bytes remained identical with no staged entries. Safe evidence is retained in `C:/Users/Miguel/AppData/Local/Temp/go-preload-auth-Bh3EtB/final-workspace.json`.

No staging, commit, push, merge, deployment, image pull/build, or development-resource modification occurred.

**STOP for independent ChatGPT review.** No RESET experiment or second runtime attempt was performed.

## Preload fallback provenance investigation — 2026-10-11 UTC

**Server fallback provenance is established: `session_preload_libraries` is `supautils` from the pinned image's main configuration file. RESET would not produce the required empty session preload list. No correction or RESET was applied. Complete authentication/privacy safety remains unverified, and an independent shared-preload privacy blocker was observed.**

### Starting state and evidence review

Branch `feature/phase-6-publishing-sharing`, exact HEAD `7dcad86906834475029b20076ffd9697f6f3ab66`, and empty index were verified before investigation. The 325 existing tracked/nonignored files and index bytes were captured as a new baseline. Initial Git status matched the final status below. All existing HTTP implementation, diagnostic, and bootstrap files were preserved.

Docker's local Linux context/endpoint/daemon and PostgreSQL image digest/config ID matched the previously approved identities. The existing HTTP image/source provenance verifier also passed read-only; no sidecar or image preparation occurred. All 33 prior manifests were valid removal tombstones with exact resources absent and no temporary/cleanup-lock residue, including run `d9692979df4934220bea99ba3a9595f0`. Development baseline contained the same 12 containers, four networks, three volumes, and 15 image inventory rows.

Review of the retained previous coordinator establishes what its guard actually measured: fresh `supabase_admin` sessions selected `pg_settings.setting` and `reset_val` in `postgres` and the disposable database. It did not record `source`, `sourcefile` provenance, or `boot_val`. Its catalog query separately showed no database-specific preload overrides and quoted-empty authenticator overrides. Thus the earlier nonempty category was an **administrative session observation**, not a measured authenticator session or an administrative role-setting classification.

### 1. Confirmed failure mechanism

The previous owned-cluster evidence remains the runtime failure evidence: both authenticator preload overrides were quoted empty list items; an incorrect password was rejected; a correct password failed with an allowlisted file-access category and an empty library name. This investigation ran no new SCRAM probes.

PostgreSQL 17.6's SQL argument processing explains the representation: these preload GUCs use quoted list inputs, and an SQL empty string supplied through `ALTER ROLE ... SET ... = ''` becomes a quoted empty list element. `FROM CURRENT` instead obtains the existing GUC string directly. The catalog insertion path preserves that string rather than running the SQL list-argument flattening again. These are source-level mechanisms supporting the observed malformed entries, not results of a new correction experiment. See [17.6 GUC argument extraction](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/utils/misc/guc_funcs.c), [17.6 catalog GUC storage](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/utils/misc/guc.c), and [17.6 GUC definitions](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/utils/misc/guc_tables.c).

A genuine empty library list contains zero entries; a quoted empty item names a library with an empty name. PostgreSQL documents that a missing session/local preload library causes connection failure. This distinguishes the measured library-load failure from password rejection without inferring an absent SQLSTATE. [PostgreSQL 17 preload behavior](https://www.postgresql.org/docs/17/runtime-config-client.html#RUNTIME-CONFIG-CLIENT-PRELOAD).

### 2. Source and meaning of the administrative fallback

Existing evidence lacked source metadata, so the single permitted disposable container was used for read-only inspection. The existing container creation/isolation arguments were reused unchanged. The coordinator started the immutable image normally, but **did not invoke `cluster.start()`**, the isolated SQL bootstrap, migration preparation, or HTTP bootstrap: those helpers would change authentication/configuration. No test database was created. Queries targeted only the new container's built-in `postgres` database after image initialization.

Verified fresh `supabase_admin` metadata:

| Setting | Effective / reset classification | Built-in boot classification | Source | Context | Source metadata |
|---|---|---|---|---|---|
| `session_preload_libraries` | `supautils-only` / `supautils-only` | `true-empty` | `configuration file` | `superuser` | Main configuration; file/line present; no pending restart |
| `local_preload_libraries` | `true-empty` / `true-empty` | `true-empty` | `default` | `user` | No source file; no pending restart |
| `shared_preload_libraries` | `unknown-nonempty` / `unknown-nonempty` | `true-empty` | `configuration file` | `postmaster` | Main configuration; audit-or-explain membership detected; no pending restart |

The session value matched the exact allowlisted single module `supautils`. `pg_file_settings` independently classified its applied entry as `supautils-only` from the main configuration, not an included file or automatic configuration file; no configuration-file errors were present. No raw local paths or unrestricted library lists were returned. The image has no `PGOPTIONS`, `PGLIB`, or `PGHOST` environment entries, and the existing container command supplies no preload override.

Relevant `pg_db_role_setting` inspection found **no preload entries for `supabase_admin`**, no all-role/database preload defaults, and no database-specific preload entries for the relevant roles. Therefore this administrative fallback is not an administrative role, database, or role-and-database override, or a session-local SQL assignment. It is the server configuration default provided by the image.

This agrees with the upstream image definition, which sets the session preload default to `supautils`. Supautils is a legitimate Supabase privilege-management/hook library; its name alone does not certify all configured behavior as safe. Upstream definitions are corroborating source evidence, not a measured binary-version assertion. [Supabase PostgreSQL image source](https://raw.githubusercontent.com/supabase/postgres/17.6.1.171/Dockerfile-17), [Supautils documentation](https://raw.githubusercontent.com/supabase/supautils/v3.4.3/README.md).

The read-only metadata also showed that no API role was configured as Supautils' privileged role/superuser, and no API role was a member of its configured privileged role. Skipped-event-trigger logging was off; API-role enhanced hints were configured. These narrow booleans do not establish absence of all privilege/hint hooks or compatibility with exact HTTP-denial responses.

### 3. Configuration precedence and authenticator inheritance

Role-and-database settings override role settings, which override database settings and server defaults. They apply on fresh login; `SET ROLE` does not reapply another role's login defaults. `pg_settings.reset_val` describes RESET within the current session; `ALTER ROLE ... RESET` deletes the targeted catalog override for future sessions. It does not restore a value that the bootstrap previously overwrote. [PostgreSQL 17 ALTER ROLE](https://www.postgresql.org/docs/17/sql-alterrole.html), [pg_settings metadata](https://www.postgresql.org/docs/17/view-pg-settings.html), [pg_db_role_setting](https://www.postgresql.org/docs/17/catalog-pg-db-role-setting.html).

For complete provenance, server-file defaults can be overridden by server command-line settings, all-role catalog settings, database settings, role settings, role-and-database settings, permitted client startup options, and special/session overrides. The applicable source and login context must be evaluated rather than blindly using an administrative reset value. This ordering is documented by the [PostgreSQL configuration guide](https://www.postgresql.org/docs/17/config-setting.html) and the [17.6 GUC source ordering](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/include/utils/guc.h). The [17.6 login implementation](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/utils/init/postinit.c) and [catalog-setting application](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/catalog/pg_db_role_setting.c) confirm that role settings are applied at login with authority validated when inserted; a false parameter-SET ACL flag alone does not mean the stored superuser-authored default is ignored.

Combining the verified pinned server defaults with the **previous disposable cluster's measured absence of database-specific/global preload overrides** gives this counterfactual for deleting only authenticator's two malformed role entries:

| Target / operation | Session preload | Local preload | Evidence status |
|---|---|---|---|
| Authenticator in `postgres`, after removal | `supautils-only` | `true-empty` | Catalog/source-derived prediction; no RESET or live post-removal measurement |
| Authenticator in the historical disposable database, after removal | `supautils-only` | `true-empty` | Same prediction, conditional on unchanged server/catalog/client sources |
| Anon/authenticated/service_role, if their corresponding login defaults were removed | `supautils-only` | `true-empty` | Source-derived defaults; these roles remain NOLOGIN |

The untouched factory image additionally contains an authenticator-specific **nonempty** session preload override. Its value was classified `unknown-nonempty` rather than disclosed. Upstream image initialization suggests a `supautils, safeupdate` role default, but that exact token list was not measured by this inspection. [Upstream authenticator initialization](https://raw.githubusercontent.com/supabase/postgres/17.6.1.171/migrations/db/migrations/20220224211803_fix-postgrest-supautils.sql). The existing HTTP bootstrap overwrites that role key; a later RESET would remove the overwritten key rather than recover its earlier factory value. No factory-role restoration is therefore claimed.

### 4–5. Safety assessment and guard scope

**Inherited settings are not demonstrably safe for the existing test contract.** `supautils` is an identified legitimate module, but inheritance would not satisfy the explicit empty-session-preload check. Allowing it merely because it is recognized would also introduce privilege/hint-hook compatibility questions. Removing the other API-role defaults would not clear already loaded modules from authenticator's backend, and switching to their roles does not load their login defaults. Their catalog correctness and actual PostgREST pool behavior require separate verification.

The previous guard was scoped imprecisely: administrative effective/reset values are not generally a substitute for target-role/database precedence. In this pinned configuration, its refusal to perform RESET was substantively justified: the now-confirmed server fallback is nonempty and contradicts the intended empty-list policy. The right diagnostic adjustment is to compute and label the target fallback and verify fresh target sessions when authorized, while retaining strict empty-list and privacy checks. Do not convert `supautils-only` or `unknown-nonempty` to a passing empty classification.

An additional pre-existing blocker is now measured: `shared_preload_libraries` contains **at least one audit or auto-explain library**, while `go_http_test_identity.logging_safe` explicitly requires both names absent. The complete list was deliberately suppressed. All nine inspected basic logging suppression booleans were true under the existing container startup flags, but `pg_stat_statements.track='none'` was false in the unbootstrapped administrative context. Neither observation proves token leakage; they show why this inspection cannot certify the existing complete privacy predicate. Fixing a role's session/local lists cannot unload libraries already preloaded by the postmaster. Keep the shared-preload guard and tracking checks unchanged; resolving that separate isolated-server policy conflict requires independent review, not a workaround in this task.

Correct negative-password rejection, positive login after a correction, effective pool privacy, and HTTP denials were **not tested in this investigation**. Prior negative rejection remains historical evidence only.

### 6–7. Exact proposed correction and diagnostic changes — NOT APPLIED

The smallest candidate **serialization** correction preserves explicit true-empty defaults for the four existing test API roles, rather than inheriting a different server/factory configuration. Within the existing transaction and `DO $logging$` block, insert the following two lines immediately before `foreach r ...`:

```sql
  perform pg_catalog.set_config('session_preload_libraries', '', true);
  perform pg_catalog.set_config('local_preload_libraries', '', true);
```

Replace only the two current `%L` empty-string assignments inside that unchanged four-role loop with:

```sql
    execute format('alter role %I set session_preload_libraries from current', r);
    execute format('alter role %I set local_preload_libraries from current', r);
```

This is a four-line candidate change: two inserted statements and two replacements, with no RESET, direct system-catalog update, role/password/HBA/ACL change, or server-file change. `set_config` supplies a true empty GUC string; `FROM CURRENT` copies it without the SQL quoted-list flattening. Transaction-local administrative GUC changes revert at transaction end; they do **not** unload Supautils already loaded into the bootstrap backend. The image's legitimate global configuration remains intact for administrative/other sessions. Explicit empty API-role defaults match the test's existing intended policy rather than silently removing an override. [PostgreSQL configuration functions](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-SET), [ALTER ROLE FROM CURRENT](https://www.postgresql.org/docs/17/sql-alterrole.html), and the 17.6 source references above explain the proposed mechanism.

**This candidate has not been executed and is not a verified safe complete fix.** Its ability to serialize eight truly empty catalog entries, restore authenticator SCRAM acceptance, and preserve all security restrictions still requires the A/B checks below. The independent shared-preload blocker remains; do not claim HTTP readiness from this candidate.

Proposed diagnostic/guard changes, also unapplied:

- Extend the safe preload inspector with allowlisted source/context/boot/reset classifications, source-location booleans, target role/database scopes, and precedence results. Keep every unknown list or ambiguous configuration classified as unknown/failing. Separate administrative metadata from target-session observations.
- Add fixed library-file/load failure categories to `classifyScramProcess`; allow `58P01` only when actually parsed, leaving SQLSTATE null otherwise. Do not emit library paths, messages, passwords, verifiers, or configuration strings. Preserve capture bounds and buffer erasure.
- Use a minimal fresh-authenticator query for identities, its visible preload settings, and logging booleans. Inspect protected Supautils/server provenance only in the verified administrative connection; never grant extra parameter/read-all-settings privileges to make diagnostics work. Classify query/ACL failures separately from failed login, without assuming which occurred.
- In a future authorized correction run, reject a candidate unless all four roles' two catalog values are truly empty and all other security/configuration fingerprints match. Verify the target session after commit; do not require the unrelated administrative server default to become empty. Retain the complete existing pool, shared-preload, tracking, and HTTP-denial guards.

### 8. Proposed regression tests and controlled A/B plan — NOT RUN

Required regression coverage:

1. Classifier tests distinguish true empty, quoted empty item, the exact known legitimate module, unknown/path-bearing lists, and mixed/ambiguous lists without exposing their raw values. Test connection/library/query failures, absent versus parsed SQLSTATE, and buffer erasure.
2. Actual isolated SQL tests verify `set_config` plus `FROM CURRENT` stores genuine empty entries for both settings in all four roles (eight entries), and that administrative transaction-local settings restore the original server default on commit/rollback. Do not treat an in-session empty `current_setting` as proof of future login behavior.
3. Precedence tests cover global, database, role, role-and-database, and permitted client sources; removal predictions must not confuse current-session RESET with removal of a role key. Unknown/conflicting provenance must fail closed.
4. Authentication A/B must preserve the same negative and positive credentials, probe target/query/delivery, SCRAM verifiers, HBA contents, memberships, CONNECT privileges, role attributes, logging controls, and isolation. Negative must still reject; positive must identify authenticator with both lists truly empty and no library error after the candidate.
5. Anon/authenticated/service_role remain NOLOGIN with their existing privileges. Catalog and later authorized actual pool checks must verify all roles without temporarily granting LOGIN or extra configuration privileges. `SET ROLE` is not a substitute for a fresh-login default check.
6. A nonempty or audit/auto-explain shared preload must continue failing the existing privacy guard. Retain `pg_stat_statements.track='none'`, all logging controls, token-redaction checks, and the exact resolver-denial assertions. A corrected serializer must not make this independently failing guard pass by changing its expectation.

Controlled plan for a separately authorized disposable run:

- First independently review the four-line SQL candidate and resolve the shared-preload policy conflict. If complete privacy cannot be established, keep token-bearing fixtures/HTTP prohibited and stop; do not automatically adjust server libraries.
- Use the existing pinned/manifest-owned isolated initializer, with initial auth setup only as explicitly authorized for that future experiment. Apply unchanged bootstrap for A, snapshot all configuration/security/isolation evidence, and run each wrong/correct credential once. Expect the established malformed-entry/library-load baseline.
- In the same verified owned cluster, apply only the candidate preload-default statements transactionally for B; leave passwords/HBA/grants and all unrelated settings unchanged. Check eight catalog entries, administrative fallback preservation, and fingerprints excluding only the eight intended defaults. Roll back on any mismatch.
- After successful commit, run the identical wrong/correct probes once each, then read effective settings in a fresh authenticator session. Stop on any unexpected category, output, SQLSTATE, module, configuration, or isolation change; no additional fix attempts.
- Independently verify the full unchanged privacy predicate before any future token traffic. Actual PostgREST pooling/HTTP-denial regression remains a later explicitly authorized gate; no sidecar/full HTTP suite is part of this investigation.
- Finally use exact-run ownership cleanup and compare development container/network/volume/image fingerprints. Preserve uncertain manifests and report the exact run ID rather than pruning or adopting resources.

Rollback is transaction rollback before commit. After commit, disposal of the exact owned container is the recovery boundary; do not restore malformed defaults, reset shared roles, or touch the development database. If a future permanent uncommitted file edit is rejected, revert only that reviewed candidate edit while preserving the user's existing implementation. No such edit or rollback was needed here.

### 9. Runtime result, limits, static checks, and exact cleanup

One owned read-only container was used:

- Run `89d2477b13f48696b06f4c847cd458ef`, container `go-security-pg-89d2477b13f48696b06f4c847cd458ef`.
- Exact ID `b1afac58dc9db3e70b0acf86c91d902bffad29c105b5cde115117d7c6440fab8`; created `2026-10-11T13:16:21.566305344Z` after recorded intent.
- Observed PostgreSQL `17.6`, system ID `7695398485583134756`, built-in `postgres` OID `5`, owner `postgres`. The reserved disposable-database name remained absent. Manifest never claimed a ready test database or its marker/identity; container ownership evidence was the cleanup authority.
- Existing exact container/image/daemon/creation/label checks and isolation (`network=none`, no host ports/shared binds, private IPC, data tmpfs/resource limits) were reused. Read-only system/database identity was compared before inspections. All manually submitted SQL comprised read-only transactions and SELECTs; no RESET, SET/set_config, ALTER, GRANT, password/HBA edit, migration, reload, or test bootstrap was submitted.
- Administrative configuration and catalog inspection completed. The subsequent fresh authenticator socket inspection failed; existing `ownedDocker` returned the fixed safe category `Isolated Docker exec failed (details suppressed)`. No raw stderr or SQLSTATE was retained, so failure cannot be assigned to login, module loading, query ACLs, or SQL execution. The intended PostgreSQL-role inspection and final intra-cluster security-fingerprint comparison were not reached. Do not claim a successful authenticator session or a completed before/after database fingerprint audit from this run.
- Runtime coordinator exit was 1. No retry, second container, alternate query, RESET, or corrective action was attempted. The sole owned container was removed through established exact-run cleanup; successful full-ID inventory proved its absence. Manifest version 1 is `removed`, with no HTTP dependent. All 34 manifests are valid removal tombstones with no lock/temporary residue. A later read-only inventory again contained only the 12 development containers.
- Tombstone: `C:/Users/Miguel/AppData/Local/guild-organizer-isolated-postgres/1bda25be0a348d032b04574830e8b422b39d1bce2bdfc84c53ab60d0499d5afc/89d2477b13f48696b06f4c847cd458ef.json`.
- Safe owned review artifacts: `C:/Users/Miguel/AppData/Local/Temp/go-preload-provenance-WuWzK3` (`baseline.json`, `result.json`, `coordinator.mjs`, `report-before.md`, `image-environment.json`, `final-resource-check.json`). The temporary workspace coordinator was deleted only after its exact evidence copy matched. These retained artifacts contain source bytes/safe classifications/ownership fingerprints, not raw-secret diagnostics or active resources.

| Static check | Result |
|---|---|
| Temporary coordinator `node --check` | PASS |
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm exec vitest run src/test/scram-probe-diagnostics.test.ts` | PASS, 23 tests / 1 file, exit 0 |
| `git diff --check` | PASS after append, exit 0 |

These checks validate the preserved source, not the proposed SQL/diagnostic edits or full runtime contract. No complete HTTP, extra database lifecycle/concurrency suite, build, image pull/build, or dependency operation ran.

### 10. Development preservation and remaining uncertainty

Before/after exact IDs, creation times, immutable image IDs, Config/HostConfig hashes, mount hashes, and network-attachment hashes matched for all 12 development containers. Four network identity/configuration fingerprints, three volume metadata fingerprints, and 15 image inventory rows matched. The development database remained exact container `6cfbbecb879f21ea1f615a37bcc1031988d9e48761a5b65f6837c0e724598b05`. Vector remained in its pre-existing restarting state with counter 66 → 66 over the measured inspection; Edge remained exited; the other ten containers remained running.

No development SQL connection, credential discovery, Supabase operation, or development-container mutation occurred. No shared storage/network was attached. Preservation of development data is based on this operation boundary and unchanged infrastructure evidence, not a query of its contents.

The source of the administrative nonempty fallback is resolved. Remaining uncertainty concerns the unclassified authenticator inspection failure, the factory role's exact nonempty list, actual post-correction authentication/effective settings, Supautils/hint compatibility if it were inherited, and the incompatible shared-preload privacy condition. No unsafe fallback acceptance or weakened guard is proposed to bridge those gaps.

### 11. Final Git state

Branch/HEAD/index remained as requested. All 325 starting source hashes matched after runtime and static checks, before this append. Only this report receives a permanent workspace change; the prior report bytes are retained as an unchanged prefix. Final status matches initial status:

```text
 M docs/ARCHITECTURE.md
 M docs/LOCAL_E2E_FIXTURES.md
 M docs/QUALITY_GATES.md
 M package.json
 M scripts/isolated-postgres-test-cluster.mjs
 M scripts/test-isolated-postgres-lifecycle.mjs
 M scripts/test-share-link-concurrency.mjs
?? docs/reviews/PHASE_6_3A_5C_1C_VALIDATION.md
?? scripts/docker/postgrest-http/Dockerfile
?? scripts/docker/postgrest-http/harness.mjs
?? scripts/isolated-postgrest-test-service.mjs
?? scripts/postgrest-http-contract.mjs
?? scripts/postgrest-http-image.mjs
?? scripts/scram-probe-diagnostics.mjs
?? scripts/share-link-test-database.mjs
?? scripts/sql/event-share-link-http-bootstrap.sql
?? scripts/sql/event-share-link-http-fixtures.sql
?? scripts/test-isolated-postgrest-lifecycle.mjs
?? scripts/test-share-link-http.mjs
?? src/test/isolated-postgrest-test-service.test.ts
?? src/test/scram-probe-diagnostics.test.ts
```

Final byte verification preserved the original 101,421-byte report prefix, matched all other 324 source hashes, confirmed no new workspace files, and matched branch/HEAD/status and the empty index to baseline. Evidence: `C:/Users/Miguel/AppData/Local/Temp/go-preload-provenance-WuWzK3/final-workspace.json`.

**STOP for independent ChatGPT review.** Proposed corrections, regression tests, and A/B plan remain unapplied/unexecuted. No staging, commit, push, merge, deployment, development modification, or RESET occurred.

## Approved SCRAM serialization correction and Gate A validation — 2026-10-11 UTC

**Authentication and catalog serialization PASSED. Complete Gate A remains INCOMPLETE: effective session-preload inspection was denied with 42501. Gate B remains BLOCKED. No privileged diagnostic helper or privacy bypass was added.**

### 1. Baseline and approved source changes

Verified branch `feature/phase-6-publishing-sharing`, exact HEAD `7dcad86906834475029b20076ffd9697f6f3ab66`, empty index, and the existing working-tree status below before editing. The baseline captured all 325 tracked/nonignored files, index bytes, and a byte copy of this report. Existing implementation was preserved; only the three approved source/test files changed before runtime.

Docker Desktop Linux engine was available on the previously approved desktop-linux daemon. PostgreSQL digest/config identity remained `public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9`. The existing HTTP image provenance verifier passed read-only. All 34 prior manifests were valid removal tombstones, exact recorded resources absent, with no lock/temporary residue. The baseline recorded 12 development containers, four networks, three volumes, and 15 image inventory rows.

Applied exactly these four statements in `scripts/sql/event-share-link-http-bootstrap.sql`: the two `perform` statements precede the unchanged four-role loop; the two `execute` statements replace only its malformed `%L` preload assignments.

```sql
  perform pg_catalog.set_config('session_preload_libraries', '', true);
  perform pg_catalog.set_config('local_preload_libraries', '', true);
    execute format('alter role %I set session_preload_libraries from current', r);
    execute format('alter role %I set local_preload_libraries from current', r);
```

The existing roles remain authenticator, anon, authenticated, and service_role. All other role defaults, memberships/privilege statements, timeouts, SQL assertions, and privacy controls are unchanged. No RESET or shared-preload change was made. The administrative transaction-local values restored the original fallback: session preload classified supautils-only and local preload true-empty after bootstrap.

`scripts/scram-probe-diagnostics.mjs` now allowlists SQLSTATE 58P01 only when parsed from actual diagnostics; recognizes fixed `empty-library-load-failed`, `library-load-failed`, and `setting-inspection-denied` categories; and returns only session/shared preload setting names for recognized inspection denial. Existing delivery, identity, negative-password, capture, erasure, and fail-closed checks remain unchanged. No raw stderr, library paths, passwords, verifiers, JWTs, tokens, connection strings, or environment secrets were emitted.

`src/test/scram-probe-diagnostics.test.ts` adds seven classification cases and one bootstrap/privacy regression: parsed/absent 58P01, empty and generic library failure, both protected preload setting denials, unknown denied names, sensitive-output suppression, failure rejection by both authentication controls, the four-role serialization loop, absence of the old malformed assignments, unchanged shared-preload guard, SECURITY INVOKER identity RPC, and absence of the unapproved helper/RESET/parameter grants.

### 2. Static validation

| Command | Result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test` | PASS, exit 0; 44 files, 623 tests |
| `git diff --check` | PASS, exit 0; existing LF/CRLF notices only |

No source fix or runtime retry followed a failed check. No standalone concurrency, PostgreSQL lifecycle, PostgREST lifecycle, or HTTP security suite was invoked. The approved full unit suite uses mocks for the diagnostic runner/sidecar boundary.

### 3. Authorized diagnostic command and execution boundary

```text
node scripts/test-share-link-http.mjs --diagnose-scram
```

The exact entrypoint was executed once, exit **0**, with no stderr. Its diagnostic-only branch was reviewed and unit-tested to return before HTTP fixtures, token provisioning/resolution, HTTP requests, or sidecar creation. Existing isolated setup and schema preparation ran as defined by that entrypoint; no sensitive share-link operations ran.

A temporary observer outside the repository was loaded through child-only NODE_OPTIONS `--import`. It performed read-only catalog/fingerprint queries and one fresh authenticator inspection in the same owned cluster, retained only safe evidence, and vetoed HTTP-dependent/version-2 registration. It created no container itself and changed no PostgreSQL setting or permission. The permanent entrypoint and cluster/service implementations were not edited. Actual executed child arguments remained the command above.

### 4–5. Real SCRAM controls

| Control | Process | Exit | Safe category | Parsed SQLSTATE | Identity output | Credential delivery |
|---|---|---|---|---|---|---|
| Incorrect password | completed | 2 | password-authentication-rejected | null | empty | verified |
| Correct password | completed | 0 | expected-identity | null | exact authenticator | verified |

Both existing controls targeted TCP loopback and the built-in postgres database. No SQLSTATE was inferred when the client did not provide one. The correct login produced no unexpected diagnostics or library-loading error. LOGIN, CONNECT to postgres and the disposable database, database connection acceptance, SCRAM-verifier presence, account validity, and exact loopback SCRAM/reject HBA checks passed. No unexpected SET-role authority was accepted by the existing bootstrap.

A fresh correct-password TCP authenticator session in the disposable database additionally executed a read-only SELECT proving session_user/current_user are authenticator, the target is the registered disposable database, local_preload_libraries is genuinely empty, the existing core logging predicate is true, and pg_stat_statements tracking is none. This is actual target-session evidence, distinct from catalog defaults.

### 6–7. Serialization results

All eight role-level entries were present exactly once and classified `true-empty`, both before and after probes. No relevant global/database/role-and-database preload override shadowed them.

| Role | session_preload_libraries | local_preload_libraries |
|---|---|---|
| authenticator | true-empty | true-empty |
| anon | true-empty | true-empty |
| authenticated | true-empty | true-empty |
| service_role | true-empty | true-empty |

The malformed quoted-empty catalog issue is resolved in this run, and the formerly failing positive SCRAM login now succeeds. This was one post-correction run compared with the retained historical failure evidence; it was not a new same-cluster pre/post A/B experiment. Catalog correctness alone is not claimed as direct proof of authenticator effective session preload.

After the established isolated setup, the before/after in-database security/configuration fingerprint matched across the diagnostic controls and inspection. It covers role attributes/verifiers, memberships, role defaults, database/CONNECT metadata, parameter ACLs, HBA contents, and applied configuration-file metadata. There was no experimental change to passwords, HBA, memberships, permissions, authentication policy, or server configuration during these measurements.

### 8–9. Protected inspection limitation and Gate A decision

The first target-session SELECT above succeeded. The next SELECT attempting protected preload inspection failed with **42501**, process exit **3**, safe category `setting-inspection-denied`, allowlisted parameter `session_preload_libraries`, and verified credential delivery. Because ON_ERROR_STOP terminated the read-only inspection, no successful shared-preload target-session result was obtained. This is a query-inspection denial after successful login, not a SCRAM authentication failure.

No retry, privilege grant, SECURITY DEFINER helper, replacement query bypass, RESET, or correction followed the denial. Cleanup and evidence collection proceeded. Direct effective session_preload_libraries inspection therefore remains blocked under the existing permissions.

**Gate A assessment: authentication correctness and eight-entry serialization checks PASS; complete Gate A is NOT fully established because protected effective session-preload verification remains unavailable.** Effective identity, disposable connectivity, local preload, core logging, and tracking were measured. No claim is made that all four configured role defaults establish actual session configuration.

### 10. Remaining Gate B privacy blockers

The unchanged shared-preload predicate was false in administrative inspection: the pinned configuration still contains at least one audit/auto-explain library. The role serialization correction neither changes nor unloads shared libraries. The SECURITY INVOKER identity RPC and its shared-library prohibition remain byte-for-byte unchanged outside the approved four-line serialization edit.

No pooled PostgREST privacy result, extension-audit/auto-explain safety proof, startup/listener coverage, complete PostgreSQL log-sink coverage, token-bearing log absence, or HTTP-denial result was established. Core logging controls alone do not certify extension-based logging safety. The pre-existing diagnostic unlisted-setting count was 1; it was reported safely, not treated as a new permission or configuration change. Gate B remains blocked for independent review.

### 11. Exact disposable cleanup

- Run ID: `3fdcf789d56aba4c8f514aa4e5e0aaca`.
- Exact PostgreSQL container: `33f25657a68735e903e199920ef0d044294d20ac468bfd80bbc7e3e4367cae83`.
- Established ownership checks verified daemon/image, manifest, exact ID/creation identity, database identity/marker, network isolation, and configuration before operations and cleanup.
- Version-1 manifest is `removed`; successful full-ID inventory proved exact container absence; no HTTP dependent was registered.
- All 35 manifests are valid removal tombstones, with no lock/temporary residue. The final inventory contains only the original 12 development containers.
- Tombstone: `C:/Users/Miguel/AppData/Local/guild-organizer-isolated-postgres/1bda25be0a348d032b04574830e8b422b39d1bce2bdfc84c53ab60d0499d5afc/3fdcf789d56aba4c8f514aa4e5e0aaca.json`.

Safe review evidence remains in `C:/Users/Miguel/AppData/Local/Temp/go-scram-serialization-5b2bbd26117a4592a8d5103e8c16253f`: baseline/report prefix, temporary observer/driver source, pre-runtime source hashes, allowlisted diagnostic output, process status, catalog/session observations, and final resource fingerprints. These are owned review artifacts; no temporary workspace implementation file remains.

### 12. Development Supabase preservation

All 12 development containers retained exact IDs, creation times, image IDs, Config/HostConfig hashes, mounts, and network attachments. Four network identity/configuration fingerprints, three volume metadata fingerprints, and 15 image inventory rows matched the baseline. The development database remains exact container `6cfbbecb879f21ea1f615a37bcc1031988d9e48761a5b65f6837c0e724598b05`.

All container state categories remained the same. Vector was already restarting; its autonomous restart counter advanced 142 → 149 during this task. Edge remained exited; the database and other nine containers remained running. No agent action targeted Vector or any development container. Configuration/identity fingerprints exclude these live restart counters and are recorded separately.

No development SQL connection, data operation, Supabase CLI mutation, development container action, image pull/build, network/volume creation, or shared mount occurred. Preservation of development data is supported by this operation boundary and unchanged infrastructure evidence, not by querying development contents.

### 13. Final Git status

Branch and HEAD remain the approved values; index remains empty and its bytes match the baseline. All source files outside the three approved implementation/test files remained byte-identical through runtime. This report is the only subsequent edit, appended without rewriting prior bytes. Final status:

```text
 M docs/ARCHITECTURE.md
 M docs/LOCAL_E2E_FIXTURES.md
 M docs/QUALITY_GATES.md
 M package.json
 M scripts/isolated-postgres-test-cluster.mjs
 M scripts/test-isolated-postgres-lifecycle.mjs
 M scripts/test-share-link-concurrency.mjs
?? docs/reviews/PHASE_6_3A_5C_1C_VALIDATION.md
?? scripts/docker/postgrest-http/Dockerfile
?? scripts/docker/postgrest-http/harness.mjs
?? scripts/isolated-postgrest-test-service.mjs
?? scripts/postgrest-http-contract.mjs
?? scripts/postgrest-http-image.mjs
?? scripts/scram-probe-diagnostics.mjs
?? scripts/share-link-test-database.mjs
?? scripts/sql/event-share-link-http-bootstrap.sql
?? scripts/sql/event-share-link-http-fixtures.sql
?? scripts/test-isolated-postgrest-lifecycle.mjs
?? scripts/test-share-link-http.mjs
?? src/test/isolated-postgrest-test-service.test.ts
?? src/test/scram-probe-diagnostics.test.ts
```

No stage, commit, push, merge, deployment, full HTTP validation, extra container run, privacy bypass, or new privileged helper occurred.

**STOP for independent ChatGPT review.**

## Work Package A — consolidated local security completion (2026-10-11)

### Result and Git baseline

**The local isolated checkpoint passed Gate A, Gate B and the complete real HTTP suite.** This is a new engineering run under the consolidated authorization; the earlier STOP decisions and 623-test checkpoint above remain historical evidence.

Initial and final branch: `feature/phase-6-publishing-sharing`.
Initial and final HEAD: `7dcad86906834475029b20076ffd9697f6f3ab66`.
The index was empty throughout; its SHA-256 remained `341d1f05de3a893b379faf1ce94801c0a9b51f2a6420c195fd963f9f111f35e5`.
Initial status contained the existing 21 modified/untracked paths listed in the preceding checkpoint. All were preserved. A complete source-byte baseline was recorded before implementation; only the authorized test infrastructure and tests below changed, followed by this append. Historical fixtures, committed migrations and application source remained byte-identical.

Docker Desktop's Linux engine and local endpoint were verified. Both existing immutable image identities, HTTP source provenance labels and binary checks remained unchanged:
- PostgreSQL: `public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9`.
- HTTP harness: `sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa`.
- PostgREST base: `public.ecr.aws/supabase/postgrest@sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962`.
- PostgREST 16.3 binary SHA-256: `0cf367dc2ee47d5c648baa2952e25bdf299de4e1998d31e251bb00d129262d71`.

Preflight found only the 12 development containers and 35 valid removal tombstones; no previous active isolated resource or lock residue remained. There were no image pulls, image builds or dependency downloads.

### Implementation changes

1. Added `scripts/sql/scram-preload-inspection.sql`: transactional installation of `go_test_diagnostics.preloads_empty()`, owned by dedicated `go_test_preload_reader`. The role is NOLOGIN, non-superuser, has no database/role creation, replication or bypass-RLS authority, and inherits only `pg_read_all_settings`, with SET and ADMIN options false. No application identity receives that membership or diagnostic-owner membership.
2. Added strict installer authority, catalog and security-fingerprint checks plus a fresh TCP authenticator preload/permission probe in `scripts/scram-probe-diagnostics.mjs`. The helper returns only booleans, uses qualified system functions and a fixed search path, binds the exact database and ownership marker, requires authenticator session identity without a request-role switch, revokes PUBLIC execution and permits only authenticator usage/execution. Request roles have neither schema USAGE/CREATE nor function EXECUTE.
3. Added the opt-in `http-private-v1` startup profile to `scripts/isolated-postgres-test-cluster.mjs`. It preserves the pinned image and all nine other effective shared libraries: `pg_stat_statements,plpgsql,plpgsql_check,pg_cron,pg_net,pgsodium,pg_tle,plan_filter,supabase_vault`. It excludes only the prohibited pgAudit and auto_explain hooks and disables statement tracking and ancillary logging before initialization. The complete startup command is verified; session/local preload startup overrides and PGOPTIONS/service overrides are refused. Legacy manifests and the default SQL-only startup path remain supported.
4. Added `scripts/http-postgres-privacy.mjs` and `scripts/sql/http-privacy-inspection.sql`. Fresh administrative sessions verify effective logging, source-library preservation and sink configuration. A separate private boolean function permits the existing SECURITY INVOKER identity RPC to inspect protected runtime preload settings. It grants no broad settings privileges to request roles. The original shared-library prohibition remains the same predicate, qualified and evaluated in this private helper.
5. Updated `scripts/sql/event-share-link-http-bootstrap.sql` only to delegate protected privacy reads to that boolean helper. The approved four-line SET FROM CURRENT serialization fix and other role defaults, timeouts, privileges and core logging predicates were retained.
6. Updated `scripts/test-share-link-http.mjs` to complete Gate A before fixtures/sidecar execution, enforce privacy before token-bearing HTTP, verify both actual pool PIDs and the authenticator LISTEN connection, collect complete bounded PostgreSQL logs, scan synthetic credential/JWT/token variants, and check PostgREST shutdown diagnostics before cleanup.
7. Updated `scripts/isolated-postgrest-test-service.mjs` to refuse sidecar registration without the verified privacy profile.
8. Updated HTTP lifecycle preparation and shutdown log verification; added `--http-privacy-profile` to the existing SQL/concurrency entrypoint to validate that profile against the full existing database regression suite.
9. Added/extended diagnostic, privacy and startup-isolation unit/security regressions. Safe error output now distinguishes an allowlisted SQLSTATE or fixed harness failure category without raw SQL/stderr, paths or secret-bearing error messages.

No public application migration, production helper, resolver access relaxation, privileged application membership, new dependency, alternative image or development configuration change was introduced.

### Gate A evidence

The standalone command `node scripts/test-share-link-http.mjs --diagnose-scram` completed with exit **0**, run `89ee261aef6252c13b89c1d33efbc4a7`, PostgreSQL container `2b57771afe62412eb900227dbd62e49b711a68e54c04ca63c6f2b6786d7a32f7`. It returned before HTTP fixtures, share-token operations and sidecar creation. Gate A was subsequently repeated successfully in the privacy profile and successful HTTP/lifecycle preparations.

- Wrong password: completed, exit **2**, allowlisted category `password-authentication-rejected`; no client SQLSTATE was inferred.
- Correct password: completed, exit **0**, exact `authenticator` identity and verified credential delivery.
- Fresh TCP connection to the registered disposable database: exact session/current identity; protected helper true, proving effective session and local preload lists genuinely empty without SET/PGOPTIONS masking.
- All eight role/preload catalog entries: present exactly once and genuinely empty, with no relevant database or role-and-database override.
- No empty-library or unexpected library-loading failure.
- Actual anon, authenticated and service_role helper calls: PostgreSQL **42501**, exact `permission denied for schema go_test_diagnostics` boundary, caught and verified inside the diagnostic. Unrelated 42501 errors and successful helper entry cannot count as denial. Effective function EXECUTE denial is independently checked by OID; no claim is made that a function-body error was observed through the denied schema.
- PUBLIC function EXECUTE absent; request-role schema/function privileges and diagnostic/settings-owner membership restrictions verified before the probe baseline.
- Administrative security fingerprints matched before/after installation, excluding only its explicitly verified new role/membership delta, and across the diagnostic probes with the new helper included. Roles/verifiers, memberships, defaults, database/CONNECT metadata, parameter ACLs, HBA contents and configuration-file metadata were hashed within the administrative session; only the digest left it.

The installer verifies actual `supabase_admin` superuser/CREATEROLE/LOGIN authority, major version 17, exact database/marker, no role switch and absent owner/schema before DDL. The existing isolated bootstrap and pinned initialization establish that superuser authority; CREATEROLE alone is not assumed to confer SET/owner-switch authority. The owner role gets no additional administrator membership. See [pinned Supabase initialization](https://raw.githubusercontent.com/supabase/postgres/17.6.1.171/migrations/db/init-scripts/00000000000000-initial-schema.sql) and [PostgreSQL 17 role membership](https://www.postgresql.org/docs/17/role-membership.html).

### Gate B evidence and corrections

The dedicated profile initialized successfully, replayed application migrations, retained required extension availability, created the required roles, passed SCRAM and later passed all SQL/concurrency and cryptographic integration regressions. Its first complete profile-only success was run `68b1080b946bd2cb7b21a93824f6f461`, exact PostgreSQL container `81fe2cac6a9fcc1ce896d8f8061cfd2b4167afb348d0dff5b7c39b9942893a18`, exit **0**, safely removed.

Administrative checks use supabase_admin for configuration-file provenance reads, and independent fresh supabase_admin/postgres sessions for effective logging controls. Both core statement/error/parameter/duration/sampling logging and pg_stat_statements tracking are disabled. Effective shared-library membership matches the profile exactly, and compares with the image's file-configured list minus only pgAudit/auto_explain. The server and pool sessions have no registered pgAudit or auto_explain settings, and authenticator has empty session/local preloads. This establishes unloaded hooks rather than relying solely on core log_statement.

For startup and notification connections, the pinned harness uses the same authenticator URI without startup GUC options, `db-config=false`, fixed exposed/search-path schemas and immutable source/binary provenance. Administrative runtime inspection confirms exactly three authenticator client backends: the two PIDs independently exercised by concurrent identity requests and one actual LISTEN pgrst backend. Global startup logging controls and verified login defaults apply to the startup/listener connection; both request backends directly return logging_safe=true while alternating roles and clearing JWT identity. These checks repeat through cache and cold-process transitions.

The server reports logging_collector off, stderr as the sole log destination and no current collector logfile in administrative inspection. PostgreSQL Docker logging is json-file with no rotating/custom options. Complete `docker logs <exact-owned-id>` stdout and stderr are captured without tail filtering, bounded at 1 MiB, scanned in memory and erased; command failure, overflow, missing evidence, unknown sink or a sensitive match fails closed. Readiness LOG messages are intentionally suppressed; the actual bootstrap negative-password FATAL is the required live-sink sentinel.

The successful full HTTP run's complete PostgreSQL log evidence was **16,637 bytes**, **zero sensitive matches**, both before token-bearing HTTP and after explicit sidecar shutdown. Synthetic passwords (including negative probes), key encodings, JWTs and recovered share tokens are covered. PostgREST child diagnostics remain bounded in harness memory, scanned on requests/restarts/shutdown, with the existing Docker log-driver none and private tmpfs configuration protections.

Preserved failed evidence and justified repairs:
- The first 68-test diagnostic unit run had 17 failures caused by a mock replacing the unit under test; delegating to the real implementation fixed it before runtime.
- Profile `cb4c9fadbf08c0ed068fbadf5dc19322` stopped on missing fingerprint evidence. Read-only inspection in `466b08e9c47deab362f1da34675df608` classified the sole file-setting error as the shared-library file value not applicable under a command-line profile.
- Candidate `5f95ba3ed4beb63bca50bff15f94b079` still refused evidence because pending_restart is true for that intentional file/command-line difference. The final exception accepts only this exact owned profile, exact error/name, command-line source and exact effective library list; all other file errors still fail, and the complete metadata remains fingerprinted. This follows the file view's distinction from effective configuration. See [PostgreSQL pg_file_settings](https://www.postgresql.org/docs/17/view-pg-file-settings.html).
- In `3248c1cd909522d2b1f4d476df840561`, the new privacy-function installer failed; its format() template required escaped percent signs in LIKE patterns. The corrected installer passed in `68b1080b946bd2cb7b21a93824f6f461`.
- The first SQL-profile/HTTP runs stopped with protected administrative file-inspection **42501**. File provenance checks now use only the already authorized superuser installer; no postgres/request-role privilege was expanded. SQL-profile rerun passed.
- HTTP attempt 2 stopped at sidecar privacy readiness. pg_current_logfile() requires pg_monitor execution authority. Its no-logfile assertion remains in the administrative prerequisite, while the pool helper checks effective collector-off/stderr-only settings without gaining pg_monitor or file-reading privileges. The final real pool checks passed. See [PostgreSQL system information functions](https://www.postgresql.org/docs/17/functions-info.html).
- Suppressed readiness logs were not treated as missing/empty proof: the required sentinel is the real negative SCRAM FATAL, and collection remains complete and bounded.

No logging prohibition was relaxed. Repair candidates were bounded by blocker; the extra fingerprint run was read-only classification, not another speculative correction. Every failed run was cleaned using the established exact ownership checks. Failed HTTP attempt exit codes were **1, 1**; the corrected complete attempt was **0**. None of those failures counted as authorization evidence.

### Real HTTP authorization evidence

Command: `node scripts/test-share-link-http.mjs`, final attempt exit **0**.
Successful run: `931ec0c5b3487871696c7978426e2d67`.
Exact PostgreSQL container: `99a53131050ecfccd8177b111da6246a1ab5a18d1400c5236f55bc458c9a6cb8`.
Exact HTTP container: `c32416b9fb169b986198eec7db2e3521faea3b63c11b2f9231f059d18c90e176`.

**279 HTTP assertions and 12 internal resolver assertions passed.**

| Stage | Verified evidence |
|---|---|
| Pre-migration controls | Correct anonymous/signed-anon/authenticated projections through GET, HEAD, POST; service role denied under earlier grants |
| Immediately after committed access migration | 36 real resolver denials: anonymous/signed-anon 401, authenticated/service 403; PostgreSQL 42501 |
| After schema-reload request | Same 36 denials |
| After independently verified cache sentinel | Same 36 denials; notification alone was not accepted as cache completion |
| After cold PostgREST restart | Same 36 denials, new pool identities and LISTEN connection checked |
| Rotation/revocation batches | Four 12-request concurrent denial batches across all credentials/methods; old tokens stay denied |
| JWT/parser/escalation controls | Invalid JSON and JWT classified separately; resolver-role switching denied; these did not substitute for resolver execution denial |
| Internal resolver | Trusted dedicated role only; approved sealed metadata projection, unknown/malformed tokens, draft immutability, unavailable/unsealed pointers, publication/archive transitions, rotation/revocation and reachable management RPC |

GET and POST denial bodies identify the exact resolver function with SQLSTATE 42501; HEAD requires an empty body and matching Proxy-Status PostgreSQL 42501 evidence. Invalid JWTs, role-switch errors, HTTP 404, missing RPCs, cache/transport failures and empty successful responses are not accepted as resolver denials. Resolver definition integrity and absence of authenticator/request-role resolver membership remain asserted.

### Fresh quality gates

| Command | Result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test` | PASS, **677 tests in 45 files**, exit 0 |
| `pnpm build` | PASS on final source, exit 0 |
| `node scripts/test-share-link-http.mjs` | PASS, **279 HTTP + 12 internal resolver assertions**, exit 0 |
| `node scripts/test-isolated-postgrest-lifecycle.mjs` | PASS, **22 real lifecycle/isolation assertions**, exit 0 |
| `node scripts/test-share-link-concurrency.mjs --http-privacy-profile` | PASS, **1,401 SQL assertions in 33 files; 16 concurrency; 130 authorization-concurrency; 31 production-cryptographic integration assertions**, exit 0 |
| `node scripts/test-isolated-postgres-lifecycle.mjs` | PASS, **27 real infrastructure lifecycle assertions**, exit 0 |
| `git diff --check` | PASS |

The SQL-profile suite replayed 39 migrations. Existing historical 623-unit and other earlier checkpoint results were not substituted for these fresh results. PowerShell native-stderr formatting for package command announcements and Git line-ending warnings did not change actual zero exit statuses.

### Cleanup and development preservation

This work package created **20 owned PostgreSQL containers and six owned HTTP sidecars**, including failure/classification and interrupted-lifecycle cases. Every exact resource is removed. The protected manifest directory advanced from 35 to **55 valid removal tombstones**; all parent phases are removed, all registered HTTP phases are removed, and there are no cleanup locks or temporary residues. Successful full-ID Docker inventories prove no remaining isolated resource. No recovery uncertainty remains.

Protected tombstone directory:
`C:/Users/Miguel/AppData/Local/guild-organizer-isolated-postgres/1bda25be0a348d032b04574830e8b422b39d1bce2bdfc84c53ab60d0499d5afc`.

Safe engineering evidence directory:
`C:/Users/Miguel/AppData/Local/Temp/go-work-package-a-9fe8878f07e7468e8da2e6d6f0c7ac55`.
It contains baseline/final preservation metadata, original source-byte hashes, index hash, full safe run-ID/container-ID cleanup inventory, failed/pass process statuses, safe profile observations and sanitized HTTP/SQL/lifecycle/build transcripts. It contains no captured raw PostgreSQL/PostgREST diagnostics or live credential values.

Final development preservation comparisons all matched:
- **12 containers**: exact IDs, creation times, image IDs, Config/HostConfig hashes, mounts, network attachments and state categories.
- **Four networks**: identity/configuration fingerprints unchanged.
- **Three volumes**: metadata fingerprints unchanged.
- **15 image inventory rows** and approved immutable pins unchanged.
- Development database exact ID retained: `6cfbbecb879f21ea1f615a37bcc1031988d9e48761a5b65f6837c0e724598b05`.

No development SQL connection, reset, migration, data mutation, container restart, network attachment, host service port, image pull/build or production operation occurred. Existing ownership lease behavior is unchanged; PostgreSQL/HTTP Docker PortBindings remain empty. Historical fixture source bytes were preserved. Preservation of development data is supported by the operation boundary and matching infrastructure, without querying its contents.

### Review scope and final status

No local checkpoint blocker remains. Evidence applies to the approved immutable PostgreSQL 17.6/PostgREST 16.3 environment; no upstream image upgrade, hosted gateway/browser validation, production deployment or CI change was included. Current Supabase changelog differences for later images were reviewed without altering these pins.

An independent source-review ZIP is prepared in Windows Downloads with all changed implementation/documentation files and an internal SHA-256 manifest. Dependencies, environment files, runtime credentials/configuration, databases and Git internals are excluded. The ZIP is verified against its source hashes; its external SHA-256 sidecar identifies the archive itself.

Final Git status follows; branch/HEAD/index remain as above. No stage, commit, push, merge or deployment occurred.

```text
 M docs/ARCHITECTURE.md
 M docs/LOCAL_E2E_FIXTURES.md
 M docs/QUALITY_GATES.md
 M package.json
 M scripts/isolated-postgres-test-cluster.mjs
 M scripts/test-isolated-postgres-lifecycle.mjs
 M scripts/test-share-link-concurrency.mjs
 M src/test/isolated-postgres-test-cluster.test.ts
?? docs/reviews/PHASE_6_3A_5C_1C_VALIDATION.md
?? scripts/docker/postgrest-http/Dockerfile
?? scripts/docker/postgrest-http/harness.mjs
?? scripts/http-postgres-privacy.mjs
?? scripts/isolated-postgrest-test-service.mjs
?? scripts/postgrest-http-contract.mjs
?? scripts/postgrest-http-image.mjs
?? scripts/scram-probe-diagnostics.mjs
?? scripts/share-link-test-database.mjs
?? scripts/sql/event-share-link-http-bootstrap.sql
?? scripts/sql/event-share-link-http-fixtures.sql
?? scripts/sql/http-privacy-inspection.sql
?? scripts/sql/scram-preload-inspection.sql
?? scripts/test-isolated-postgrest-lifecycle.mjs
?? scripts/test-share-link-http.mjs
?? src/test/http-postgres-privacy.test.ts
?? src/test/isolated-postgrest-test-service.test.ts
?? src/test/scram-probe-diagnostics.test.ts

```

**STOP for independent ChatGPT source review. No commit or deployment is authorized.**


## 2026-10-11 ? CI SQL runner restoration (uncommitted review proposal)

### Baseline and confirmed failure

Branch: feature/phase-6-publishing-sharing. HEAD: 4305c7748021cd6d9d0c009aacf372d771585af5. Initial working tree and index were clean. No Work Package B implementation is included.

GitHub Actions [run 38159235131](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38159235131) completed with quality SUCCESS and database FAILURE. Database migration reset and schema lint succeeded; Database tests failed; the owned runner and generated-type check were skipped. The three reported permission failures are in event_share_link_management_state.test.sql, event_share_link_resolver_access.test.sql and event_share_links.test.sql.

The workflow invoked the standard Supabase CLI SQL path before the existing owned runner. Its postgres session is intentionally not a superuser. The access-boundary migration creates a restricted NOLOGIN resolver with no application membership; the trusted creator ADMIN grant does not enable SET. Two tests need test-only SET authority, while the access test needs a genuinely restricted session_user through SET SESSION AUTHORIZATION. Granting SET alone cannot satisfy the latter from a non-superuser login. PostgreSQL documents this distinction in [SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html) and [SET SESSION AUTHORIZATION](https://www.postgresql.org/docs/17/sql-set-session-authorization.html).

The existing independent runner already supplies the appropriate disposable-only postgres SET grant with INHERIT false, pgTAP schema access, and a supabase_admin connection for the access/session-authorization test. Production migration, resolver attributes, application privileges, SQLSTATE 42501 expectations and SQL test files remain unchanged.

### Exact source scope

- .github/workflows/ci.yml: replace the CLI Database tests step with Bash preparation of the private Linux manifest base and an explicit pull of the existing immutable imageDigest exported by the runner. Rename the existing concurrency step to identify its complete SQL/concurrency/cryptographic coverage. It still executes pnpm db:test:concurrency once.
- docs/QUALITY_GATES.md: identify that owned runner as the authoritative complete SQL gate and explain the legacy CLI authority limitation.
- This report: append this verified evidence; earlier report bytes are preserved.

No package/dependency, runner, bootstrap, public migration, RLS, application role, SQL expectation, fixture, authentication, preload or HTTP privacy implementation was changed. The quality job, workflow triggers, Supabase start/reset/schema lint, generated-type check and always-run Supabase stop steps are structurally unchanged.

### Linux provisioning and fail-closed behavior

The runner already accepts a local Linux unix:///var/run/docker.sock, enforces a Linux daemon, and uses private owned POSIX manifest directories. A fresh GitHub-hosted home need not contain ~/.local/state, so CI prepares that base with install -d -m 700. Docker pulls only public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9, obtained from the existing export instead of a second pin. No image pull/build was performed locally.

Explicit Bash uses GitHub's fail-on-error/pipefail behavior; preparation and pull failures fail the job. The existing runner independently requires the approved image ID and RepoDigest, supported local endpoint, immutable daemon identity, exact intent/ID/labels/timestamps, network none, no published ports/binds/persistent volumes, bounded tmpfs and resources, and database system identifier/OID/ownership marker. It never discovers or connects to the CLI stack or development/production database. Random credentials remain in the established protected in-memory/stdin flow; no GitHub secrets or credential permissions were added.

Every discovered regression file must return a complete matching TAP plan without not-ok results; SQL execution failure is fatal. Concurrency counts 16/130 and crypto count 31 remain mandatory. Cleanup uncertainty sets a nonzero process exit, retaining ownership evidence rather than force-cleaning uncertain resources. The workflow does not suppress those exits or type-check failure. Discovery exercised all current 33 files once, including the three permission regressions; no SQL coverage was deleted or duplicated.

### Fresh local validation

| Check | Result |
| --- | --- |
| pnpm exec tsc --noEmit | PASS, exit 0 |
| pnpm lint | PASS, exit 0 |
| pnpm test | PASS, 677 tests in 45 files, exit 0 |
| Workflow YAML parse and structural gate assertions | PASS; quality job/triggers and compatibility/lint/type/stop steps preserved; complete SQL gate exactly once; no continue-on-error |
| CI preparation Bash syntax and actual Node digest extraction | PASS; preparation/pull commands were not executed locally |
| node scripts/test-share-link-concurrency.mjs | PASS, 1,401 assertions across all 33 SQL files; 16 concurrency; 130 authorization-concurrency; 31 production crypto, exit 0 |
| CRLF-aware git diff whitespace check | PASS, exit 0; blank-at-eol, blank-at-eof, space-before-tab and cr-at-eol enabled |

The three formerly failing SQL files passed 101, 27 and 311 assertions respectively. All 39 migrations replayed inside the owned empty database. The transcript's 33 per-file names and assertion totals were cross-checked against the complete current supabase/tests discovery.

The standard whitespace check flags CR bytes on edited lines of the previously approved CRLF documentation. The full CRLF-aware check recognizes those existing line endings while retaining trailing-whitespace/blank-EOF/space-before-tab checks. No repository/global configuration or wholesale line-ending normalization was performed.

### Exact cleanup and development preservation

One default SQL-profile cluster was created; no HTTP sidecar or HTTP suite was run.

- Run ID: 1592da09b3282cedeef86fe64e2a7af3.
- Full container ID: 51602d065c8fe2d5a49d0fa913cfb004fc4637c7aa121256b3949c002413b8ef.
- The ownership manifest is valid and phase removed; successful full-ID inventory proves that container absent. All 56 protected manifests have removed parent/dependent phases, and the labeled test-container inventory is empty.
- Before/after snapshots match all 12 development container identities/configuration/network fingerprints, all four networks, all three volumes and all 15 image inventory entries. No development SQL connection, reset, migration or container lifecycle operation occurred.
- Safe local evidence is retained at C:/Users/Miguel/AppData/Local/Temp/go-ci-sql-runner-ce379bfff4e74f3abb202f65664b7670 (baseline/final snapshots, sanitized SQL transcript, exit code and verified result metadata). Runtime secrets and database contents are excluded from the review ZIP.

The earlier historical Docker network discrepancy remains Classification C, unexplained. Matching current snapshots do not reclassify that historical observation as harmless.

### Limits and review state

This validates the current owned runner on the local Windows control plane with Docker's Linux engine; Bash/YAML and Linux path preparation were checked without executing the updated workflow on Ubuntu. A new GitHub Actions result is pending independent review and a separately authorized commit/push. The original run's quality PASS and reset/lint PASS are historical CI evidence, not a green result for this uncommitted workflow. Generated types were not checked against the development database locally; the unchanged CI type gate remains required. No HTTP/lifecycle suite was rerun because neither runner nor its isolation implementation changed.

Final source scope is exactly the three modified tracked paths listed above. The index remains empty; no untracked repository artifacts, staging, commit, push, deployment or Work Package B work occurred. The review ZIP includes these three source files, an exact unified diff and a SHA-256 manifest; its checksum is provided separately in Downloads.
