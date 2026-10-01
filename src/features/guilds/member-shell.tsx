import { signOut } from "@/features/auth/actions";
import type {
  GuildAccess,
  GuildMembershipSummary,
} from "@/features/guilds/server";
import { GuildSwitcher } from "@/features/guilds/guild-switcher";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";

export function MemberShell({
  access,
  memberships,
  children,
}: {
  access: GuildAccess;
  memberships: GuildMembershipSummary[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-tertiary)]">
              Guild
            </p>
            <p className="truncate font-semibold">{access.guildName}</p>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
            <StatusChip tone="neutral" className="hidden sm:inline-flex">
              Member view
            </StatusChip>

            <GuildSwitcher
              memberships={memberships}
              currentGuildId={access.guildId}
            />

            <form action={signOut} className="hidden sm:block">
              <Button type="submit" variant="ghost">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
