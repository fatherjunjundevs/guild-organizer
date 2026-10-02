import { redirect } from "next/navigation";
import { AddCharacterDialog } from "@/features/roster/add-character-dialog";
import { getGuildAccess } from "@/features/guilds/server";
import { RosterTagManagerDialog } from "@/features/roster/roster-tag-manager-dialog";
import { RtnwImportDialog } from "@/features/roster/rtnw-import-dialog";
import { RosterView } from "@/features/roster/roster-view";
import { loadMasterRoster } from "@/features/roster/server";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

export default async function GuildRosterPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const access = await getGuildAccess(guildId);

  if (!access || access.role === "member") {
    redirect("/app");
  }

  const roster = await loadMasterRoster(access);

  if (roster.status === "forbidden") {
    return (
      <div className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <StatusChip tone="warning">Roster restricted</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Master Roster
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">Roster access is not enabled</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Your Officer account needs the roster.manage capability
              before it can view or maintain this Guild&apos;s Master
              Roster.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  if (roster.status === "error") {
    return (
      <div className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <StatusChip tone="danger">Roster unavailable</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Master Roster
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">
              The roster could not be loaded
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Refresh the page and try again. No roster data was changed.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[90rem]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <StatusChip tone="accent">Master Roster</StatusChip>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
              Guild Roster
            </h1>
            <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
              One permanent character database for {access.guildName}.
              Current RTNW data and historical Guild departures stay
              separate from organizer-maintained roles and tags.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <RosterTagManagerDialog
              guildId={access.guildId}
              tags={roster.tags}
            />
            <AddCharacterDialog guildId={access.guildId} />
            <RtnwImportDialog guildId={access.guildId} />
          </div>
        </div>

        {roster.characters.length === 0 ? (
          <Surface level={2} className="mt-8 p-8">
            <p className="text-lg font-semibold">
              Your Master Roster is ready
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Import the official RTNW Guild CSV for the current game
              roster, or add a character manually. Future RTNW exports
              will match manual entries by exact IGN.
            </p>
          </Surface>
        ) : (
          <RosterView
            guildId={access.guildId}
            characters={roster.characters}
            tags={roster.tags}
          />
        )}
      </div>
    </div>
  );
}
