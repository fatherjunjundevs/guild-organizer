"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createRosterCustomFieldAction,
  deleteRosterCustomFieldAction,
  updateRosterCustomFieldAction,
} from "@/features/roster/custom-field-actions";
import type { RosterCustomFieldType } from "@/features/roster/custom-fields";
import type { MasterRosterCustomField } from "@/features/roster/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

const FIELD_TYPE_LABELS: Record<RosterCustomFieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / No",
  select: "Choice",
};

export function RosterCustomFieldManagerDialog({
  guildId,
  fields,
}: {
  guildId: string;
  fields: MasterRosterCustomField[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerStartedRef = useRef(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] =
    useState<RosterCustomFieldType>("text");
  const [newSelectOptions, setNewSelectOptions] = useState("");
  const [search, setSearch] = useState("");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = useState("");
  const [editingOptions, setEditingOptions] = useState("");
  const [pendingDeleteField, setPendingDeleteField] =
    useState<MasterRosterCustomField | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");

  const normalizedNewFieldName = newFieldName
    .trim()
    .toLocaleLowerCase();

  const duplicateField = useMemo(
    () =>
      normalizedNewFieldName
        ? fields.find(
            (field) =>
              field.name.trim().toLocaleLowerCase() ===
              normalizedNewFieldName,
          ) ?? null
        : null,
    [fields, normalizedNewFieldName],
  );

  const filteredFields = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) return fields;

    return fields.filter((field) =>
      field.name.toLocaleLowerCase().includes(query),
    );
  }, [fields, search]);

  function resetTransientState() {
    setNewFieldName("");
    setNewFieldType("text");
    setNewSelectOptions("");
    setSearch("");
    setEditingFieldId(null);
    setEditingName("");
    setEditingOptions("");
    setPendingDeleteField(null);
    setBusyKey("");
    setMessage("");
  }

  async function createField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      duplicateField ||
      fields.length >= 20 ||
      newFieldName.trim().length === 0
    ) {
      return;
    }

    setBusyKey("create");
    setMessage("");

    const result = await createRosterCustomFieldAction(
      new FormData(event.currentTarget),
    );

    setBusyKey("");

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setNewFieldName("");
    setNewFieldType("text");
    setNewSelectOptions("");
    setMessage(result.message);
    router.refresh();
  }

  function beginEdit(field: MasterRosterCustomField) {
    setEditingFieldId(field.id);
    setEditingName(field.name);
    setEditingOptions(field.selectOptions.join("\n"));
    setMessage("");
  }

  function cancelEdit() {
    setEditingFieldId(null);
    setEditingName("");
    setEditingOptions("");
  }

  async function saveEdit(field: MasterRosterCustomField) {
    const nextName = editingName.trim();

    if (!nextName) {
      setMessage("Custom field name cannot be empty.");
      return;
    }

    const duplicate = fields.find(
      (candidate) =>
        candidate.id !== field.id &&
        candidate.name.trim().toLocaleLowerCase() ===
          nextName.toLocaleLowerCase(),
    );

    if (duplicate) {
      setMessage(`\"${duplicate.name}\" already exists.`);
      return;
    }

    setBusyKey(`edit:${field.id}`);
    setMessage("");

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("fieldId", field.id);
    data.set("name", nextName);
    data.set("fieldType", field.fieldType);
    data.set(
      "selectOptions",
      field.fieldType === "select" ? editingOptions : "",
    );

    const result = await updateRosterCustomFieldAction(data);

    setBusyKey("");

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    cancelEdit();
    setMessage(result.message);
    router.refresh();
  }

  async function confirmDeleteField() {
    if (!pendingDeleteField) return;

    const field = pendingDeleteField;
    setBusyKey(`delete:${field.id}`);
    setMessage("");

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("fieldId", field.id);

    const result = await deleteRosterCustomFieldAction(data);

    setBusyKey("");

    if (!result.ok) {
      setMessage(result.message);
      setPendingDeleteField(null);
      return;
    }

    setPendingDeleteField(null);
    setMessage(result.message);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        Manage Fields
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="roster-custom-fields-dialog-title"
        onClose={resetTransientState}
        onPointerDown={(event) => {
          backdropPointerStartedRef.current =
            event.target === dialogRef.current;
        }}
        onPointerCancel={() => {
          backdropPointerStartedRef.current = false;
        }}
        onClick={(event) => {
          const shouldClose =
            backdropPointerStartedRef.current &&
            event.target === dialogRef.current;

          backdropPointerStartedRef.current = false;

          if (!shouldClose || pendingDeleteField) return;

          event.preventDefault();
          event.stopPropagation();

          window.requestAnimationFrame(() => {
            if (dialogRef.current?.open) {
              dialogRef.current.close();
            }
          });
        }}
        className="m-auto w-[min(52rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <h2
              id="roster-custom-fields-dialog-title"
              className="text-xl font-semibold"
            >
              Custom Fields
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Define Guild-specific organizer fields for roster characters.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </Button>
        </div>

        <div className="p-5 sm:p-6">
          <form onSubmit={createField}>
            <input type="hidden" name="guildId" value={guildId} />

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <div>
                <label
                  htmlFor="new-roster-custom-field-name"
                  className="text-sm font-semibold"
                >
                  Field name
                </label>
                <input
                  id="new-roster-custom-field-name"
                  name="name"
                  value={newFieldName}
                  onChange={(event) => {
                    setNewFieldName(event.target.value);
                    setMessage("");
                  }}
                  maxLength={40}
                  autoComplete="off"
                  placeholder="Example: Discord Name"
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="new-roster-custom-field-type"
                  className="text-sm font-semibold"
                >
                  Type
                </label>
                <select
                  id="new-roster-custom-field-type"
                  name="fieldType"
                  value={newFieldType}
                  onChange={(event) => {
                    setNewFieldType(
                      event.target.value as RosterCustomFieldType,
                    );
                    setNewSelectOptions("");
                    setMessage("");
                  }}
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes / No</option>
                  <option value="select">Choice</option>
                </select>
              </div>
            </div>

            {newFieldType === "select" ? (
              <div className="mt-4">
                <label
                  htmlFor="new-roster-custom-field-options"
                  className="text-sm font-semibold"
                >
                  Choice options
                </label>
                <textarea
                  id="new-roster-custom-field-options"
                  name="selectOptions"
                  value={newSelectOptions}
                  onChange={(event) =>
                    setNewSelectOptions(event.target.value)
                  }
                  rows={4}
                  placeholder={"Main Team\nReserve\nFlexible"}
                  className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                />
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  Enter one option per line. Choice fields require 2 to 20
                  unique options.
                </p>
              </div>
            ) : null}

            {duplicateField ? (
              <p className="mt-3 text-xs font-semibold text-[var(--warning)]">
                &ldquo;{duplicateField.name}&rdquo; already exists.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {fields.length}/20 fields configured
              </p>
              <Button
                type="submit"
                disabled={
                  busyKey !== "" ||
                  fields.length >= 20 ||
                  newFieldName.trim().length === 0 ||
                  Boolean(duplicateField)
                }
              >
                {busyKey === "create" ? "Creating…" : "Create Field"}
              </Button>
            </div>
          </form>

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-semibold">Existing fields</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Field types stay fixed after creation. Names and Choice
                  options can be updated.
                </p>
              </div>

              {fields.length > 4 ? (
                <div className="w-full sm:w-64">
                  <label
                    htmlFor="roster-custom-field-search"
                    className="text-xs font-semibold text-[var(--text-tertiary)]"
                  >
                    Search fields
                  </label>
                  <input
                    id="roster-custom-field-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a field…"
                    className="mt-1.5 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                  />
                </div>
              ) : null}
            </div>

            {fields.length === 0 ? (
              <p className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">
                No custom fields yet. Create the first organizer field above.
              </p>
            ) : filteredFields.length === 0 ? (
              <p className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">
                No fields match &ldquo;{search.trim()}&rdquo;.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {filteredFields.map((field) => {
                  const editing = editingFieldId === field.id;
                  const inputId = `roster-custom-field-${field.id}`;

                  return (
                    <div
                      key={field.id}
                      className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-3"
                    >
                      {editing ? (
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label
                              htmlFor={inputId}
                              className="text-xs font-semibold text-[var(--text-tertiary)]"
                            >
                              Edit field
                            </label>
                            <StatusChip tone="neutral">
                              {FIELD_TYPE_LABELS[field.fieldType]}
                            </StatusChip>
                          </div>

                          <input
                            id={inputId}
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            maxLength={40}
                            autoFocus
                            className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                          />

                          {field.fieldType === "select" ? (
                            <div className="mt-3">
                              <label
                                htmlFor={`${inputId}-options`}
                                className="text-xs font-semibold text-[var(--text-tertiary)]"
                              >
                                Choice options
                              </label>
                              <textarea
                                id={`${inputId}-options`}
                                value={editingOptions}
                                onChange={(event) =>
                                  setEditingOptions(event.target.value)
                                }
                                rows={4}
                                className="mt-1.5 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                              />
                              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                                An option that is still assigned to a
                                character cannot be removed until those
                                character values are changed.
                              </p>
                            </div>
                          ) : null}

                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyKey !== ""}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={
                                busyKey !== "" ||
                                editingName.trim().length === 0
                              }
                              onClick={() => saveEdit(field)}
                            >
                              {busyKey === `edit:${field.id}`
                                ? "Saving…"
                                : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{field.name}</p>
                              <StatusChip tone="neutral">
                                {FIELD_TYPE_LABELS[field.fieldType]}
                              </StatusChip>
                            </div>
                            {field.fieldType === "select" ? (
                              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                                {field.selectOptions.join(" · ")}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyKey !== ""}
                              onClick={() => beginEdit(field)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={busyKey !== ""}
                              onClick={() => setPendingDeleteField(field)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {message ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              {message}
            </p>
          ) : null}
        </div>

        {pendingDeleteField ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-roster-custom-field-title"
              aria-describedby="delete-roster-custom-field-description"
              className="w-[min(30rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-5 shadow-2xl"
            >
              <StatusChip tone="danger">Delete custom field</StatusChip>
              <h3
                id="delete-roster-custom-field-title"
                className="mt-4 text-lg font-semibold"
              >
                Delete &ldquo;{pendingDeleteField.name}&rdquo;?
              </h3>
              <p
                id="delete-roster-custom-field-description"
                className="mt-2 text-sm leading-6 text-[var(--text-secondary)]"
              >
                This permanently removes this field and its saved value
                from every character in this Guild. Characters, RTNW data,
                tags, and roster history are not deleted.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyKey !== ""}
                  onClick={() => setPendingDeleteField(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busyKey !== ""}
                  onClick={confirmDeleteField}
                >
                  {busyKey === `delete:${pendingDeleteField.id}`
                    ? "Deleting…"
                    : "Delete Field"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
