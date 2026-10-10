# Phase 6.3A.5C.1B — Independent PostgreSQL security tests

## Baseline and scope

Starting branch: `feature/phase-6-publishing-sharing`.
Starting exact HEAD: `567ed26858e220c18b3dad06aca42e162abbccef`.
Worktree and index were clean before editing. No commit, staging, push, deployment, development migration application, historical cleanup or dependency installation is part of this checkpoint.

The concurrency runner now creates a whole independently owned PostgreSQL cluster instead of a database inside the development cluster. No development credential discovery, Supabase CLI status, development Auth schema dump, development SQL or legacy recovery remains in that runner. Existing application migrations, SQL/concurrency suites, production cryptography, resolver grants and browser fixture lifecycle code are unchanged.

## Implemented boundary

The installed Supabase PostgreSQL image `17.6.1.171` is pinned to `public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9`. Its exact local image ID/digest is checked before resource creation. No image pull, mutable-tag fallback or shared-cluster fallback exists. A supported local Linux Docker endpoint and daemon identity are required; Docker connection overrides fail closed.

Each random run creates one container with network `none`, no published ports, no development network or bind/volume mounts, private IPC, no restart policy, 2 CPUs, 2 GiB memory and a 1 GiB PostgreSQL tmpfs. SQL statements and idle transactions are bounded to 120 seconds. Readiness and Docker commands have deadlines. Commands use Node argument arrays; sensitive setup uses stdin.

Durable intent precedes container creation. A protected, local-only manifest records the repository/daemon/image identity, run, exact full container ID, creation timestamp, ownership labels, phase and database system identifier/OID/comment. Windows ACL checks passed in the actual local environment. Manifests never contain passwords, cryptographic keys or tokens. Removed tombstones remain outside Git for repeatable verification. Only one explicitly identified inactive run can be recovered; active PIDs and live TCP leases veto recovery, and a per-run exclusive cleanup lock prevents competing removal.

Container and database identity are rechecked before SQL execution. Cleanup persists removal intent before database/container deletion, rechecks the complete ownership boundary, removes only the exact owned container, closes its sessions and confirms absence with successful Docker inspection/listing. Failures retain evidence and make the run unsuccessful. It never drops a role in a shared cluster, prunes Docker, scans legacy manifests or adopts historical fixtures.

## Bootstrap and authentication evidence

The pinned image supplies Supabase base roles, Auth schema and extension libraries. Test-only bootstrap SQL renders `auth.uid()` from [Supabase Auth v2.197.0](https://raw.githubusercontent.com/supabase/auth/v2.197.0/migrations/20220224000811_update_auth_functions.up.sql). Its legacy claim setting, current JSON claims and precedence were exercised. Bootstrap checks verify PostgreSQL 17, restricted postgres authority, superuser supabase_admin authority, API roles, authenticator memberships, Auth table ownership/grants and pgcrypto/pgTAP/dblink availability. Application migrations execute under postgres, not a substituted superuser.

The helper temporarily uses trust only inside the network-isolated bootstrap container. It replaces final TCP rules with SCRAM on IPv4 loopback and reject rules elsewhere. Both a wrong-password denial and a correct-password PostgreSQL connection passed. Non-superuser dblink concurrency sessions passed with fresh in-memory credentials. Unix socket trust remains limited to privileged docker exec in the owned container.

An actual incompatible postgres-superuser bootstrap probe failed and rolled back. The resolver definition comparison remained identical before/after access-boundary migration. Same-cluster role collision remained rejected; two independent clusters simultaneously contained the same resolver role without interference.

## Actual validation

| Check | Result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS: 499 tests, 42 files; 44 isolated-infrastructure unit tests |
| `pnpm build` | PASS: Next.js 16.3.8 production build |
| `pnpm db:test:isolation` | PASS: 27 real Docker/PostgreSQL lifecycle assertions |
| `pnpm db:test:concurrency` | PASS: 39 migrations, 1,401 SQL assertions / 33 files, 16 lifecycle concurrency, 130 authorization concurrency, 31 production-crypto integration assertions |
| `git diff --check` | PASS |

The lifecycle suite used real independently owned containers. It exercised creation/removal, two independent system identities, actual name collision, bootstrap rejection/rollback, unchanged resolver bodies, same-cluster role rejection, independently scoped records, active-run/unregistered-run denial, corrupted manifests, database identity mismatch, injected removal failure, lost removal-response recovery, duplicate cleanup, repeat recovery, two killed-child interruption windows, and a cleanup-failure subprocess with nonzero exit followed by verified recovery. Removal failures and lost-response windows are deliberately injected around real resources; they are not claims of a real Docker daemon failure.

Unit coverage additionally tests wrong daemon/image/context, incorrect labels/networks/mounts/resource limits, missing/corrupt ownership evidence, unavailable manifest destination, credential-field persistence rejection, Docker overrides, PID reuse/uncertainty and an active lease paired with a misleading dead PID.

The baseline assertions are retained without weakening or editing their SQL. Authorization coverage still observes actual blocking sessions and checks committed capability/membership/role/Guild/catalog revocations, contention, commit/rollback ordering, different Events, isolation levels and proof expiry. Existing sealed snapshots, lifecycle semantics, permission denials, AES copy recovery and TypeScript/PostgreSQL HMAC compatibility remain covered. Counts are unchanged from the preceding checkpoint; bootstrap and infrastructure probes are additional.

## Cleanup and development-data evidence

All passing validation runs removed their exact temporary containers and therefore their entire temporary databases, roles and stored credentials. The lifecycle suite compared pre-existing non-test full container IDs/names before and after and found the inventory unchanged. Independent test containers are excluded from that inventory comparison because other runs may legitimately create/remove them; labels do not authorize cleanup, which verifies each exact owned resource separately. No development database connection was made, so no historical fixture contents or credentials were inspected and no development record counts were obtained. Historical fixtures remain intentionally untouched; this is not a claim that development is clean.

Successful removal leaves only secret-free local manifests. The final ownership-labelled container check found no surviving isolated test containers. Legacy manifests and detailed historical inventories were not read, repaired or deleted.

Final local lifecycle verification: 29 exact run manifests, all 29 marked removed; zero unfinished manifests, zero cleanup locks/atomic-write remnants, and zero surviving isolated test containers. These aggregate counts include startup/failure probes and repeated validation runs. Git retained the starting HEAD with exactly ten intended changed/new files and an empty index. Environment-file modification timestamps predate this checkpoint; their contents were not inspected.

Initial standalone bootstrap/SCRAM probing passed. An early runner integration attempt still contained the old primary-database existence check; the new helper correctly rejected that unregistered execution path and removed the owned container. The obsolete check was removed because the helper already creates and verifies the test database. All required suites then passed. Documentation diff inspection also restored following governance/historical-inventory sections after a line-ending-sensitive replacement; those instructions remain preserved.

A concurrent validation attempt completed the first 26 lifecycle checks but failed the old whole-Docker-inventory comparison when another independently owned test run created resources. Its own resources were removed. The comparison now preserves the non-test inventory while exact suite resources remain independently ownership-verified and removed. The corrected lifecycle suite was exercised alongside an independent full database runner; this does not weaken resource deletion authorization.

## Limitations and pending gates

- Missing/corrupt manifests, ambiguous unconfirmed creation, unavailable daemon or changed ownership fail closed and require independent operator review.
- An interrupted recovery holding a durable cleanup lock requires independent review; no automatic stale-lock override exists. This favors preserving evidence over guessing ownership.
- The protection assumes a trusted local operator and Docker daemon. Docker administrators can inspect process memory, socket traffic and temporary cluster storage. SCRAM verifiers and dblink mappings exist inside the temporary cluster. tmpfs can be swapped; no guaranteed memory erasure is claimed.
- The pinned PostgreSQL 17.6 image matches the established test baseline. It is not a claim of current production patch readiness; changing it requires a reviewed compatibility upgrade. Current Supabase changelog guidance was checked, including the newer 17.11 rollout.
- Auth compatibility covers the actual SQL primitives used by these migrations/tests, not complete GoTrue HTTP or session-service behavior.
- Ordinary development `db:test`, DB lint/types, default/configured browser E2E and direct PostgREST GET/HEAD/POST denial were not run. No development migration application is authorized here. All 33 SQL regression files instead ran in the isolated target. No HTTP or browser validation is claimed.
- Public sharing remains disabled. Development migration application, HTTP boundary validation, dedicated resolver connection, controlled public endpoint, distributed abuse protection and public-page safeguards require later approval.

Ready for independent source review. No development migration, staging, commit, push or deployment is authorized by this report.
