# Phase 6.3A.5C.1 resolver access boundary review

Baseline: branch `feature/phase-6-publishing-sharing`, exact HEAD `8835f22820072ccc1a432e6a4d380ccf00be2097`, clean worktree and empty index. This checkpoint implements only the resolver database access boundary. No public page, resolver Route Handler, connection adapter, limiter, new dependency or production provisioning was introduced.

## Migration and permissions

The CLI-created additive migration is `20261010002444_event_share_link_resolver_access_boundary.sql`. It checks the existing resolver contract, rejects every pre-existing `go_event_share_resolver` role, creates the restricted NOLOGIN/NOINHERIT role, revokes resolver EXECUTE from PUBLIC/anon/authenticated/service_role and grants public schema USAGE plus resolver EXECUTE. Creation and grants are transactional. It does not alter previously committed migrations or the resolver definition.

The disposable runner compared `pg_get_functiondef` before and after this migration and found it identical. Replaying the migration against the already-created role failed closed without replacing that role. The actual local PostgreSQL version was 17.6. Its non-superuser creator receives an automatic ADMIN grant from supabase_admin to postgres, with INHERIT/SET initially disabled. No Data API role receives membership and the internal role belongs to no other role. Test-only SET authority for the trusted creator and extensions schema USAGE for pgTAP are confined to the owned validation role/database.

Effective privilege regressions verified direct denial for anon, authenticated and service_role; Owner, Admin, publish.manage Officer, events.manage Officer, Member, inactive Officer and foreign Owner JWT identities do not bypass resolver execution denial. The internal role cannot directly read protected link, Guild, Event, Character or Auth records, call management functions, create roles, or assume postgres/authenticator/authenticated authority. Escalation tests change SESSION AUTHORIZATION, rather than relying only on SET ROLE from an administrative session.

PUBLIC privileges are not claimed absent: catalog diagnostics found CONNECT/TEMP available and EXECUTE on `private.set_updated_at` and `private.prevent_membership_identity_change` without private schema USAGE. Built-in/extension privileges also remain outside this application's explicit grants. The effective application-function test includes schema USAGE; protected schema, table and column permissions are checked separately. Re-audit the real deployment target before operational provisioning or changes to PUBLIC/default grants.

## Actual final validation

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm lint` | PASS, no ESLint warnings/errors |
| `pnpm test` | PASS: 455 tests, 41 files; includes 15 new role-ownership tests |
| `pnpm build` | PASS, Next.js 16.3.8 production build |
| `pnpm db:test:concurrency` | PASS: 39 migrations replayed into an empty, verified owned database |
| All SQL regressions within that guarded runner | PASS: 1,401 assertions, 33 files |
| Dedicated resolver access SQL file | PASS: 27 assertions |
| Existing share-link lifecycle SQL file | PASS: all 311 assertions retained |
| Management-state SQL file | PASS: 101 assertions, including seven added actual-JWT resolver denials |
| Real competing-session lifecycle | PASS: 16 assertions |
| Real authorization-race suite | PASS: 130 assertions |
| Production TypeScript/PostgreSQL crypto integration | PASS: 31 assertions; internal-role resolution and encrypted copy recovery |
| `pnpm db:lint` | PASS, no errors in the unchanged development schema; not evidence that the new grants are deployed there |
| `pnpm db:types:check` | PASS against development; unchanged resolver definition/signature independently verified in the disposable target; no types regenerated |
| `git diff --check` | PASS |

Initial implementation probes failed on trusted-creator membership/OID handling, test-only pgTAP schema access and harness issues. Those were corrected before the complete passing runs. Cleanup guards initially refused unexpected membership state and retained ownership evidence. Recovery subsequently checked exact run identity, OID, marker, attributes, trusted membership and absence of shared dependencies before removing only the owned test role. Final validation left no runner-created role or database behind.

SQL lifecycle coverage still verifies malformed/unknown tokens, sealed metadata, draft isolation, publication update, unpublish/republish, rotation rollback, replacement resolution, revoked tokens and Event/Guild archival. Positive resolution now runs under the internal role, not anon or authenticated. Production crypto assertions preserve HMAC/AES compatibility and actual authenticated management authorization. Unit/component failures are injected; SQL and concurrency assertions use actual PostgreSQL roles/sessions. No HTTP/browser test was executed for this checkpoint.

## Intentionally pending checks

- The new migration was **not applied to development**. A read-only catalog/migration-history check confirmed it absent and the earlier anonymous/authenticated execution grants still present there.
- Ordinary `pnpm db:test` was not run against the unmigrated development target. All its 33 SQL files instead passed in the guarded disposable database. Internal-role SQL tests also require the disposable runner's trusted test-only SET and pgTAP context; do not add those testing privileges to a deployed resolver role merely to run the ordinary CLI suite.
- Default/configured browser E2E was not run. Updated sharing tests require the new grants; applying this migration to development requires separate approval. Existing browser fixture creation/cleanup helpers remain unchanged.
- Direct PostgREST GET/HEAD/POST denial for anon, authenticated and service_role remains an explicit next-checkpoint gate. SQL EXECUTE denial is verified but is not claimed as HTTP evidence.
- The future dedicated runtime connection, TLS/pooling and operational provisioning are not exercised. No login credentials were created for the resolver role.

## Data and safety evidence

The runner reuses the established local repository/project/Docker/loopback/database identity guard. It clones only Auth schema definitions, never development data, and writes fixtures exclusively into its exact ownership-marked disposable database. Cluster-role intent is durably recorded before creation; collision, unconfirmed ownership, altered role attributes, untrusted membership or external dependencies fail closed. Recovery skips an active runner and never adopts a genuine pre-existing role. Missing ownership evidence requires review, not an override.

Before and after the passing run, development totals were unchanged: 339 Guilds, 339 Auth accounts, 146 Events, 170 publication versions and 29 share-link records. Historical inventory was not regenerated or repaired: the 338 previously inventoried historical pairs and unmatched records remain intentionally untouched. Counts alone are not an identity-level re-inventory or a claim of a clean development database.

Final read-only checks confirmed the temporary resolver role absent, zero matching resolver-validation manifests remaining, and the new migration still unapplied to development.

No environment secret files were changed or secret values printed. Local test credentials remained in memory within established guarded helpers. No reset, historical deletion, application permission change, staging, commit, push or deployment occurred. The migration exists only in source and was exercised only in the owned disposable target.

## Remaining release blockers

Independent source review and approved migration application/HTTP validation are pending. Public resolution must remain unavailable until a least-privilege server connection, controlled endpoint, trusted proxy identity, distributed fail-closed admission and token-safe observability exist. The public page additionally requires fragment handling, no-store caching, referrer/indexing restrictions and an approved sealed lineup/search contract. Rollback must keep direct grants closed rather than restoring anonymous execution. See [architecture](../ARCHITECTURE.md) and [configuration](../SHARE_LINK_SERVER_CONFIGURATION.md).

Checkpoint implementation and isolated database evidence are ready for independent review; this is not public-sharing release completion.
