# Phase 5 — Guild League Builder / Core v1 Quality Gate

## Status

**Phase 5 is quality-gated complete locally.**

This document records evidence for the Phase 5 Guild League Builder / Core v1 integration and quality gate. It does not claim that the whole product is production-ready; publishing, member-facing sharing, preview/public-release hardening, formal production performance budgets, monitoring, recovery drills, and broader security hardening remain in later roadmap phases.

## Scope

Phase 5 covers creation and management of draft Guild Events from reusable active Templates:

- Event creation from an active Template,
- immutable Event-owned structural snapshot copied at creation time,
- Event management/list/create UI,
- focused Event Builder board,
- eligible Character read model,
- unassigned/all-eligible Character views,
- fast Character search,
- picker-based assignment/change/clear flows,
- desktop pointer drag/drop assignment,
- open-seat moves and occupied-seat swaps,
- advisory duplicate-assignment detection,
- required-role-open detection,
- missing Character role detection,
- role-conflict detection,
- inactive-assignment detection,
- Party Full / open-seat status,
- responsive desktop/tablet/mobile parity,
- critical authenticated Event Builder E2E coverage.

Publishing and member-facing lineup/search are intentionally outside Phase 5 and remain Phase 6 scope.

## Product Integrity — PASS

- Events are created from active Templates through an atomic database RPC.
- Each Event owns a copied structural snapshot with fresh identifiers; later Template edits do not restructure an existing Event.
- Event snapshot provenance preserves the source Event Type and Template identity/name at creation.
- Assignments reference the stable Guild Organizer Character UUID, not the RTNW export `Id`.
- RTNW reimports do not own or overwrite Event assignments.
- Duplicate Character assignments are intentionally allowed in draft state so organizers can see and resolve them through advisory warnings instead of having the database silently discard organizer intent.
- Event structure remains Guild-defined; no universal SUN/MOON/STAR or fixed Party/seat layout is hard-coded.
- Phase 5 stops at draft Event building and does not blur the boundary with Phase 6 publishing.

## UX Quality — PASS for Phase 5 scope

- Organizers can create Events from active Templates and open a focused Event Builder.
- The Builder supports picker-based assignment, replacement, and clearing.
- Desktop pointer drag/drop supports move-to-open-seat and swap-with-occupied-seat behavior.
- Picker controls remain available as touch/keyboard parity instead of making drag/drop the only workflow.
- Assignment search supports fast Character filtering.
- Unassigned and All eligible views are available in the Character picker.
- Lineup checks surface advisory duplicate, required-role, missing-role, role-conflict, and inactive-assignment warnings.
- Warning state recalculates immediately after successful assignment/clear/move operations.
- Party headers expose Full or open-seat status.
- Assignment success/error feedback uses the in-app fixed bottom-right toast pattern.
- Dedicated Playwright coverage verifies Event Builder mobile (390x844) and tablet (820x1180) behavior, picker fit/usability, and document horizontal-overflow regressions.
- Browser-native `alert`, `confirm`, and `prompt` are not used for Phase 5 Event Builder assignment workflows.

## Security & Privacy — PASS for Phase 5 scope

- Event authorization is enforced outside client UI through the established Guild authorization model.
- Owners/Admins receive Event-management access through Guild capabilities; Officers require explicit `events.manage`.
- Event creation, assignment, clear, and move operations use database RPC/server boundaries rather than unsafe client-side direct writes.
- Event creation validates Guild ownership, active Template state, and copies the full structure transactionally.
- Assignment RPCs validate Event/Slot/Character Guild scope and reject invalid cross-Guild combinations.
- Drag move/swap is performed by a single `SECURITY DEFINER` RPC that validates the actor and preserves Event/Guild invariants.
- The Event Builder Character read path is narrowly scoped for `events.manage` rather than broadening general Master Roster read access.
- Database regression tests cover Event foundation, Event creation, assignment authorization, move/swap semantics, archived Event mutation rejection, and cross-Guild isolation.
- No service-role credential is exposed to browser production code.

This is not a claim that later preview/public-release security hardening is complete.

## Performance & Reliability — PASS for Phase 5 scope

- Event creation is atomic so partial structural snapshots are not left behind.
- Drag move/swap is transactional at the database RPC boundary.
- Assignment, clear, move, and swap flows update the mounted Event Builder state after successful server mutations so warning/toast state is not lost to an unnecessary current-route remount.
- The database remains authoritative; optimistic/local UI state is applied only after successful assignment/clear actions or with rollback on failed drag operations.
- Duplicate assignments remain explicit draft data rather than being silently overwritten.
- Responsive E2E coverage includes document overflow checks at mobile/tablet widths.
- Critical Event Builder E2E covers picker assignment, live warning recalculation, duplicate clearing, move to an open Seat, and swap across occupied Seats.
- The complete Playwright suite passed after the final board-refresh repair.
- No formal production performance budget is claimed for large Event boards or multi-organizer concurrency.

## Release Quality — PASS

Latest local Phase 5 quality-gate evidence:

- `pnpm exec tsc --noEmit` — PASS
- `pnpm lint` — PASS
- `pnpm test` — PASS, 24 files / 177 tests
- `pnpm build` — PASS
- focused Phase 5.4B Event Builder Playwright — PASS, 3 tests
- `pnpm test:e2e` — PASS, 19 tests
- `pnpm db:reset` — PASS; all migrations replayed cleanly through `20261006013000_event_assignment_move_rpc.sql`
- `pnpm db:lint` — PASS, no schema errors
- `pnpm db:test` — PASS, 28 files / 871 tests
- `pnpm db:types:check` — PASS, generated DB types up to date
- `pnpm exec supabase db advisors --local` — PASS, no issues found
- `git diff --check` — PASS
- working tree was clean before this documentation checkpoint
- Phase 5.4B implementation/E2E checkpoint `2589a93` was pushed to `origin/feature/phase-5-guild-league-builder`

## Known Follow-ups Outside Phase 5

Later roadmap phases still own:

- preview and publication flow,
- immutable published lineup versions and publication history,
- Discord-ready sharing,
- member-facing lineup view and IGN search,
- formal production performance budgets/Core Web Vitals,
- large Event-board performance measurement,
- multi-organizer concurrency behavior,
- monitoring and error reporting,
- backup/restore validation and recovery drills,
- broader production security hardening,
- staging/production checks.

## Result

```text
Checkpoint: Phase 5 — Guild League Builder / Core v1
Scope: Event-owned draft structure + assignment workflow + warning intelligence + responsive integration hardening

Product Integrity: PASS
UX Quality: PASS for Phase 5 scope
Security & Privacy: PASS for Phase 5 scope
Performance & Reliability: PASS for Phase 5 scope
Release Quality: PASS

Result:
PHASE 5 QUALITY-GATED COMPLETE
```
