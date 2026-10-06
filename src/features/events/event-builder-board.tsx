import Link from "next/link";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import type {
  EventBuilderArea,
  EventBuilderSection,
} from "@/features/events/event-builder";
import type { EventBuilderEvent } from "@/features/events/builder-server";

function TeamBoard({ section }: { section: EventBuilderSection }) {
  return (
    <Surface level={2} className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
            Team
          </p>
          <h3 className="mt-1 text-lg font-semibold">{section.name}</h3>
        </div>
        <StatusChip tone="neutral">
          {section.parties.length} {section.parties.length === 1 ? "Party" : "Parties"}
        </StatusChip>
      </div>

      {section.parties.length === 0 ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] p-4 text-sm text-[var(--text-secondary)]">
          This Team has no Parties in the Event snapshot.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {section.parties.map((party) => (
            <div
              key={party.id}
              className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-semibold">{party.name}</h4>
                <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                  {party.slots.length} seats
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {party.slots.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{slot.name}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-[var(--text-tertiary)]">
                        Open
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                      {slot.roleLabel ? `Required: ${slot.roleLabel}` : "Any role"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
}

function AreaBoard({ area }: { area: EventBuilderArea }) {
  return (
    <section aria-labelledby={`event-area-${area.id}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-tertiary)] uppercase">
            Area
          </p>
          <h2 id={`event-area-${area.id}`} className="mt-1 text-xl font-semibold">
            {area.name}
          </h2>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          {area.sections.length} {area.sections.length === 1 ? "Team" : "Teams"}
        </p>
      </div>

      <div className="grid gap-4">
        {area.sections.map((section) => (
          <TeamBoard key={section.id} section={section} />
        ))}
      </div>
    </section>
  );
}

export function EventBuilderBoard({
  guildId,
  guildName,
  event,
}: {
  guildId: string;
  guildName: string;
  event: EventBuilderEvent;
}) {
  const { totals } = event.structure;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-1)_92%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/app/guild/${guildId}/events`}
              className="inline-flex h-9 shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            >
              ← Events
            </Link>
            <div className="min-w-0">
              <p className="truncate text-xs text-[var(--text-tertiary)]">{guildName}</p>
              <p className="truncate text-sm font-semibold">{event.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusChip tone={event.status === "active" ? "success" : "neutral"}>
              {event.status === "active" ? "Active" : "Archived"}
            </StatusChip>
            <StatusChip tone="accent">Event Builder</StatusChip>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <StatusChip tone="neutral">{event.eventTypeName}</StatusChip>
                  <StatusChip tone="neutral">
                    Snapshot: {event.templateName}
                  </StatusChip>
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  {event.name}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
                  {event.description ?? "No Event description."}
                </p>
              </div>
            </div>
          </div>

          <Surface level={2} className="p-4">
            <p className="text-xs font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
              Event snapshot
            </p>
            <div className={`mt-3 grid gap-2 ${event.usesAreas ? "grid-cols-4" : "grid-cols-3"}`}>
              {event.usesAreas ? (
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                  <p className="text-[11px] text-[var(--text-tertiary)]">Areas</p>
                  <p className="mt-1 font-semibold">{totals.areas}</p>
                </div>
              ) : null}
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)]">Teams</p>
                <p className="mt-1 font-semibold">{totals.sections}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)]">Parties</p>
                <p className="mt-1 font-semibold">{totals.parties}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)]">Seats</p>
                <p className="mt-1 font-semibold">{totals.slots}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
              This board is reading the Event-owned structural snapshot. Template changes do not rewrite it.
            </p>
          </Surface>
        </div>

        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Lineup board</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Structural read view. Character assignment controls arrive in the next Phase 5 checkpoint.
            </p>
          </div>

          {event.usesAreas ? (
            event.structure.areas.length === 0 ? (
              <Surface level={2} className="p-6">
                <p className="font-semibold">No Areas in this snapshot</p>
              </Surface>
            ) : (
              <div className="grid gap-8">
                {event.structure.areas.map((area) => (
                  <AreaBoard key={area.id} area={area} />
                ))}
              </div>
            )
          ) : event.structure.rootSections.length === 0 ? (
            <Surface level={2} className="p-6">
              <p className="font-semibold">No Teams in this snapshot</p>
            </Surface>
          ) : (
            <div className="grid gap-4">
              {event.structure.rootSections.map((section) => (
                <TeamBoard key={section.id} section={section} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
