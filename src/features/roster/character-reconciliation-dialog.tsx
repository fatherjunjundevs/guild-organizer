"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildCharacterReconciliationPreview,
  displayReconciliationValue,
  formatReconciliationTimestampUtc,
  type CharacterReconciliationHistoryEntry,
} from "@/features/roster/character-reconciliation";
import { reconcileRosterCharactersAction } from "@/features/roster/reconciliation-actions";
import type {
  MasterRosterCharacter,
  MasterRosterCustomField,
} from "@/features/roster/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

function statusLabel(character: MasterRosterCharacter) {
  if (character.status === "active") return "Active";
  if (character.inactiveReason === "left_guild") return "Left Guild";
  if (character.inactiveReason === "manual") return "Inactive";
  return "Stored";
}

function CharacterIdentityCard({
  title,
  character,
}: {
  title: string;
  character: MasterRosterCharacter;
}) {
  return (
    <Surface level={3} className="p-4">
      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase">
        {title}
      </p>
      <p className="mt-2 text-lg font-semibold">{character.ign}</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        {character.className ?? "Class unavailable"}
        {character.level !== null ? ` · Lv. ${character.level}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusChip
          tone={character.status === "active" ? "success" : "neutral"}
        >
          {statusLabel(character)}
        </StatusChip>
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
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-[var(--text-tertiary)]">Designation</dt>
          <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
            {character.designation ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-tertiary)]">Organizer role</dt>
          <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
            {character.roleLabel ?? "—"}
          </dd>
        </div>
      </dl>
    </Surface>
  );
}

export function CharacterReconciliationDialog({
  guildId,
  characters,
  customFields,
  history,
  historyAvailable,
}: {
  guildId: string;
  characters: MasterRosterCharacter[];
  customFields: MasterRosterCustomField[];
  history: CharacterReconciliationHistoryEntry[];
  historyAvailable: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerStartedRef = useRef(false);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const candidates = useMemo(
    () =>
      characters
        .filter(
          (character) => !character.reconciledIntoCharacterId,
        )
        .slice()
        .sort((left, right) => {
          if (left.ign < right.ign) return -1;
          if (left.ign > right.ign) return 1;
          return 0;
        }),
    [characters],
  );

  const source =
    candidates.find((character) => character.id === sourceId) ?? null;
  const target =
    candidates.find((character) => character.id === targetId) ?? null;

  const preview = useMemo(
    () =>
      source && target
        ? buildCharacterReconciliationPreview(
            source,
            target,
            customFields,
          )
        : null,
    [customFields, source, target],
  );

  function resetDialog() {
    setSourceId("");
    setTargetId("");
    setNote("");
    setAcknowledged(false);
    setBusy(false);
    setMessage("");
    setSuccessMessage("");
  }

  function openDialog() {
    resetDialog();
    dialogRef.current?.showModal();
  }

  async function reconcile() {
    if (
      !source ||
      !target ||
      !preview ||
      preview.conflicts.length > 0 ||
      !acknowledged
    ) {
      return;
    }

    setBusy(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const result = await reconcileRosterCharactersAction({
        guildId,
        sourceCharacterId: source.id,
        targetCharacterId: target.id,
        note,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setSuccessMessage(
        `${source.ign} is now preserved as historical identity for ${target.ign}.`,
      );
      setSourceId("");
      setTargetId("");
      setNote("");
      setAcknowledged(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={candidates.length < 2}
        title={
          candidates.length < 2
            ? "At least two independent Characters are required."
            : undefined
        }
        onClick={openDialog}
      >
        Reconcile Characters
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="character-reconciliation-title"
        onClose={resetDialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
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

          if (!shouldClose || busy) return;

          event.preventDefault();
          event.stopPropagation();

          window.requestAnimationFrame(() => {
            if (dialogRef.current?.open) {
              dialogRef.current.close();
            }
          });
        }}
        className="m-auto w-[min(72rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <StatusChip tone="warning">Identity resolution</StatusChip>
            <h2
              id="character-reconciliation-title"
              className="mt-2 text-xl font-semibold"
            >
              Reconcile Characters
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              Use this only when you know two stored Character rows
              represent the same real Character, such as an explicit IGN
              change. Guild Organizer never guesses a rename.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </Button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {successMessage ? (
            <Surface
              level={2}
              className="border-[color-mix(in_srgb,var(--success)_40%,transparent)] p-4"
            >
              <p className="font-semibold text-[var(--success)]">
                Reconciliation complete
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                {successMessage} Historical references remain preserved.
              </p>
            </Surface>
          ) : null}

          <Surface level={2} className="p-4">
            <p className="font-semibold">Choose identity direction</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              The source becomes read-only historical identity. The target
              stays canonical. Target game/current values are never
              overwritten by reconciliation.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="reconciliation-source"
                  className="text-xs font-semibold text-[var(--text-tertiary)]"
                >
                  Source · becomes historical
                </label>
                <select
                  id="reconciliation-source"
                  value={sourceId}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSourceId(next);
                    if (next === targetId) setTargetId("");
                    setAcknowledged(false);
                    setMessage("");
                    setSuccessMessage("");
                  }}
                  className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                >
                  <option value="">Choose source Character</option>
                  {candidates.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.ign} · {statusLabel(character)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="reconciliation-target"
                  className="text-xs font-semibold text-[var(--text-tertiary)]"
                >
                  Target · remains canonical
                </label>
                <select
                  id="reconciliation-target"
                  value={targetId}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value;
                    setTargetId(next);
                    if (next === sourceId) setSourceId("");
                    setAcknowledged(false);
                    setMessage("");
                    setSuccessMessage("");
                  }}
                  className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                >
                  <option value="">Choose canonical target</option>
                  {candidates.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.ign} · {statusLabel(character)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Surface>

          {source && target && preview ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <CharacterIdentityCard
                  title="Source · historical after confirmation"
                  character={source}
                />
                <CharacterIdentityCard
                  title="Target · canonical after confirmation"
                  character={target}
                />
              </div>

              {preview.sourceIsActive ? (
                <Surface
                  level={2}
                  className="border-[color-mix(in_srgb,var(--warning)_40%,transparent)] p-4"
                >
                  <p className="font-semibold text-[var(--warning)]">
                    The selected source is currently Active
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    Reconciliation will make {source.ign} historical and
                    inactive. Confirm the direction carefully before
                    continuing.
                  </p>
                </Surface>
              ) : null}

              {preview.conflicts.length > 0 ? (
                <Surface
                  level={2}
                  className="border-[color-mix(in_srgb,var(--danger)_40%,transparent)] p-4"
                >
                  <p className="font-semibold text-[var(--danger)]">
                    Resolve {preview.conflicts.length} organizer-owned
                    conflict
                    {preview.conflicts.length === 1 ? "" : "s"} first
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    Reconciliation never guesses which organizer value is
                    correct. Edit the source or target so each conflicting
                    field matches or one side is empty, then reopen this
                    review.
                  </p>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-xs">
                      <thead className="text-[var(--text-tertiary)]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">
                            Field
                          </th>
                          <th className="px-3 py-2 font-semibold">
                            {source.ign}
                          </th>
                          <th className="px-3 py-2 font-semibold">
                            {target.ign}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.conflicts.map((conflict) => (
                          <tr
                            key={conflict.key}
                            className="border-t border-[var(--border-subtle)]"
                          >
                            <th className="px-3 py-2 font-semibold">
                              {conflict.label}
                            </th>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">
                              {displayReconciliationValue(
                                conflict.sourceValue,
                              )}
                            </td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">
                              {displayReconciliationValue(
                                conflict.targetValue,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Surface>
              ) : (
                <Surface
                  level={2}
                  className="border-[var(--accent-border)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        Organizer metadata is conflict-free
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                        Missing target metadata can move safely. Existing
                        equal values remain unchanged.
                      </p>
                    </div>
                    <StatusChip tone="success">Ready</StatusChip>
                  </div>

                  {preview.transfers.length > 0 ? (
                    <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      {preview.transfers.map((transfer) => (
                        <li
                          key={transfer.key}
                          className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-3)] px-3 py-2"
                        >
                          <span className="text-[var(--text-tertiary)]">
                            {transfer.label}:{" "}
                          </span>
                          <span className="font-semibold">
                            {displayReconciliationValue(transfer.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--text-tertiary)]">
                      No organizer-owned values need to move.
                    </p>
                  )}
                </Surface>
              )}

              <Surface level={2} className="p-4">
                <label
                  htmlFor="reconciliation-note"
                  className="text-sm font-semibold"
                >
                  Reconciliation note · optional
                </label>
                <textarea
                  id="reconciliation-note"
                  value={note}
                  maxLength={500}
                  disabled={busy}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Example: Confirmed IGN change with player in Discord."
                  className="mt-2 min-h-24 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-right text-xs text-[var(--text-tertiary)]">
                  {note.length}/500
                </p>
              </Surface>

              {preview.conflicts.length === 0 ? (
                <Surface
                  level={2}
                  className="border-[color-mix(in_srgb,var(--warning)_35%,transparent)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      id="character-reconciliation-acknowledgement"
                      type="checkbox"
                      checked={acknowledged}
                      disabled={busy}
                      onChange={(event) =>
                        setAcknowledged(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <label
                      htmlFor="character-reconciliation-acknowledgement"
                      className="cursor-pointer"
                    >
                      <span className="block text-sm font-semibold">
                        Confirm identity direction
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                        I confirm that {source.ign} and {target.ign} are the
                        same real Character, that {source.ign} should become
                        historical, and that {target.ign} should remain the
                        canonical Character. This is an explicit organizer
                        decision, not an automatic rename guess.
                      </span>
                    </label>
                  </div>
                </Surface>
              ) : null}

              {message ? (
                <Surface
                  level={2}
                  className="border-[color-mix(in_srgb,var(--danger)_40%,transparent)] p-4"
                >
                  <p
                    role="alert"
                    className="text-sm font-semibold text-[var(--danger)]"
                  >
                    {message}
                  </p>
                </Surface>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => dialogRef.current?.close()}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={
                    busy ||
                    preview.conflicts.length > 0 ||
                    !acknowledged
                  }
                  onClick={() => void reconcile()}
                >
                  {busy ? "Reconciling…" : "Reconcile Characters"}
                </Button>
              </div>
            </>
          ) : null}

          <Surface level={2} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Recent reconciliations</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                  Audit entries preserve the source and target IGN
                  snapshots used when identity was explicitly resolved.
                </p>
              </div>
              {historyAvailable ? (
                <StatusChip tone="neutral">
                  {history.length} shown
                </StatusChip>
              ) : (
                <StatusChip tone="warning">History unavailable</StatusChip>
              )}
            </div>

            {historyAvailable && history.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                No Character reconciliations have been recorded yet.
              </p>
            ) : historyAvailable ? (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-3)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {entry.sourceIgn}{" "}
                        <span className="text-[var(--text-tertiary)]">
                          →
                        </span>{" "}
                        {entry.targetIgn}
                      </p>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {formatReconciliationTimestampUtc(
                          entry.reconciledAt,
                        )}
                      </span>
                    </div>
                    {entry.note ? (
                      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                Refresh the page and try again. Reconciliation itself
                remains protected by the database authorization boundary.
              </p>
            )}
          </Surface>
        </div>
      </dialog>
    </>
  );
}
