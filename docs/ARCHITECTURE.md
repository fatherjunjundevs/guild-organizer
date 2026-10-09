# Guild Organizer — Architecture & Engineering Guardrails

These are durable implementation rules. Changes may be made deliberately and documented, but they should not drift accidentally.

## Application Experiences

- Public
- Management
- Event Focus
- Member

Do not force organizer complexity into member-facing screens.

## Identity Boundaries

Account identity, Guild membership, and Character identity are separate concepts.

A Character has a stable Guild Organizer UUID. RTNW export `Id` is not identity.

## Guild Authorization

Authorization is enforced at the server/database layer. UI visibility is convenience, not security.

- Owner/Admin have broad management rights.
- Officers receive explicit capabilities.
- Members receive only intended member-facing access.
- Cross-Guild access must be rejected.
- Protected writes use authorized RPC/server boundaries.

Relevant Guild-management capabilities include:

- `roster.manage`
- `imports.manage`
- `templates.manage`
- `events.manage`
- `publish.manage`

`templates.manage` and `events.manage` are active authorization boundaries for the Template Designer and Event Builder. `publish.manage` is already defined in the capability model for the Phase 6 publishing workflow.

## Database Security

For privileged Guild-scoped data:

- enable RLS,
- use explicit Guild scoping,
- revoke unsafe direct writes,
- use narrowly scoped `SECURITY DEFINER` functions when justified,
- fix `search_path` for security-definer functions,
- validate the actor inside the database,
- test denied paths as seriously as allowed paths.

Every new Guild-scoped feature should include cross-Guild isolation tests.

## Mutation Strategy

Important multi-row operations should be transactional, including imports, bulk updates, identity reconciliation, Event publication, and future invariant-sensitive administrative changes.

Repeated operations should be idempotent where practical or explicitly reject unsafe repetition.

## Master Roster Identity

- Organizer UUID is stable identity.
- RTNW `Id` is not identity.
- exact IGN is automatic import matching.
- never guess a rename.
- preserve historical records.
- manual reconciliation must preserve references instead of delete/recreate history.

## Data Ownership

RTNW reimport may update RTNW-owned fields but must not overwrite organizer-owned designation, role, tags, custom fields, notes, Event assignments, or future organizer metadata.

## Event Architecture

```text
Event Type
  -> Template
  -> Event
  -> Event-owned Structural Snapshot
  -> Assignments
  -> Published Version
```

Template edits after Event creation must not silently restructure historical Events. Phase 5 implements the Event-owned structural snapshot and draft assignment layers; assignments reference stable Character UUIDs. Draft duplicate assignments are allowed and surfaced as advisory warnings so organizers can resolve them deliberately.

Published versions are immutable snapshots and remain Phase 6 scope.

### Phase 6.2B publication read and recovery decisions

- Normal Event Builder loads read publication state, independently scoped latest/current version numbers, and an exact version total. They do not load historical seats, assignments, or version pages.
- History loads on demand in descending version-number pages of 10. A maximum-version anchor and an exclusive before-version cursor keep page boundaries stable when another version is published. Each visible version uses exact, Guild/Event/version-scoped HEAD counts; seat and assignment rows are not downloaded to calculate history totals.
- Selected sealed snapshots read each child table in deterministic ID order, in batches of 500. Exact counts and duplicate detection verify every batch. A failed or incomplete read returns an error instead of a partial board; version visibility is rechecked after the read. Display fields, including inactive status, come exclusively from the sealed snapshot.
- Closing History invalidates pending responses and releases rendered history content. Read failures support retry, modal dismissal remains available while loading, and snapshot requests announce loading/completion.
- After a confirmed publication mutation, a failed status reload is treated as a read failure. The UI hides obsolete status and offers a read-only recovery action. An interrupted mutation with unknown outcome follows the same recovery boundary; neither path automatically retries the write.
- These decisions use the existing schema, session client, RLS, and immutable publication RPCs. No migration or broader release-readiness claim is implied. Visual QA and formal large-history performance budgets remain separate validation work.

### Phase 6.3A.2 share-link database foundation

- `private.event_share_links` holds one active bearer link per Event, enforced by a partial unique index. A composite Guild/Event foreign key prevents scope mismatches. RLS has no policies, and PUBLIC, anon, authenticated, and service_role have no direct table privileges. No additional anonymous private-schema access is granted.
- Five authenticated management RPCs enforce `private.require_publish_manage` inside PostgreSQL and match both Guild and Event. Create/rotate require active Events; revoke and management reads allow archived Events in active Guilds. Mutations lock the Event first, following publication lock ordering. Rotation revokes and scrubs the old envelope before inserting its replacement in one transaction; any failure rolls back both steps. Stale revocations affect only the targeted identity. An identical active creation request is recognized; rotation is deliberately not automatically repeated after an uncertain outcome.
- Create/rotate also require a trusted server HMAC proof; `publish.manage` alone cannot provision caller-chosen credentials. The original proof-free RPCs are dropped entirely by `20261008225953_event_share_link_provisioning_hardening.sql`.
- Digests are unique lowercase SHA-256 hex. Active recovery envelopes contain exactly 32 ciphertext bytes, a 12-byte AES-GCM nonce, a 16-byte authentication tag, and a bounded encryption key ID. These constraints validate shape only. PostgreSQL authenticates the trusted server's approval of the exact material using a separate provisioning HMAC key. The database still cannot independently decrypt AES-GCM or prove randomness: the trusted server must generate the token/envelope itself, never sign browser-supplied cryptographic fields, and verify recovered plaintext against the digest.
- Phase 6.3A.3 must generate 32 random bytes server-side, encrypt with a dedicated server-only AES-256-GCM key, bind format/Guild/Event/link identity as associated data, and verify the reconstructed canonical token against its digest after authenticated decryption. Client-supplied digests, ciphertext, nonces, tags, and key IDs must never be forwarded by server actions. Missing keys or failed verification must show recovery failure; they must not return an unchecked token or silently rotate the link. No encryption keys, server integration, or UI are introduced in 6.3A.2.
- A write guard makes identity, scope, digest, creation metadata, and active recovery material immutable. Revocation is permanent and removes the entire recovery envelope. Revoked digests remain reserved while the Event exists. Actor references may become null only when the referenced profile has actually been deleted. Event/Guild cascades can remove their link records; application roles cannot delete records to reclaim a digest.
- `resolve_event_share_link(text)` is executable by anon and authenticated. It accepts only `v1.` followed by the canonical unpadded base64url encoding of 32 bytes, including validation of the final padding bits. The exact token string is hashed inside PostgreSQL; the stored digest is never accepted as a credential. Malformed, unknown, revoked, unpublished, archived, and missing-current-version cases return zero rows. No Guild/Event/version selectors or alternative overloads exist.
- The resolver reads the active Guild/Event and current sealed publication pointer in one statement snapshot. It returns only published Event name, published Event Type name, current version number, and current publication timestamp. It never reads roster or snapshot-child tables, returns descriptions/internal IDs, or exposes history. Draft edits do not affect the projection; publication updates and republishing change the version through the same non-revoked link. New resolutions after committed unpublish/revocation fail; already delivered or in-flight data cannot be withdrawn.
- New RPCs use the trusted `postgres` migration owner, fixed empty search paths, schema-qualified references, and explicit EXECUTE grants with PUBLIC/service-role execution revoked. The public definer entry points deliberately follow the existing publication RPC boundary: anonymous access bypasses table RLS only for the audited bearer-authorized projection, while every management entry point verifies the authenticated actor. `pgcrypto` must be in `extensions`; the migration checks this and never relocates an existing extension.
- SQL tests exercise actual authenticated/anonymous roles, private-table restrictions, management capabilities, attestation tampering, projection fields, canonical-token rejection, rollback, revocation, and immutable publication compatibility. `pnpm db:test:concurrency` runs the suite in `supabase/concurrency-tests/`, outside ordinary pgTAP discovery. Its dedicated runner verifies the local CLI Docker project/workdir, creates a randomly named empty database, restores schema-only Auth primitives and replays every migration. No development data is copied or reset. Before committed fixtures, every connection checks the exact database name, ownership marker, and foreign-server target. Docker connection details are discovered at runtime; SQL contains no credentials or project hostname. The runner verifies cleanup and removes only its ownership-matched database in finally. A secret-free temporary ownership manifest supports recovery after process termination; the next run verifies container/root/name/comment ownership and that the recorded process has stopped before reclaiming a leftover. SQL cleanup steps are independently best-effort. An unmarked database is never automatically deleted. This suite also runs explicitly in CI.
- Anonymous Data API RPC calls can bypass any later Next.js endpoint limiter. Before public exposure, apply and verify request/body limits, database statement timeouts, API/database abuse monitoring, and rate limiting that covers direct `/rest/v1/rpc/resolve_event_share_link` access (an API/database boundary control, not just the app endpoint). Supabase Auth rate limits are not a resolver rate limit. Indexed lookup and strict token length keep each resolution bounded, but full production rate limiting is not implemented here. Logging/tracing must redact bearer bodies and prevent parameter/error logs from recording tokens; never log token digests or recovery envelopes. Deployment/API configuration and sensitive-data-safe observability remain release gates.


#### Trusted provisioning protocol: go.share.provision.v1

The hardened create/rotate RPCs append `p_provisioning_key_id text`, `p_provisioning_expires_at bigint`, and `p_provisioning_mac bytea` to their original arguments, with no defaults or legacy overloads. Authenticated users retain EXECUTE but must provide both their actual user JWT and a valid server attestation. PUBLIC, anon, and service_role cannot execute provisioning. State/copy/revoke and the four-field anonymous resolver retain their existing contracts. No general signing endpoint exists.

The signed bytes are UTF-8 encoding of these **14 fields in this exact order**, joined with one LF byte (0x0A), without a trailing LF:

1. Literal `go.share.provision.v1`.
2. Literal `create` or `rotate`.
3. Actual authenticated actor UUID.
4. Guild UUID.
5. Event UUID.
6. New link UUID (create's link ID or rotate's new link ID).
7. Expected previous link UUID for rotate; literal `-` for create.
8. SHA-256 token digest, lowercase 64-character hex.
9. Ciphertext, lowercase 64-character hex (32 bytes).
10. Nonce, lowercase 24-character hex (12 bytes).
11. Authentication tag, lowercase 32-character hex (16 bytes).
12. AES recovery key ID.
13. Provisioning key ID.
14. Proof expiration: integer Unix seconds as canonical decimal, no sign/leading zero padding.

UUID fields use lowercase hyphenated PostgreSQL canonical text. Both key IDs use only ASCII `[A-Za-z0-9_-]{1,32}`; byte fields and digests are fixed lowercase hex. These formats exclude separators, so the encoding is unambiguous. PostgreSQL reconstructs the message from typed RPC arguments and `auth.uid()`; it never accepts a preconstructed signed message. HMAC-SHA-256 uses the raw 32-byte provisioning key and returns a raw 32-byte MAC (PostgREST bytea uses its usual hex representation). SQL tests include an independently computed Node HMAC golden vector; concurrent requests are independently signed with Node's built-in crypto.

The trusted server must set expiration to `floor(server Unix seconds) + 120` or less. PostgreSQL accepts only `dbNow - 5 <= expiration <= dbNow + 125`, using fractional Unix seconds from `clock_timestamp()`: five seconds of tolerance on either end for clock skew, no unbounded future expiration. Proof and key validity are checked before acquiring and again after waiting for the Event lock. Authentication/capability checks remain database-enforced. Proof failures use a uniform 42501 error without key/token/material details; structurally malformed recovery fields use 23514. The MAC comparison visits all 32 bytes, accumulating XOR/OR differences without early exit. PostgreSQL/PLpgSQL offers no formal constant-time execution guarantee; bounded requests, database timeouts, and API abuse controls remain necessary.

`private.event_share_link_provisioning_keys` stores a versioned ASCII ID, exactly 32 key bytes, activation timestamp, and optional retirement timestamp. RLS has no policies and every application role lacks table access. Only privileged operational provisioning can install or retire keys; there is no key-management RPC. The migration starts empty and missing, unknown, not-yet-active, or retired keys fail closed. Retirement takes effect for subsequent verification; already completed operations are not undone. Operations already in flight cannot be retroactively withdrawn.

For Phase 6.3A.3, use a dedicated server-only provisioning secret and key ID, never a NEXT_PUBLIC value, separate from the server-only AES-256-GCM recovery key/key ID. Generate once in a trusted secret-management process and install identical raw bytes in the server secret store and the private database key row through a privileged, parameterized, sensitive-logging-disabled operation. Never put live keys into migration SQL, command arguments, test output, telemetry, errors, or client DTOs. Rotation installs a fresh ID/key with an activation time, switches trusted servers to signing with it, then retires the old key after the bounded proof window and clock tolerance. Never reuse IDs or reactivate retired production keys. Missing server configuration must stop provisioning; no fallback to client data or another key. Existing issued links resolve independently of provisioning keys. AES decryption/recovery remains separate, and AES key availability has its own recovery-error behavior.

An identical active create with a valid proof remains recognizable. Valid replay cannot resurrect revoked identities or replace a newer link; rotation still requires the expected active ID. Unknown outcomes or expired proofs lead to an authorized state/copy read, never blind automatic mutation repetition. The future server must retain the intended identities for comparison and recover tokens only after authenticated AES-GCM decryption with scoped associated data and digest verification.

**Deployment ordering:** keep Data API/application share-link access closed for the entire migration rollout. Apply the foundation and hardening as one controlled migration set before opening access, even if the migration runner commits files separately. Verify pg_proc contains only the proof-bearing create/rotate signatures and their restrictive grants, then provision keys and deploy the trusted server integration. Never expose a production interval with only the foundation migration applied. A rollback must not restore legacy provisioning grants/signatures; fail closed instead. No production keys or server integration are implemented in this checkpoint.

### Phase 6.3A.3 secure share-link server integration

- `share-link-config.ts`, `share-link-crypto.ts`, and `share-link-server.ts` import `server-only`. They require the Node.js runtime. Reusable authenticated server operations exist without new UI, Server Action endpoints, Route Handlers, or public pages. Only `share-link.ts` contains client-safe DTO types.
- Every operation validates and canonicalizes UUIDs and calls the existing cookie/session Supabase client plus `auth.getUser()`. The actual validated user supplies the HMAC actor. PostgreSQL enforces `publish.manage`, active membership/Guild checks, and Guild/Event scope. No service-role client is used. Input schemas reject unknown fields; callers cannot supply actors, tokens, envelopes, digests, or proofs.
- Provisioning generates a fresh link UUID, exactly 32 random token bytes, and a fresh 12-byte nonce through Node crypto. AES-256-GCM encrypts the original bytes. Associated data is UTF-8 encoding of five LF-separated fields, without trailing LF: `go.share.recovery.v1`, `v1`, canonical Guild UUID, Event UUID, link UUID. The canonical token is `v1.` plus the unpadded base64url bytes, and SHA-256 covers that whole token string. No plaintext token is returned by provisioning or written to PostgreSQL.
- The TypeScript HMAC signer reproduces the existing 14-field PostgreSQL protocol exactly and sets integer expiration to `floor(Date.now()/1000) + 120`. It is an internal server-only helper, never a signing endpoint. The database's five-second clock tolerance and post-lock verification remain authoritative. Provisioning and AES keys must have different bytes.
- Config loads lazily: state/revoke do not depend on crypto keys; explicit copy needs only recovery keys and trusted origin. Recovery selects the recorded AES key ID, validates strict bytea field sizes, authenticates associated data/tag, reconstructs canonical encoding, and compares the recalculated digest with Node `timingSafeEqual`. Missing keys, corruption, or scope mismatch return sanitized recovery failure without a mutation.
- Only `copyEventShareLink` returns `<APP_ORIGIN>/share/event#token=v1.<bytes>`. It requires an explicit current link ID and checks authorized active state before payload retrieval and again after decryption. An observed rotation/revocation withholds the URL. A mutation after the final read remains an unavoidable response race; the database resolver rejects the revoked token. Never call copy from page rendering or put its URL into HTML, metadata, general Event props, analytics, logs, or cached data. Phase 6.3A.4 should invoke it only from an explicit authenticated copy interaction.
- Create/rotate/revoke submit exactly one mutation with PostgREST retries explicitly disabled. A thrown request, unclassified transport error, or unexpected mutation response returns `mutation_unknown` with the intended link ID and a read-only state recovery instruction. Known PostgreSQL rejection codes are sanitized. Confirmed writes followed by failed refresh return `outcome: confirmed`, `state: null`, `refresh: required`; stale state is not returned. Recovery reads never retry a write. Stale revoke uses the exact requested identity and cannot target a replacement.
- Tests cover crypto/configuration, safe DTO serialization, session authentication, rejected reads/writes, and races without UI. The guarded disposable runner compiles the actual TypeScript crypto in an isolated Node test runtime, checks modified/expired proofs using authenticated PostgreSQL roles, exercises real generated AES envelopes and encrypted copy recovery, and uses the same production signer for its real concurrent requests. This verifies TypeScript/PostgreSQL compatibility, not an anonymous page or end-to-end HTTP share flow.
- Exact configuration and operational ordering are documented in [SHARE_LINK_SERVER_CONFIGURATION.md](SHARE_LINK_SERVER_CONFIGURATION.md). Keys were not added to environment files or provisioned in production. Direct anonymous RPC rate limits, token-safe API/database logging, public-page fragment handling, no-store responses, and indexing/referrer controls remain release work.

## UI Architecture

Prefer reusable shared primitives as the interface grows:

- Button
- Input
- Select
- Checkbox
- Combobox
- Dropdown
- Dialog
- ConfirmDialog
- Toast
- Surface
- StatusChip
- EmptyState
- LoadingState
- ErrorState

Permanent rules:

- never use browser-native `alert`, `confirm`, or `prompt`,
- use Guild Organizer in-app destructive confirmation,
- use explicit `<label htmlFor>` relationships,
- do not make broad blank regions clickable through wrapper labels,
- avoid layout shifts when editing one item in a grid/list,
- maintain keyboard/touch usability and responsive parity.

## Accessibility

Target WCAG 2.2 AA.

Verify keyboard use, visible focus, dialog focus trapping/restoration, semantic structure, accessible names, ARIA where needed, touch targets, contrast, and reduced-motion behavior.

## Performance Strategy

Do not over-engineer before measurement.

Before adding pagination, virtualization, caching layers, or similar complexity:

1. measure the bottleneck,
2. define a target,
3. implement the smallest useful optimization,
4. measure again.

### Phase 3 Master Roster performance decision

The Master Roster continues to load the complete Guild-scoped roster so search, filters, sorting, reconciliation context, and organizer selection semantics operate on the full data set. The UI renders at most **200 filtered Characters per page** for both desktop and responsive representations.

This decision followed local Desktop Chrome measurement at the current **1,000-row import maximum**:

- before pagination: about 47,390 DOM elements, 1,000 desktop table rows, and roughly 4.1 seconds from reload to visible roster in the diagnostic run,
- after pagination: about 11,395–11,396 DOM elements, 200 desktop table rows, and roughly 0.88–0.91 seconds from reload to visible roster in isolated repeat runs,
- post-change client search/filter measurements were roughly 0.28–0.35 seconds in isolated repeat runs.

These are local development measurements used to justify the implementation choice. They are **not** production performance budgets, SLAs, or a claim that performance work is finished.

Eventually measure Core Web Vitals, LCP, INP, CLS, route/server response time, DB query latency, bundle size, mobile-network behavior, large rosters, large Event boards, and multi-organizer usage.

## Reliability

Before public release, explicitly cover:

- backups
- restore procedure
- migration recovery
- failure-safe imports
- retry/error UX
- concurrent edits
- monitoring
- error reporting
- soft deletion where history matters
- audit logs for important administrative actions

## Testing Strategy

### Database tests
RLS/authorization, invariants, RPC behavior, transactions, cross-Guild denial, and data integrity.

### Unit/component tests
Parsing, filtering/sorting, view-model logic, interactions, and validation.

### E2E tests
Critical end-to-end user journeys, including auth, Guild creation, invitations, Guild switching, RTNW import/reimport, Left Guild/return behavior, manual characters, tags/custom fields, bulk management, permission denial, templates, Event building, publishing, member views, and IGN search.

A single landing-page smoke test is not enough for release.

## CI Quality

Continue automated lint, tests, build, E2E, clean DB reset, DB lint/tests, and generated DB type verification.

## Security Hardening Before Preview/Public Release

Explicitly review/implement:

- rate limiting
- abuse protection
- Content Security Policy
- HSTS
- `X-Content-Type-Options`
- Referrer Policy
- appropriate Permissions Policy
- dependency vulnerability scanning
- secret scanning
- session/auth behavior
- invite replay/abuse scenarios
- authorization regression coverage
- production Supabase Security Advisor
- sensitive-data-safe logging

Do not describe security as finished until this gate is completed.

## Documentation Discipline

When a product or architecture decision changes, update the relevant repository document in the same checkpoint. Important decisions should not live only in chat history.
