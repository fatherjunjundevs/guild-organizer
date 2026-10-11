# Guild Organizer — Permanent Quality Gates

A feature is **functional** when its intended path works.

A feature is **finished** only when it has passed the applicable quality gates below.

## 1. Product Integrity

- [ ] Solves the intended Guild workflow.
- [ ] Matches the Product Blueprint.
- [ ] Matches roadmap scope.
- [ ] Preserves RTNW vs organizer-owned data boundaries.
- [ ] Preserves historical data where required.
- [ ] Does not hard-code one Guild structure universally.
- [ ] Edge cases are identified.
- [ ] Acceptance criteria are explicit.
- [ ] Relevant docs are updated.
- [ ] The feature advances an original Guild Organizer workflow rather than merely copying another product.

## 2. UX Quality

- [ ] Desktop behavior is intentional.
- [ ] Tablet behavior is intentional.
- [ ] Mobile behavior is intentional.
- [ ] Empty/loading/error states exist where applicable.
- [ ] Keyboard behavior works.
- [ ] Touch targets are appropriate.
- [ ] Focus behavior is correct.
- [ ] No unexpected layout shifts.
- [ ] No oversized invisible hitboxes.
- [ ] Labels use explicit control relationships.
- [ ] No browser-native `alert`, `confirm`, or `prompt`.
- [ ] Destructive actions use in-app Guild Organizer confirmation.
- [ ] Shared patterns use shared components when appropriate.
- [ ] Motion respects reduced-motion settings.
- [ ] Accessibility is considered and verified.
- [ ] Visual language remains consistent.

## 3. Security & Privacy

- [ ] Authentication requirements are correct.
- [ ] Authorization is enforced outside client UI.
- [ ] RLS/policies are correct for protected data.
- [ ] Cross-Guild access is denied.
- [ ] Officer capabilities are enforced where applicable.
- [ ] Direct writes are appropriately restricted.
- [ ] Privileged RPCs validate the actor.
- [ ] Inputs are validated.
- [ ] Critical multi-row operations are transaction-safe.
- [ ] No secret/service-role credential reaches browser code.
- [ ] Logs/errors do not expose sensitive information.
- [ ] Abuse/replay/rate-limit concerns are considered.
- [ ] Important boundaries have security regression tests.

## 4. Performance & Reliability

- [ ] Avoid unnecessary sequential network/DB work.
- [ ] Queries are Guild-scoped and appropriately indexed.
- [ ] Client work is reasonable for expected dataset size.
- [ ] No obvious fetch/rerender loops.
- [ ] Failure leaves data safe.
- [ ] Critical multi-row mutations are transactional.
- [ ] Repeated actions are safe or deliberately rejected.
- [ ] Error/retry behavior is understandable.
- [ ] Concurrency implications are considered.
- [ ] Performance is measured when responsiveness may be affected.
- [ ] No claim of "excellent performance" is based only on subjective local feel.

## 5. Release Quality

As applicable:

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] `pnpm db:lint`
- [ ] `pnpm db:test:concurrency` (all SQL regressions, real competing sessions and production cryptography in an owned disposable database)
- [ ] `pnpm db:types:check`
- [ ] `git diff --check`
- [ ] Browser smoke test
- [ ] Critical E2E coverage exists or follow-up is explicitly recorded
- [ ] Migrations reproduce cleanly
- [ ] Generated DB types match schema
- [ ] Documentation/status updated
- [ ] No unintended files/secrets staged
- [ ] Working tree clean after commit/push

## Definition of Done Template

```text
Checkpoint:
Scope:

Product Integrity: PASS / FAIL / FOLLOW-UP
UX Quality: PASS / FAIL / FOLLOW-UP
Security & Privacy: PASS / FAIL / FOLLOW-UP
Performance & Reliability: PASS / FAIL / FOLLOW-UP
Release Quality: PASS / FAIL / FOLLOW-UP

Known follow-ups:
- ...

Evidence:
- tests:
- DB tests:
- build:
- E2E:
- browser checks:
- performance/security checks:

Result:
FUNCTIONAL / QUALITY-GATED COMPLETE
```

## Precise Status Language

GitHub CI uses `pnpm db:test:concurrency` as the single complete SQL regression/concurrency gate. It discovers every `supabase/tests/*.test.sql` file (the Work Package A baseline is 33 files and 1,401 assertions), then requires 16 concurrency, 130 authorization-concurrency and 31 production-cryptographic assertions plus verified cleanup. CI explicitly provisions the runner's existing digest-pinned PostgreSQL image and private Linux manifest destination; the runner still rejects missing/mismatched images or unsupported Docker targets. The separate Supabase CLI migration reset, schema lint and generated-type check remain required. `pnpm db:test` is the legacy CLI path and lacks the disposable-only resolver SET/session-authorization authority; it is not a substitute for this gate. No migration or application-role privileges are changed to accommodate CI.

Work Package B adds `public_event_lineup.test.sql` to that automatic discovery, preserving all original files and assertions. Its focused owned validation is `node scripts/test-public-event-lineup.mjs`: private projection, actual dedicated-reader SCRAM/effective-configuration checks, separate publication/revocation races and complete log inspection. `node scripts/test-public-event-driver.mjs` exercises the actual `pg` adapter and API route over loopback HTTP in the existing verified Node sidecar, with real owned PostgreSQL backends, fault injection and exact cleanup. Its Redis REST responses are scripted; it is not hosted admission evidence. For browser-only viewer tests, first run `pnpm build`, then `pnpm exec playwright test --config playwright.public-event.config.ts`; this suite neither discovers a development database nor creates application fixtures. Published browser responses are mocked; the production API missing-configuration checks are real. Keep hosted sharing disabled. See [the Work Package B report](reviews/PHASE_6_WORK_PACKAGE_B_VALIDATION.md) for precise remaining gates and the confirmed GitHub pinned-image failure; local passes are not a green GitHub baseline.

Phase 6.3A.5C.1C adds separate local `db:test:http` and `db:test:http:isolation` gates. They require reviewed immutable PostgREST binary/image provenance and real independently owned Docker runs, including exact-resource cleanup. Unknown provenance or an unavailable daemon is BLOCKED, never a runtime pass. Keep the existing 1,401 SQL, 16 lifecycle-concurrency, 130 authorization-concurrency and 31 production-cryptographic integration baselines; previous results do not substitute for rerunning changed infrastructure. HTTP 42501/status/header evidence, actual pool logging/identity controls and cache transitions must pass before local HTTP approval. Hosted gateway/browser validation and CI changes require their separate approvals. See [the checkpoint report](reviews/PHASE_6_3A_5C_1C_VALIDATION.md).

Local authenticated E2E must first pass `pnpm test:e2e:cleanup`. Use the guarded automatic fixture lifecycle; do not ignore deletion errors or use service-role Guild DELETE. Before/after fixture verification, failed-teardown evidence and exact interrupted-run recovery are part of the gate. Historical leftovers are inventoried separately and are not evidence of a clean database. See [LOCAL_E2E_FIXTURES.md](LOCAL_E2E_FIXTURES.md).

Do not casually describe the product as "secure", "performance is excellent", "production ready", or "finished" unless the relevant gate has actually been measured/audited.

Prefer precise wording such as:

- "security foundation implemented; release hardening pending"
- "functional performance is acceptable for the current test roster; formal budgets not yet measured"
- "checkpoint implementation complete; release-quality follow-ups remain"
