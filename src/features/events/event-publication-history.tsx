"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import {
  mapAssignmentsBySlot,
  type EventBuilderCharacter,
} from "@/features/events/event-assignment";
import type {
  EventBuilderArea,
  EventBuilderSection,
  EventBuilderSlot,
  EventBuilderStructure,
} from "@/features/events/event-builder";
import {
  getEventPublicationVersionStatusLabel,
  type EventPublicationVersionSnapshot,
  type EventPublicationHistoryPage,
} from "@/features/events/event-publication";
import {
  loadEventPublicationVersionAction,
  loadEventPublicationHistoryAction,
} from "@/features/events/publication-actions";

function formatUtcTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const hour24 = date.getUTCHours();
  const hour12 = hour24 % 12 || 12;
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";

  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} · ${hour12}:${minute} ${period} UTC`;
}

function HistoricalSeat({
  slot,
  assignment,
}: {
  slot: EventBuilderSlot;
  assignment: EventBuilderCharacter | undefined;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{slot.name}</p>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {slot.roleLabel ? `Required: ${slot.roleLabel}` : "Any role"}
          </p>
        </div>
        <StatusChip
          tone={assignment ? assignment.status === "inactive" ? "warning" : "accent" : "neutral"}
          className="shrink-0"
        >
          {assignment ? assignment.status === "inactive" ? "Inactive" : "Assigned" : "Open"}
        </StatusChip>
      </div>

      {assignment ? (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
          <p className="truncate text-sm font-semibold">
            {assignment.ign}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {assignment.className ?? "Class unknown"}
            {assignment.roleLabel ? ` · ${assignment.roleLabel}` : ""}
            {assignment.designation
              ? ` · ${assignment.designation}`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function HistoricalTeam({
  section,
  assignments,
}: {
  section: EventBuilderSection;
  assignments: Map<string, EventBuilderCharacter>;
}) {
  return (
    <Surface level={2} className="min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
            Team
          </p>
          <h4 className="mt-1 text-base font-semibold">
            {section.name}
          </h4>
        </div>
        <StatusChip tone="neutral">
          {section.parties.length}{" "}
          {section.parties.length === 1 ? "Party" : "Parties"}
        </StatusChip>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {section.parties.map((party) => (
          <div
            key={party.id}
            className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3"
          >
            <h5 className="truncate text-sm font-semibold">
              {party.name}
            </h5>
            <div className="mt-3 space-y-2">
              {party.slots.map((slot) => (
                <HistoricalSeat
                  key={slot.id}
                  slot={slot}
                  assignment={assignments.get(slot.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function HistoricalArea({
  area,
  assignments,
}: {
  area: EventBuilderArea;
  assignments: Map<string, EventBuilderCharacter>;
}) {
  return (
    <section>
      <div className="mb-3">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-tertiary)] uppercase">
          Area
        </p>
        <h3 className="mt-1 text-lg font-semibold">{area.name}</h3>
      </div>

      <div className="grid gap-4">
        {area.sections.map((section) => (
          <HistoricalTeam
            key={section.id}
            section={section}
            assignments={assignments}
          />
        ))}
      </div>
    </section>
  );
}

function HistoricalSnapshotBoard({
  usesAreas,
  structure,
  characters,
}: {
  usesAreas: boolean;
  structure: EventBuilderStructure;
  characters: EventBuilderCharacter[];
}) {
  const assignments = mapAssignmentsBySlot(characters);

  if (usesAreas) {
    return (
      <div className="grid gap-7">
        {structure.areas.map((area) => (
          <HistoricalArea
            key={area.id}
            area={area}
            assignments={assignments}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {structure.rootSections.map((section) => (
        <HistoricalTeam
          key={section.id}
          section={section}
          assignments={assignments}
        />
      ))}
    </div>
  );
}

type PublicationHistoryDialogProps = {
  guildId: string;
  eventId: string;
  historyCount: number;
  disabled: boolean;
};

export function PublicationHistoryDialog({
  guildId,
  eventId,
  historyCount,
  disabled,
}: PublicationHistoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState<EventPublicationHistoryPage | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<EventPublicationVersionSnapshot | null>(null);
  const [loadingVersionId, setLoadingVersionId] = useState("");
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [retry, setRetry] = useState<
    { kind: "history"; before: number | null; max: number | null; index: number } |
    { kind: "snapshot"; id: string } | null
  >(null);

  useEffect(() => () => { requestRef.current++; }, []);
  useEffect(() => {
    if (isOpen) dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [isOpen]);
  useEffect(() => {
    if (selectedSnapshot) dialogRef.current?.querySelector<HTMLElement>("#publication-history-snapshot-title")?.focus();
  }, [selectedSnapshot]);
  if (historyCount === 0) return null;
  const busy = loadingPage || loadingVersionId !== "";
  const history = page?.versions ?? [];
  const total = page?.totalVersions ?? historyCount;

  function resetDialog() {
    requestRef.current++;
    setIsOpen(false);
    setPage(null);
    setSelectedSnapshot(null);
    setLoadingPage(false);
    setLoadingVersionId("");
    setLoadMessage(null);
    setAnnouncement("");
    setRetry(null);
  }

  function closeHistory() {
    resetDialog();
    dialogRef.current?.close();
  }

  function identifiers() {
    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventId", eventId);
    return data;
  }

  async function loadPage(before: number | null, max: number | null, index: number) {
    const request = ++requestRef.current;
    setLoadingPage(true);
    setLoadMessage(null);
    setRetry(null);
    setSelectedSnapshot(null);
    setAnnouncement("Loading publication history.");
    const data = identifiers();
    if (before !== null) data.set("beforeVersion", String(before));
    if (max !== null) data.set("maxVersion", String(max));
    try {
      const result = await loadEventPublicationHistoryAction(data);
      if (request !== requestRef.current || !dialogRef.current?.open) return;
      if (!result.ok) throw new Error(result.message);
      setPage(result.page);
      setPageIndex(index);
      setCursors((current) => [...current.slice(0, index), before]);
      setAnnouncement(result.page.versions.length ? "Publication history page loaded." : "No publication versions available.");
    } catch {
      if (request !== requestRef.current || !dialogRef.current?.open) return;
      setLoadMessage("Publication history could not be loaded. Try again.");
      setAnnouncement("");
      setRetry({ kind: "history", before, max, index });
    } finally {
      if (request === requestRef.current) setLoadingPage(false);
    }
  }

  function openHistory() {
    setPage(null);
    setPageIndex(0);
    setCursors([null]);
    setSelectedSnapshot(null);
    setIsOpen(true);
    dialogRef.current?.showModal();
    void loadPage(null, null, 0);
  }

  async function viewVersion(versionId: string) {
    const request = ++requestRef.current;
    setLoadingVersionId(versionId);
    setLoadMessage(null);
    setRetry(null);
    setSelectedSnapshot(null);
    setAnnouncement("Loading immutable publication snapshot.");
    const data = identifiers();
    data.set("versionId", versionId);
    try {
      const result = await loadEventPublicationVersionAction(data);
      if (request !== requestRef.current || !dialogRef.current?.open) return;
      if (!result.ok) {
        setLoadMessage(result.message);
        setRetry({ kind: "snapshot", id: versionId });
        setAnnouncement("");
        return;
      }
      setSelectedSnapshot(result.snapshot);
      setAnnouncement(`Loaded immutable version ${result.snapshot.version.versionNumber} snapshot.`);
    } catch {
      if (request !== requestRef.current || !dialogRef.current?.open) return;
      setLoadMessage("The immutable publication snapshot could not be loaded. Try again.");
      setAnnouncement("");
      setRetry({ kind: "snapshot", id: versionId });
    } finally {
      if (request === requestRef.current) setLoadingVersionId("");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={openHistory}
      >
        History ({historyCount})
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="publication-history-title"
        onCancel={resetDialog}
        onClose={resetDialog}
        className="m-auto w-[min(82rem,calc(100vw-1.5rem))] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        {isOpen ? <div className="flex max-h-[calc(100vh-1.5rem)] flex-col">
          <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <StatusChip tone="accent">
                  {total} immutable version
                  {total === 1 ? "" : "s"}
                </StatusChip>
                <h2
                  id="publication-history-title"
                  className="mt-3 text-2xl font-semibold tracking-[-0.02em]"
                >
                  Publication history
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                  Every row is a sealed snapshot. Publishing an update
                  creates a new version; older versions remain unchanged.
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={closeHistory}
              >
                Close history
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto grid max-w-[76rem] gap-5">
              <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-[var(--text-secondary)]">{announcement}</p>
              <Surface level={2} className="overflow-hidden">
                <div className="border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
                  <p className="text-xs font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
                    Versions
                  </p>
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">
                  {history.map((version) => (
                    <div
                      key={version.id}
                      data-publication-version-number={version.versionNumber}
                      className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusChip tone="accent">
                            v{version.versionNumber}
                          </StatusChip>
                          <StatusChip
                            tone={version.isCurrent ? "success" : "neutral"}
                          >
                            {getEventPublicationVersionStatusLabel(version)}
                          </StatusChip>
                        </div>

                        <p className="mt-3 truncate text-sm font-semibold">
                          {version.eventName}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                          {version.eventTypeName} · Snapshot:{" "}
                          {version.templateName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {formatUtcTimestamp(version.sealedAt)} ·{" "}
                          {version.assignmentCount}/{version.slotCount} assigned
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => viewVersion(version.id)}
                      >
                        {loadingVersionId === version.id
                          ? "Loading…"
                          : `View v${version.versionNumber} snapshot`}
                      </Button>
                    </div>
                  ))}
                </div>
              </Surface>

              {page ? (
                <nav aria-label="Publication history pages" className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="secondary" disabled={busy || pageIndex === 0}
                    onClick={() => void loadPage(cursors[pageIndex - 1] ?? null, page.maxVersionNumber, pageIndex - 1)}>Newer versions</Button>
                  <span className="text-sm">Page {pageIndex + 1} · {total} versions</span>
                  <Button type="button" variant="secondary" disabled={busy || page.nextBeforeVersion === null}
                    onClick={() => void loadPage(page.nextBeforeVersion, page.maxVersionNumber, pageIndex + 1)}>Older versions</Button>
                </nav>
              ) : null}

              {loadMessage ? (
                <Surface level={2} className="p-4">
                  <p role="alert" className="text-sm text-[var(--danger)]">
                    {loadMessage}
                  </p>
                  {retry ? <Button type="button" variant="secondary" disabled={busy} onClick={() => {
                    if (retry.kind === "snapshot") void viewVersion(retry.id);
                    else void loadPage(retry.before, retry.max, retry.index);
                  }}>Retry loading</Button> : null}
                </Surface>
              ) : null}

              {selectedSnapshot ? (
                <section
                  data-publication-snapshot-version={
                    selectedSnapshot.version.versionNumber
                  }
                  aria-labelledby="publication-history-snapshot-title"
                >
                  <Surface level={2} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <StatusChip tone="accent">
                            Immutable v
                            {selectedSnapshot.version.versionNumber}
                          </StatusChip>
                          <StatusChip
                            tone={
                              selectedSnapshot.version.isCurrent
                                ? "success"
                                : "neutral"
                            }
                          >
                            {getEventPublicationVersionStatusLabel(
                              selectedSnapshot.version,
                            )}
                          </StatusChip>
                        </div>

                        <h3
                          id="publication-history-snapshot-title"
                          tabIndex={-1}
                          className="mt-3 text-xl font-semibold"
                        >
                          {selectedSnapshot.version.eventName}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {selectedSnapshot.description ??
                            "No Event description."}
                        </p>
                      </div>

                      <div className="text-right text-xs text-[var(--text-tertiary)]">
                        <p>
                          {selectedSnapshot.version.assignmentCount}/
                          {selectedSnapshot.version.slotCount} assigned
                        </p>
                        <p className="mt-1">
                          {formatUtcTimestamp(
                            selectedSnapshot.version.sealedAt,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusChip tone="neutral">
                        {selectedSnapshot.version.eventTypeName}
                      </StatusChip>
                      <StatusChip tone="neutral">
                        Snapshot:{" "}
                        {selectedSnapshot.version.templateName}
                      </StatusChip>
                    </div>

                    <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                      This view is loaded from the sealed publication
                      snapshot, not from the current editable draft.
                    </p>
                  </Surface>

                  <div className="mt-5">
                    <HistoricalSnapshotBoard
                      usesAreas={selectedSnapshot.version.usesAreas}
                      structure={selectedSnapshot.structure}
                      characters={selectedSnapshot.characters}
                    />
                  </div>
                </section>
              ) : (
                <Surface level={2} className="p-5">
                  <p className="font-semibold">
                    Choose a version to inspect
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Historical previews are loaded from immutable sealed
                    data only when you request them.
                  </p>
                </Surface>
              )}
            </div>
          </div>
        </div> : null}
      </dialog>
    </>
  );
}
