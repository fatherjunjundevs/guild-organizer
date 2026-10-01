import { signOut } from "@/features/auth/actions";
import type {
  GuildAccess,
  GuildMembershipSummary,
} from "@/features/guilds/server";
import { GuildSwitcher } from "@/features/guilds/guild-switcher";
import { ManagementNav } from "@/features/guilds/management-nav";
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

        <ManagementNav guildId={access.guildId} />

        <div className="hidden px-3 pb-5 lg:block">
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
        </div>
      </aside>

      <main className="relative z-0 min-w-0 bg-[var(--bg-canvas)]">
        {children}
      </main>
    </div>
  );
}
