import type { Metadata } from "next";
import { PublicEventViewer } from "@/features/events/public-event-viewer";
import { isShareLinkInterfaceEnabled } from "@/features/events/share-link-feature";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Event lineup | Guild Organizer", description: "View your Guild’s current published Event lineup.",
  robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer",
  openGraph: { title: "Guild Organizer • Event lineup", description: "Open your shared link to find your published assignment.", type: "website" },
};

export default function PublicEventPage() {
  return <PublicEventViewer enabled={isShareLinkInterfaceEnabled() && process.env.PUBLIC_EVENT_VIEWER_ENABLED === "true"} />;
}
