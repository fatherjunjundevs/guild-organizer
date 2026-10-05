# Ragnarok: The New World — Guild Organizer

An unofficial community tool for organizing guild rosters, events, assignments, and published lineups for Ragnarok: The New World.

## Current Development Status

**Official roadmap:** Phase 4 — Event Template Designer ✅

**Current status:** Phase 4 quality-gated complete ✅

**Next phase:** Phase 5 — Guild League Builder / Core v1 ⏳

Implemented so far includes:

- Next.js App Router + TypeScript
- Tailwind CSS + semantic design tokens
- Local Supabase development stack
- Authenticated multi-Guild foundation
- Guild roles and Officer capabilities
- Invitation/access-link foundation
- Master Guild Roster data model
- Secure roster RPCs and Row Level Security
- Official RTNW CSV preview/apply synchronization
- Exact-IGN import semantics with historical retention
- Desktop/mobile roster UI
- Guild hierarchy sorting and roster filters
- Manual character creation/editing with RTNW field protection
- Organizer designation and role metadata
- Bulk roster management
- Guild-specific reusable roster tags
- Guild-defined custom organizer fields with typed values, roster search/filter integration, and RTNW-safe persistence
- Generic CSV/XLSX spreadsheet import with mapping, validation, duplicate handling, preview, and transactional apply
- Explicit Character reconciliation for same-character identity changes without automatic rename guessing
- Import and reconciliation history for organizer visibility and audit context
- Responsive roster hardening with loading, empty/error, and accessibility states
- Measured larger-roster hardening with 200-character render pages while full-roster filtering/sorting remains intact
- Guild-defined Event Types and reusable Event Templates
- Flat and optional Area-grouped Team -> Party -> Slot Template structures
- Configurable 1–8 Party seat counts with safe resize rules
- Optional seat role requirements plus Team/Party reordering
- Template readiness validation, ordered preview, activation, and Active -> Draft edit lifecycle
- Independent Template cloning with fresh structure identifiers
- Capability-gated Template management with critical Playwright authorization/lifecycle coverage
- Responsive Template-board overflow and deletion scroll-position regression coverage
- Vitest + Testing Library
- Playwright end-to-end testing
- GitHub Actions CI

The project is currently in active development and is not yet a public v1 release.

## Product Documentation

The repository keeps the product plan and engineering expectations alongside the code:

- [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/QUALITY_GATES.md`](docs/QUALITY_GATES.md)
- [`docs/PHASE_3_QUALITY_GATE.md`](docs/PHASE_3_QUALITY_GATE.md)
- [`docs/PHASE_4_QUALITY_GATE.md`](docs/PHASE_4_QUALITY_GATE.md)

These are authoritative project references and should be updated when product decisions change.

## Requirements

- Node.js 24
- pnpm 12
- Docker Desktop
- Supabase CLI

## Local Setup

```bash
pnpm install
pnpm db:start
pnpm dev
```

Copy `.env.example` to `.env.local` and configure the local Supabase URL and publishable key.

Local development ports:

- API: http://127.0.0.1:55421
- Database: 127.0.0.1:55422
- Studio: http://127.0.0.1:55423
- Mailpit: http://127.0.0.1:55424

The development-only design system playground is available at:

```text
http://localhost:3000/design-system
```

## Quality Checks

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm db:lint
pnpm db:test
pnpm db:types:check
```

A feature being functional does **not** make it finished. See `docs/QUALITY_GATES.md`.

## Architecture

The application is organized around four primary experiences:

- Public
- Management
- Event Focus
- Member

Core event model:

```text
Event Type
  -> Template
  -> Event
  -> Event-owned Structural Snapshot
  -> Assignments
  -> Published Version
```

Published state is intentionally separated from draft management state.

## Security

- Never commit `.env.local`.
- Never expose Supabase secret/service-role keys to browser code.
- Browser code uses only the Supabase publishable key.
- Protected application data is enforced by Row Level Security and capability-gated transactional RPCs.
- UI visibility is never considered authorization.
- Cross-Guild access must be denied at the database/server boundary.

Security is an ongoing quality track, not a one-time feature.

## Disclaimer

This is an unofficial community project and is not affiliated with the game publisher.
