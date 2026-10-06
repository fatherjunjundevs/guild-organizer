"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import {
  createEventAction,
  type EventMutationResult,
} from "@/features/events/actions";
import type {
  EventSummary,
  EventTemplateOption,
} from "@/features/events/server";

type EventManagementViewProps = {
  guildId: string;
  guildName: string;
  events: EventSummary[];
  activeTemplates: EventTemplateOption[];
};

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function EventMessage({
  result,
}: {
  result: EventMutationResult | null;
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

export function EventManagementView({
  guildId,
  guildName,
  events,
  activeTemplates,
}: EventManagementViewProps) {
  const router = useRouter();
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    activeTemplates[0]?.id ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EventMutationResult | null>(null);

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();

    return events.filter((event) => {
      if (statusFilter !== "all" && event.status !== statusFilter) {
        return false;
      }

      if (!normalized) return true;

      return (
        event.name.toLocaleLowerCase().includes(normalized) ||
        event.eventTypeName.toLocaleLowerCase().includes(normalized) ||
        event.templateName.toLocaleLowerCase().includes(normalized) ||
        event.description?.toLocaleLowerCase().includes(normalized)
      );
    });
  }, [events, query, statusFilter]);

  const selectedTemplate = activeTemplates.find(
    (template) => template.id === selectedTemplateId,
  );
  const activeCount = events.filter((event) => event.status === "active").length;
  const activeSeatCount = events
    .filter((event) => event.status === "active")
    .reduce((total, event) => total + event.slotCount, 0);

  function openCreateDialog() {
    setResult(null);
    setSelectedTemplateId(activeTemplates[0]?.id ?? "");
    createDialogRef.current?.showModal();
  }

  async function submitCreateEvent(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setResult(null);

    const mutation = await createEventAction(new FormData(form));
    setBusy(false);
    setResult(mutation);

    if (!mutation.ok) return;

    form.reset();
    createDialogRef.current?.close();
    router.refresh();
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <StatusChip tone="accent">Event Builder</StatusChip>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
              Events
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
              Build {guildName} lineups from active reusable Templates. Each
              Event receives its own independent structural snapshot.
            </p>
          </div>

          <Button
            type="button"
            disabled={activeTemplates.length === 0}
            onClick={openCreateDialog}
          >
            Create Event
          </Button>
        </div>

        {activeTemplates.length === 0 ? (
          <Surface level={2} className="mt-6 p-5">
            <p className="font-semibold">No active Templates are ready</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Activate a valid Event Template before creating an Event. Draft
              and archived Templates cannot create Event snapshots.
            </p>
          </Surface>
        ) : null}

        <div className="mt-6">
          <EventMessage result={result} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">Active Events</p>
            <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
          </Surface>
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Active Templates
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {activeTemplates.length}
            </p>
          </Surface>
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Active Event Seats
            </p>
            <p className="mt-2 text-2xl font-semibold">{activeSeatCount}</p>
          </Surface>
        </div>

        <Surface level={1} className="mt-8 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
            <label className="text-xs font-semibold text-[var(--text-tertiary)]">
              Search Events
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Event, Event Type, Template…"
                className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
              />
            </label>

            <label className="text-xs font-semibold text-[var(--text-tertiary)]">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>
        </Surface>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Event plans</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {filteredEvents.length} shown · {events.length} total
            </p>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <Surface level={2} className="mt-4 p-6">
            <p className="font-semibold">
              {events.length === 0 ? "No Events yet" : "No Events match"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {events.length === 0
                ? "Create the first Event from an active Template to begin lineup planning."
                : "Change the search text or status filter to see more Event plans."}
            </p>
          </Surface>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {filteredEvents.map((event) => (
              <Surface key={event.id} level={2} className="min-w-0 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip
                        tone={event.status === "active" ? "success" : "neutral"}
                      >
                        {formatStatus(event.status)}
                      </StatusChip>
                      <StatusChip tone="neutral">{event.eventTypeName}</StatusChip>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-semibold">
                      {event.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Updated {formatDate(event.updatedAt)}
                  </p>
                </div>

                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {event.description ?? "No Event description."}
                </p>

                <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
                  <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase">
                    Source snapshot
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {event.templateName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {event.usesAreas
                      ? "Areas → Teams → Parties → Slots"
                      : "Teams → Parties → Slots"}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {event.usesAreas ? (
                    <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">Areas</p>
                      <p className="mt-1 font-semibold">{event.areaCount}</p>
                    </div>
                  ) : null}
                  <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                    <p className="text-xs text-[var(--text-tertiary)]">Teams</p>
                    <p className="mt-1 font-semibold">{event.sectionCount}</p>
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                    <p className="text-xs text-[var(--text-tertiary)]">Parties</p>
                    <p className="mt-1 font-semibold">{event.partyCount}</p>
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--surface-1)] p-3">
                    <p className="text-xs text-[var(--text-tertiary)]">Seats</p>
                    <p className="mt-1 font-semibold">{event.slotCount}</p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/app/guild/${guildId}/events/${event.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-sm font-semibold text-[#07101f] transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--accent-hover)] active:translate-y-px"
                  >
                    Open Event Builder
                  </Link>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>

      <dialog
        ref={createDialogRef}
        aria-labelledby="create-event-title"
        onClose={() => setBusy(false)}
        className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
          <div>
            <StatusChip tone="accent">Independent snapshot</StatusChip>
            <h2 id="create-event-title" className="mt-2 text-xl font-semibold">
              Create Event
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Choose an active Template. Later Template edits will not rewrite
              this Event.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => createDialogRef.current?.close()}
          >
            Close
          </Button>
        </div>

        <form onSubmit={submitCreateEvent} className="p-5 sm:p-6">
          <input type="hidden" name="guildId" value={guildId} />

          <label className="block text-sm font-semibold">
            Active Template
            <select
              name="templateId"
              required
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
            >
              {activeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.eventTypeName} — {template.name}
                </option>
              ))}
            </select>
          </label>

          {selectedTemplate ? (
            <Surface level={2} className="mt-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{selectedTemplate.name}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {selectedTemplate.eventTypeName} · {selectedTemplate.slotCount}{" "}
                    seat{selectedTemplate.slotCount === 1 ? "" : "s"}
                  </p>
                </div>
                <StatusChip tone="success">Active</StatusChip>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {selectedTemplate.description ?? "No Template description."}
              </p>
            </Surface>
          ) : null}

          <label className="mt-5 block text-sm font-semibold">
            Event name
            <input
              name="name"
              required
              maxLength={120}
              autoComplete="off"
              placeholder="Example: Guild League Week 1"
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
            />
          </label>

          <label className="mt-5 block text-sm font-semibold">
            Description
            <textarea
              name="description"
              maxLength={1000}
              rows={3}
              placeholder="Optional planning note"
              className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 font-normal"
            />
          </label>

          <div className="mt-4">
            <EventMessage result={result?.ok ? null : result} />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => createDialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !selectedTemplateId}
            >
              {busy ? "Creating…" : "Create Event"}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
