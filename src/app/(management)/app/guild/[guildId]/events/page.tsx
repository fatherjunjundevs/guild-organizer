import { redirect } from "next/navigation";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import { EventManagementView } from "@/features/events/event-management-view";
import { loadEventManagement } from "@/features/events/server";
import { getGuildAccess } from "@/features/guilds/server";

export default async function GuildEventsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const access = await getGuildAccess(guildId);

  if (!access || access.role === "member") {
    redirect("/app");
  }

  const management = await loadEventManagement(access);

  if (management.status === "forbidden") {
    return (
      <div className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <StatusChip tone="warning">Events restricted</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Events
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">Event management is not enabled</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Your Officer account needs the events.manage capability before it
              can create Events or work with this Guild&apos;s Event Builder.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  if (management.status === "error") {
    return (
      <div className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <StatusChip tone="danger">Events unavailable</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Events
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">Event management could not be loaded</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Refresh the page and try again. No Event data was changed.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <EventManagementView
      guildId={access.guildId}
      guildName={access.guildName}
      events={management.events}
      activeTemplates={management.activeTemplates}
    />
  );
}
