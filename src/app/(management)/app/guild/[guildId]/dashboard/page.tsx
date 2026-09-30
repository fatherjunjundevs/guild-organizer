import { getGuildAccess } from "@/features/guilds/server";
import { redirect } from "next/navigation";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

export default async function GuildDashboardPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const access = await getGuildAccess(guildId);

  if (!access || access.role === "member") {
    redirect("/app");
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <StatusChip tone="accent">Management</StatusChip>

        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
          {access.guildName}
        </h1>

        <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
          Your Guild command center is active. Roster, events, templates,
          publishing, and member administration will attach to this shell.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Your role
            </p>
            <p className="mt-2 text-xl font-semibold capitalize">
              {access.role}
            </p>
          </Surface>

          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Roster
            </p>
            <p className="mt-2 text-xl font-semibold">Not imported</p>
          </Surface>

          <Surface level={2} className="p-5">
            <p className="text-xs text-[var(--text-tertiary)]">
              Events
            </p>
            <p className="mt-2 text-xl font-semibold">0 active</p>
          </Surface>
        </div>
      </div>
    </div>
  );
}
