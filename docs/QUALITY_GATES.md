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
- [ ] `pnpm db:test`
- [ ] `pnpm db:test:concurrency` (owned disposable database; real competing sessions)
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

Do not casually describe the product as "secure", "performance is excellent", "production ready", or "finished" unless the relevant gate has actually been measured/audited.

Prefer precise wording such as:

- "security foundation implemented; release hardening pending"
- "functional performance is acceptable for the current test roster; formal budgets not yet measured"
- "checkpoint implementation complete; release-quality follow-ups remain"
