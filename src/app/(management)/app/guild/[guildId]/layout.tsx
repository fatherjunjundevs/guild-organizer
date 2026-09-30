import { redirect } from "next/navigation";
import { getAuthViewer } from "@/features/auth/viewer";
import { getGuildAccess } from "@/features/guilds/server";
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
  const access = await getGuildAccess(guildId);

  if (!access) {
    redirect("/app");
  }

  if (access.role === "member") {
    redirect(`/member/guild/${guildId}/home`);
  }

  return (
    <ManagementShell access={access}>
      {children}
    </ManagementShell>
  );
}
