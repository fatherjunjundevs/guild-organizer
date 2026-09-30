# Ragnarok: The New World ? Guild Organizer

An unofficial community tool for organizing guild rosters, events, assignments, and published lineups for Ragnarok: The New World.

## Current Development Status

Phase 3.1 ? Application Foundation

- Next.js App Router + TypeScript
- Tailwind CSS + semantic design tokens
- Local Supabase development stack
- Browser/server Supabase clients
- Vitest + Testing Library
- Playwright end-to-end testing
- GitHub Actions CI

## Requirements

- Node.js 24
- pnpm 12
- Docker Desktop
- Supabase CLI

## Local Setup

Clone the repository and install dependencies:

```bash
pnpm install
```

Start Docker Desktop, then start the local Supabase stack:

```bash
pnpm db:start
```

Copy the environment template:

```text
.env.example -> .env.local
```

Configure `.env.local` with your local Supabase Project URL and publishable key.

The default local ports for this development environment are:

- API: http://127.0.0.1:55421
- Database: 127.0.0.1:55422
- Studio: http://127.0.0.1:55423
- Mailpit: http://127.0.0.1:55424

Start the Next.js development server:

```bash
pnpm dev
```

Then open:

```text
http://localhost:3000
```

The development-only design system playground is available at:

```text
http://localhost:3000/design-system
```

## Quality Checks

Run linting:

```bash
pnpm lint
```

Run unit/component tests:

```bash
pnpm test
```

Run end-to-end tests:

```bash
pnpm test:e2e
```

Run the production build:

```bash
pnpm build
```

## Database Commands

```bash
pnpm db:start
pnpm db:stop
pnpm db:status
pnpm db:reset
```

## Architecture

The application is organized around four primary experiences:

- Public
- Management
- Event Focus
- Member

Core product model:

```text
Event Type -> Template -> Event -> Event-owned Structure -> Assignments -> Published Version
```

Published views are intentionally separated from draft management state.

## Security

- Never commit `.env.local`.
- Never expose Supabase secret/service-role keys to browser code.
- Browser code uses only the Supabase publishable key.
- Row Level Security and transactional RPCs will be authoritative for protected application data.

## Disclaimer

This is an unofficial community project and is not affiliated with the game publisher.
