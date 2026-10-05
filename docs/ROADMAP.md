# Guild Organizer — Project Roadmap

This is the authoritative product roadmap.

Official phases are numbered **0–14**. Labels such as `3.4A` are internal implementation checkpoints inside an official phase.

## Status Legend

- ✅ Complete
- 🟡 In progress
- ⏳ Planned
- 🔒 Quality/release gate

## Phase 0 — Product Blueprint & Community Discovery ✅
Define Guild-management problems, workflows, product principles, and v1 boundaries.

## Phase 1 — UI/UX Design System ✅
Global shell, Event Builder concepts, Master Roster/import concepts, templates, Member Portal, dashboard/history, publish/share, settings/permissions, responsive design, motion, accessibility, and visual system.

## Phase 2 — Technical Foundation ✅
Next.js, TypeScript, Supabase, authentication/session foundation, Guild access, multi-Guild navigation, roles/capabilities, invites, RLS, transactional RPC patterns, migrations/tests, unit/component tests, Playwright, and CI.

## Phase 3 — Master Guild Roster ✅

Completed internal checkpoints:

- **3.1A** Master Roster Data Foundation ✅
- **3.1B** Secure Roster RPCs ✅
- **3.1C** Official RTNW Synchronization Engine ✅
- **3.2A** Master Roster Application UI ✅
- **3.2B** Official RTNW CSV Import & Preview ✅
- **3.2C** Hierarchy Sorting & Guild Switcher Polish ✅
- **3.3A** Manual Character Creation & Organizer Controls ✅
- **3.3B** Manual Full Detail Editing & RTNW Protection ✅
- **3.3C** Bulk Roster Management ✅
- **3.4A** Roster Tags ✅
- **3.4B** Custom Organizer Fields ✅
- **3.5** Generic Spreadsheet Import & Mapping ✅
- **3.6** Character Reconciliation & Import History ✅

### 3.7 — Phase 3 Integration & Quality Gate ✅

Completed quality-gate work:

- Critical roster/auth E2E coverage and authorization regression checks ✅
- Responsive mobile/tablet roster coverage and explicit route loading state ✅
- Dialog/control accessible naming and reconciliation form labeling ✅
- Larger-roster measurement followed by bounded 200-character render pages ✅
- Local lint, unit, build, E2E, DB lint, DB tests, generated DB type verification, and `git diff --check` ✅
- Phase 3 documentation/status refresh ✅
- GitHub Actions CI #51 passed for documentation checkpoint `dc156b6`, including clean migration replay, quality gates, DB lint/tests, and generated DB type verification ✅

Phase 3 is quality-gated complete.

See [`PHASE_3_QUALITY_GATE.md`](PHASE_3_QUALITY_GATE.md) for evidence and scope boundaries.

## Phase 4 — Event Template Designer ✅

Completed Phase 4 scope:

- Guild-defined Event Types and reusable Templates ✅
- Draft / Active / Archived Template lifecycle ✅
- Flat Team (Section) -> Party -> Slot hierarchy ✅
- Optional Area -> Team (Section) -> Party -> Slot hierarchy ✅
- Custom structure names and configurable 1–8 Party seat counts ✅
- Party resizing with explicit destructive confirmation ✅
- Optional per-seat role requirements ✅
- Team and Party reordering ✅
- Canonical readiness validation and ordered read-only preview ✅
- Guarded activation and Active -> Draft structural edit rules ✅
- Independent Template cloning ✅
- Capability-gated management and authorization regression coverage ✅
- Responsive Party-board overflow and deletion scroll-position regression coverage ✅
- Full local Phase 4 quality gate: lint, TypeScript, unit, build, E2E, DB lint/tests/types/advisors, and diff checks ✅

Phase 4 is quality-gated complete.

See [`PHASE_4_QUALITY_GATE.md`](PHASE_4_QUALITY_GATE.md) for evidence and scope boundaries.

## Phase 5 — Guild League Builder / Core v1 ⏳
Event creation from template, Event-owned structural snapshot, assignment workflow, drag/drop, warning system, duplicate detection, missing-role detection, unassigned/eligible views, responsive parity, and fast assignment search.

## Phase 6 — Publishing & Sharing ⏳
Preview, immutable published versions, publication history, share links, Discord-ready sharing, member-facing lineup, IGN search, and clear version/update behavior.

## Phase 7 — Closed Community Preview ⏳
Security hardening, measured performance budgets, critical E2E workflows, monitoring, backup/recovery validation, accessibility review, feedback workflow, and staging/production checks.

## Phase 8 — v1 Public Release ⏳
A coherent finished product that passes all permanent quality gates.

## Phase 9 — Attendance & Availability ⏳
Member availability, Event attendance, organizer visibility, and historical attendance signals.

## Phase 10 — Expanded Event Management ⏳
Broader Event types, richer lifecycle, deeper history, reusable operations, and coordination improvements.

## Phase 11 — Guild Auction ⏳
Guild-specific auction workflows with permissions, history, and auditability.

## Phase 12 — Live Collaboration ⏳
Multiple organizers, concurrency behavior, presence/live updates where valuable, and conflict-safe editing.

## Phase 13 — Guild Intelligence & Automation ⏳
Helpful roster/Event insights, warning automation, planning assistance, and operational summaries. Automation assists organizers and does not silently mutate important Guild data.

## Phase 14 — FatherJunJun RTNW Tools Ecosystem ⏳
Long-term ecosystem direction for Guild Organizer and other RTNW tools, with shared branding/integration only where it improves user experience.

## Roadmap Rule

No official phase is complete solely because its feature set exists.

A phase reaches completion only after the applicable five quality tracks pass:

1. Product Integrity
2. UX Quality
3. Security & Privacy
4. Performance & Reliability
5. Release Quality
