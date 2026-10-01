import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthViewer } from "@/features/auth/viewer";
import { getGuildAccess } from "@/features/guilds/server";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

type InviteSuccessPageProps = {
  searchParams: Promise<{
    guild?: string | string[];
  }>;
};

export default async function InviteSuccessPage({
  searchParams,
}: InviteSuccessPageProps) {
  const viewer = await getAuthViewer();

  if (!viewer) {
    redirect("/");
  }

  const query = await searchParams;
  const guildId = Array.isArray(query.guild)
    ? query.guild[0]
    : query.guild;

  if (!guildId) {
    redirect("/");
  }

  const access = await getGuildAccess(guildId);

  if (!access) {
    redirect("/app");
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <Surface className="w-full p-6 sm:p-8">
          <StatusChip tone="success">Invitation accepted</StatusChip>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            You joined {access.guildName}
          </h1>

          <p className="mt-3 leading-7 text-[var(--text-secondary)]">
            Your Guild membership is active with the{" "}
            <span className="font-semibold capitalize text-[var(--text-primary)]">
              {access.role}
            </span>{" "}
            role.
          </p>

          <Link
            href={access.destination}
            className="mt-7 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-5 text-[15px] font-semibold text-[#07101f] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Open Guild
          </Link>
        </Surface>
      </div>
    </main>
  );
}
