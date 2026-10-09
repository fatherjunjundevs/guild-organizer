import { redirect } from "next/navigation";
import { getAuthViewer } from "@/features/auth/viewer";
import {
  getGuildAccess,
  getGuildMembershipSummaries,
} from "@/features/guilds/server";
import { ManagementShell } from "@/features/guilds/management-shell";
import { isShareLinkInterfaceEnabled } from "@/features/events/share-link-feature";
import { canPublishEvent } from "@/features/events/publication-server";

export default async function GuildManagementLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const viewer = await getAuthViewer();

  if (!viewer) {
    redirect("/");
  }

  const { guildId } = await params;
  const [access, memberships] = await Promise.all([
    getGuildAccess(guildId),
    getGuildMembershipSummaries(),
  ]);

  if (!access) {
    redirect("/app");
  }

  if (access.role === "member") {
    redirect(access.destination);
  }

  const canShare = isShareLinkInterfaceEnabled() && (await canPublishEvent(access)) === "allowed";
  return (
    <ManagementShell access={access} memberships={memberships} canShare={canShare}>
      {children}
    </ManagementShell>
  );
}
