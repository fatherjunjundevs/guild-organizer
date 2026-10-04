import "server-only";

import type { GuildAccess } from "@/features/guilds/server";
import { createClient } from "@/lib/supabase/server";

export type EventTypeSummary = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  templateCount: number;
  liveTemplateCount: number;
};

export type EventTemplateSummary = {
  id: string;
  eventTypeId: string;
  eventTypeName: string;
  eventTypeStatus: "active" | "archived";
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  usesAreas: boolean;
  createdAt: string;
  updatedAt: string;
  areaCount: number;
  sectionCount: number;
  partyCount: number;
  slotCount: number;
};

export type TemplateManagementLoadResult =
  | {
      status: "ready";
      eventTypes: EventTypeSummary[];
      templates: EventTemplateSummary[];
    }
  | {
      status: "forbidden" | "error";
      eventTypes: [];
      templates: [];
    };

async function canManageTemplates(
  access: GuildAccess,
): Promise<"allowed" | "forbidden" | "error"> {
  if (access.role === "owner" || access.role === "admin") {
    return "allowed";
  }

  if (access.role !== "officer") {
    return "forbidden";
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guild_officer_capabilities")
    .select("capability_key")
    .eq("guild_id", access.guildId)
    .eq("membership_id", access.membershipId)
    .eq("capability_key", "templates.manage")
    .maybeSingle();

  if (error) {
    return "error";
  }

  return data ? "allowed" : "forbidden";
}

function countByTemplate(rows: { template_id: string }[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.template_id, (counts.get(row.template_id) ?? 0) + 1);
  }

  return counts;
}

export async function loadTemplateManagement(
  access: GuildAccess,
): Promise<TemplateManagementLoadResult> {
  const authorization = await canManageTemplates(access);

  if (authorization !== "allowed") {
    return {
      status: authorization,
      eventTypes: [],
      templates: [],
    };
  }

  const supabase = await createClient();
  const [
    eventTypesResult,
    templatesResult,
    areasResult,
    sectionsResult,
    partiesResult,
    slotsResult,
  ] = await Promise.all([
    supabase
      .from("event_types")
      .select("id,name,description,status,created_at,updated_at")
      .eq("guild_id", access.guildId)
      .order("status", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("event_templates")
      .select(
        "id,event_type_id,name,description,status,uses_areas,created_at,updated_at",
      )
      .eq("guild_id", access.guildId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("event_template_areas")
      .select("template_id")
      .eq("guild_id", access.guildId),
    supabase
      .from("event_template_sections")
      .select("template_id")
      .eq("guild_id", access.guildId),
    supabase
      .from("event_template_parties")
      .select("template_id")
      .eq("guild_id", access.guildId),
    supabase
      .from("event_template_slots")
      .select("template_id")
      .eq("guild_id", access.guildId),
  ]);

  if (
    eventTypesResult.error ||
    templatesResult.error ||
    areasResult.error ||
    sectionsResult.error ||
    partiesResult.error ||
    slotsResult.error
  ) {
    return {
      status: "error",
      eventTypes: [],
      templates: [],
    };
  }

  const rawEventTypes = eventTypesResult.data ?? [];
  const rawTemplates = templatesResult.data ?? [];
  const eventTypesById = new Map(
    rawEventTypes.map((eventType) => [eventType.id, eventType]),
  );

  const areaCounts = countByTemplate(areasResult.data ?? []);
  const sectionCounts = countByTemplate(sectionsResult.data ?? []);
  const partyCounts = countByTemplate(partiesResult.data ?? []);
  const slotCounts = countByTemplate(slotsResult.data ?? []);

  const templateCounts = new Map<string, number>();
  const liveTemplateCounts = new Map<string, number>();

  for (const template of rawTemplates) {
    templateCounts.set(
      template.event_type_id,
      (templateCounts.get(template.event_type_id) ?? 0) + 1,
    );

    if (template.status !== "archived") {
      liveTemplateCounts.set(
        template.event_type_id,
        (liveTemplateCounts.get(template.event_type_id) ?? 0) + 1,
      );
    }
  }

  const eventTypes: EventTypeSummary[] = rawEventTypes.map(
    (eventType) => ({
      id: eventType.id,
      name: eventType.name,
      description: eventType.description,
      status: eventType.status as "active" | "archived",
      createdAt: eventType.created_at,
      updatedAt: eventType.updated_at,
      templateCount: templateCounts.get(eventType.id) ?? 0,
      liveTemplateCount: liveTemplateCounts.get(eventType.id) ?? 0,
    }),
  );

  const templates: EventTemplateSummary[] = rawTemplates.flatMap(
    (template) => {
      const eventType = eventTypesById.get(template.event_type_id);

      if (!eventType) {
        return [];
      }

      return [
        {
          id: template.id,
          eventTypeId: template.event_type_id,
          eventTypeName: eventType.name,
          eventTypeStatus: eventType.status as "active" | "archived",
          name: template.name,
          description: template.description,
          status: template.status as "draft" | "active" | "archived",
          usesAreas: template.uses_areas,
          createdAt: template.created_at,
          updatedAt: template.updated_at,
          areaCount: areaCounts.get(template.id) ?? 0,
          sectionCount: sectionCounts.get(template.id) ?? 0,
          partyCount: partyCounts.get(template.id) ?? 0,
          slotCount: slotCounts.get(template.id) ?? 0,
        },
      ];
    },
  );

  return {
    status: "ready",
    eventTypes,
    templates,
  };
}
