import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

export default function GuildRosterLoading() {
  return (
    <div
      className="px-5 py-8 sm:px-8 lg:px-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto max-w-[90rem]">
        <StatusChip tone="neutral">Loading roster</StatusChip>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
          Guild Roster
        </h1>
        <Surface level={2} className="mt-6 max-w-2xl p-5">
          <p className="font-semibold">Loading Master Roster</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Loading characters, organizer metadata, and roster history.
          </p>
        </Surface>
      </div>
    </div>
  );
}
