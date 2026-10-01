import { redirect } from "next/navigation";
import { getAuthViewer } from "@/features/auth/viewer";
import {
  getGuildAccess,
  getGuildMembershipSummaries,
} from "@/features/guilds/server";
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
  const [access, memberships] = await Promise.all([
    getGuildAccess(guildId),
    getGuildMembershipSummaries(),
  ]);

  if (!access) {
    redirect("/app");
  }

  if (access.role !== "member") {
    redirect(access.destination);
  }

  return (
    <MemberShell access={access} memberships={memberships}>
      {children}
    </MemberShell>
  );
}
