"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createRosterTagAction,
  deleteRosterTagAction,
  renameRosterTagAction,
} from "@/features/roster/tag-actions";
import type { MasterRosterTag } from "@/features/roster/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

export function RosterTagManagerDialog({
  guildId,
  tags,
}: {
  guildId: string;
  tags: MasterRosterTag[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerStartedRef = useRef(false);
  const [newTagName, setNewTagName] = useState("");
  const [search, setSearch] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = useState("");
  const [pendingDeleteTag, setPendingDeleteTag] =
    useState<MasterRosterTag | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");

  const normalizedNewTagName = newTagName
    .trim()
    .toLocaleLowerCase();

  const duplicateTag = useMemo(
    () =>
      normalizedNewTagName
        ? tags.find(
            (tag) =>
              tag.name.trim().toLocaleLowerCase() ===
              normalizedNewTagName,
          ) ?? null
        : null,
    [normalizedNewTagName, tags],
  );

  const filteredTags = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) {
      return tags;
    }

    return tags.filter((tag) =>
      tag.name.toLocaleLowerCase().includes(query),
    );
  }, [search, tags]);

  function resetTransientState() {
    setNewTagName("");
    setSearch("");
    setEditingTagId(null);
    setEditingName("");
    setPendingDeleteTag(null);
    setBusyKey("");
    setMessage("");
  }

  async function createTag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (duplicateTag || newTagName.trim().length === 0) {
      return;
    }

    setBusyKey("create");
    setMessage("");

    const data = new FormData(event.currentTarget);
    const result = await createRosterTagAction(data);

    setBusyKey("");

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setNewTagName("");
    setMessage(result.message);
    router.refresh();
  }

  function beginRename(tag: MasterRosterTag) {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    setMessage("");
  }

  function cancelRename() {
    setEditingTagId(null);
    setEditingName("");
  }

  async function saveRename(tag: MasterRosterTag) {
    const nextName = editingName.trim();

    if (!nextName) {
      setMessage("Tag name cannot be empty.");
      return;
    }

    const duplicate = tags.find(
      (candidate) =>
        candidate.id !== tag.id &&
        candidate.name.trim().toLocaleLowerCase() ===
          nextName.toLocaleLowerCase(),
    );

    if (duplicate) {
      setMessage(`"${duplicate.name}" already exists.`);
      return;
    }

    setBusyKey(`rename:${tag.id}`);
    setMessage("");

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("tagId", tag.id);
    data.set("name", nextName);

    const result = await renameRosterTagAction(data);

    setBusyKey("");

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setEditingTagId(null);
    setEditingName("");
    setMessage(result.message);
    router.refresh();
  }

  async function confirmDeleteTag() {
    if (!pendingDeleteTag) return;

    const tag = pendingDeleteTag;
    setBusyKey(`delete:${tag.id}`);
    setMessage("");

    const data = new FormData();
    data.set("guildId", guildId);
    data.set("tagId", tag.id);

    const result = await deleteRosterTagAction(data);

    setBusyKey("");

    if (!result.ok) {
      setMessage(result.message);
      setPendingDeleteTag(null);
      return;
    }

    setPendingDeleteTag(null);
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
        Manage Tags
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="roster-tags-dialog-title"
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

          if (!shouldClose || pendingDeleteTag) return;

          event.preventDefault();
          event.stopPropagation();

          window.requestAnimationFrame(() => {
            if (dialogRef.current?.open) {
              dialogRef.current.close();
            }
          });
        }}
        className="m-auto w-[min(48rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <h2
              id="roster-tags-dialog-title"
              className="text-xl font-semibold"
            >
              Roster Tags
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Create reusable organizer labels for this Guild.
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
          <form onSubmit={createTag}>
            <input type="hidden" name="guildId" value={guildId} />
            <input
              type="hidden"
              name="name"
              value={newTagName.trim()}
            />

            <label
              htmlFor="new-roster-tag-name"
              className="text-sm font-semibold"
            >
              New tag
            </label>

            <div className="mt-2 flex gap-2">
              <input
                id="new-roster-tag-name"
                value={newTagName}
                onChange={(event) => {
                  setNewTagName(event.target.value);
                  setMessage("");
                }}
                maxLength={40}
                autoComplete="off"
                placeholder="Example: Siege, Raid Team, Reserve"
                className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
              />
              <Button
                type="submit"
                disabled={
                  busyKey !== "" ||
                  newTagName.trim().length === 0 ||
                  Boolean(duplicateTag)
                }
              >
                {busyKey === "create" ? "Creating…" : "Create"}
              </Button>
            </div>

            {duplicateTag ? (
              <p className="mt-2 text-xs font-semibold text-[var(--warning)]">
                &ldquo;{duplicateTag.name}&rdquo; already exists.
              </p>
            ) : (
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Tag names are checked case-insensitively, so &ldquo;Siege&rdquo;
                and &ldquo;siege&rdquo; count as the same tag.
              </p>
            )}
          </form>

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-semibold">Existing tags</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {tags.length} total
                </p>
              </div>

              {tags.length > 4 ? (
                <div className="w-full sm:w-64">
                  <label
                    htmlFor="roster-tag-search"
                    className="text-xs font-semibold text-[var(--text-tertiary)]"
                  >
                    Search tags
                  </label>
                  <input
                    id="roster-tag-search"
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Find a tag…"
                    className="mt-1.5 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                  />
                </div>
              ) : null}
            </div>

            {tags.length === 0 ? (
              <p className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">
                No tags yet. Create your first organizer tag above.
              </p>
            ) : filteredTags.length === 0 ? (
              <p className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">
                No tags match &ldquo;{search.trim()}&rdquo;.
              </p>
            ) : (
              <div className="mt-3 grid items-start gap-2 sm:grid-cols-2">
                {filteredTags.map((tag) => {
                  const inputId = `roster-tag-${tag.id}`;
                  const editing = editingTagId === tag.id;

                  return (
                    <div
                      key={tag.id}
                      className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-3"
                    >
                      {editing ? (
                        <>
                          <label
                            htmlFor={inputId}
                            className="text-xs font-semibold text-[var(--text-tertiary)]"
                          >
                            Rename tag
                          </label>
                          <input
                            id={inputId}
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            maxLength={40}
                            autoFocus
                            className="mt-1.5 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                          />

                          <div className="mt-2 flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyKey !== ""}
                              onClick={cancelRename}
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
                              onClick={() => saveRename(tag)}
                            >
                              {busyKey === `rename:${tag.id}`
                                ? "Saving…"
                                : "Save"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex min-h-9 items-center justify-between gap-3">
                          <span
                            className="min-w-0 truncate rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1 text-sm font-semibold"
                            title={tag.name}
                          >
                            {tag.name}
                          </span>

                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyKey !== ""}
                              onClick={() => beginRename(tag)}
                            >
                              Rename
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={busyKey !== ""}
                              onClick={() =>
                                setPendingDeleteTag(tag)
                              }
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

        {pendingDeleteTag ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-roster-tag-title"
              aria-describedby="delete-roster-tag-description"
              className="w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-5 shadow-2xl"
            >
              <StatusChip tone="danger">Delete tag</StatusChip>

              <h3
                id="delete-roster-tag-title"
                className="mt-4 text-lg font-semibold"
              >
                Delete &ldquo;{pendingDeleteTag.name}&rdquo;?
              </h3>

              <p
                id="delete-roster-tag-description"
                className="mt-2 text-sm leading-6 text-[var(--text-secondary)]"
              >
                This removes the tag from every character. No character
                or roster history will be deleted.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyKey !== ""}
                  onClick={() => setPendingDeleteTag(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busyKey !== ""}
                  onClick={confirmDeleteTag}
                >
                  {busyKey === `delete:${pendingDeleteTag.id}`
                    ? "Deleting…"
                    : "Delete Tag"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
