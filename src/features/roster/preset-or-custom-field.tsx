"use client";

import { useId, useMemo, useState } from "react";

type PresetOption =
  | string
  | {
      value: string;
      label: string;
    };

const CUSTOM_VALUE = "__custom__";

function normalizeOptions(options: readonly PresetOption[]) {
  return options.map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : option,
  );
}

export function PresetOrCustomField({
  name,
  label,
  options,
  defaultValue = "",
  emptyLabel = "Not specified",
  customLabel = "Other / enter manually…",
  placeholder = "Enter custom value",
  maxLength = 80,
}: {
  name: string;
  label: string;
  options: readonly PresetOption[];
  defaultValue?: string | null;
  emptyLabel?: string;
  customLabel?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  const fieldId = useId();
  const selectId = `${fieldId}-select`;

  const normalizedOptions = useMemo(
    () => normalizeOptions(options),
    [options],
  );
  const initialValue = defaultValue ?? "";
  const initialPreset = normalizedOptions.some(
    (option) => option.value === initialValue,
  )
    ? initialValue
    : initialValue
      ? CUSTOM_VALUE
      : "";

  const [selection, setSelection] = useState(initialPreset);
  const [customValue, setCustomValue] = useState(
    initialPreset === CUSTOM_VALUE ? initialValue : "",
  );

  const submittedValue =
    selection === CUSTOM_VALUE ? customValue : selection;

  return (
    <div className="text-sm font-semibold">
      <label htmlFor={selectId}>{label}</label>
      <select
        id={selectId}
        value={selection}
        onChange={(event) => {
          const next = event.target.value;
          setSelection(next);

          if (next !== CUSTOM_VALUE) {
            setCustomValue("");
          }
        }}
        className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
      >
        <option value="">{emptyLabel}</option>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>{customLabel}</option>
      </select>

      <input type="hidden" name={name} value={submittedValue} />

      {selection === CUSTOM_VALUE ? (
        <input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={`${label} custom value`}
          className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 font-normal"
        />
      ) : null}
    </div>
  );
}
