"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import type { EventAssignmentMutationResult } from "@/features/events/assignment-actions";
import {
  mapAssignmentsBySlot,
  type EventBuilderCharacter,
  type EventBuilderEvent,
} from "@/features/events/event-assignment";
import type {
  EventBuilderArea,
  EventBuilderSection,
  EventBuilderSlot,
} from "@/features/events/event-builder";
import {
  getEventPublicationUi,
  type EventPublicationState,
} from "@/features/events/event-publication";
import {
  publishEventAction,
  unpublishEventAction,
  updateEventPublicationAction,
} from "@/features/events/publication-actions";
import type { EventBuilderWarningReport } from "@/features/events/event-warnings";

function publicationTone(
  lifecycle: EventPublicationState["lifecycle"],
) {
  if (lifecycle === "published") return "success" as const;
  if (lifecycle === "unpublished") return "warning" as const;
  return "neutral" as const;
}

function PreviewSeat({
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
          tone={
            assignment
              ? assignment.status === "active"
                ? "accent"
                : "warning"
              : "neutral"
          }
          className="shrink-0"
        >
          {assignment
            ? assignment.status === "active"
              ? "Assigned"
              : "Inactive"
            : "Open"}
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
      ) : (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          This Seat will appear open in the published lineup.
        </p>
      )}
    </div>
  );
}

function PreviewTeam({
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
                <PreviewSeat
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

function PreviewArea({
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
          <PreviewTeam
            key={section.id}
            section={section}
            assignments={assignments}
          />
        ))}
      </div>
    </section>
  );
}

function PublicationPreviewBoard({
  event,
  characters,
}: {
  event: EventBuilderEvent;
  characters: EventBuilderCharacter[];
}) {
  const assignments = useMemo(
    () => mapAssignmentsBySlot(characters),
    [characters],
  );

  if (event.usesAreas) {
    if (event.structure.areas.length === 0) {
      return (
        <Surface level={2} className="p-5">
          <p className="font-semibold">No Areas to preview</p>
        </Surface>
      );
    }

    return (
      <div className="grid gap-7">
        {event.structure.areas.map((area) => (
          <PreviewArea
            key={area.id}
            area={area}
            assignments={assignments}
          />
        ))}
      </div>
    );
  }

  if (event.structure.rootSections.length === 0) {
    return (
      <Surface level={2} className="p-5">
        <p className="font-semibold">No Teams to preview</p>
      </Surface>
    );
  }

  return (
    <div className="grid gap-4">
      {event.structure.rootSections.map((section) => (
        <PreviewTeam
          key={section.id}
          section={section}
          assignments={assignments}
        />
      ))}
    </div>
  );
}

type EventPublicationPanelProps = {
  guildId: string;
  event: EventBuilderEvent;
  characters: EventBuilderCharacter[];
  initialPublication: EventPublicationState;
  canPublish: boolean;
  assignmentBusy: boolean;
  warningReport: EventBuilderWarningReport;
  onFeedback: (
    result: EventAssignmentMutationResult | null,
  ) => void;
};

export function EventPublicationPanel({
  guildId,
  event,
  characters,
  initialPublication,
  canPublish,
  assignmentBusy,
  warningReport,
  onFeedback,
}: EventPublicationPanelProps) {
  const previewDialogRef = useRef<HTMLDialogElement>(null);
  const unpublishDialogRef = useRef<HTMLDialogElement>(null);
  const [publication, setPublication] =
    useState(initialPublication);
  const [busy, setBusy] = useState<
    "publish" | "update" | "unpublish" | null
  >(null);

  const ui = getEventPublicationUi(publication);
  const eventArchived = event.status === "archived";
  const canMutate = canPublish && !eventArchived;
  const mutationBlocked = assignmentBusy || busy !== null;

  function openPreview() {
    onFeedback(null);
    previewDialogRef.current?.showModal();
  }

  function openUnpublish() {
    onFeedback(null);
    unpublishDialogRef.current?.showModal();
  }

  async function confirmPublish() {
    if (!canMutate || mutationBlocked) return;

    const mode =
      publication.lifecycle === "published"
        ? "update"
        : "publish";
    setBusy(mode);
    onFeedback(null);

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventId", event.id);

    const result =
      mode === "update"
        ? await updateEventPublicationAction(data)
        : await publishEventAction(data);

    setBusy(null);

    if (!result.ok) {
      onFeedback({ ok: false, message: result.message });
      return;
    }

    if (result.publication) {
      setPublication(result.publication);
    }

    previewDialogRef.current?.close();
    onFeedback({ ok: true, message: result.message });
  }

  async function confirmUnpublish() {
    if (
      !canPublish ||
      publication.lifecycle !== "published" ||
      mutationBlocked
    ) {
      return;
    }

    setBusy("unpublish");
    onFeedback(null);

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventId", event.id);

    const result = await unpublishEventAction(data);
    setBusy(null);

    if (!result.ok) {
      onFeedback({ ok: false, message: result.message });
      return;
    }

    if (result.publication) {
      setPublication(result.publication);
    }

    unpublishDialogRef.current?.close();
    onFeedback({ ok: true, message: result.message });
  }

  return (
    <>
      <Surface level={2} className="mt-4 overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
                Publishing
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                Member lineup
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {ui.detail}
              </p>
            </div>
            <StatusChip tone={publicationTone(publication.lifecycle)}>
              {ui.statusLabel}
            </StatusChip>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={busy !== null}
              onClick={openPreview}
            >
              {canMutate
                ? ui.previewButtonLabel
                : "Preview lineup"}
            </Button>

            {publication.lifecycle === "published" &&
            canPublish &&
            !eventArchived ? (
              <Button
                type="button"
                variant="secondary"
                disabled={mutationBlocked}
                onClick={openUnpublish}
              >
                Unpublish
              </Button>
            ) : null}
          </div>

          {!canPublish ? (
            <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">
              Preview is available. Publishing actions require the
              publish.manage capability.
            </p>
          ) : eventArchived ? (
            <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">
              Archived Events can be previewed, but they cannot publish
              or update a member-facing version.
            </p>
          ) : assignmentBusy ? (
            <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">
              Finish the current assignment save before publishing.
            </p>
          ) : null}
        </div>

        <div className="grid border-t border-[var(--border-subtle)] sm:grid-cols-3">
          <div className="p-4">
            <p className="text-[11px] text-[var(--text-tertiary)]">
              Current
            </p>
            <p className="mt-1 text-sm font-semibold">
              {ui.statusLabel}
            </p>
          </div>
          <div className="border-t border-[var(--border-subtle)] p-4 sm:border-t-0 sm:border-l">
            <p className="text-[11px] text-[var(--text-tertiary)]">
              Next immutable version
            </p>
            <p className="mt-1 text-sm font-semibold">
              v{ui.nextVersionNumber}
            </p>
          </div>
          <div className="border-t border-[var(--border-subtle)] p-4 sm:border-t-0 sm:border-l">
            <p className="text-[11px] text-[var(--text-tertiary)]">
              Advisory warnings
            </p>
            <p className="mt-1 text-sm font-semibold">
              {warningReport.summary.total}
            </p>
          </div>
        </div>
      </Surface>

      <dialog
        ref={previewDialogRef}
        aria-labelledby="publication-preview-title"
        onCancel={(dialogEvent) => {
          if (busy === "publish" || busy === "update") {
            dialogEvent.preventDefault();
          }
        }}
        className="m-auto w-[min(80rem,calc(100vw-1.5rem))] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="flex max-h-[calc(100vh-1.5rem)] flex-col">
          <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <StatusChip tone="accent">
                    Next version v{ui.nextVersionNumber}
                  </StatusChip>
                  <StatusChip
                    tone={
                      warningReport.summary.total > 0
                        ? "warning"
                        : "success"
                    }
                  >
                    {warningReport.summary.total > 0
                      ? `${warningReport.summary.total} advisory warning${
                          warningReport.summary.total === 1 ? "" : "s"
                        }`
                      : "No warnings"}
                  </StatusChip>
                </div>
                <h2
                  id="publication-preview-title"
                  className="mt-3 text-2xl font-semibold tracking-[-0.02em]"
                >
                  Member lineup preview
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  This read-only preview uses only fields captured by the
                  immutable publication snapshot. Previewing does not
                  change the draft Event.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy === "publish" || busy === "update"}
                onClick={() => previewDialogRef.current?.close()}
              >
                Close
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-[72rem]">
              <Surface level={2} className="p-4 sm:p-5">
                <div className="flex flex-wrap gap-2">
                  <StatusChip tone="neutral">
                    {event.eventTypeName}
                  </StatusChip>
                  <StatusChip tone="neutral">
                    Snapshot: {event.templateName}
                  </StatusChip>
                </div>
                <h3 className="mt-4 text-2xl font-semibold">
                  {event.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {event.description ?? "No Event description."}
                </p>

                {publication.lifecycle === "published" ? (
                  <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {publication.currentVersionNumber
                      ? `Members keep seeing published v${publication.currentVersionNumber} until you confirm this update.`
                      : "The current published version remains live until you confirm this update."}
                  </p>
                ) : null}
              </Surface>

              <div className="mt-5">
                <PublicationPreviewBoard
                  event={event}
                  characters={characters}
                />
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-xs leading-5 text-[var(--text-secondary)]">
                Publishing creates a new sealed snapshot. Later draft or
                roster edits cannot rewrite that version.
              </p>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy === "publish" || busy === "update"}
                  onClick={() => previewDialogRef.current?.close()}
                >
                  Close
                </Button>
                {canMutate ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={mutationBlocked}
                    onClick={confirmPublish}
                  >
                    {busy === "publish" || busy === "update"
                      ? "Publishing…"
                      : ui.confirmButtonLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </dialog>

      <dialog
        ref={unpublishDialogRef}
        aria-labelledby="unpublish-event-title"
        onCancel={(dialogEvent) => {
          if (busy === "unpublish") {
            dialogEvent.preventDefault();
          }
        }}
        className="m-auto w-[min(34rem,calc(100vw-1.5rem))] rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="p-5 sm:p-6">
          <StatusChip tone="warning">Member visibility</StatusChip>
          <h2
            id="unpublish-event-title"
            className="mt-3 text-xl font-semibold"
          >
            Unpublish Event?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Members will stop seeing the current published lineup.
            Immutable version history will remain saved, and a future
            republish will create a new version instead of overwriting
            history.
          </p>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy === "unpublish"}
              onClick={() => unpublishDialogRef.current?.close()}
            >
              Keep published
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy === "unpublish"}
              onClick={confirmUnpublish}
            >
              {busy === "unpublish"
                ? "Unpublishing…"
                : "Unpublish now"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
