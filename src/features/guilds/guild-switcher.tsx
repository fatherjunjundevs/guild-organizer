"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GuildMembershipSummary } from "@/features/guilds/server";
import { getGuildExperienceLabel } from "@/features/guilds/routing";
import { StatusChip } from "@/components/ui/status-chip";

export function GuildSwitcher({
  memberships,
  currentGuildId,
  align = "end",
}: {
  memberships: GuildMembershipSummary[];
  currentGuildId: string;
  align?: "start" | "end";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = memberships.find(
    (membership) => membership.guildId === currentGuildId,
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        !containerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!current) {
    return (
      <Link
        href="/app"
        className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
      >
        All Guilds
      </Link>
    );
  }

  const menuAlignment =
    align === "start" ? "left-0" : "right-0";

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Switch Guild"
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2 text-left transition-colors hover:bg-[var(--surface-3)]"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
            Current Guild
          </span>
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
            {current.guildName}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <StatusChip tone="neutral" className="hidden sm:inline-flex">
            {current.role.charAt(0).toUpperCase()}
            {current.role.slice(1)}
          </StatusChip>
          <span
            aria-hidden="true"
            className={`text-xs text-[var(--text-tertiary)] transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Switch Guild"
          className={`absolute ${menuAlignment} z-50 mt-2 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-1)] shadow-2xl shadow-black/30`}
        >
          <div className="border-b border-[var(--border-subtle)] px-3 py-2">
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-tertiary)] uppercase">
              Switch Guild
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {memberships.map((membership) => {
              const isCurrent = membership.guildId === currentGuildId;

              return (
                <Link
                  key={membership.membershipId}
                  href={membership.destination}
                  aria-current={isCurrent ? "page" : undefined}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                    isCurrent
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {membership.guildName}
                    </span>
                    <span className="mt-0.5 block text-xs opacity-75">
                      {membership.role.charAt(0).toUpperCase()}
                      {membership.role.slice(1)} ·{" "}
                      {getGuildExperienceLabel(membership.role)}
                    </span>
                  </span>

                  {isCurrent ? (
                    <span className="shrink-0 text-xs font-semibold">
                      Current
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[var(--text-tertiary)]"
                    >
                      →
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="border-t border-[var(--border-subtle)] p-2">
            <Link
              href="/app"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex min-h-10 items-center rounded-[var(--radius-md)] px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            >
              View all Guilds
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
