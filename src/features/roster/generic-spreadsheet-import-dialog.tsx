"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyGenericSpreadsheetImportAction,
  previewGenericSpreadsheetImportAction,
  type GenericSpreadsheetImportSummary,
  type GenericSpreadsheetPreviewChange,
} from "@/features/roster/generic-import-actions";
import {
  buildGenericRosterRpcRows,
  countGenericPreviewChanges,
  mappedFieldsFromSpreadsheetMapping,
  updateSpreadsheetMappingColumn,
} from "@/features/roster/generic-spreadsheet-import";
import {
  GENERIC_ROSTER_FIELD_DEFINITIONS,
  analyzeSpreadsheetImport,
  autoDetectSpreadsheetMapping,
  type GenericRosterFieldKey,
  type SpreadsheetColumnMapping,
  type SpreadsheetGrid,
  type SpreadsheetImportIssue,
} from "@/features/roster/spreadsheet-import";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

const CLIENT_FILE_LIMIT_BYTES = 5 * 1024 * 1024;

const FIELD_LABELS = Object.fromEntries(
  GENERIC_ROSTER_FIELD_DEFINITIONS.map((definition) => [
    definition.key,
    definition.label,
  ]),
) as Record<GenericRosterFieldKey, string>;

type Inspection = {
  filename: string;
  sha256: string;
  grid: SpreadsheetGrid;
  ambiguities: ReturnType<
    typeof autoDetectSpreadsheetMapping
  >["ambiguities"];
};

type BusyState = "" | "read" | "preview" | "apply";

function labelForChange(changeKind: string) {
  if (changeKind === "new") return "New";
  if (changeKind === "update") return "Updated";
  return "Unchanged";
}

function toneForChange(
  changeKind: string,
): "accent" | "success" | "neutral" {
  if (changeKind === "new") return "success";
  if (changeKind === "update") return "accent";
  return "neutral";
}

function displayCell(value: string | number | boolean | null) {
  if (value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function IssueList({
  issues,
}: {
  issues: SpreadsheetImportIssue[];
}) {
  if (issues.length === 0) return null;

  const hasErrors = issues.some((issue) => issue.severity === "error");
  const visible = issues.slice(0, 8);

  return (
    <Surface
      level={2}
      className={
        hasErrors
          ? "border-[color-mix(in_srgb,var(--danger)_40%,transparent)] p-4"
          : "border-[color-mix(in_srgb,var(--warning)_40%,transparent)] p-4"
      }
    >
      <p
        className={`font-semibold ${
          hasErrors
            ? "text-[var(--danger)]"
            : "text-[var(--warning)]"
        }`}
      >
        {hasErrors
          ? "Fix these spreadsheet issues"
          : "Review these identity warnings"}
      </p>

      <ul className="mt-2 space-y-1.5 text-sm leading-5 text-[var(--text-secondary)]">
        {visible.map((issue, index) => (
          <li key={`${issue.rowNumber ?? "mapping"}:${issue.fieldKey ?? "general"}:${index}`}>
            {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}
            {issue.message}
          </li>
        ))}
      </ul>

      {issues.length > visible.length ? (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          {issues.length - visible.length} more issue
          {issues.length - visible.length === 1 ? "" : "s"} not shown.
        </p>
      ) : null}
    </Surface>
  );
}

export function GenericSpreadsheetImportDialog({
  guildId,
}: {
  guildId: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropPointerStartedRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [mapping, setMapping] = useState<SpreadsheetColumnMapping>({});
  const [preview, setPreview] =
    useState<GenericSpreadsheetPreviewChange[] | null>(null);
  const [summary, setSummary] =
    useState<GenericSpreadsheetImportSummary | null>(null);
  const [busy, setBusy] = useState<BusyState>("");
  const [message, setMessage] = useState("");

  const analysis = useMemo(
    () =>
      inspection
        ? analyzeSpreadsheetImport(inspection.grid, mapping)
        : null,
    [inspection, mapping],
  );

  const mappedFields = useMemo(
    () => mappedFieldsFromSpreadsheetMapping(mapping),
    [mapping],
  );

  const rpcRows = useMemo(
    () =>
      analysis && !analysis.hasErrors
        ? buildGenericRosterRpcRows(analysis.rows, mappedFields)
        : [],
    [analysis, mappedFields],
  );

  const changeCounts = useMemo(
    () => countGenericPreviewChanges(preview ?? []),
    [preview],
  );

  const sampleColumnIndexes = useMemo(() => {
    if (!inspection) return [];

    const indexes = new Set<number>();

    for (const index of Object.values(mapping)) {
      if (index !== undefined) indexes.add(index);
    }

    for (
      let index = 0;
      index < inspection.grid.headers.length && indexes.size < 8;
      index += 1
    ) {
      indexes.add(index);
    }

    return [...indexes].sort((left, right) => left - right);
  }, [inspection, mapping]);

  function resetImport() {
    setFile(null);
    setInspection(null);
    setMapping({});
    setPreview(null);
    setSummary(null);
    setBusy("");
    setMessage("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function handleFile(selectedFile: File | undefined) {
    setFile(null);
    setInspection(null);
    setMapping({});
    setPreview(null);
    setSummary(null);
    setMessage("");

    if (!selectedFile) return;

    const lowerName = selectedFile.name.toLocaleLowerCase();

    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
      setMessage("Choose a .csv or .xlsx spreadsheet.");
      return;
    }

    if (
      selectedFile.size === 0 ||
      selectedFile.size > CLIENT_FILE_LIMIT_BYTES
    ) {
      setMessage("Choose a spreadsheet up to 5 MB.");
      return;
    }

    setBusy("read");

    try {
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      const { readGenericSpreadsheetBytes } = await import(
        "@/features/roster/spreadsheet-file"
      );
      const result = await readGenericSpreadsheetBytes({
        filename: selectedFile.name,
        bytes,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      const detection = autoDetectSpreadsheetMapping(
        result.grid.headers,
      );

      setFile(selectedFile);
      setInspection({
        filename: result.filename,
        sha256: result.sha256,
        grid: result.grid,
        ambiguities: detection.ambiguities,
      });
      setMapping(detection.mapping);
    } catch {
      setMessage(
        "The spreadsheet could not be opened. No roster data was changed.",
      );
    } finally {
      setBusy("");
    }
  }

  function changeMapping(
    fieldKey: GenericRosterFieldKey,
    value: string,
  ) {
    const columnIndex = value === "" ? null : Number(value);

    setMapping((current) =>
      updateSpreadsheetMappingColumn(
        current,
        fieldKey,
        columnIndex,
      ),
    );
    setPreview(null);
    setSummary(null);
    setMessage("");
  }

  async function previewImport() {
    if (!inspection || !analysis || analysis.hasErrors) {
      setMessage(
        "Fix the spreadsheet mapping and row errors before previewing.",
      );
      return;
    }

    setBusy("preview");
    setMessage("");
    setPreview(null);

    try {
      const result = await previewGenericSpreadsheetImportAction({
        guildId,
        rows: rpcRows,
        mappedFields,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setPreview(result.changes);
    } finally {
      setBusy("");
    }
  }

  async function confirmImport() {
    if (
      !inspection ||
      !analysis ||
      analysis.hasErrors ||
      !preview
    ) {
      return;
    }

    setBusy("apply");
    setMessage("");

    try {
      const result = await applyGenericSpreadsheetImportAction({
        guildId,
        rows: rpcRows,
        mappedFields,
        sourceFilename: inspection.filename,
        sourceSha256: inspection.sha256,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setSummary(result.summary);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        Import Spreadsheet
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="generic-spreadsheet-import-title"
        onClose={resetImport}
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
              closeDialog();
            }
          });
        }}
        className="m-auto w-[min(70rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 outline-none backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-5 py-4 sm:px-6">
          <div>
            <StatusChip tone="accent">Flexible import</StatusChip>
            <h2
              id="generic-spreadsheet-import-title"
              className="mt-2 text-xl font-semibold"
            >
              Import Spreadsheet
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Map CSV or XLSX columns to the Master Roster before anything
              changes.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={Boolean(busy)}
            onClick={closeDialog}
            aria-label="Close spreadsheet import"
          >
            Close
          </Button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {!summary ? (
            <>
              <Surface level={2} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="font-semibold">
                      Choose a CSV or XLSX spreadsheet
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      The original file is parsed in your browser. Only
                      validated fields you map are sent when you preview or
                      apply the import. Formulas are not executed.
                    </p>
                  </div>
                  <StatusChip tone="neutral">Up to 5 MB</StatusChip>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={Boolean(busy)}
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
                    disabled={Boolean(busy)}
                    onClick={() => inputRef.current?.click()}
                  >
                    {busy === "read" ? "Reading…" : "Choose spreadsheet"}
                  </Button>

                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">
                    {file?.name ?? "No file selected"}
                  </span>
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

              {inspection ? (
                <>
                  <Surface level={2} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{inspection.filename}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {inspection.grid.rows.length} data rows ·{" "}
                          {inspection.grid.headers.length} source columns
                          {inspection.grid.sheetName
                            ? ` · ${inspection.grid.sheetName}`
                            : ""}
                        </p>
                      </div>
                      <StatusChip tone="success">File read</StatusChip>
                    </div>
                  </Surface>

                  {inspection.ambiguities.length > 0 ? (
                    <Surface
                      level={2}
                      className="border-[color-mix(in_srgb,var(--warning)_40%,transparent)] p-4"
                    >
                      <p className="font-semibold text-[var(--warning)]">
                        Some columns need your choice
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                        Automatic mapping did not guess where multiple headers
                        could represent the same field.
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                        {inspection.ambiguities.map((ambiguity) => (
                          <li key={ambiguity.fieldKey}>
                            {FIELD_LABELS[ambiguity.fieldKey]}:{" "}
                            {ambiguity.headers.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </Surface>
                  ) : null}

                  <Surface level={2} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Column mapping</p>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                          IGN / Player is required. Leave an optional field
                          unmapped to preserve its existing roster value. A
                          blank cell in a mapped field intentionally clears
                          that field.
                        </p>
                      </div>
                      <StatusChip
                        tone={
                          mapping.ign === undefined ? "warning" : "success"
                        }
                      >
                        {mapping.ign === undefined
                          ? "IGN required"
                          : `${mappedFields.length + 1} mapped`}
                      </StatusChip>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {GENERIC_ROSTER_FIELD_DEFINITIONS.map((definition) => (
                        <div key={definition.key}>
                          <label
                            htmlFor={`spreadsheet-map-${definition.key}`}
                            className="text-xs font-semibold text-[var(--text-tertiary)]"
                          >
                            {definition.label}
                            {definition.required ? " · Required" : ""}
                          </label>
                          <select
                            id={`spreadsheet-map-${definition.key}`}
                            value={mapping[definition.key] ?? ""}
                            disabled={Boolean(busy)}
                            onChange={(event) =>
                              changeMapping(
                                definition.key,
                                event.target.value,
                              )
                            }
                            className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm"
                          >
                            <option value="">
                              {definition.required
                                ? "Select source column"
                                : "Do not import"}
                            </option>
                            {inspection.grid.headers.map(
                              (header, columnIndex) => (
                                <option
                                  key={`${columnIndex}:${header}`}
                                  value={columnIndex}
                                >
                                  {columnIndex + 1}. {header}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      ))}
                    </div>
                  </Surface>

                  <Surface level={2} className="overflow-hidden">
                    <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                      <p className="font-semibold">Source sample</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                        First four data rows. Mapped columns are always included;
                        additional early columns are shown up to eight total.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-[var(--surface-3)] text-[var(--text-tertiary)]">
                          <tr>
                            {sampleColumnIndexes.map((columnIndex) => (
                              <th
                                key={columnIndex}
                                scope="col"
                                className="whitespace-nowrap px-3 py-2 font-semibold"
                              >
                                {inspection.grid.headers[columnIndex]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inspection.grid.rows
                            .slice(0, 4)
                            .map((row, rowIndex) => (
                              <tr
                                key={
                                  inspection.grid.rowNumbers[rowIndex] ??
                                  rowIndex
                                }
                                className="border-t border-[var(--border-subtle)]"
                              >
                                {sampleColumnIndexes.map((columnIndex) => (
                                  <td
                                    key={columnIndex}
                                    className="max-w-52 truncate whitespace-nowrap px-3 py-2 text-[var(--text-secondary)]"
                                  >
                                    {displayCell(row[columnIndex] ?? null)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </Surface>

                  {analysis ? <IssueList issues={analysis.issues} /> : null}

                  {analysis && !analysis.hasErrors ? (
                    <Surface level={2} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">
                            {analysis.validRowCount} row
                            {analysis.validRowCount === 1 ? "" : "s"} ready
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                            Generic imports never mark omitted characters Left
                            Guild and never reactivate an inactive character.
                            Exact IGN matching only.
                          </p>
                        </div>

                        <Button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => void previewImport()}
                        >
                          {busy === "preview"
                            ? "Previewing…"
                            : preview
                              ? "Refresh preview"
                              : "Preview import"}
                        </Button>
                      </div>
                    </Surface>
                  ) : null}

                  {preview ? (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        {(
                          [
                            ["New", changeCounts.new],
                            ["Updated", changeCounts.update],
                            ["Unchanged", changeCounts.unchanged],
                          ] as const
                        ).map(([label, count]) => (
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

                      <Surface level={2} className="overflow-hidden">
                        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                          <p className="font-semibold">Import preview</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                            Only these incoming exact IGNs are in scope. Rows
                            missing from the spreadsheet are untouched.
                          </p>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {preview.map((change, index) => (
                            <div
                              key={`${change.changeKind}:${change.ign}:${index}`}
                              className="flex items-start justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-2.5 first:border-t-0"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">
                                  {change.ign}
                                </span>
                                {change.changedFields.length > 0 ? (
                                  <span className="mt-0.5 block text-xs leading-5 text-[var(--text-tertiary)]">
                                    {change.changedFields
                                      .map(
                                        (field) =>
                                          FIELD_LABELS[field],
                                      )
                                      .join(" · ")}
                                  </span>
                                ) : (
                                  <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">
                                    No mapped values change
                                  </span>
                                )}
                              </span>
                              <StatusChip
                                tone={toneForChange(change.changeKind)}
                                className="shrink-0"
                              >
                                {labelForChange(change.changeKind)}
                              </StatusChip>
                            </div>
                          ))}
                        </div>
                      </Surface>

                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={Boolean(busy)}
                          onClick={() => {
                            setPreview(null);
                            setMessage("");
                          }}
                        >
                          Edit mapping
                        </Button>
                        <Button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => void confirmImport()}
                        >
                          {busy === "apply"
                            ? "Importing…"
                            : "Confirm spreadsheet import"}
                        </Button>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              <Surface level={2} className="p-5">
                <StatusChip tone="success">Import complete</StatusChip>
                <h3 className="mt-3 text-xl font-semibold">
                  Master Roster updated
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {summary.sourceRowCount} spreadsheet rows were processed.
                  Only explicitly mapped fields were eligible to change.
                  Characters not listed in the spreadsheet were untouched.
                </p>
              </Surface>

              <div className="grid grid-cols-3 gap-3">
                {[
                  ["New", summary.createdCount],
                  ["Updated", summary.updatedCount],
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
