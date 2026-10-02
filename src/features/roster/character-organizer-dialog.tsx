"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateCharacterOrganizationAction } from "@/features/roster/manual-actions";
import type { MasterRosterCharacter } from "@/features/roster/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

export function CharacterOrganizerDialog({
  guildId,
  character,
  onClose,
}: {
  guildId: string;
  character: MasterRosterCharacter | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (character && !dialog.open) {
      dialog.showModal();
    }

    if (!character && dialog.open) {
      dialog.close();
    }
  }, [character]);

  if (!character) {
    return (
      <dialog ref={dialogRef} className="hidden" />
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result = await updateCharacterOrganizationAction(
      new FormData(event.currentTarget),
    );

    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }

    dialogRef.current?.close();
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        setMessage("");
        setBusy(false);
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              tone={
                character.sourceOrigin === "rtnw_export"
                  ? "accent"
                  : "neutral"
              }
            >
              {character.sourceOrigin === "rtnw_export"
                ? "RTNW synced"
                : "Manual"}
            </StatusChip>
          </div>
          <h2 className="mt-2 truncate text-xl font-semibold">
            {character.ign}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {character.className ?? "Class unavailable"}
            {character.guildPosition
              ? ` · ${character.guildPosition}`
              : ""}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => dialogRef.current?.close()}
        >
          Close
        </Button>
      </div>

      <form onSubmit={submit} className="p-5 sm:p-6">
        <input type="hidden" name="guildId" value={guildId} />
        <input
          type="hidden"
          name="characterId"
          value={character.id}
        />

        <p className="font-semibold">Organizer controls</p>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
          Main/Sub and Organizer Role are private Guild Organizer
          metadata. RTNW imports do not overwrite them.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Designation
            <select
              name="designation"
              defaultValue={character.designation ?? ""}
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
            >
              <option value="">None</option>
              <option value="main">Main</option>
              <option value="sub">Sub</option>
            </select>
          </label>

          <label className="text-sm font-semibold">
            Organizer Role
            <input
              name="roleLabel"
              defaultValue={character.roleLabel ?? ""}
              maxLength={80}
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
              placeholder="e.g. Healer, Tank, Ranged DPS"
            />
          </label>
        </div>

        <div className="mt-5 border-t border-[var(--border-subtle)] pt-5">
          <label className="text-sm font-semibold">
            Roster Status
            <select
              name="status"
              defaultValue={
                character.status === "active"
                  ? "active"
                  : "inactive"
              }
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
            Manual Inactive never deletes the character. If this exact
            IGN appears in a later confirmed RTNW export, the sync will
            return it to Active because the game export is authoritative
            for current Guild membership.
          </p>
        </div>

        {character.sourceOrigin === "rtnw_export" ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--accent)]">
              Game fields are RTNW-managed
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              IGN, class, level, Gear Score, contribution, and Guild
              Position are intentionally not edited here. The next
              official roster import remains the source of truth for
              those values.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-4">
            <p className="text-sm font-semibold">
              Manual character details
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Detailed game-field editing for manual entries is the next
              roster-management checkpoint. This step keeps identity and
              sync behavior safe while organizer metadata becomes fully
              usable.
            </p>
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
            {busy ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
