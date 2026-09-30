import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utilities/cn";

type StatusTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

const tones: Record<StatusTone, string> = {
  neutral:
    "border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-secondary)]",
  accent:
    "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  success:
    "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]",
  warning:
    "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]",
  danger:
    "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]",
};

export function StatusChip({
  tone = "neutral",
  className,
  ...props
}: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}