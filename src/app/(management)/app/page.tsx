import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthViewer } from "@/features/auth/viewer";
import { createGuildAction } from "@/features/guilds/actions";
import { getGuildMembershipSummaries } from "@/features/guilds/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

type GuildHubPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

export default async function GuildHubPage({
  searchParams,
}: GuildHubPageProps) {
  const viewer = await getAuthViewer();

  if (!viewer) {
    redirect("/");
  }

  const guilds = await getGuildMembershipSummaries();
  const query = await searchParams;
  const errorValue = Array.isArray(query.error)
    ? query.error[0]
    : query.error;

  const errorMessage =
    errorValue === "invalid-name"
      ? "Guild names must be between 2 and 80 characters."
      : errorValue === "create-failed"
        ? "The Guild could not be created. Please try again."
        : null;

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <StatusChip tone="success">Signed in</StatusChip>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
              Your Guilds
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Welcome, {viewer.displayName}. Choose a Guild or create one.
            </p>
          </div>
        </div>

        {guilds.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold tracking-[0.12em] text-[var(--text-tertiary)] uppercase">
              Active memberships
            </h2>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {guilds.map((guild) => (
                <Link key={guild.membershipId} href={guild.destination}>
                  <Surface
                    level={2}
                    className="h-full p-5 transition-colors hover:bg-[var(--surface-3)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{guild.guildName}</h3>
                        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                          {guild.role.charAt(0).toUpperCase()}
                          {guild.role.slice(1)}
                        </p>
                      </div>

                      <span className="text-[var(--accent)]">Open →</span>
                    </div>
                  </Surface>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <Surface level={2} className="mt-8 p-5">
            <p className="font-semibold">No Guild memberships yet</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Create a Guild to become its Owner, or use an invitation
              link from another Guild.
            </p>
          </Surface>
        )}

        <section className="mt-10 max-w-xl">
          <Surface className="p-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--guild-accent)] uppercase">
              Create Guild
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Start a new command center
            </h2>

            <form action={createGuildAction} className="mt-5">
              <label
                htmlFor="guild-name"
                className="text-sm font-semibold text-[var(--text-secondary)]"
              >
                Guild name
              </label>
              <input
                id="guild-name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
                className="mt-2 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                placeholder="Enter your Guild name"
              />

              {errorMessage ? (
                <p className="mt-3 text-sm text-[var(--danger)]">
                  {errorMessage}
                </p>
              ) : null}

              <Button type="submit" size="lg" className="mt-4">
                Create Guild
              </Button>
            </form>
          </Surface>
        </section>
      </div>
    </main>
  );
}
