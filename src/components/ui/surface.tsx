import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utilities/cn";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  level?: 1 | 2 | 3;
};

export function Surface({
  level = 1,
  className,
  ...props
}: SurfaceProps) {
  const levels = {
    1: "bg-[var(--surface-1)]",
    2: "bg-[var(--surface-2)]",
    3: "bg-[var(--surface-3)]",
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--border-subtle)]",
        levels[level],
        className,
      )}
      {...props}
    />
  );
}