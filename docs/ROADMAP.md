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

## Phase 3 — Master Guild Roster 🟡

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

Remaining Phase 3 work:

### 3.4B — Custom Organizer Fields ⏳
Guild-defined organizer fields, character values, safe field types, permissions, search/filter use where valuable, and persistence across RTNW imports.

### 3.5 — Generic Spreadsheet Import & Mapping ⏳
Excel/CSV ingestion, column mapping, auto-detection suggestions, duplicate detection, validation summary, preview, and transactional apply. This remains separate from the strict official RTNW importer.

### 3.6 — Character Reconciliation & Import History ⏳
Controlled same-character reconciliation for IGN changes, no automatic rename guessing, historical-reference preservation, import history UI, import-run details, and conflict visibility.

### 3.7 — Phase 3 Integration & Quality Gate 🔒
Responsive polish, loading/empty/error states, keyboard/accessibility review, larger-roster performance testing, critical E2E roster workflows, authorization regression pass, security review, and documentation update.

## Phase 4 — Event Template Designer ⏳
Event Types, reusable templates, optional Area -> Section -> Party -> Slot hierarchy, custom names/seat counts, role requirements, template validation, preview, cloning, and edit rules.

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
