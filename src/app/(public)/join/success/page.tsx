import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthViewer } from "@/features/auth/viewer";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { data: guild } = await supabase
    .from("guilds")
    .select("name")
    .eq("id", guildId)
    .maybeSingle();

  if (!guild) {
    redirect("/");
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <Surface className="w-full p-6 sm:p-8">
          <StatusChip tone="success">Invitation accepted</StatusChip>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            You joined {guild.name}
          </h1>

          <p className="mt-3 leading-7 text-[var(--text-secondary)]">
            Your Guild membership is active. The Guild workspace will
            become your main destination as we finish the access shell.
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-3)]"
          >
            Return home
          </Link>
        </Surface>
      </div>
    </main>
  );
}
