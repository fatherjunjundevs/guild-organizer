import Link from "next/link";
import { notFound } from "next/navigation";
import { Surface } from "@/components/ui/surface";
import { StatusChip } from "@/components/ui/status-chip";
import { EventShareLinkManager } from "@/features/events/event-share-link-manager";
import { loadSharingEvents } from "@/features/events/sharing-events-server";

export const runtime = "nodejs";

export default async function GuildSharingPage({ params, searchParams }: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const { guildId } = await params;
  const { after } = await searchParams;
  const result = await loadSharingEvents(guildId, after ?? null);
  if (result.status === "disabled" || result.status === "forbidden") notFound();
  return <div className="px-5 py-8 sm:px-8 lg:px-10">
    <div className="mx-auto max-w-3xl">
      <StatusChip tone="warning">Development only</StatusChip>
      <h1 className="mt-4 text-3xl font-semibold">Event sharing</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Manage Event share links. The public Event page is not available yet; links are not ready to send to members.</p>
      {result.status === "error" ? <Surface level={2} className="mt-6 p-5"><p role="alert">Events could not be loaded. Reload the page to try again.</p></Surface>
        : <div className="mt-6 space-y-3">
          {result.events.length === 0 ? <Surface level={2} className="p-5">No Events available on this page.</Surface> : null}
          {result.events.map((event) => <Surface key={event.id} level={2} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{event.name}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{event.status === "archived" ? "Archived Event" : "Active Event"}</p></div>
            <EventShareLinkManager guildId={guildId} eventId={event.id} eventName={event.name} archived={event.status === "archived"} />
          </Surface>)}
          <nav aria-label="Sharing Event pages" className="flex flex-wrap gap-4 pt-3 text-sm font-semibold text-[var(--accent)]">
            {after ? <Link href={`/app/guild/${guildId}/sharing`}>First page</Link> : null}
            {result.next ? <Link href={`/app/guild/${guildId}/sharing?after=${result.next}`}>Next 25 Events</Link> : null}
          </nav>
        </div>}
    </div>
  </div>;
}
