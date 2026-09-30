import { getGuildAccess } from "@/features/guilds/server";
import { redirect } from "next/navigation";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

export default async function MemberHomePage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const access = await getGuildAccess(guildId);

  if (!access) {
    redirect("/app");
  }

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <StatusChip tone="success">Active member</StatusChip>

        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
          {access.guildName}
        </h1>

        <p className="mt-2 text-[var(--text-secondary)]">
          Your member home is ready. Published events and your linked
          characters will appear here in later phases.
        </p>

        <Surface level={2} className="mt-8 p-5">
          <p className="text-xs text-[var(--text-tertiary)]">
            Guild role
          </p>
          <p className="mt-2 text-xl font-semibold capitalize">
            {access.role}
          </p>
        </Surface>
      </div>
    </main>
  );
}
