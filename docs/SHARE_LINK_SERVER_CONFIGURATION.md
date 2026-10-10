# Share-link server configuration

Phase 6.3A.3 introduces server-only code, without the organizer UI or anonymous page. No live secrets are included in this repository. Do not edit secret files as part of review or validation.

| Environment variable | Required use | Format |
| --- | --- | --- |
| `APP_ENV` | Existing application environment | `local`, `staging`, or `production` |
| `SHARE_LINK_INTERFACE_ENABLED` | Organizer UI and Server Actions | Exact `true`, accepted only when `APP_ENV=local`; absent/other values disable sharing. No `NEXT_PUBLIC_` equivalent. |
| `APP_ORIGIN` | Trusted URL construction | HTTPS origin only outside local mode; no credentials, path, query, or fragment. Local HTTP is restricted to localhost/loopback. |
| `SHARE_LINK_PROVISIONING_KEY_ID` | Create/rotate | ASCII `[A-Za-z0-9_-]{1,32}` identifying a database provisioning-key row |
| `SHARE_LINK_PROVISIONING_KEY_BASE64` | Create/rotate | Canonical padded standard base64 of exactly 32 random bytes: 44 characters, ending in `=` |
| `SHARE_LINK_RECOVERY_KEY_ID` | Newly encrypted links | ASCII identifier selecting the active AES key in the recovery keyring |
| `SHARE_LINK_RECOVERY_KEYS_JSON` | Create/rotate/copy | JSON object mapping key IDs to canonical base64-encoded 32-byte AES keys; 1–16 entries |

None of the secret variable names use `NEXT_PUBLIC_`. The provisioning key must differ from every recovery key. There are no fallback/default keys. Active AES IDs must exist in the keyring. Unknown recovery IDs fail without rotating a link. `test_` and `local_` key-ID prefixes are rejected outside local mode. This prefix check supplements operational separation; it cannot identify a test key relabeled as production.

Provisioning and recovery configuration load only when needed. Application build, authorized state reads, and revocation do not require share-link keys. Copy can continue while HMAC provisioning is unavailable, provided its recovery key and origin remain configured. Internal PostgreSQL resolution does not require either key family; after Phase 6.3A.5C.1, direct anonymous/authenticated Data API execution is denied.

## Operational provisioning

1. Keep share-link access closed while applying both foundation and hardening migrations. Verify only the proof-bearing create/rotate signatures exist before opening access. Never deploy only the proof-free foundation.
2. In a trusted secret-management process, generate independent high-entropy 32-byte provisioning and AES keys. Do not reuse invite secrets, JWT signing keys, service-role credentials, or Next.js action encryption keys.
3. Configure server-only secret values in the runtime's secret store. Install the identical raw provisioning bytes in `private.event_share_link_provisioning_keys` with an explicit versioned ID and activation timestamp through a privileged, parameterized database operation. No application-role provisioning/key-management endpoint exists.
4. Disable sensitive statement/error-parameter logging for that operational session and ensure tracing/error systems redact sensitive inputs. Do not put key values into migration SQL, shell command arguments/history, tickets, screenshots, telemetry, or logs. Database administrators and backups containing this private table belong to the trusted security boundary.
5. Keep the AES key exclusively in the trusted server secret store/keyring. PostgreSQL receives only digest and authenticated encrypted recovery material, never the AES key or plaintext token.
6. Verify server/database clock synchronization. The signer uses a 120-second expiry; PostgreSQL accepts only the documented bounded expiry with five-second tolerance. A clock/configuration failure must stop provisioning, not trigger retries or fallback keys.

No production key provisioning commands are executed by repository tests. Unit fixtures use clearly scoped test keys; integration fixtures use random ephemeral keys in a verified disposable database and are cleaned with that database.

## Rotation and retirement

- HMAC: install a fresh ID/key and activation timestamp, switch trusted servers to that ID, then retire the old row after all previous proofs have expired (including clock tolerance and operational margin). Never reuse IDs or reactivate retired production keys. Removing provisioning availability does not invalidate existing links.
- AES: add a new ID/key to the keyring, then change the active ID for new create/rotate operations. Retain prior recovery keys while active links still reference them. Immutable active envelopes are not rewritten. Missing an old AES key prevents copy recovery; it does not silently rotate or invalidate anonymous resolution.
- Revocation permanently scrubs recovery material through the existing RPC. Use an explicit authorized rotate operation to replace a link; never rotate automatically because copy failed or a mutation reply was lost.

## Calling the server operations

The reusable operations in `src/features/events/share-link-server.ts` use the authenticated session client, validate input, and return sanitized DTOs. They are internal server-only functions; Phase 6.3A.4 adds gated Server Action wrappers in `share-link-actions.ts`.

The Phase 6.3A.4 wrappers accept only the required identifiers, preserve `mutation_unknown` and confirmed-write/read-failure distinctions, and return safe management state after confirmed changes. The interface offers read-only refresh and targets the exact displayed identity for copy/rotation/revocation. No mutation is automatically retried. Copy results are bearer credentials: they are returned only for explicit copy, excluded from server-rendered HTML and general state, never cached/logged, and built from the trusted configured origin rather than request headers.

The future anonymous route must consume the token from the fragment in the browser. No anonymous route is introduced here. Phase 6.3A.5C.1 removes direct Data API execution through an additive migration; until that migration is applied, the earlier grants remain in the target. A controlled server adapter, distributed abuse protection and sensitive-parameter-safe observability remain release blockers, alongside no-store/indexing/referrer controls for that future route.

## Phase 6.3A.4 organizer interface and local testing

The organizer interface is now implemented behind a default-disabled, local-only server gate. Owner/Admin and Officers with `publish.manage` see Sharing navigation and the minimal Guild-scoped selector. The draft Builder continues to require `events.manage`; its Share Link control additionally requires publishing authority. Every share-link action checks the gate independently and delegates to the authenticated server-only operations. Disabling the UI does not alter existing database RPC grants; this is an application interface gate, not a new database access policy.

For authorized local work, set process-scoped variables in the shell that launches Next.js, without modifying any environment files:

```powershell
$env:APP_ENV = 'local'
$env:SHARE_LINK_INTERFACE_ENABLED = 'true'
pnpm dev
```

These variables enable state/revoke/UI testing without cryptographic keys. Create/rotate require the existing provisioning and recovery configuration; Copy requires the recovery configuration and trusted origin. Missing configuration produces sanitized feedback, never fallback keys or automatic rotation. Supply any separately provisioned local keys through a trusted process environment, not command arguments, checked-in files, or public variables. To disable the interface in this shell after stopping Next.js, remove its process variable with `Remove-Item Env:SHARE_LINK_INTERFACE_ENABLED`. A running server must be restarted when changing its environment.

For the complete reproducible browser flow, stop any existing port-3000 server and run `pnpm test:e2e:sharing`. This runner verifies the exact local CLI container/project/workdir, generates separate random AES and provisioning keys in memory, installs a random test-only provisioning key with a 30-minute retirement bound, and launches a fresh local dev server with process-only configuration. It runs sharing HTTP/browser tests and the existing publication workflow, then deletes only its exact test key in `finally`. Test account/Guild fixtures use the guarded automatic lifecycle described in [LOCAL_E2E_FIXTURES.md](LOCAL_E2E_FIXTURES.md); checked Guild-before-Auth teardown and remaining-record verification fail the test run on cleanup errors. Run `pnpm test:e2e:cleanup` before broad browser validation. It does not accept production URLs, print key material, or edit environment files. Tracing/video/automatic screenshots are disabled for bearer-copy tests, automatic page snapshots are disabled by the runner, and the intentional mobile screenshot is taken only after the manual URL field is cleared. An interrupted runner's test key expires within 30 minutes; privileged local cleanup may remove its `local_e2e_` record after verifying ownership. Do not use this runner against production.

All enabled UI states say Development only. The `/share/event` page does not exist yet: copied links are not ready to send to members. Staging and production remain disabled even if the flag is set to `true`. Public-page implementation, direct Data API abuse controls, sensitive-safe observability, no-store behavior, indexing/referrer protection, and independent review remain separate release work.

## Internal resolver boundary (Phase 6.3A.5C.1)

The new migration creates `go_event_share_resolver` as NOLOGIN/NOINHERIT with no elevated role attributes. Its explicit grants are public schema USAGE and EXECUTE on `public.resolve_event_share_link(text)`. PUBLIC, anon, authenticated and service_role cannot execute that function after application, even when the authenticated user is an Owner. Existing organizer management grants and PostgreSQL publish.manage checks remain intact. No credential or application connection to this internal role is implemented in this checkpoint.

The role is not a service-role substitute. The future server connection must be separately provisioned with only the reviewed internal resolver authority, parameterized SQL, verified TLS outside the verified local environment, bounded pool/acquisition/query timeouts and appropriate pooler compatibility. Review existing PUBLIC/default privileges and role memberships before provisioning; NOINHERIT does not remove PUBLIC privileges or by itself prohibit SET ROLE. Never grant this role to authenticator, anon, authenticated or service_role. Never store credentials in migrations, manifests, command arguments or repository files.

Migration ordering:

1. Keep public access gates closed and independently review the new migration.
2. Verify the target and that the role name is absent. Every collision fails closed; do not alter/drop an existing role to make deployment succeed. This includes genuine roles already deployed in another database in the cluster.
3. Apply the transactional migration in the approved target. Verify unchanged resolver definition, effective grants, role attributes and memberships. Account for requests already in flight during a real deployment.
4. Refresh the Data API schema cache and test GET/HEAD/POST authorization denial for anonymous, authenticated and service-role callers. An empty successful response does not prove denial.
5. Provision/enable the future dedicated connection only under separate approval. Public resolution stays unavailable until the controlled adapter, trusted ingress, distributed admission and logging/caching/referrer/indexing safeguards pass.

Rollback must fail closed: disable the future adapter and revoke its access where necessary. Do not restore anon/authenticated/PUBLIC grants, change cryptographic contracts or remove publication history. Do not drop a shared role without independent ownership and dependency verification. No production provisioning or deployment is performed by the validation runner.

Current checkpoint validation uses the existing guarded disposable database runner, including all SQL tests, actual-role resolver checks, real concurrent sessions and production TypeScript crypto. It does **not** apply this migration to the existing development database. Updated browser denial expectations therefore remain pending, along with actual Data API GET/HEAD/POST denial. See [validation evidence](reviews/PHASE_6_3A_5C_1_VALIDATION.md). The ordinary `pnpm db:test` and browser suite must not be used to claim the new boundary is deployed while local migration application remains unapproved.
