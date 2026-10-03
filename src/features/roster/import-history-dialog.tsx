"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import { loadRosterImportRunChangesAction } from "@/features/roster/import-history-actions";
import {
  formatImportHistoryValue,
  formatImportTimestampUtc,
  labelForImportChange,
  labelForImportField,
  labelForImportSource,
  toneForImportChange,
  type RosterImportChange,
  type RosterImportRunSummary,
} from "@/features/roster/import-history";

function ImportCount({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <span className="text-xs text-[var(--text-tertiary)]">
      {label}{" "}
      <span className="font-semibold tabular-nums text-[var(--text-secondary)]">
        {count}
      </span>
    </span>
  );
}

function ChangeDetails({
  change,
}: {
  change: RosterImportChange;
}) {
  return (
    <Surface level={3} className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {change.characterIgn}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {change.changedFields.length} field
            {change.changedFields.length === 1 ? "" : "s"} changed
          </p>
        </div>

        <StatusChip tone={toneForImportChange(change.changeKind)}>
          {labelForImportChange(change.changeKind)}
        </StatusChip>
      </div>

      <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead className="text-[var(--text-tertiary)]">
            <tr>
              <th className="px-4 py-2 font-semibold">Field</th>
              <th className="px-4 py-2 font-semibold">Before</th>
              <th className="px-4 py-2 font-semibold">After</th>
            </tr>
          </thead>
          <tbody>
            {change.changedFields.map((field) => (
              <tr
                key={field}
                className="border-t border-[var(--border-subtle)]"
              >
                <th className="px-4 py-2 font-semibold text-[var(--text-secondary)]">
                  {labelForImportField(field)}
                </th>
                <td className="px-4 py-2 text-[var(--text-secondary)]">
                  {formatImportHistoryValue(
                    field,
                    change.beforeValues[field],
                  )}
                </td>
                <td className="px-4 py-2 text-[var(--text-primary)]">
                  {formatImportHistoryValue(
                    field,
                    change.afterValues[field],
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

export function ImportHistoryDialog({
  guildId,
  runs,
}: {
  guildId: string;
  runs: RosterImportRunSummary[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    null,
  );
  const [changes, setChanges] = useState<RosterImportChange[] | null>(
    null,
  );
  const [loadingRunId, setLoadingRunId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState("");

  const selectedRun =
    runs.find((run) => run.id === selectedRunId) ?? null;

  function resetDialog() {
    setSelectedRunId(null);
    setChanges(null);
    setLoadingRunId(null);
    setMessage("");
  }

  async function viewRun(runId: string) {
    setSelectedRunId(runId);
    setChanges(null);
    setMessage("");
    setLoadingRunId(runId);

    try {
      const result = await loadRosterImportRunChangesAction({
        guildId,
        syncRunId: runId,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setChanges(result.changes);
    } finally {
      setLoadingRunId(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        Import History
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="import-history-title"
        onClose={resetDialog}
        className="m-auto w-[min(76rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <StatusChip tone="accent">Audit trail</StatusChip>
            <h2
              id="import-history-title"
              className="mt-2 text-xl font-semibold"
            >
              Import History
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
              Review recent roster imports and the meaningful Character
              changes recorded by each applied run.
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

        <div className="space-y-5 p-5 sm:p-6">
          {runs.length === 0 ? (
            <Surface level={2} className="p-6 text-center">
              <p className="font-semibold">No imports recorded yet</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Applied RTNW and spreadsheet imports will appear here.
              </p>
            </Surface>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-3">
                <div>
                  <p className="font-semibold">Recent imports</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Showing the {runs.length} most recent applied run
                    {runs.length === 1 ? "" : "s"}, newest first.
                  </p>
                </div>

                {runs.map((run) => (
                  <Surface
                    key={run.id}
                    level={2}
                    className={
                      selectedRunId === run.id
                        ? "border-[var(--accent-border)] p-4"
                        : "p-4"
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusChip
                            tone={
                              run.sourceType === "rtnw_csv"
                                ? "accent"
                                : "neutral"
                            }
                          >
                            {labelForImportSource(run.sourceType)}
                          </StatusChip>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {run.sourceRowCount} source rows
                          </span>
                        </div>
                        <p className="mt-2 truncate font-semibold">
                          {run.sourceFilename}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {formatImportTimestampUtc(run.appliedAt)}
                          {run.importedByName
                            ? ` · ${run.importedByName}`
                            : ""}
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant={
                          selectedRunId === run.id
                            ? "primary"
                            : "secondary"
                        }
                        disabled={loadingRunId !== null}
                        onClick={() => void viewRun(run.id)}
                      >
                        {loadingRunId === run.id
                          ? "Loading…"
                          : selectedRunId === run.id && changes
                            ? "Refresh"
                            : "View changes"}
                      </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] pt-3">
                      <ImportCount label="New" count={run.createdCount} />
                      <ImportCount
                        label="Updated"
                        count={run.updatedCount}
                      />
                      <ImportCount
                        label="Returning"
                        count={run.reactivatedCount}
                      />
                      <ImportCount
                        label="Left"
                        count={run.leftGuildCount}
                      />
                      <ImportCount
                        label="Unchanged"
                        count={run.unchangedCount}
                      />
                    </div>
                  </Surface>
                ))}
              </div>

              <div>
                {!selectedRun ? (
                  <Surface level={2} className="p-6">
                    <p className="font-semibold">
                      Select an import to inspect
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      Detailed history contains only meaningful Character
                      changes. Unchanged rows remain represented by the run
                      summary instead of being duplicated.
                    </p>
                  </Surface>
                ) : (
                  <div className="space-y-3">
                    <Surface level={2} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {selectedRun.sourceFilename}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                            {labelForImportSource(
                              selectedRun.sourceType,
                            )}{" "}
                            ·{" "}
                            {formatImportTimestampUtc(
                              selectedRun.appliedAt,
                            )}
                          </p>
                        </div>
                        {changes ? (
                          <StatusChip tone="neutral">
                            {changes.length} recorded change
                            {changes.length === 1 ? "" : "s"}
                          </StatusChip>
                        ) : null}
                      </div>
                    </Surface>

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

                    {loadingRunId === selectedRun.id ? (
                      <Surface level={2} className="p-5">
                        <p className="text-sm font-semibold">
                          Loading Character changes…
                        </p>
                      </Surface>
                    ) : changes?.length === 0 ? (
                      <Surface level={2} className="p-5">
                        <p className="font-semibold">
                          No detailed Character changes
                        </p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          This run did not record any meaningful Character
                          changes.
                        </p>
                      </Surface>
                    ) : changes ? (
                      <div className="space-y-3">
                        {changes.map((change) => (
                          <ChangeDetails
                            key={change.id}
                            change={change}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
