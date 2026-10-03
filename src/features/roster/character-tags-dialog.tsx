"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setCharacterRosterTagsAction } from "@/features/roster/tag-actions";
import type {
  MasterRosterCharacter,
  MasterRosterTag,
} from "@/features/roster/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

export function CharacterTagsDialog({
  guildId,
  character,
  availableTags,
  onClose,
}: {
  guildId: string;
  character: MasterRosterCharacter | null;
  availableTags: MasterRosterTag[];
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerStartedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (character && !dialog.open) dialog.showModal();
    if (!character && dialog.open) dialog.close();
  }, [character]);

  if (!character) {
    return <dialog ref={dialogRef} className="hidden" />;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result = await setCharacterRosterTagsAction(
      new FormData(event.currentTarget),
    );

    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    dialogRef.current?.close();
    router.refresh();
  }

  const selected = new Set(character.tags.map((tag) => tag.id));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="character-tags-dialog-title"
      onClose={() => {
        setBusy(false);
        setMessage("");
        onClose();
      }}
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

        if (!shouldClose) return;

        event.preventDefault();
        event.stopPropagation();

        window.requestAnimationFrame(() => {
          if (dialogRef.current?.open) {
            dialogRef.current.close();
          }
        });
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <StatusChip tone="accent">Organizer Tags</StatusChip>
          <h2
            id="character-tags-dialog-title"
            className="mt-2 truncate text-xl font-semibold"
          >
            <span className="sr-only">Tags for </span>
            {character.ign}
          </h2>
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

      <form onSubmit={submit} className="p-5 sm:p-6">
        <input type="hidden" name="guildId" value={guildId} />
        <input type="hidden" name="characterId" value={character.id} />

        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          Tags are Guild Organizer metadata. They are never overwritten
          by RTNW imports.
        </p>

        {availableTags.length === 0 ? (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-4">
            <p className="font-semibold">No roster tags exist yet</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Close this dialog and use Manage Tags at the top of the
              roster to create reusable labels.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {availableTags.map((tag) => {
              const inputId = `character-tag-${tag.id}`;

              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2.5"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    name="tagId"
                    value={tag.id}
                    defaultChecked={selected.has(tag.id)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
                  />
                  <label
                    htmlFor={inputId}
                    className="min-w-0 cursor-pointer text-sm font-semibold"
                  >
                    {tag.name}
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {message ? (
          <p className="mt-4 text-sm text-[var(--danger)]">
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save Tags"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
