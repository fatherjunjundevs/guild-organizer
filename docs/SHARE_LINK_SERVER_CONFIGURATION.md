# Share-link server configuration

Phase 6.3A.3 introduces server-only code, without the organizer UI or anonymous page. No live secrets are included in this repository. Do not edit secret files as part of review or validation.

| Environment variable | Required use | Format |
| --- | --- | --- |
| `APP_ENV` | Existing application environment | `local`, `staging`, or `production` |
| `APP_ORIGIN` | Trusted URL construction | HTTPS origin only outside local mode; no credentials, path, query, or fragment. Local HTTP is restricted to localhost/loopback. |
| `SHARE_LINK_PROVISIONING_KEY_ID` | Create/rotate | ASCII `[A-Za-z0-9_-]{1,32}` identifying a database provisioning-key row |
| `SHARE_LINK_PROVISIONING_KEY_BASE64` | Create/rotate | Canonical padded standard base64 of exactly 32 random bytes: 44 characters, ending in `=` |
| `SHARE_LINK_RECOVERY_KEY_ID` | Newly encrypted links | ASCII identifier selecting the active AES key in the recovery keyring |
| `SHARE_LINK_RECOVERY_KEYS_JSON` | Create/rotate/copy | JSON object mapping key IDs to canonical base64-encoded 32-byte AES keys; 1–16 entries |

None of the secret variable names use `NEXT_PUBLIC_`. The provisioning key must differ from every recovery key. There are no fallback/default keys. Active AES IDs must exist in the keyring. Unknown recovery IDs fail without rotating a link. `test_` and `local_` key-ID prefixes are rejected outside local mode. This prefix check supplements operational separation; it cannot identify a test key relabeled as production.

Provisioning and recovery configuration load only when needed. Application build, authorized state reads, and revocation do not require share-link keys. Copy can continue while HMAC provisioning is unavailable, provided its recovery key and origin remain configured. Anonymous PostgreSQL resolution does not require either key family.

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

The reusable operations in `src/features/events/share-link-server.ts` use the authenticated session client, validate input, and return sanitized DTOs. They are not exported Server Action or Route Handler endpoints at this checkpoint.

For Phase 6.3A.4, wrap these operations in authenticated Server Actions that accept only the required identifiers. Preserve `mutation_unknown` and confirmed-write/read-failure distinctions, show a read-only refresh path, and retain requested identities for comparison. Do not automatically retry create/rotate. Treat copy results as bearer credentials: return them only for explicit copy, keep them out of server-rendered HTML and general state, do not cache/log them, and never derive the URL origin from request headers.

The future anonymous route must consume the token from the fragment in the browser. No anonymous route is introduced here. Direct Supabase resolver abuse protection and sensitive-parameter-safe observability remain release blockers, alongside no-store/indexing/referrer controls for that future route.
