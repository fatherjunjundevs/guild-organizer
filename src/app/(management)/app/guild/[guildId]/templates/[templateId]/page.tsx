import { notFound, redirect } from "next/navigation";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import { getGuildAccess } from "@/features/guilds/server";
import { loadTemplateStructure } from "@/features/templates/structure-server";
import { TemplateStructureDesigner } from "@/features/templates/template-structure-designer";

export default async function TemplateStructurePage({
  params,
}: {
  params: Promise<{ guildId: string; templateId: string }>;
}) {
  const { guildId, templateId } = await params;
  const access = await getGuildAccess(guildId);

  if (!access || access.role === "member") {
    redirect("/app");
  }

  const result = await loadTemplateStructure(access, templateId);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "forbidden") {
    return (
      <div className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <StatusChip tone="warning">Templates restricted</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Team Board
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">
              Team design is not enabled
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Your Officer account needs the templates.manage capability
              before it can edit reusable Event Team layouts.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  if (result.status === "error" || !result.template) {
    return (
      <div className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <StatusChip tone="danger">Team Board unavailable</StatusChip>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
            Team Board
          </h1>
          <Surface level={2} className="mt-6 max-w-2xl p-5">
            <p className="font-semibold">
              The Template Team Board could not be loaded
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Refresh and try again. No Template data was changed.
            </p>
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <TemplateStructureDesigner
      guildId={access.guildId}
      guildName={access.guildName}
      template={result.template}
    />
  );
}
