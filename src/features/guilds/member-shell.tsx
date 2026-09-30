import Link from "next/link";
import type { GuildAccess } from "@/features/guilds/server";
import { StatusChip } from "@/components/ui/status-chip";

export function MemberShell({
  access,
  children,
}: {
  access: GuildAccess;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">
              Guild
            </p>
            <p className="font-semibold">{access.guildName}</p>
          </div>

          <div className="flex items-center gap-3">
            <StatusChip tone="neutral">Member view</StatusChip>
            <Link
              href="/app"
              className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Guilds
            </Link>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
