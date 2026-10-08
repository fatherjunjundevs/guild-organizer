import { notFound, redirect } from "next/navigation";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import { loadEventBuilder } from "@/features/events/builder-server";
import { EventBuilderBoard } from "@/features/events/event-builder-board";
import { getGuildAccess } from "@/features/guilds/server";

export default async function EventBuilderPage({
  params,
}: {
  params: Promise<{ guildId: string; eventId: string }>;
}) {
  const { guildId, eventId } = await params;
  const access = await getGuildAccess(guildId);

  if (!access || access.role === "member") {
    redirect("/app");
  }

  const result = await loadEventBuilder(access, eventId);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "forbidden") {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <StatusChip tone="warning">Event Builder restricted</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Event Builder
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">Event management is not enabled</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Your Officer account needs the events.manage capability before it can open this Guild&apos;s draft Event Builder.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  if (result.status === "error" || !result.event) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <StatusChip tone="danger">Event Builder unavailable</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Event Builder
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">The Event snapshot could not be loaded</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Return to Events and try again. No Event data was changed.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <EventBuilderBoard
      guildId={access.guildId}
      guildName={access.guildName}
      event={result.event}
      publication={result.publication}
      canPublish={result.canPublish}
    />
  );
}
