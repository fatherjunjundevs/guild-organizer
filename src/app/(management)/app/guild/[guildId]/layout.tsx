import { redirect } from "next/navigation";
import { getAuthViewer } from "@/features/auth/viewer";
import {
  getGuildAccess,
  getGuildMembershipSummaries,
} from "@/features/guilds/server";
import { ManagementShell } from "@/features/guilds/management-shell";

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

  return (
    <ManagementShell access={access} memberships={memberships}>
      {children}
    </ManagementShell>
  );
}
