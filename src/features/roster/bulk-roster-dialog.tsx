"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateRosterAction } from "@/features/roster/bulk-actions";
import { PresetOrCustomField } from "@/features/roster/preset-or-custom-field";
import { ORGANIZER_ROLE_OPTIONS } from "@/features/roster/roster-field-options";
import type { MasterRosterCharacter } from "@/features/roster/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

type BulkAction = "" | "designation" | "role_label" | "status";

export function BulkRosterDialog({
  guildId,
  characters,
  onApplied,
}: {
  guildId: string;
  characters: MasterRosterCharacter[];
  onApplied: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [action, setAction] = useState<BulkAction>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedIds = characters.map((character) => character.id);
  const previewCharacters = characters.slice(0, 5);
  const remainingCount = Math.max(
    0,
    characters.length - previewCharacters.length,
  );

  function reset() {
    setAction("");
    setBusy(false);
    setMessage("");
    formRef.current?.reset();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result = await bulkUpdateRosterAction(
      new FormData(event.currentTarget),
    );

    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }

    dialogRef.current?.close();
    reset();
    onApplied();
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Bulk Edit
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="bulk-roster-dialog-title"
        onClose={reset}
        className="m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <StatusChip tone="accent">
              {characters.length} selected
            </StatusChip>
            <h2
              id="bulk-roster-dialog-title"
              className="mt-2 text-xl font-semibold"
            >
              Bulk Roster Edit
            </h2>
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

        <form ref={formRef} onSubmit={submit} className="p-5 sm:p-6">
          <input type="hidden" name="guildId" value={guildId} />
          <input
            type="hidden"
            name="characterIdsJson"
            value={JSON.stringify(selectedIds)}
          />

          <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] p-4">
            <p className="text-sm font-semibold">
              Selected characters
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {previewCharacters
                .map((character) => character.ign)
                .join(", ")}
              {remainingCount > 0
                ? `, +${remainingCount} more`
                : ""}
            </p>
          </div>

          <div className="mt-5">
            <label
              htmlFor="bulk-roster-action"
              className="text-sm font-semibold"
            >
              Action
            </label>
            <select
              id="bulk-roster-action"
              name="action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value as BulkAction);
                setMessage("");
              }}
              className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3"
            >
              <option value="">Choose an action…</option>
              <option value="designation">
                Set Main / Sub designation
              </option>
              <option value="role_label">
                Set Organizer Role
              </option>
              <option value="status">
                Set Active / Inactive status
              </option>
            </select>
          </div>

          {action === "designation" ? (
            <div className="mt-4">
              <label
                htmlFor="bulk-designation"
                className="text-sm font-semibold"
              >
                Designation
              </label>
              <select
                id="bulk-designation"
                name="value"
                defaultValue="main"
                className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3"
              >
                <option value="main">Main</option>
                <option value="sub">Sub</option>
                <option value="">None / Clear designation</option>
              </select>
            </div>
          ) : null}

          {action === "role_label" ? (
            <div className="mt-4">
              <PresetOrCustomField
                name="value"
                label="Organizer Role"
                options={ORGANIZER_ROLE_OPTIONS}
                emptyLabel="None / Clear role"
                placeholder="Enter organizer role"
              />
            </div>
          ) : null}

          {action === "status" ? (
            <div className="mt-4">
              <label
                htmlFor="bulk-roster-status"
                className="text-sm font-semibold"
              >
                Roster Status
              </label>
              <select
                id="bulk-roster-status"
                name="value"
                defaultValue="active"
                className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                Inactive is a manual organizer state and never deletes
                history. A later confirmed RTNW export can restore a
                currently listed character to Active.
              </p>
            </div>
          ) : null}

          <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--accent)]">
              Organizer-owned fields only
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Bulk editing never changes RTNW-owned IGN, class, Gear
              Score, contribution, Guild Position, or other game-exported
              values.
            </p>
          </div>

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
            <Button
              type="submit"
              disabled={busy || action === ""}
            >
              {busy
                ? "Applying…"
                : `Apply to ${characters.length}`}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
