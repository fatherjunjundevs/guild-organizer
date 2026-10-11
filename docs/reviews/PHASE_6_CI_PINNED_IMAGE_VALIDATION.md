# Phase 6: CI pinned PostgreSQL image identity correction

Status: local correction verified; awaiting independent source review. Not staged, committed or pushed. GitHub-hosted execution of the correction remains unverified.

## Baseline and failed CI evidence

Repository: `C:\Users\Miguel\guild-organizer`. Branch: `feature/phase-6-publishing-sharing`. HEAD: `8a9f6b88e6c1040308eee76c3f36e5cc44d51736`. Initial working tree and index were clean.

- [CI #93](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38161900345), database job `114536394579`: pinned preparation passed. At `2026-10-11T18:01:46Z`, the complete SQL/concurrency/cryptography step failed with `Pinned PostgreSQL image is unavailable or incompatible; no fallback/pull attempted`, at `localTarget()` line 155.
- [CI #94](https://github.com/fatherjunjundevs/guild-organizer/actions/runs/38178073637), database job `114584591107`: the same preparation passed and failure recurred at `2026-10-11T21:53:55Z`, at the same source line.
- Both logs show a successful pull of the exact pinned digest immediately before rejection. Migration reset and schema lint passed; generated types were skipped; the Supabase stop step passed. This is not a successful isolated SQL execution.
- The existing workflow runs on `ubuntu-22.04`; the supported image/daemon platform is Linux/amd64. Workflow provisioning remains unchanged.

The confirmed source defect equated a registry repository/index digest with the daemon's local image ID in `localTarget()`, manifest validation and container validation. Docker's [image-inspect API source](https://github.com/moby/moby/blob/master/api/types/image/image_inspect.go) explicitly distinguishes a configuration-based ID from repository manifest digests. Docker also documents [multi-platform index versus per-platform digests](https://docs.docker.com/dhi/explore/security-concepts/digests/). A successful digest pull does not make these identifiers interchangeable.

## Sanitized read-only identity evidence

Unchanged pinned reference:

```text
public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9
```

Local `docker image inspect` and curated daemon inspection reported:

```text
Image ID: sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9
RepoDigests: [the exact pinned reference above]
Image OS/architecture: linux/amd64
Daemon OS/architecture: linux/x86_64
```

Read-only `docker buildx imagetools inspect <pinned-reference> --raw` reports `application/vnd.oci.image.index.v1+json`. Its Linux/amd64 platform manifest is `sha256:8fd52f740917ecfce63117428e84e04cbb9c8fed6771431c55e259ebb991e51b`; read-only inspection of that referenced manifest reports configuration digest `sha256:4b2e3fb2d8336c43335441ab1e55fb243f77d0b111eedb504ada14519c945179`. Neither registry inspection downloads layers or pulls an image into the local daemon.

The local image store's reported ID happens to equal the index digest, explaining why the old local check passed. The CI logs did not print inspected Image IDs or RepoDigests, so the exact IDs reported by those historical runners cannot be attested from their logs. The distinct configuration digest is registry evidence, not a fabricated CI inspection result. The invalid cross-identifier equality is established; a reviewed push and completed hosted database job are still required to prove the hosted repair end to end. If that daemon fails to report the exact pinned RepoDigest, the corrected runner will continue to reject it.

## Minimal implementation and invariant

Changed implementation/test paths:

1. `scripts/isolated-postgres-test-cluster.mjs`: remove the falsely universal `imageId` constant; verify and record the actual inspected image ID; compare containers against the recorded ID; revalidate the target immediately after creation.
2. `src/test/isolated-postgres-test-cluster.test.ts`: add 33 focused identity/lifecycle regressions using mocked Docker/ACL subprocesses and real isolated temporary ownership files/leases. Existing boundary expectations remain intact.
3. `src/test/isolated-postgrest-test-service.test.ts`: replace the removed constant import with a synthetic parent-image fixture ID. No HTTP implementation or assertions change.
4. `docs/reviews/PHASE_6_CI_PINNED_IMAGE_VALIDATION.md`: this evidence report.

The new invariant is:

- Inspect only the unchanged immutable pinned reference. `RepoDigests` must be an array containing that exact reference, including repository and digest. A tag, another repository with the same digest, missing evidence, or a Docker error fails closed.
- The actual local image ID must be a string matching `sha256:[a-f0-9]{64}`. It may differ from or equal the pinned digest.
- Require image Linux/amd64 and daemon Linux with `amd64` or `x86_64` architecture. ARM, unknown/missing platform and emulation are not accepted by this checkpoint.
- Persist the verified ID in the existing `target.imageId` ownership field. `container.Image` must equal that field; `container.Config.Image` must still equal the exact pinned reference.
- Reinspect the daemon and pinned image after creation, on each verified operation, cleanup and recovery. The complete recorded target must match fresh inspection. Changed daemon, context, endpoint, image ID or pin fails closed.
- A well-formed ownership manifest alone does not authorize a target. Durable on-disk equality, live pinned-image equality and exact container identity/isolation checks remain necessary before removal. A different SHA-256 in a forged manifest cannot replace the live verified target.

Versions 1 and 2 retain the same strict manifest shape and compatibility. The old ID-equals-index representation remains accepted when it matches current verified inspection. A changed image-store representation causes target mismatch; there is no automatic manifest rewrite, adoption, alternate-image selection or cleanup fallback.

All existing ownership protections remain: local-only daemon and environment guards; protected manifest directory; exact repository/run/name/ID/creation-time labels; private network namespace; bounded memory/CPU/tmpfs; no ports, binds, shared volumes, privileged mode or restart policy; exact database identity; active PID/lease rejection; dependent cleanup ordering; explicit removal intent and verified exact absence. HTTP startup/privacy guards, SQL authentication, resolver permissions and application data boundaries are unchanged.

## Fresh local validation, 2026-10-11

| Check | Result |
| --- | --- |
| Focused PostgreSQL and HTTP ownership tests | PASS: 171 tests in two files, exit 0 |
| New focused cases | 33: distinct/equal digest forms; missing/wrong RepoDigest; invalid ID; unsupported image/daemon platform; absent image; manifest format; target recording; exact cleanup/recovery; changes during and after creation; forged manifest; unrelated container |
| `pnpm exec tsc --noEmit` | PASS, exit 0 |
| `pnpm lint` | PASS without warnings, exit 0 |
| `pnpm test` | PASS: 786 tests across 49 files, exit 0 |
| Actual corrected `localTarget()` on existing Docker Desktop image | PASS, exit 0; read-only context/daemon/pinned-image inspection only |
| CRLF-aware whitespace checks | PASS; tracked diff exit 0 and the new report checked separately; no Git configuration change |

The first development static check caught two test-mock type errors and one unused import. Those were corrected without changing production security assertions; the final checks above are fresh passes.

Lifecycle regressions execute the actual creation, verification, cleanup and recovery coordinators with all Docker and Windows ACL subprocesses mocked. They prove persistence and exact-target selection, including repeat recovery, retained submission evidence after identity changes during creation, and no deletion on untrusted evidence. They are not a fresh real-container PostgreSQL lifecycle or SQL/HTTP run. No actual container lifecycle was necessary for this identity-only correction; startup SQL and authentication logic are unchanged. Production build was not rerun because application/build sources were unaffected.

## Preservation, final state and review package

All 31 independently approved Work Package B working-tree hashes were rechecked against its final manifest and remain byte-identical. `.github/workflows/ci.yml`, dependencies/lockfile, migrations, public application implementation, historical fixtures, resolver authorization and admission/privacy policies remain untouched. No development database was accessed or changed. Actual Docker usage was read-only context, daemon and pinned image/registry metadata inspection; no unrelated container or historical network investigation, image pull/build, creation, start/stop, deletion, migration or reset occurred. No new disposable Docker resource was created, and no Docker cleanup was attempted. Unit-only temporary files and leases were cleaned up.

Final Git baseline remains the expected branch and HEAD, with an empty index: three modified tracked implementation/test files and this one new report. No commit, push, deployment, hosted credential provisioning or public feature activation occurred. Hosted sharing remains disabled. The historical network discrepancy stays unresolved Classification C and was not revisited.

The source-review ZIP contains exactly these four changed source/documentation files and a SHA-256 manifest, with a separate archive checksum. It excludes credentials, dependencies, Git internals and raw CI/runtime logs. The known hosted CI failure is not declared fixed in GitHub until independent source review approves a push and the required hosted execution completes. Stop for independent source review.
