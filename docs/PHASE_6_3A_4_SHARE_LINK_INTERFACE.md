# Phase 6.3A.4 — Organizer Share-Link Interface

Implemented on `feature/phase-6-publishing-sharing`, starting from `a326936` with a clean, synchronized tree. This checkpoint adds the organizer interface after the separately reviewed state-contract migration. It does not add a migration, change cryptography, implement the public Event page, or complete Phase 6/public release hardening.

## Behavior and boundaries

- Builder: a compact Share Link entry beside Preview and History, gated by publishing authority and the server feature flag. Existing assignment, drag/drop, publication/history, and toast behavior are retained.
- Sharing: a minimal Guild-scoped route available to Owner/Admin and publish.manage Officers. It uses only Event ID, name, and active/archived status in bounded 25-row keyset pages. It does not load draft structure, descriptions, assignments, Characters, roster, or history; publish-only Officers still cannot open the draft Builder.
- State: the management adapter authenticates the actual session and validates the new RPC response at runtime, including enum values/nullability. The UI distinguishes absent, active/published, active/unavailable, revoked, and unknown status.
- Actions: each wrapper enforces the local-only gate and delegates authentication, strict input validation, one-request mutations, HMAC provisioning, and safe recovery to the existing operations. PostgreSQL remains the publish.manage and Guild/Event security boundary. The application gate does not change existing RPC grants.
- Reliability: read failures and uncertain writes hide obsolete state and require Reload Status. Confirmed mutations retain their success classification even if a later read fails. A dismissed write remains locked until settling, and stale reads/copies cannot restore state or write to the clipboard after dismissal/reopen. No mutation is retried automatically.
- Clipboard: URLs are recovered only by explicit authorized Copy, sent to the Clipboard API, and retained in local dialog state only for an accessible manual fallback. Closing/reopening, reload, link/scope changes, clearing the field, and unmounting discard sensitive UI state. Clipboard failures never rotate a link.
- Accessibility: in-app confirmation, labeled temporary fields, status/error announcements, native modal isolation plus explicit Tab wrapping, focus restoration, Escape cancellation, responsive 390 × 844 layout, and a single dialog content scroll area. Mobile rendering was inspected visually; this is not a claim of a complete external WCAG audit.
- Configuration: `SHARE_LINK_INTERFACE_ENABLED=true` is accepted only with `APP_ENV=local`. Default, staging, and production remain closed. Enabled UI explicitly warns that the public page is unavailable and links are not ready for members. See [local testing configuration](SHARE_LINK_SERVER_CONFIGURATION.md#phase-63a4-organizer-interface-and-local-testing).

## Final UX reliability polish

The dialog now retains its last verified management state after an explicit `configuration`, `invalid`, or `unauthenticated` rejection. The existing server emits these codes before submitting a write. This applies to mutations and Copy; it does not treat transport errors or message text as proof that a mutation failed. Conflicts, changed access/identity, read failures, unknown outcomes, and confirmed mutations with failed refreshes still clear potentially obsolete state and require explicit Reload Status. Stale responses after dismissal cannot restore the previous snapshot.

Cancel and Escape now restore focus to the Rotate or Revoke button that opened confirmation, after that button is rendered again. Closing the manager still restores focus to Share Link. This polish changes only the manager, its component tests, the sharing E2E spec, and this report; authorization, feature gating, Server Actions, cryptography, and database contracts are unchanged.

## Validation

| Check | Actual result |
| --- | --- |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm lint` | PASS, no lint warnings |
| `pnpm test` | PASS: 38 files, 381 tests |
| `pnpm build` | PASS, Next.js 16.3.8 |
| `pnpm test:e2e --workers=2` | PASS: 23 tests; 7 enabled-sharing tests intentionally skipped |
| Sharing/publication E2E, enabled without local crypto configuration | PASS: 7 tests; default-disabled and configured Owner lifecycle cases intentionally skipped |
| `pnpm test:e2e:sharing` | PASS: 7 tests; default-disabled and missing-crypto cases intentionally skipped |
| `pnpm db:lint` | PASS, no schema errors |
| `pnpm db:test` | PASS: 32 files, 1,367 assertions |
| `pnpm db:types:check` | PASS, no generated-type changes |
| `pnpm db:test:concurrency` | PASS: 16 concurrency + 31 server-integration assertions; 37 migrations replayed; disposable database removed |
| `git diff --check` | PASS |

The enabled E2E run used ephemeral local keys and real authenticated browser Server Actions/PostgREST for Owner/Admin/publish-only Officer lifecycle actions, successful and failed clipboard paths, unpublished/published/revoked state, rotation cancellation, mobile focus/overflow, Member/events-only/cross-Guild denial, anonymous management denial, and existing publication compatibility. The missing-crypto run verified an actual Create configuration response, preserved absent state, one request with no retry, and explicit Reload Status. The configured run also verified Rotate Escape and Revoke Cancel focus restoration. No required path was blocked by unavailable local keys or infrastructure. Transport failures, uncertain/competing outcomes, post-mutation read failures, malformed wire responses, stale requests, and pagination beyond 1,000 rows are covered by unit/component tests; not every failure was injected at the real HTTP layer. Key rows and E2E account/Guild fixtures were cleaned. Client static bundles contained none of the inspected recovery/provisioning configuration names or cryptographic protocol strings.

Database and bundle-inspection results above were recorded at the initial interface checkpoint. The database checks were not rerun for this UI-only polish. The earlier review ZIP remains unchanged and predates the polish.

## Changed files

New:

- `src/features/events/share-link-feature.ts`
- `src/features/events/share-link-management-server.ts` and its test
- `src/features/events/share-link-actions.ts` and its test
- `src/features/events/event-share-link-manager.tsx` and its test
- `src/features/events/sharing-events-server.ts` and its test
- `src/app/(management)/app/guild/[guildId]/sharing/page.tsx`
- `e2e/event-share-link.spec.ts`
- `scripts/test-share-link-interface-e2e.mjs`
- This checkpoint report

Updated:

- `src/features/events/share-link.ts`
- `src/features/events/event-publication-panel.tsx` and its test
- `src/features/events/event-builder-board.tsx`
- `src/app/(event-focus)/app/guild/[guildId]/events/[eventId]/page.tsx`
- `src/app/(management)/app/guild/[guildId]/layout.tsx`
- `src/features/guilds/management-nav.tsx`
- `src/features/guilds/management-shell.tsx`
- `src/components/ui/button.tsx` (React 19 ref prop for dialog focus)
- `e2e/helpers/local-supabase.ts`
- `playwright.config.ts` (fresh server for ephemeral sharing tests)
- `package.json` (local sharing E2E runner only; no dependencies)
- `docs/ARCHITECTURE.md`
- `docs/SHARE_LINK_SERVER_CONFIGURATION.md`

Existing migrations, database types, crypto/configuration algorithms, and server lifecycle operations are unchanged. No environment files were edited, dependencies installed, production keys provisioned, or changes staged/committed/pushed/deployed. Independent review is pending. Public-page implementation and release controls remain required before external sharing can be exposed.
