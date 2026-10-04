import { redirect } from "next/navigation";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import { getGuildAccess } from "@/features/guilds/server";
import { loadTemplateManagement } from "@/features/templates/server";
import { TemplateManagementView } from "@/features/templates/template-management-view";

export default async function GuildTemplatesPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const access = await getGuildAccess(guildId);

  if (!access || access.role === "member") {
    redirect("/app");
  }

  const management = await loadTemplateManagement(access);

  if (management.status === "forbidden") {
    return (
      <div className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <StatusChip tone="warning">Templates restricted</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Event Templates
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">
              Template management is not enabled
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Your Officer account needs the templates.manage capability
              before it can create or maintain this Guild&apos;s reusable
              Event Types and Templates.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  if (management.status === "error") {
    return (
      <div className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <StatusChip tone="danger">Templates unavailable</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Event Templates
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">
              Template management could not be loaded
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Refresh the page and try again. No Template data was
              changed.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <TemplateManagementView
      guildId={access.guildId}
      guildName={access.guildName}
      eventTypes={management.eventTypes}
      templates={management.templates}
    />
  );
}
