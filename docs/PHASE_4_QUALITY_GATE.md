# Phase 4 — Event Template Designer Quality Gate

## Status

**Phase 4 is quality-gated complete locally.**

This document records evidence for the Phase 4 Event Template Designer integration and quality gate. It does not claim that the whole product is production-ready; broader preview/public-release hardening remains in later roadmap phases.

## Scope

Phase 4 covers reusable Guild-owned Event Template design:

- Guild-defined Event Types,
- reusable Templates with Draft / Active / Archived lifecycle,
- flat Team (Section) -> Party -> Slot structure,
- optional Area -> Team (Section) -> Party -> Slot structure,
- custom Area, Team, and Party names,
- configurable 1–8 seats per Party,
- Party seat-count resizing with explicit destructive confirmation,
- optional per-seat role requirements,
- Team and Party ordering,
- canonical readiness validation,
- read-only ordered preview,
- guarded activation,
- structural edit rules that return Active Templates to Draft,
- independent Template cloning,
- responsive Template-board overflow/scroll behavior,
- capability-gated Template management.

## Product Integrity — PASS

- Event Types and Templates are Guild-owned rather than globally hard-coded.
- Both flat and Area-grouped hierarchy modes are supported.
- Template structure is reusable and remains separate from future Event-owned structural snapshots.
- Template cloning creates independent Draft copies with fresh structure identifiers.
- Existing Template changes do not mutate a clone, and clone edits do not mutate the source.
- Custom seat counts are supported instead of assuming a universal five-seat Party.
- Active structural edits return the Template to Draft and require fresh readiness validation before reactivation.
- Archived Templates remain structurally read-only until restored.

## UX Quality — PASS for Phase 4 scope

- Organizers can create Event Types and reusable Templates from the management UI.
- Team creation supports custom starting Party counts and 1–8 seats per Party.
- Existing Parties can be resized from 1–8 seats.
- Shrinking a Party requires explicit in-app confirmation before trailing seats are removed.
- Role-bearing trailing seats are never removed on the first submit; the organizer must explicitly confirm the destructive reduction.
- Template readiness issues are shown in the designer.
- Ordered preview is read-only.
- Team and Party reordering support pointer drag on desktop and explicit directional controls for keyboard/touch workflows.
- Party boards use contained horizontal overflow on narrower layouts.
- Party/Team deletion preserves relevant page/board scroll position instead of producing the previously observed jump/bounce behavior.
- Browser-native `alert`, `confirm`, and `prompt` are not used for Template destructive flows.

## Security & Privacy — PASS for Phase 4 scope

- Template authorization remains enforced outside client UI.
- Owners/Admins retain management access through the established Guild authorization model.
- Officers require the explicit `templates.manage` capability.
- Members cannot enter Template management.
- Database/RPC tests cover Template authorization, Guild scoping, lifecycle rules, hierarchy invariants, ordering, cloning, validation/activation, and Party layout mutation.
- Critical multi-row Template structure and clone operations use database RPC boundaries.
- No service-role credential is exposed to browser code.

This is not a claim that later preview/public-release security hardening is complete.

## Performance & Reliability — PASS for Phase 4 scope

- Template mutation paths preserve database invariants through RPC-backed operations.
- Team/Party ordering and clone operations have regression coverage.
- Party resize keeps retained seat identifiers/role requirements intact and removes only trailing seats when explicitly confirmed.
- The responsive Team-board regression found during Phase 4.4B was fixed by allowing Team grid items to shrink to available width so wide Party rows overflow inside their own Party board.
- E2E coverage verifies that the Party board has a real horizontal scroll range on a narrower viewport and that Party/Team deletion preserves scroll position.
- No formal production performance budget is claimed for Template Designer. Large Event-board and multi-organizer performance work remains in later roadmap phases.

## Release Quality — PASS

Latest local Phase 4 gate evidence:

- `pnpm exec tsc --noEmit` — PASS
- `pnpm lint` — PASS
- `pnpm test` — PASS, 19 files / 146 tests
- `pnpm build` — PASS
- `pnpm test:e2e` — PASS, 16 tests
- `pnpm db:lint` — PASS, no schema errors
- `pnpm db:test` — PASS, 24 files / 740 tests
- `pnpm db:types:check` — PASS, generated DB types up to date
- `pnpm exec supabase db advisors --local` — PASS, no issues found
- `git diff --check` — PASS apart from expected Windows LF/CRLF conversion notices
- focused Template E2E — PASS, 5 tests
- Phase 4.4A clean migration replay — PASS after the final Phase 4 database migrations
- Phase 4.4B introduced no database/schema changes
- working tree was clean after Phase 4.4B commit `53dab23` was pushed.

### Critical Template E2E coverage

Phase 4.4B added browser coverage for:

- Event Type + Template creation,
- custom Party seat counts,
- Party resize up/down,
- destructive seat-removal confirmation,
- role requirements,
- readiness preview,
- activation,
- Active -> Draft lifecycle after structural edit,
- Template cloning and source/clone independence,
- Template authorization,
- Party/Team deletion scroll preservation,
- responsive Party-board horizontal overflow.

The full Playwright suite passed with all 16 tests after this coverage was added.

## Known Follow-ups Outside Phase 4

Later roadmap phases still own:

- Event creation from a Template,
- Event-owned structural snapshots,
- assignment workflow and assignment warnings,
- publishing/immutable published versions,
- member-facing lineup/search,
- formal production performance budgets/Core Web Vitals,
- monitoring and error reporting,
- backup/restore validation and recovery drills,
- broader production security hardening,
- staging/production checks,
- multi-organizer concurrency behavior.

## Result

```text
Checkpoint: Phase 4 — Event Template Designer
Scope: reusable Template implementation + Phase 4 integration/quality hardening

Product Integrity: PASS
UX Quality: PASS for Phase 4 scope
Security & Privacy: PASS for Phase 4 scope
Performance & Reliability: PASS for Phase 4 scope
Release Quality: PASS

Result:
PHASE 4 QUALITY-GATED COMPLETE
```
