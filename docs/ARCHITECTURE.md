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

Existing capabilities include:

- `roster.manage`
- `imports.manage`

Future Event/template/publish permissions should follow the same capability pattern where useful.

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

Template edits after Event creation must not silently restructure historical Events. Published versions are immutable snapshots.

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
