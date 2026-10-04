"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import {
  createEventTemplateAction,
  createEventTypeAction,
  updateEventTemplateAction,
  updateEventTypeAction,
  type TemplateMutationResult,
} from "@/features/templates/actions";
import type {
  EventTemplateSummary,
  EventTypeSummary,
} from "@/features/templates/server";

type TemplateManagementViewProps = {
  guildId: string;
  guildName: string;
  eventTypes: EventTypeSummary[];
  templates: EventTemplateSummary[];
};

function templateTone(status: EventTemplateSummary["status"]) {
  if (status === "active") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function MutationMessage({
  message,
  isError,
}: {
  message: string;
  isError: boolean;
}) {
  if (!message) return null;

  return (
    <p
      aria-live="polite"
      className={`mt-4 text-sm ${
        isError
          ? "text-[var(--danger)]"
          : "text-[var(--success)]"
      }`}
    >
      {message}
    </p>
  );
}

export function TemplateManagementView({
  guildId,
  guildName,
  eventTypes,
  templates,
}: TemplateManagementViewProps) {
  const router = useRouter();
  const createTemplateDialogRef = useRef<HTMLDialogElement>(null);
  const eventTypeDialogRef = useRef<HTMLDialogElement>(null);
  const editTemplateDialogRef = useRef<HTMLDialogElement>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("live");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [editingTemplate, setEditingTemplate] =
    useState<EventTemplateSummary | null>(null);
  const [editingEventTypeId, setEditingEventTypeId] =
    useState<string | null>(null);
  const [editingEventTypeName, setEditingEventTypeName] =
    useState("");
  const [editingEventTypeDescription, setEditingEventTypeDescription] =
    useState("");
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const activeEventTypes = useMemo(
    () => eventTypes.filter((eventType) => eventType.status === "active"),
    [eventTypes],
  );

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return templates.filter((template) => {
      if (
        statusFilter === "live" &&
        template.status === "archived"
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        statusFilter !== "live" &&
        template.status !== statusFilter
      ) {
        return false;
      }

      if (
        eventTypeFilter !== "all" &&
        template.eventTypeId !== eventTypeFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        template.name.toLocaleLowerCase().includes(query) ||
        template.eventTypeName.toLocaleLowerCase().includes(query) ||
        template.description?.toLocaleLowerCase().includes(query)
      );
    });
  }, [eventTypeFilter, search, statusFilter, templates]);

  const draftCount = templates.filter(
    (template) => template.status === "draft",
  ).length;
  const activeCount = templates.filter(
    (template) => template.status === "active",
  ).length;
  const liveSeatCount = templates
    .filter((template) => template.status !== "archived")
    .reduce((sum, template) => sum + template.slotCount, 0);

  function clearMessage() {
    setMessage("");
    setIsError(false);
  }

  function applyResult(result: TemplateMutationResult) {
    setMessage(result.message);
    setIsError(!result.ok);
    return result.ok;
  }

  async function submitCreateEventType(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusyKey("create-event-type");
    clearMessage();

    const result = await createEventTypeAction(
      new FormData(event.currentTarget),
    );

    setBusyKey("");

    if (!applyResult(result)) {
      return;
    }

    form.reset();
    router.refresh();
  }

  function beginEditEventType(eventType: EventTypeSummary) {
    clearMessage();
    setEditingEventTypeId(eventType.id);
    setEditingEventTypeName(eventType.name);
    setEditingEventTypeDescription(eventType.description ?? "");
  }

  async function saveEventType(eventType: EventTypeSummary) {
    setBusyKey(`event-type-save:${eventType.id}`);
    clearMessage();

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventTypeId", eventType.id);
    data.set("name", editingEventTypeName);
    data.set("description", editingEventTypeDescription);
    data.set("status", eventType.status);

    const result = await updateEventTypeAction(data);
    setBusyKey("");

    if (!applyResult(result)) {
      return;
    }

    setEditingEventTypeId(null);
    router.refresh();
  }

  async function changeEventTypeStatus(
    eventType: EventTypeSummary,
    status: "active" | "archived",
  ) {
    setBusyKey(`event-type-status:${eventType.id}`);
    clearMessage();

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("eventTypeId", eventType.id);
    data.set("name", eventType.name);
    data.set("description", eventType.description ?? "");
    data.set("status", status);

    const result = await updateEventTypeAction(data);
    setBusyKey("");

    if (applyResult(result)) {
      router.refresh();
    }
  }

  async function submitCreateTemplate(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusyKey("create-template");
    clearMessage();

    const result = await createEventTemplateAction(
      new FormData(event.currentTarget),
    );

    setBusyKey("");

    if (!applyResult(result)) {
      return;
    }

    form.reset();
    createTemplateDialogRef.current?.close();
    router.refresh();
  }

  function openTemplateEditor(template: EventTemplateSummary) {
    clearMessage();
    setEditingTemplate(template);
    window.requestAnimationFrame(() => {
      editTemplateDialogRef.current?.showModal();
    });
  }

  async function submitEditTemplate(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!editingTemplate) {
      return;
    }

    setBusyKey(`template-save:${editingTemplate.id}`);
    clearMessage();

    const result = await updateEventTemplateAction(
      new FormData(event.currentTarget),
    );

    setBusyKey("");

    if (!applyResult(result)) {
      return;
    }

    editTemplateDialogRef.current?.close();
    setEditingTemplate(null);
    router.refresh();
  }

  async function changeTemplateStatus(
    template: EventTemplateSummary,
    status: "draft" | "archived",
  ) {
    setBusyKey(`template-status:${template.id}`);
    clearMessage();

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("templateId", template.id);
    data.set("eventTypeId", template.eventTypeId);
    data.set("name", template.name);
    data.set("description", template.description ?? "");
    data.set("usesAreas", String(template.usesAreas));
    data.set("status", status);

    const result = await updateEventTemplateAction(data);
    setBusyKey("");

    if (applyResult(result)) {
      router.refresh();
    }
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[90rem]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <StatusChip tone="accent">Template Designer</StatusChip>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
              Event Templates
            </h1>
            <p className="mt-2 max-w-3xl leading-7 text-[var(--text-secondary)]">
              Build reusable Event structures for {guildName}. Event Types,
              Template lifecycle, Area mode, and seat counts stay Guild-owned
              instead of being hard-coded for one event format.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                clearMessage();
                eventTypeDialogRef.current?.showModal();
              }}
            >
              Manage Event Types
            </Button>
            <Button
              type="button"
              disabled={activeEventTypes.length === 0}
              onClick={() => {
                clearMessage();
                createTemplateDialogRef.current?.showModal();
              }}
            >
              New Template
            </Button>
          </div>
        </div>

        {activeEventTypes.length === 0 ? (
          <Surface level={2} className="mt-5 p-4">
            <p className="text-sm font-semibold">
              Create an active Event Type before creating a Template.
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
              Event Types are Guild-defined categories such as League,
              Siege, Raid, or any format your Guild actually uses.
            </p>
          </Surface>
        ) : null}

        <MutationMessage message={message} isError={isError} />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Event Types
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {activeEventTypes.length}
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              active
            </p>
          </Surface>

          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Draft Templates
            </p>
            <p className="mt-2 text-2xl font-semibold">{draftCount}</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              being prepared
            </p>
          </Surface>

          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Active Templates
            </p>
            <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              reusable
            </p>
          </Surface>

          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Live Template Seats
            </p>
            <p className="mt-2 text-2xl font-semibold">{liveSeatCount}</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              seat rows
            </p>
          </Surface>
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 md:flex-row md:items-end">
          <label className="min-w-0 flex-1 text-xs font-semibold text-[var(--text-tertiary)]">
            Search Templates
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, Event Type, or description"
              className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
            />
          </label>

          <label className="text-xs font-semibold text-[var(--text-tertiary)]">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1.5 h-10 min-w-40 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
            >
              <option value="live">Live + Draft</option>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-[var(--text-tertiary)]">
            Event Type
            <select
              value={eventTypeFilter}
              onChange={(event) =>
                setEventTypeFilter(event.target.value)
              }
              className="mt-1.5 h-10 min-w-48 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
            >
              <option value="all">All Event Types</option>
              {eventTypes.map((eventType) => (
                <option key={eventType.id} value={eventType.id}>
                  {eventType.name}
                  {eventType.status === "archived" ? " (Archived)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {templates.length === 0 ? (
          <Surface level={2} className="mt-6 p-8">
            <p className="text-lg font-semibold">
              No Event Templates yet
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Create an Event Type, then create a reusable draft Template.
              Its structural hierarchy can be added without hard-coding
              SUN, MOON, STAR, ALPHA, or any other Guild-specific labels.
            </p>
          </Surface>
        ) : filteredTemplates.length === 0 ? (
          <Surface level={2} className="mt-6 p-6">
            <p className="font-semibold">No Templates match these filters</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Change the search, lifecycle status, or Event Type filter.
            </p>
          </Surface>
        ) : (
          <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
            {filteredTemplates.map((template) => {
              const structureCount =
                template.areaCount +
                template.sectionCount +
                template.partyCount +
                template.slotCount;
              const eventTypeCanRestore =
                template.eventTypeStatus === "active";

              return (
                <Surface key={template.id} level={2} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip tone={templateTone(template.status)}>
                          {formatStatus(template.status)}
                        </StatusChip>
                        <StatusChip tone="neutral">
                          {template.eventTypeName}
                        </StatusChip>
                        <StatusChip tone="neutral">
                          {template.usesAreas
                            ? "Area hierarchy"
                            : "Flat hierarchy"}
                        </StatusChip>
                      </div>

                      <h2 className="mt-3 truncate text-xl font-semibold">
                        {template.name}
                      </h2>
                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--text-secondary)]">
                        {template.description ??
                          "No Template description yet."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Areas
                      </p>
                      <p className="mt-1 font-semibold">
                        {template.areaCount}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Teams
                      </p>
                      <p className="mt-1 font-semibold">
                        {template.sectionCount}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Parties
                      </p>
                      <p className="mt-1 font-semibold">
                        {template.partyCount}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Seats
                      </p>
                      <p className="mt-1 font-semibold">
                        {template.slotCount}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Updated{" "}
                      {new Date(template.updatedAt).toLocaleDateString()}
                      {structureCount === 0 ? " · Team layout not started" : ""}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/app/guild/${guildId}/templates/${template.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-3)]"
                      >
                        Design teams
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busyKey !== ""}
                        onClick={() => openTemplateEditor(template)}
                      >
                        Edit details
                      </Button>

                      {template.status === "archived" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={
                            busyKey !== "" || !eventTypeCanRestore
                          }
                          title={
                            eventTypeCanRestore
                              ? undefined
                              : "Restore the Event Type first."
                          }
                          onClick={() =>
                            changeTemplateStatus(template, "draft")
                          }
                        >
                          {busyKey ===
                          `template-status:${template.id}`
                            ? "Restoring…"
                            : "Restore to Draft"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyKey !== ""}
                          onClick={() =>
                            changeTemplateStatus(template, "archived")
                          }
                        >
                          {busyKey ===
                          `template-status:${template.id}`
                            ? "Archiving…"
                            : "Archive"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Surface>
              );
            })}
          </div>
        )}
      </div>

      <dialog
        ref={createTemplateDialogRef}
        aria-labelledby="create-template-title"
        onClose={clearMessage}
        className="m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
          <div>
            <StatusChip tone="accent">Reusable Template</StatusChip>
            <h2 id="create-template-title" className="mt-2 text-xl font-semibold">
              Create Event Template
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => createTemplateDialogRef.current?.close()}
          >
            Close
          </Button>
        </div>

        <form onSubmit={submitCreateTemplate} className="p-5 sm:p-6">
          <input type="hidden" name="guildId" value={guildId} />

          <label className="text-sm font-semibold">
            Event Type
            <select
              name="eventTypeId"
              required
              defaultValue={activeEventTypes[0]?.id ?? ""}
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
            >
              {activeEventTypes.map((eventType) => (
                <option key={eventType.id} value={eventType.id}>
                  {eventType.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-5 block text-sm font-semibold">
            Template name
            <input
              name="name"
              required
              maxLength={120}
              autoComplete="off"
              placeholder="Example: Saturday Guild League"
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
            />
          </label>

          <label className="mt-5 block text-sm font-semibold">
            Description
            <textarea
              name="description"
              maxLength={1000}
              rows={3}
              placeholder="Optional organizer notes about when this Template is used."
              className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 font-normal"
            />
          </label>

          <label className="mt-5 block text-sm font-semibold">
            Structure mode
            <select
              name="usesAreas"
              defaultValue="false"
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
            >
              <option value="false">
                Teams → Parties → 5 seats
              </option>
              <option value="true">
                Areas → Teams → Parties → 5 seats
              </option>
            </select>
          </label>
          <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
            Once structural rows exist, Area mode is locked so existing
            hierarchy is never silently reshaped.
          </p>

          <MutationMessage message={message} isError={isError} />

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busyKey !== ""}
              onClick={() => createTemplateDialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                busyKey !== "" || activeEventTypes.length === 0
              }
            >
              {busyKey === "create-template"
                ? "Creating…"
                : "Create Draft"}
            </Button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={eventTypeDialogRef}
        aria-labelledby="event-types-title"
        onClose={() => {
          clearMessage();
          setEditingEventTypeId(null);
        }}
        className="m-auto w-[min(52rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <h2 id="event-types-title" className="text-xl font-semibold">
              Event Types
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Guild-defined categories for reusable Templates.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => eventTypeDialogRef.current?.close()}
          >
            Close
          </Button>
        </div>

        <div className="p-5 sm:p-6">
          <form onSubmit={submitCreateEventType}>
            <input type="hidden" name="guildId" value={guildId} />
            <p className="font-semibold">Create Event Type</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
              <label className="text-xs font-semibold text-[var(--text-tertiary)]">
                Name
                <input
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="off"
                  placeholder="Example: Guild League"
                  className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
                />
              </label>

              <label className="text-xs font-semibold text-[var(--text-tertiary)]">
                Description
                <input
                  name="description"
                  maxLength={500}
                  autoComplete="off"
                  placeholder="Optional"
                  className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
                />
              </label>

              <Button
                type="submit"
                disabled={busyKey !== ""}
              >
                {busyKey === "create-event-type"
                  ? "Creating…"
                  : "Create"}
              </Button>
            </div>
          </form>

          <MutationMessage message={message} isError={isError} />

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Existing Event Types</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {eventTypes.length} total
                </p>
              </div>
            </div>

            {eventTypes.length === 0 ? (
              <Surface level={2} className="mt-3 p-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  No Event Types yet. Create the first Guild-defined
                  category above.
                </p>
              </Surface>
            ) : (
              <div className="mt-3 grid gap-3">
                {eventTypes.map((eventType) => {
                  const editing =
                    editingEventTypeId === eventType.id;
                  const archivingBlocked =
                    eventType.status === "active" &&
                    eventType.liveTemplateCount > 0;

                  return (
                    <Surface key={eventType.id} level={2} className="p-4">
                      {editing ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-semibold text-[var(--text-tertiary)]">
                              Name
                              <input
                                value={editingEventTypeName}
                                onChange={(event) =>
                                  setEditingEventTypeName(
                                    event.target.value,
                                  )
                                }
                                maxLength={80}
                                autoFocus
                                className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
                              />
                            </label>

                            <label className="text-xs font-semibold text-[var(--text-tertiary)]">
                              Description
                              <input
                                value={editingEventTypeDescription}
                                onChange={(event) =>
                                  setEditingEventTypeDescription(
                                    event.target.value,
                                  )
                                }
                                maxLength={500}
                                className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm font-normal text-[var(--text-primary)]"
                              />
                            </label>
                          </div>

                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyKey !== ""}
                              onClick={() =>
                                setEditingEventTypeId(null)
                              }
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={
                                busyKey !== "" ||
                                editingEventTypeName.trim().length === 0
                              }
                              onClick={() => saveEventType(eventType)}
                            >
                              {busyKey ===
                              `event-type-save:${eventType.id}`
                                ? "Saving…"
                                : "Save"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {eventType.name}
                              </p>
                              <StatusChip
                                tone={
                                  eventType.status === "active"
                                    ? "success"
                                    : "neutral"
                                }
                              >
                                {formatStatus(eventType.status)}
                              </StatusChip>
                            </div>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              {eventType.description ??
                                "No description."}
                            </p>
                            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                              {eventType.templateCount} total Template
                              {eventType.templateCount === 1 ? "" : "s"} ·{" "}
                              {eventType.liveTemplateCount} not archived
                            </p>
                            {archivingBlocked ? (
                              <p className="mt-2 text-xs font-semibold text-[var(--warning)]">
                                Archive its live Templates before
                                archiving this Event Type.
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyKey !== ""}
                              onClick={() =>
                                beginEditEventType(eventType)
                              }
                            >
                              Edit
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={
                                busyKey !== "" || archivingBlocked
                              }
                              onClick={() =>
                                changeEventTypeStatus(
                                  eventType,
                                  eventType.status === "active"
                                    ? "archived"
                                    : "active",
                                )
                              }
                            >
                              {busyKey ===
                              `event-type-status:${eventType.id}`
                                ? "Saving…"
                                : eventType.status === "active"
                                  ? "Archive"
                                  : "Restore"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </Surface>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </dialog>

      <dialog
        ref={editTemplateDialogRef}
        aria-labelledby="edit-template-title"
        onClose={() => {
          clearMessage();
          setEditingTemplate(null);
        }}
        className="m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        {editingTemplate ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
              <div>
                <StatusChip tone={templateTone(editingTemplate.status)}>
                  {formatStatus(editingTemplate.status)}
                </StatusChip>
                <h2
                  id="edit-template-title"
                  className="mt-2 text-xl font-semibold"
                >
                  Edit Template Details
                </h2>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => editTemplateDialogRef.current?.close()}
              >
                Close
              </Button>
            </div>

            <form
              key={editingTemplate.id}
              onSubmit={submitEditTemplate}
              className="p-5 sm:p-6"
            >
              <input type="hidden" name="guildId" value={guildId} />
              <input
                type="hidden"
                name="templateId"
                value={editingTemplate.id}
              />
              <input
                type="hidden"
                name="status"
                value={
                  editingTemplate.status === "archived"
                    ? "archived"
                    : "draft"
                }
              />

              {editingTemplate.status === "active" ? (
                <div className="mb-5 rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-4">
                  <p className="text-sm font-semibold text-[var(--warning)]">
                    Saving active Template metadata returns it to Draft.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    It must pass the validation gate again before
                    reactivation.
                  </p>
                </div>
              ) : null}

              <label className="text-sm font-semibold">
                Event Type
                <select
                  name="eventTypeId"
                  defaultValue={editingTemplate.eventTypeId}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                >
                  {eventTypes
                    .filter(
                      (eventType) =>
                        eventType.status === "active" ||
                        eventType.id === editingTemplate.eventTypeId,
                    )
                    .map((eventType) => (
                      <option key={eventType.id} value={eventType.id}>
                        {eventType.name}
                        {eventType.status === "archived"
                          ? " (Archived)"
                          : ""}
                      </option>
                    ))}
                </select>
              </label>

              <label className="mt-5 block text-sm font-semibold">
                Template name
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editingTemplate.name}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                />
              </label>

              <label className="mt-5 block text-sm font-semibold">
                Description
                <textarea
                  name="description"
                  maxLength={1000}
                  rows={3}
                  defaultValue={editingTemplate.description ?? ""}
                  className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 font-normal"
                />
              </label>

              {editingTemplate.areaCount +
                editingTemplate.sectionCount +
                editingTemplate.partyCount +
                editingTemplate.slotCount >
              0 ? (
                <>
                  <input
                    type="hidden"
                    name="usesAreas"
                    value={String(editingTemplate.usesAreas)}
                  />
                  <label className="mt-5 block text-sm font-semibold">
                    Structure mode
                    <select
                      disabled
                      value={String(editingTemplate.usesAreas)}
                      className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 font-normal text-[var(--text-tertiary)]"
                    >
                      <option value="false">
                        Sections → Parties → Slots
                      </option>
                      <option value="true">
                        Areas → Sections → Parties → Slots
                      </option>
                    </select>
                  </label>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    Structure mode is locked because this Template already
                    contains structural rows.
                  </p>
                </>
              ) : (
                <label className="mt-5 block text-sm font-semibold">
                  Structure mode
                  <select
                    name="usesAreas"
                    defaultValue={String(editingTemplate.usesAreas)}
                    className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                  >
                    <option value="false">
                      Sections → Parties → Slots
                    </option>
                    <option value="true">
                      Areas → Sections → Parties → Slots
                    </option>
                  </select>
                </label>
              )}

              <MutationMessage message={message} isError={isError} />

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyKey !== ""}
                  onClick={() => editTemplateDialogRef.current?.close()}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busyKey !== ""}>
                  {busyKey ===
                  `template-save:${editingTemplate.id}`
                    ? "Saving…"
                    : editingTemplate.status === "archived"
                      ? "Save Archived Details"
                      : "Save as Draft"}
                </Button>
              </div>
            </form>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
