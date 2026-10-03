"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createManualCharacterAction } from "@/features/roster/manual-actions";
import { PresetOrCustomField } from "@/features/roster/preset-or-custom-field";
import {
  GUILD_POSITION_OPTIONS,
  ORGANIZER_ROLE_OPTIONS,
  RTNW_CLASS_OPTIONS,
} from "@/features/roster/roster-field-options";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

export function AddCharacterDialog({
  guildId,
}: {
  guildId: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerStartedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function reset() {
    formRef.current?.reset();
    setMessage("");
    setIsError(false);
    setBusy(false);
  }

  function close() {
    dialogRef.current?.close();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);

    const result = await createManualCharacterAction(
      new FormData(event.currentTarget),
    );

    if (!result.ok) {
      setMessage(result.message);
      setIsError(true);
      setBusy(false);
      return;
    }

    close();
    reset();
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        Add Character
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="add-character-dialog-title"
        onClose={reset}
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

          if (!shouldClose) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          window.requestAnimationFrame(() => {
            if (dialogRef.current?.open) {
              close();
            }
          });
        }}
        className="m-auto w-[min(46rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <StatusChip tone="accent">Manual entry</StatusChip>
            <h2
              id="add-character-dialog-title"
              className="mt-2 text-xl font-semibold"
            >
              Add Guild Character
            </h2>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={close}
          >
            Close
          </Button>
        </div>

        <form ref={formRef} onSubmit={submit} className="p-5 sm:p-6">
          <input type="hidden" name="guildId" value={guildId} />

          <div>
            <label
              htmlFor="manual-character-ign"
              className="text-sm font-semibold"
            >
              IGN
            </label>
            <input
              id="manual-character-ign"
              name="ign"
              required
              maxLength={80}
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-[var(--text-primary)]"
              placeholder="Exact in-game name"
            />
            <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
              Exact spelling, case, symbols, and Unicode are preserved.
              A future RTNW import with this exact IGN will update the
              same roster character.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="text-sm font-semibold">
                <label htmlFor="add-character-level">Level</label>
                <input id="add-character-level"
                name="level"
                inputMode="numeric"
                pattern="[0-9]*"
                className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                placeholder="Optional"
              />
              </div>

            <div className="text-sm font-semibold">
                <label htmlFor="add-character-gear-score">Gear Score</label>
                <input id="add-character-gear-score"
                name="gearScore"
                inputMode="numeric"
                pattern="[0-9]*"
                className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                placeholder="Optional"
              />
              </div>

            <PresetOrCustomField
              name="className"
              label="Class"
              options={RTNW_CLASS_OPTIONS}
              placeholder="Enter class"
            />

            <PresetOrCustomField
              name="guildPosition"
              label="Guild Position"
              options={GUILD_POSITION_OPTIONS}
              placeholder="Enter Guild position"
            />
          </div>

          <div className="mt-5 border-t border-[var(--border-subtle)] pt-5">
            <p className="font-semibold">Organizer metadata</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
              These fields belong to Guild Organizer and are never
              overwritten by RTNW roster syncs.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="text-sm font-semibold">
                <label htmlFor="add-character-designation">Designation</label>
                <select id="add-character-designation"
                  name="designation"
                  defaultValue=""
                  className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
                >
                  <option value="">None</option>
                  <option value="main">Main</option>
                  <option value="sub">Sub</option>
                </select>
              </div>

              <PresetOrCustomField
                name="roleLabel"
                label="Organizer Role"
                options={ORGANIZER_ROLE_OPTIONS}
                emptyLabel="None"
                placeholder="Enter organizer role"
              />
            </div>
          </div>

          {message ? (
            <p
              className={`mt-4 text-sm ${
                isError
                  ? "text-[var(--danger)]"
                  : "text-[var(--success)]"
              }`}
            >
              {message}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add Character"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
