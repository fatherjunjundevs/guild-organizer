# Guild Organizer — Product Blueprint

## Product Identity

Guild Organizer is an RTNW-focused operational tool for Guild leaders, Officers, and members.

It should feel like a purpose-built **Guild command center**, not a spreadsheet clone or a reskin of another Guild website. Other tools may be studied to understand problems, but our information architecture, data model, workflows, and interaction design remain our own.

## Core Workflow

```text
Import Guild
  -> Organize Roster
  -> Create/Reuse Template
  -> Build Event
  -> Resolve Warnings
  -> Preview
  -> Publish
  -> Share
  -> Member Searches IGN
  -> Historical Record Remains Preserved
```

## Product Differentiators

- RTNW-aware roster synchronization
- preservation of former Guild characters instead of destructive deletion
- organizer-owned metadata layered over official game data
- exact-IGN automatic matching with manual identity reconciliation instead of unsafe guessing
- Event-owned structural snapshots
- immutable published versions
- member-focused IGN search
- warning-driven Event building
- Guild-specific roles, tags, custom fields, and structures
- future attendance, availability, intelligence, and automation
- consistent desktop/tablet/mobile experience

## User Roles

### Guild Owner
Controls the Guild, ownership, permissions, settings, organizers, and critical actions.

### Admin
Performs broad Guild-management operations delegated by the Owner.

### Officer
Receives explicit capabilities such as `roster.manage`, `imports.manage`, and future Event/template/publishing capabilities.

### Member / Viewer
Uses member-facing or published experiences without organizer privileges.

## Account, Membership, and Character Are Separate

A signed-in account, a Guild membership, and a Guild Character are different concepts. The database must not collapse them into one identity.

This supports alt characters, historical characters, claims/linking, future permissions, and cross-Guild use.

## Master Roster Rules

The official RTNW export currently provides:

`Id`, `Player`, `Lv.`, `Class`, `Title`, `Gender`, `Position`, `Gear Score`, `Weekly`, `Weekly Contribution`, `Total Contribution`, `Online Status`.

`Id` is an export row/count value only and is never stable identity.

Guild Organizer creates its own stable UUID for each Character.

Official RTNW synchronization:

- exact IGN match -> update
- new IGN -> add
- missing IGN -> preserve and mark Left Guild/inactive
- returning exact IGN -> reactivate the same Character
- never hard-delete because a Character disappeared from an export
- preserve organizer-owned metadata across imports

### Rename Safety

Do not infer renames automatically.

If `OldIGN` disappears and `NewIGN` appears, treat them as separate records until an authorized organizer explicitly reconciles them. Future reconciliation must preserve historical references.

## Data Ownership Boundary

RTNW-owned/imported fields include game details such as IGN, Level, Class, Title, Gender, Guild Position, Gear Score, activity/contribution values, and Online Status.

Organizer-owned fields include designation, Organizer Role, manual status, tags, custom fields, notes, Event assignments, availability, and future organizer metadata.

RTNW imports must never erase organizer-owned metadata.

## Event Model

Canonical model:

```text
Event Type
  -> Template
  -> Event
  -> Event-owned Structural Snapshot
  -> Assignments
  -> Published Version
```

Structural hierarchy:

```text
Event
  -> optional Area
  -> Section
  -> Party
  -> Slot
  -> Character
```

SUN / MOON / STAR / ALPHA / BRAVO / CHARLIE are examples only, never universal hard-coded structure.

## Draft and Published State

Draft management state and published member-facing state remain separate.

A published version is an immutable snapshot. Later draft edits do not silently rewrite what members were previously shown.

## Member Experience

A member should be able to open a shared link or Guild portal, search their IGN, and immediately understand Event -> Area/Section -> Party -> Slot -> Role without learning the organizer UI.

## Event Builder Experience

The Event Builder should eventually surface useful live intelligence such as:

- eligible vs total characters
- unassigned characters
- duplicate assignments
- missing class information
- missing required roles
- full parties
- open seats
- assignment conflicts
- validation warnings

The "wow" factor comes from reducing organizer work and uncertainty.

## Discord and Sharing

Publishing should flow naturally into:

```text
Build -> Validate -> Preview -> Publish -> Copy/Share to Discord
```

## Historical Integrity

Preserve, where applicable:

- former Guild characters
- import history
- past Events
- Event structural snapshots
- assignment history
- published versions
- important administrative history

Future edits should not silently rewrite history.

## Design Direction

- dark navy/slate
- highly legible
- polished and fluid
- compact where data density matters
- responsive desktop/tablet/mobile
- WCAG 2.2 AA target
- functional glass rather than decorative glass everywhere

## Permanent Interaction Rules

- No `window.alert()`.
- No `window.confirm()`.
- No `window.prompt()`.
- Destructive actions use in-app Guild Organizer confirmation UI.
- Use explicit `htmlFor`/`id` label relationships.
- Empty spacing around controls remains inert.
- Avoid unexpected layout shifts.
- Respect reduced motion/accessibility preferences.
- Reuse shared UI primitives instead of inconsistent one-off controls.

## What "Finished" Means

Every checkpoint is evaluated through five permanent quality tracks:

1. Product Integrity
2. UX Quality
3. Security & Privacy
4. Performance & Reliability
5. Release Quality
