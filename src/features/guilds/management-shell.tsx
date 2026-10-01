import Link from "next/link";
import { signOut } from "@/features/auth/actions";
import type {
  GuildAccess,
  GuildMembershipSummary,
} from "@/features/guilds/server";
import { GuildSwitcher } from "@/features/guilds/guild-switcher";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

export function ManagementShell({
  access,
  memberships,
  children,
}: {
  access: GuildAccess;
  memberships: GuildMembershipSummary[];
  children: React.ReactNode;
}) {
  const roleLabel =
    access.role.charAt(0).toUpperCase() + access.role.slice(1);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[var(--management-sidebar-expanded)_1fr]">
      <aside className="relative z-20 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex min-h-16 items-center justify-between gap-4 px-5 lg:block lg:px-4 lg:py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--text-tertiary)] uppercase">
              Guild Command Center
            </p>
            <h1 className="mt-1 truncate font-semibold text-[var(--text-primary)]">
              {access.guildName}
            </h1>
          </div>

          <StatusChip tone="accent">{roleLabel}</StatusChip>
        </div>

        <div className="px-5 pb-4 lg:px-3">
          <GuildSwitcher
            memberships={memberships}
            currentGuildId={access.guildId}
            align="start"
          />
        </div>

        <nav
          aria-label="Management"
          className="hidden px-3 pb-5 lg:block"
        >
          <Link
            href={`/app/guild/${access.guildId}/dashboard`}
            className="flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-3 text-sm font-semibold text-[var(--accent)]"
          >
            Dashboard
          </Link>

          <div className="mt-2 space-y-1 text-sm text-[var(--text-disabled)]">
            <span className="flex h-10 items-center px-3">Roster</span>
            <span className="flex h-10 items-center px-3">Events</span>
            <span className="flex h-10 items-center px-3">Templates</span>
            <span className="flex h-10 items-center px-3">History</span>
            <span className="flex h-10 items-center px-3">Settings</span>
          </div>

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start"
              >
                Sign out
              </Button>
            </form>
          </div>
        </nav>
      </aside>

      <main className="relative z-0 min-w-0 bg-[var(--bg-canvas)]">
        {children}
      </main>
    </div>
  );
}
