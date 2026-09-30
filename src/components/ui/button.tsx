import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utilities/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[#07101f] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-pressed)]",
  secondary:
    "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface-3)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
  danger:
    "bg-[var(--danger)] text-[#160909] hover:brightness-110 active:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  icon,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold",
        "transition-[background-color,border-color,color,filter,transform]",
        "duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        "disabled:pointer-events-none disabled:opacity-45",
        "active:translate-y-px",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}