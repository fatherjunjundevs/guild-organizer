import { signInWithDiscord } from "@/features/auth/actions";
import { getAuthViewer } from "@/features/auth/viewer";
import { acceptGuildInviteAction } from "@/features/invites/actions";
import {
  buildInvitePath,
} from "@/features/invites/token";
import { resolveGuildInviteLink } from "@/features/invites/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

type InvitePageProps = {
  params: Promise<{
    generation: string;
    token: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

function InviteUnavailable() {
  return (
    <Surface className="w-full p-6 sm:p-8">
      <StatusChip tone="danger">Invite unavailable</StatusChip>
      <h1 className="mt-4 text-2xl font-semibold">
        This Guild invitation cannot be used
      </h1>
      <p className="mt-3 leading-7 text-[var(--text-secondary)]">
        The link may be invalid, expired, revoked, regenerated, or
        already consumed.
      </p>
    </Surface>
  );
}

export default async function GuildInvitePage({
  params,
  searchParams,
}: InvitePageProps) {
  const { generation: generationValue, token } = await params;
  const query = await searchParams;
  const generation = Number(generationValue);

  const invite = Number.isSafeInteger(generation)
    ? await resolveGuildInviteLink(token, generation)
    : null;

  const viewer = invite ? await getAuthViewer() : null;
  const errorValue = Array.isArray(query.error)
    ? query.error[0]
    : query.error;

  const errorMessage =
    errorValue === "already-member"
      ? "You already have a membership in this Guild. Invitations cannot upgrade or reactivate an existing membership."
      : errorValue === "unavailable"
        ? "This invitation is no longer available."
        : null;

  const roleLabel = invite
    ? `${invite.role.charAt(0).toUpperCase()}${invite.role.slice(1)}`
    : "";

  const nextPath = invite
    ? buildInvitePath(invite.generation, token)
    : "/";

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        {invite ? (
          <Surface className="w-full p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone="accent">Guild invitation</StatusChip>
              {invite.inviteKind === "elevated" ? (
                <StatusChip tone="warning">Elevated access</StatusChip>
              ) : null}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
              Join {invite.guildName}
            </h1>

            <p className="mt-3 leading-7 text-[var(--text-secondary)]">
              This invitation grants the{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {roleLabel}
              </span>{" "}
              Guild role.
            </p>

            <p className="mt-2 text-sm text-[var(--text-tertiary)]">
              Expires {new Date(invite.expiresAt).toLocaleString()}.
            </p>

            {errorMessage ? (
              <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--danger)]/40 bg-[var(--surface-2)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-7">
              {viewer ? (
                <>
                  <p className="mb-3 text-sm text-[var(--text-secondary)]">
                    Signed in as{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {viewer.displayName}
                    </span>
                  </p>

                  <form action={acceptGuildInviteAction}>
                    <input type="hidden" name="token" value={token} />
                    <input
                      type="hidden"
                      name="generation"
                      value={invite.generation}
                    />
                    <Button type="submit" size="lg">
                      Accept invitation
                    </Button>
                  </form>
                </>
              ) : (
                <form action={signInWithDiscord}>
                  <input type="hidden" name="next" value={nextPath} />
                  <Button type="submit" size="lg">
                    Sign in with Discord to continue
                  </Button>
                </form>
              )}
            </div>

            <p className="mt-7 text-xs leading-5 text-[var(--text-tertiary)]">
              Only accept Guild invitations you expected to receive.
            </p>
          </Surface>
        ) : (
          <InviteUnavailable />
        )}
      </div>
    </main>
  );
}
