"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import {
  assignEventSlotAction,
  clearEventSlotAction,
  moveEventSlotAssignmentAction,
  type EventAssignmentMutationResult,
} from "@/features/events/assignment-actions";
import {
  applyEventSlotAssignment,
  applyEventSlotClear,
  applyEventSlotMove,
  filterEventBuilderCharacters,
  getEventSlotDropMode,
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
import {
  buildEventBuilderWarningReport,
  groupEventWarningsBySlot,
  type EventBuilderPartyStatus,
  type EventBuilderWarning,
  type EventBuilderWarningReport,
} from "@/features/events/event-warnings";
import type { EventPublicationState } from "@/features/events/event-publication";
import { EventPublicationPanel } from "@/features/events/event-publication-panel";

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

function AssignmentToast({
  result,
}: {
  result: EventAssignmentMutationResult | null;
}) {
  if (!result) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] sm:right-6 sm:bottom-6">
      <div
        role={result.ok ? "status" : "alert"}
        aria-live={result.ok ? "polite" : "assertive"}
        className={`rounded-[var(--radius-lg)] border px-4 py-3 shadow-xl backdrop-blur-xl ${
          result.ok
            ? "border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[color-mix(in_srgb,var(--surface-2)_94%,var(--success)_6%)]"
            : "border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--surface-2)_94%,var(--danger)_6%)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${
              result.ok ? "bg-[var(--success)]" : "bg-[var(--danger)]"
            }`}
          />
          <p className="min-w-0 text-sm font-semibold">{result.message}</p>
        </div>
      </div>
    </div>
  );
}

function LineupChecksPanel({
  report,
}: {
  report: EventBuilderWarningReport;
}) {
  const { summary, warnings } = report;
  const hasWarnings = summary.total > 0;

  const checks = [
    { label: "Duplicates", value: summary.duplicates },
    { label: "Missing roles", value: summary.missingRoles },
    { label: "Role conflicts", value: summary.roleConflicts },
    { label: "Inactive", value: summary.inactiveAssignments },
  ];

  return (
    <Surface level={2} className="mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
            Lineup checks
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            Assignment warnings
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Warnings are advisory while you build. They do not block assignment changes.
          </p>
        </div>
        <StatusChip tone={hasWarnings ? "warning" : "success"}>
          {hasWarnings
            ? `${summary.total} warning${summary.total === 1 ? "" : "s"}`
            : "No warnings"}
        </StatusChip>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {checks.map((check) => (
          <div
            key={check.label}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3"
          >
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {check.label}
            </p>
            <p className="mt-1 text-lg font-semibold">{check.value}</p>
          </div>
        ))}
      </div>

      {warnings.length > 0 ? (
        <div className="mt-4 max-h-64 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {warnings.map((warning) => (
              <li key={warning.id} className="px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="warning">{warning.title}</StatusChip>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {warning.location}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {warning.message}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          No duplicate, required-role, role-conflict, or inactive-assignment warnings.
        </p>
      )}
    </Surface>
  );
}

function SeatCard({
  slot,
  assignment,
  eventArchived,
  onChoose,
  onClear,
  busySlotId,
  draggingSlotId,
  draggingCharacterId,
  dropTargetSlotId,
  recentlyChanged,
  warnings,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
}: {
  slot: EventBuilderSlot;
  assignment: EventBuilderCharacter | undefined;
  eventArchived: boolean;
  onChoose: () => void;
  onClear: () => void;
  busySlotId: string;
  draggingSlotId: string;
  draggingCharacterId: string;
  dropTargetSlotId: string;
  recentlyChanged: boolean;
  warnings: EventBuilderWarning[];
  onDragStart: (
    event: React.DragEvent<HTMLDivElement>,
    slotId: string,
    characterId: string,
  ) => void;
  onDragEnd: () => void;
  onDragEnter: (slotId: string) => void;
  onDrop: (
    event: React.DragEvent<HTMLDivElement>,
    targetSlotId: string,
  ) => void;
}) {
  const busy = busySlotId === slot.id;
  const isDragging = draggingSlotId === slot.id;
  const isDropTarget =
    dropTargetSlotId === slot.id &&
    Boolean(draggingSlotId) &&
    draggingSlotId !== slot.id;
  const dropMode =
    isDropTarget && draggingCharacterId
      ? getEventSlotDropMode(
          draggingCharacterId,
          assignment?.id ?? null,
        )
      : null;
  const hasWarnings = warnings.length > 0;

  return (
    <div
      data-event-slot-id={slot.id}
      onDragEnter={() => {
        if (draggingSlotId && draggingSlotId !== slot.id) {
          onDragEnter(slot.id);
        }
      }}
      onDragOver={(event) => {
        if (draggingSlotId && draggingSlotId !== slot.id) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => onDrop(event, slot.id)}
      className={`rounded-[var(--radius-md)] border bg-[var(--bg-base)] px-3 py-2.5 transition-[border-color,background-color,box-shadow,opacity] duration-300 ${isDropTarget ? "border-[var(--accent)] bg-[var(--accent-soft)]" : hasWarnings ? "border-[color-mix(in_srgb,var(--warning)_45%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--bg-base)_96%,var(--warning)_4%)]" : recentlyChanged ? "border-[var(--accent-border)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent-border)]" : "border-[var(--border-subtle)]"} ${isDragging ? "opacity-45" : ""}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{slot.name}</p>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {slot.roleLabel ? `Required: ${slot.roleLabel}` : "Any role"}
          </p>
        </div>

        {isDropTarget ? (
          <StatusChip tone="accent" className="shrink-0">
            {dropMode === "swap"
              ? "Drop to swap"
              : dropMode === "same-character"
                ? "Already here"
                : "Drop to move"}
          </StatusChip>
        ) : assignment ? (
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

      {hasWarnings && !isDropTarget ? (
        <div className="mt-2 grid gap-1.5">
          {warnings.map((warning) => (
            <div
              key={warning.id}
              className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] px-2.5 py-2"
            >
              <p className="text-[11px] font-semibold text-[var(--warning)]">
                {warning.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-secondary)]">
                {warning.message}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {assignment ? (
        <div
          data-assigned-character-id={assignment.id}
          draggable={!eventArchived && !busy}
          onDragStart={(event) =>
            onDragStart(event, slot.id, assignment.id)
          }
          onDragEnd={onDragEnd}
          title={eventArchived ? undefined : "Drag to another Seat to move or swap"}
          className={`mt-3 rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3 ${!eventArchived && !busy ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
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
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="hidden text-[11px] font-semibold text-[var(--text-tertiary)] md:inline">
                ⋮⋮ Drag to move
              </span>
              <div className="ml-auto flex flex-wrap justify-end gap-2">
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
  draggingSlotId,
  draggingCharacterId,
  dropTargetSlotId,
  recentlyChangedSlotIds,
  warningsBySlot,
  partyStatusById,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
}: {
  section: EventBuilderSection;
  assignments: Map<string, EventBuilderCharacter>;
  eventArchived: boolean;
  onChooseSlot: (slot: SelectedSlot) => void;
  onClearSlot: (slotId: string) => void;
  busySlotId: string;
  draggingSlotId: string;
  draggingCharacterId: string;
  dropTargetSlotId: string;
  recentlyChangedSlotIds: ReadonlySet<string>;
  warningsBySlot: ReadonlyMap<string, EventBuilderWarning[]>;
  partyStatusById: ReadonlyMap<string, EventBuilderPartyStatus>;
  onDragStart: (
    event: React.DragEvent<HTMLDivElement>,
    slotId: string,
    characterId: string,
  ) => void;
  onDragEnd: () => void;
  onDragEnter: (slotId: string) => void;
  onDrop: (
    event: React.DragEvent<HTMLDivElement>,
    targetSlotId: string,
  ) => void;
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
                {(() => {
                  const status = partyStatusById.get(party.id);
                  if (!status) return null;

                  return (
                    <StatusChip
                      tone={status.status === "full" ? "success" : "warning"}
                      className="shrink-0"
                    >
                      {status.status === "full"
                        ? "Full"
                        : `${status.openSeats} open`}
                    </StatusChip>
                  );
                })()}
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
                    draggingSlotId={draggingSlotId}
                    draggingCharacterId={draggingCharacterId}
                    dropTargetSlotId={dropTargetSlotId}
                    recentlyChanged={recentlyChangedSlotIds.has(slot.id)}
                    warnings={warningsBySlot.get(slot.id) ?? []}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragEnter={onDragEnter}
                    onDrop={onDrop}
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
  draggingSlotId,
  draggingCharacterId,
  dropTargetSlotId,
  recentlyChangedSlotIds,
  warningsBySlot,
  partyStatusById,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
}: {
  area: EventBuilderArea;
  assignments: Map<string, EventBuilderCharacter>;
  eventArchived: boolean;
  onChooseSlot: (slot: SelectedSlot) => void;
  onClearSlot: (slotId: string) => void;
  busySlotId: string;
  draggingSlotId: string;
  draggingCharacterId: string;
  dropTargetSlotId: string;
  recentlyChangedSlotIds: ReadonlySet<string>;
  warningsBySlot: ReadonlyMap<string, EventBuilderWarning[]>;
  partyStatusById: ReadonlyMap<string, EventBuilderPartyStatus>;
  onDragStart: (
    event: React.DragEvent<HTMLDivElement>,
    slotId: string,
    characterId: string,
  ) => void;
  onDragEnd: () => void;
  onDragEnter: (slotId: string) => void;
  onDrop: (
    event: React.DragEvent<HTMLDivElement>,
    targetSlotId: string,
  ) => void;
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
            draggingSlotId={draggingSlotId}
            draggingCharacterId={draggingCharacterId}
            dropTargetSlotId={dropTargetSlotId}
            recentlyChangedSlotIds={recentlyChangedSlotIds}
            warningsBySlot={warningsBySlot}
            partyStatusById={partyStatusById}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragEnter={onDragEnter}
            onDrop={onDrop}
          />
        ))}
      </div>
    </section>
  );
}

type EventBuilderBoardProps = {
  guildId: string;
  guildName: string;
  event: EventBuilderEvent;
  publication: EventPublicationState;
  canPublish: boolean;
};

function EventBuilderBoardContent({
  guildId,
  guildName,
  event,
  publication,
  canPublish,
}: EventBuilderBoardProps) {
  const pickerDialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [query, setQuery] = useState("");
  const [rosterView, setRosterView] = useState<EventRosterView>("unassigned");
  const [busySlotId, setBusySlotId] = useState("");
  const [draggingSlotId, setDraggingSlotId] = useState("");
  const [draggingCharacterId, setDraggingCharacterId] = useState("");
  const [dropTargetSlotId, setDropTargetSlotId] = useState("");
  const [recentlyChangedSlotIds, setRecentlyChangedSlotIds] = useState<
    string[]
  >([]);
  const [characters, setCharacters] = useState(event.characters);
  const [result, setResult] =
    useState<EventAssignmentMutationResult | null>(null);

  useEffect(() => {
    if (!result || selectedSlot) return;

    const timeoutId = window.setTimeout(
      () => setResult(null),
      result.ok ? 3200 : 5000,
    );

    return () => window.clearTimeout(timeoutId);
  }, [result, selectedSlot]);

  useEffect(() => {
    if (recentlyChangedSlotIds.length === 0) return;

    const timeoutId = window.setTimeout(
      () => setRecentlyChangedSlotIds([]),
      850,
    );

    return () => window.clearTimeout(timeoutId);
  }, [recentlyChangedSlotIds]);

  const recentlyChangedSlotSet = useMemo(
    () => new Set(recentlyChangedSlotIds),
    [recentlyChangedSlotIds],
  );

  const assignments = useMemo(
    () => mapAssignmentsBySlot(characters),
    [characters],
  );

  const warningReport = useMemo(
    () => buildEventBuilderWarningReport(event.structure, characters),
    [event.structure, characters],
  );

  const warningsBySlot = useMemo(
    () => groupEventWarningsBySlot(warningReport.warnings),
    [warningReport.warnings],
  );

  const partyStatusById = useMemo(
    () =>
      new Map(
        warningReport.partyStatuses.map((status) => [
          status.partyId,
          status,
        ]),
      ),
    [warningReport.partyStatuses],
  );

  const eligibleCharacters = useMemo(
    () => characters.filter((character) => character.status === "active"),
    [characters],
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
      filterEventBuilderCharacters(characters, query, rosterView),
    [characters, query, rosterView],
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

    const slotId = selectedSlot.id;
    setBusySlotId(slotId);
    setResult(null);

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventId", event.id);
    data.set("slotId", slotId);
    data.set("characterId", characterId);

    const mutation = await assignEventSlotAction(data);
    setBusySlotId("");
    setResult(mutation);

    if (!mutation.ok) return;

    setCharacters((current) =>
      applyEventSlotAssignment(current, slotId, characterId),
    );
    setRecentlyChangedSlotIds([slotId]);
    pickerDialogRef.current?.close();
    setSelectedSlot(null);
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
      setCharacters((current) => applyEventSlotClear(current, slotId));
      setRecentlyChangedSlotIds([slotId]);
    }
  }

  function startSlotDrag(
    dragEvent: React.DragEvent<HTMLDivElement>,
    slotId: string,
    characterId: string,
  ) {
    if (eventArchived || busySlotId) return;

    dragEvent.dataTransfer.effectAllowed = "move";
    dragEvent.dataTransfer.setData("text/plain", slotId);
    setDraggingSlotId(slotId);
    setDraggingCharacterId(characterId);
    setDropTargetSlotId("");
    setResult(null);
  }

  function endSlotDrag() {
    setDraggingSlotId("");
    setDraggingCharacterId("");
    setDropTargetSlotId("");
  }

  async function dropSlot(
    dragEvent: React.DragEvent<HTMLDivElement>,
    targetSlotId: string,
  ) {
    dragEvent.preventDefault();

    const sourceSlotId =
      draggingSlotId || dragEvent.dataTransfer.getData("text/plain");

    if (
      !sourceSlotId ||
      sourceSlotId === targetSlotId ||
      eventArchived ||
      busySlotId
    ) {
      endSlotDrag();
      return;
    }

    const previousCharacters = characters;
    const optimisticCharacters = applyEventSlotMove(
      characters,
      sourceSlotId,
      targetSlotId,
    );

    flushSync(() => {
      setCharacters(optimisticCharacters);
      setBusySlotId(targetSlotId);
      setResult(null);
      setRecentlyChangedSlotIds([sourceSlotId, targetSlotId]);
      setDraggingSlotId("");
      setDraggingCharacterId("");
      setDropTargetSlotId("");
    });

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventId", event.id);
    data.set("sourceSlotId", sourceSlotId);
    data.set("targetSlotId", targetSlotId);

    const mutation = await moveEventSlotAssignmentAction(data);
    setBusySlotId("");
    setResult(mutation);

    if (!mutation.ok) {
      setCharacters(previousCharacters);
      setRecentlyChangedSlotIds([]);
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

        <EventPublicationPanel
          guildId={guildId}
          event={event}
          characters={characters}
          initialPublication={publication}
          canPublish={canPublish}
          assignmentBusy={busySlotId !== ""}
          warningReport={warningReport}
          onFeedback={setResult}
        />

        <LineupChecksPanel report={warningReport} />

        <AssignmentToast result={selectedSlot ? null : result} />

        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Lineup board</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Drag an assigned Character onto another Seat to move or swap.
              Picker, Change, and Clear remain available for touch and keyboard.
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
                    draggingSlotId={draggingSlotId}
                    draggingCharacterId={draggingCharacterId}
                    dropTargetSlotId={dropTargetSlotId}
                    recentlyChangedSlotIds={recentlyChangedSlotSet}
                    warningsBySlot={warningsBySlot}
                    partyStatusById={partyStatusById}
                    onDragStart={startSlotDrag}
                    onDragEnd={endSlotDrag}
                    onDragEnter={setDropTargetSlotId}
                    onDrop={dropSlot}
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
                  draggingSlotId={draggingSlotId}
                  draggingCharacterId={draggingCharacterId}
                  dropTargetSlotId={dropTargetSlotId}
                  recentlyChangedSlotIds={recentlyChangedSlotSet}
                  warningsBySlot={warningsBySlot}
                  partyStatusById={partyStatusById}
                  onDragStart={startSlotDrag}
                  onDragEnd={endSlotDrag}
                  onDragEnter={setDropTargetSlotId}
                  onDrop={dropSlot}
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

export function EventBuilderBoard(props: EventBuilderBoardProps) {
  const assignmentVersion = props.event.characters
    .map(
      (character) =>
        `${character.id}:${character.assignedSlotIds.join(",")}`,
    )
    .join("|");

  return (
    <EventBuilderBoardContent
      key={`${props.event.updatedAt}:${assignmentVersion}:${props.publication.lifecycle}:${props.publication.currentVersionId ?? "none"}`}
      {...props}
    />
  );
}
