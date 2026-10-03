"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyRtnwRosterSyncAction,
  previewRtnwRosterSyncAction,
  type RtnwPreviewChange,
  type RtnwSyncSummary,
} from "@/features/roster/import-actions";
import {
  readOfficialRtnwCsvFile,
  type RtnwRosterRow,
} from "@/features/roster/rtnw-csv";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

type ParsedImport = {
  filename: string;
  sha256: string;
  rows: RtnwRosterRow[];
  sourceRowCount: number;
};

function labelForChange(changeKind: string) {
  if (changeKind === "new") {
    return "New";
  }

  if (changeKind === "update") {
    return "Updated";
  }

  if (changeKind === "reactivate") {
    return "Returning";
  }

  if (changeKind === "left_guild") {
    return "Left Guild";
  }

  return "Unchanged";
}

function toneForChange(
  changeKind: string,
): "accent" | "success" | "warning" | "neutral" {
  if (changeKind === "new") {
    return "success";
  }

  if (changeKind === "update") {
    return "accent";
  }

  if (
    changeKind === "reactivate" ||
    changeKind === "left_guild"
  ) {
    return "warning";
  }

  return "neutral";
}

export function RtnwImportDialog({
  guildId,
}: {
  guildId: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [changes, setChanges] = useState<RtnwPreviewChange[] | null>(
    null,
  );
  const [summary, setSummary] = useState<RtnwSyncSummary | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const changeCounts = useMemo(() => {
    const counts = {
      new: 0,
      update: 0,
      reactivate: 0,
      left_guild: 0,
      unchanged: 0,
    };

    for (const change of changes ?? []) {
      if (change.changeKind in counts) {
        counts[
          change.changeKind as keyof typeof counts
        ] += 1;
      }
    }

    return counts;
  }, [changes]);

  const positionByIgn = useMemo(
    () =>
      new Map(
        (parsed?.rows ?? []).map((row) => [
          row.ign,
          row.guild_position,
        ]),
      ),
    [parsed],
  );

  const displayChanges = useMemo(() => {
    if (!changes) {
      return [];
    }

    const incomingOrder = new Map(
      (parsed?.rows ?? []).map((row, index) => [row.ign, index]),
    );

    return [...changes].sort((left, right) => {
      const leftOrder = incomingOrder.get(left.ign);
      const rightOrder = incomingOrder.get(right.ign);

      if (leftOrder !== undefined && rightOrder !== undefined) {
        return leftOrder - rightOrder;
      }

      if (leftOrder !== undefined) {
        return -1;
      }

      if (rightOrder !== undefined) {
        return 1;
      }

      return left.ign.localeCompare(right.ign);
    });
  }, [changes, parsed]);

  function resetImport() {
    setParsed(null);
    setChanges(null);
    setSummary(null);
    setMessage("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleFile(file: File | undefined) {
    resetImport();

    if (!file) {
      return;
    }

    if (!file.name.toLocaleLowerCase().endsWith(".csv")) {
      setMessage("Choose the official RTNW Guild .csv export.");
      return;
    }

    setBusy(true);

    try {
      const result = await readOfficialRtnwCsvFile(file);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setParsed({
        filename: result.filename,
        sha256: result.sha256,
        rows: result.rows,
        sourceRowCount: result.sourceRowCount,
      });

      const preview = await previewRtnwRosterSyncAction({
        guildId,
        rows: result.rows,
      });

      if (!preview.ok) {
        setMessage(preview.message);
        return;
      }

      setChanges(preview.changes);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSync() {
    if (!parsed || !changes) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result = await applyRtnwRosterSyncAction({
        guildId,
        rows: parsed.rows,
        sourceFilename: parsed.filename,
        sourceSha256: parsed.sha256,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setSummary(result.summary);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Import RTNW CSV
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="rtnw-import-dialog-title"
        onClose={resetImport}
        className="m-auto w-[min(54rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">
              Official game export
            </p>
            <h2
              id="rtnw-import-dialog-title"
              className="mt-1 text-xl font-semibold"
            >
              Sync RTNW Guild Roster
            </h2>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={closeDialog}
            aria-label="Close roster import"
          >
            Close
          </Button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {!summary ? (
            <>
              <Surface level={2} className="p-4">
                <p className="font-semibold">
                  Choose the CSV exported directly from RTNW
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Recognized official exports are mapped automatically.
                  The export Id column is checked only as part of the
                  file format and is never used as character identity.
                </p>

                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  onChange={(event) =>
                    void handleFile(event.target.files?.[0])
                  }
                  className="sr-only"
                  tabIndex={-1}
                />

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose CSV file
                  </Button>

                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">
                    {parsed?.filename ?? "No file selected"}
                  </span>
                </div>
              </Surface>

              {message ? (
                <Surface
                  level={2}
                  className="border-[color-mix(in_srgb,var(--danger)_40%,transparent)] p-4"
                >
                  <p className="text-sm font-semibold text-[var(--danger)]">
                    {message}
                  </p>
                </Surface>
              ) : null}

              {busy ? (
                <Surface level={2} className="p-4">
                  <p className="text-sm font-semibold">
                    Validating and previewing roster…
                  </p>
                </Surface>
              ) : null}

              {parsed && changes ? (
                <>
                  <Surface level={2} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {parsed.filename}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {parsed.sourceRowCount} characters · Official
                          RTNW schema recognized
                        </p>
                      </div>
                      <StatusChip tone="success">Validated</StatusChip>
                    </div>
                  </Surface>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {(
                      [
                        ["new", "New"],
                        ["update", "Updated"],
                        ["reactivate", "Returning"],
                        ["left_guild", "Left Guild"],
                        ["unchanged", "Unchanged"],
                      ] as const
                    ).map(([kind, label]) => (
                      <Surface key={kind} level={2} className="p-3">
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {label}
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">
                          {changeCounts[kind]}
                        </p>
                      </Surface>
                    ))}
                  </div>

                  {changeCounts.left_guild > 0 ? (
                    <Surface
                      level={2}
                      className="border-[color-mix(in_srgb,var(--warning)_40%,transparent)] p-4"
                    >
                      <p className="font-semibold text-[var(--warning)]">
                        {changeCounts.left_guild} character
                        {changeCounts.left_guild === 1 ? "" : "s"} will
                        be marked Left Guild
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                        They are not deleted. Their historical identity
                        and future event, attendance, auction, and notes
                        history remain preserved.
                      </p>
                    </Surface>
                  ) : null}

                  <Surface level={2} className="overflow-hidden">
                    <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                      <p className="font-semibold">Sync preview</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                        Exact IGN matching only. Current characters follow
                        the game export order; Left Guild entries appear
                        afterward. No automatic rename guessing or merging.
                      </p>
                    </div>

                    <div className="max-h-72 overflow-y-auto">
                      {displayChanges.map((change, index) => {
                        const position = positionByIgn.get(change.ign);

                        return (
                          <div
                            key={`${change.changeKind}:${change.ign}:${index}`}
                            className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-2.5 first:border-t-0"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">
                                {change.ign}
                              </span>
                              {position ? (
                                <span className="mt-0.5 block truncate text-xs text-[var(--text-tertiary)]">
                                  {position}
                                </span>
                              ) : null}
                            </span>

                            <StatusChip
                              tone={toneForChange(change.changeKind)}
                              className="shrink-0"
                            >
                              {labelForChange(change.changeKind)}
                            </StatusChip>
                          </div>
                        );
                      })}
                    </div>
                  </Surface>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={resetImport}
                    >
                      Choose another file
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void confirmSync()}
                    >
                      Confirm roster sync
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Surface level={2} className="p-5">
                <StatusChip tone="success">Sync complete</StatusChip>
                <h3 className="mt-3 text-xl font-semibold">
                  Master Roster updated
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {summary.sourceRowCount} RTNW characters were
                  processed. Historical records were preserved.
                </p>
              </Surface>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["New", summary.createdCount],
                  ["Updated", summary.updatedCount],
                  ["Returning", summary.reactivatedCount],
                  ["Left Guild", summary.leftGuildCount],
                  ["Unchanged", summary.unchangedCount],
                ].map(([label, count]) => (
                  <Surface
                    key={label}
                    level={2}
                    className="p-3 text-center"
                  >
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {count}
                    </p>
                  </Surface>
                ))}
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={closeDialog}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
