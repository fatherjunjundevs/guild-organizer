"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import {
  assignEventSlotAction,
  clearEventSlotAction,
  type EventAssignmentMutationResult,
} from "@/features/events/assignment-actions";
import {
  filterEventBuilderCharacters,
  mapAssignmentsBySlot,
  type EventBuilderCharacter,
  type EventBuilderEvent,
  type EventRosterView,
} from "@/features/events/event-assignment";
import type {
  EventBuilderArea,
  EventBuilderSection,
  EventBuilderSlot,
} from "@/features/events/event-builder";

type SelectedSlot = {
  id: string;
  name: string;
  roleLabel: string | null;
  partyName: string;
  teamName: string;
};

function formatGearScore(value: number | null) {
  return value === null ? "GS —" : `GS ${value.toLocaleString()}`;
}

function AssignmentMessage({
  result,
}: {
  result: EventAssignmentMutationResult | null;
}) {
  if (!result) return null;

  return (
    <p
      aria-live="polite"
      className={`text-sm ${
        result.ok ? "text-[var(--success)]" : "text-[var(--danger)]"
      }`}
    >
      {result.message}
    </p>
  );
}

function SeatCard({
  slot,
  assignment,
  eventArchived,
  onChoose,
  onClear,
  busySlotId,
}: {
  slot: EventBuilderSlot;
  assignment: EventBuilderCharacter | undefined;
  eventArchived: boolean;
  onChoose: () => void;
  onClear: () => void;
  busySlotId: string;
}) {
  const busy = busySlotId === slot.id;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2.5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{slot.name}</p>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {slot.roleLabel ? `Required: ${slot.roleLabel}` : "Any role"}
          </p>
        </div>

        {assignment ? (
          <StatusChip
            tone={assignment.status === "active" ? "accent" : "warning"}
            className="shrink-0"
          >
            {assignment.status === "active" ? "Assigned" : "Inactive"}
          </StatusChip>
        ) : (
          <span className="shrink-0 text-[11px] font-semibold text-[var(--text-tertiary)]">
            Open
          </span>
        )}
      </div>

      {assignment ? (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{assignment.ign}</p>
              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                {assignment.className ?? "Class unknown"}
                {assignment.roleLabel ? ` · ${assignment.roleLabel}` : ""}
              </p>
            </div>
            <p className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
              {formatGearScore(assignment.gearScore)}
            </p>
          </div>

          {!eventArchived ? (
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={onChoose}
              >
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={onClear}
              >
                {busy ? "Clearing…" : "Clear"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : !eventArchived ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3 w-full"
          disabled={busy}
          onClick={onChoose}
        >
          Assign Character
        </Button>
      ) : null}
    </div>
  );
}

function TeamBoard({
  section,
  assignments,
  eventArchived,
  onChooseSlot,
  onClearSlot,
  busySlotId,
}: {
  section: EventBuilderSection;
  assignments: Map<string, EventBuilderCharacter>;
  eventArchived: boolean;
  onChooseSlot: (slot: SelectedSlot) => void;
  onClearSlot: (slotId: string) => void;
  busySlotId: string;
}) {
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
          {section.parties.length}{" "}
          {section.parties.length === 1 ? "Party" : "Parties"}
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
                  <SeatCard
                    key={slot.id}
                    slot={slot}
                    assignment={assignments.get(slot.id)}
                    eventArchived={eventArchived}
                    busySlotId={busySlotId}
                    onChoose={() =>
                      onChooseSlot({
                        id: slot.id,
                        name: slot.name,
                        roleLabel: slot.roleLabel,
                        partyName: party.name,
                        teamName: section.name,
                      })
                    }
                    onClear={() => onClearSlot(slot.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
}

function AreaBoard({
  area,
  assignments,
  eventArchived,
  onChooseSlot,
  onClearSlot,
  busySlotId,
}: {
  area: EventBuilderArea;
  assignments: Map<string, EventBuilderCharacter>;
  eventArchived: boolean;
  onChooseSlot: (slot: SelectedSlot) => void;
  onClearSlot: (slotId: string) => void;
  busySlotId: string;
}) {
  return (
    <section aria-labelledby={`event-area-${area.id}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-tertiary)] uppercase">
            Area
          </p>
          <h2
            id={`event-area-${area.id}`}
            className="mt-1 text-xl font-semibold"
          >
            {area.name}
          </h2>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          {area.sections.length}{" "}
          {area.sections.length === 1 ? "Team" : "Teams"}
        </p>
      </div>

      <div className="grid gap-4">
        {area.sections.map((section) => (
          <TeamBoard
            key={section.id}
            section={section}
            assignments={assignments}
            eventArchived={eventArchived}
            onChooseSlot={onChooseSlot}
            onClearSlot={onClearSlot}
            busySlotId={busySlotId}
          />
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
  const router = useRouter();
  const pickerDialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [query, setQuery] = useState("");
  const [rosterView, setRosterView] = useState<EventRosterView>("unassigned");
  const [busySlotId, setBusySlotId] = useState("");
  const [result, setResult] =
    useState<EventAssignmentMutationResult | null>(null);

  const assignments = useMemo(
    () => mapAssignmentsBySlot(event.characters),
    [event.characters],
  );

  const eligibleCharacters = useMemo(
    () => event.characters.filter((character) => character.status === "active"),
    [event.characters],
  );

  const unassignedCount = useMemo(
    () =>
      eligibleCharacters.filter(
        (character) => character.assignedSlotIds.length === 0,
      ).length,
    [eligibleCharacters],
  );

  const filteredCharacters = useMemo(
    () =>
      filterEventBuilderCharacters(event.characters, query, rosterView),
    [event.characters, query, rosterView],
  );

  const visibleCharacters = filteredCharacters.slice(0, 100);
  const { totals } = event.structure;
  const eventArchived = event.status === "archived";

  function openCharacterPicker(slot: SelectedSlot) {
    setSelectedSlot(slot);
    setQuery("");
    setRosterView("unassigned");
    setResult(null);
    pickerDialogRef.current?.showModal();
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  async function assignCharacter(characterId: string) {
    if (!selectedSlot) return;

    setBusySlotId(selectedSlot.id);
    setResult(null);

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventId", event.id);
    data.set("slotId", selectedSlot.id);
    data.set("characterId", characterId);

    const mutation = await assignEventSlotAction(data);
    setBusySlotId("");
    setResult(mutation);

    if (!mutation.ok) return;

    pickerDialogRef.current?.close();
    setSelectedSlot(null);
    router.refresh();
  }

  async function clearSlot(slotId: string) {
    setBusySlotId(slotId);
    setResult(null);

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventId", event.id);
    data.set("slotId", slotId);

    const mutation = await clearEventSlotAction(data);
    setBusySlotId("");
    setResult(mutation);

    if (mutation.ok) {
      router.refresh();
    }
  }

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
              <p className="truncate text-xs text-[var(--text-tertiary)]">
                {guildName}
              </p>
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
            <div
              className={`mt-3 grid gap-2 ${
                event.usesAreas ? "grid-cols-4" : "grid-cols-3"
              }`}
            >
              {event.usesAreas ? (
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    Areas
                  </p>
                  <p className="mt-1 font-semibold">{totals.areas}</p>
                </div>
              ) : null}
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)]">Teams</p>
                <p className="mt-1 font-semibold">{totals.sections}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Parties
                </p>
                <p className="mt-1 font-semibold">{totals.parties}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)]">Seats</p>
                <p className="mt-1 font-semibold">{totals.slots}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
              This board is reading the Event-owned structural snapshot.
              Template changes do not rewrite it.
            </p>
          </Surface>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Surface level={2} className="p-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              Eligible Characters
            </p>
            <p className="mt-1 text-xl font-semibold">
              {eligibleCharacters.length}
            </p>
          </Surface>
          <Surface level={2} className="p-4">
            <p className="text-xs text-[var(--text-tertiary)]">Unassigned</p>
            <p className="mt-1 text-xl font-semibold">{unassignedCount}</p>
          </Surface>
          <Surface level={2} className="p-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              Filled Seats
            </p>
            <p className="mt-1 text-xl font-semibold">
              {assignments.size} / {totals.slots}
            </p>
          </Surface>
        </div>

        <div className="mt-4">
          <AssignmentMessage result={result} />
        </div>

        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Lineup board</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Choose any Seat to assign an eligible active Guild Character.
              Drag-and-drop arrives in the next checkpoint.
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
                  <AreaBoard
                    key={area.id}
                    area={area}
                    assignments={assignments}
                    eventArchived={eventArchived}
                    onChooseSlot={openCharacterPicker}
                    onClearSlot={clearSlot}
                    busySlotId={busySlotId}
                  />
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
                <TeamBoard
                  key={section.id}
                  section={section}
                  assignments={assignments}
                  eventArchived={eventArchived}
                  onChooseSlot={openCharacterPicker}
                  onClearSlot={clearSlot}
                  busySlotId={busySlotId}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <dialog
        ref={pickerDialogRef}
        aria-labelledby="character-picker-title"
        onClose={() => {
          setSelectedSlot(null);
          setQuery("");
          setResult(null);
        }}
        className="m-auto w-[min(44rem,calc(100vw-1.5rem))] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        {selectedSlot ? (
          <div className="flex max-h-[calc(100vh-1.5rem)] flex-col">
            <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <StatusChip tone="accent">
                    {selectedSlot.teamName} · {selectedSlot.partyName}
                  </StatusChip>
                  <h2
                    id="character-picker-title"
                    className="mt-2 text-xl font-semibold"
                  >
                    Assign {selectedSlot.name}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {selectedSlot.roleLabel
                      ? `Required role: ${selectedSlot.roleLabel}`
                      : "This Seat accepts any role."}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busySlotId !== ""}
                  onClick={() => pickerDialogRef.current?.close()}
                >
                  Close
                </Button>
              </div>

              <label
                htmlFor="event-character-search"
                className="mt-4 block text-xs font-semibold text-[var(--text-tertiary)]"
              >
                Search eligible Characters
              </label>
              <input
                ref={searchInputRef}
                id="event-character-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="IGN, class, role, level, gear score…"
                className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
              />

              <div
                className="mt-3 flex gap-2"
                role="group"
                aria-label="Character roster view"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={rosterView === "unassigned" ? "primary" : "secondary"}
                  onClick={() => setRosterView("unassigned")}
                >
                  Unassigned ({unassignedCount})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={rosterView === "eligible" ? "primary" : "secondary"}
                  onClick={() => setRosterView("eligible")}
                >
                  All eligible ({eligibleCharacters.length})
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <AssignmentMessage result={result?.ok ? null : result} />

              <div className={result?.ok ? "" : result ? "mt-4" : ""}>
                {visibleCharacters.length === 0 ? (
                  <Surface level={2} className="p-5">
                    <p className="font-semibold">No matching Characters</p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Try another search or switch between Unassigned and All
                      eligible.
                    </p>
                  </Surface>
                ) : (
                  <div className="grid gap-2">
                    {visibleCharacters.map((character) => (
                      <button
                        key={character.id}
                        type="button"
                        disabled={busySlotId !== ""}
                        onClick={() => assignCharacter(character.id)}
                        className="w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--surface-3)] disabled:pointer-events-none disabled:opacity-50"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {character.ign}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                              {character.className ?? "Class unknown"}
                              {character.roleLabel
                                ? ` · ${character.roleLabel}`
                                : ""}
                              {character.designation
                                ? ` · ${character.designation}`
                                : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold">
                              {formatGearScore(character.gearScore)}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                              {character.assignedSlotIds.length === 0
                                ? "Unassigned"
                                : `Assigned ${character.assignedSlotIds.length}×`}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {filteredCharacters.length > visibleCharacters.length ? (
                  <p className="mt-4 text-center text-xs text-[var(--text-tertiary)]">
                    Showing the first {visibleCharacters.length} of{" "}
                    {filteredCharacters.length}. Refine the search to narrow the
                    list.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
