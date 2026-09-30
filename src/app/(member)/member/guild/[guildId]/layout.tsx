import { redirect } from "next/navigation";
import { getAuthViewer } from "@/features/auth/viewer";
import { getGuildAccess } from "@/features/guilds/server";
import { MemberShell } from "@/features/guilds/member-shell";

export default async function GuildMemberLayout({
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

  return <MemberShell access={access}>{children}</MemberShell>;
}
