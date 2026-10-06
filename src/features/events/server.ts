import "server-only";

import type { GuildAccess } from "@/features/guilds/server";
import { createClient } from "@/lib/supabase/server";

export type EventTemplateOption = {
  id: string;
  eventTypeId: string;
  eventTypeName: string;
  name: string;
  description: string | null;
  usesAreas: boolean;
  slotCount: number;
  updatedAt: string;
};

export type EventSummary = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  eventTypeName: string;
  templateName: string;
  sourceTemplateId: string;
  usesAreas: boolean;
  createdAt: string;
  updatedAt: string;
  areaCount: number;
  sectionCount: number;
  partyCount: number;
  slotCount: number;
};

export type EventManagementLoadResult =
  | {
      status: "ready";
      events: EventSummary[];
      activeTemplates: EventTemplateOption[];
    }
  | {
      status: "forbidden" | "error";
      events: [];
      activeTemplates: [];
    };

async function canManageEvents(
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
    .eq("capability_key", "events.manage")
    .maybeSingle();

  if (error) return "error";
  return data ? "allowed" : "forbidden";
}

function countByEvent(rows: { event_id: string }[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
  }

  return counts;
}

function countByTemplate(rows: { template_id: string }[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.template_id, (counts.get(row.template_id) ?? 0) + 1);
  }

  return counts;
}

export async function loadEventManagement(
  access: GuildAccess,
): Promise<EventManagementLoadResult> {
  const authorization = await canManageEvents(access);

  if (authorization !== "allowed") {
    return {
      status: authorization,
      events: [],
      activeTemplates: [],
    };
  }

  const supabase = await createClient();
  const [
    eventsResult,
    areasResult,
    sectionsResult,
    partiesResult,
    slotsResult,
    templatesResult,
    eventTypesResult,
    templateSlotsResult,
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id,name,description,status,event_type_name_snapshot,template_name_snapshot,source_template_id,uses_areas,created_at,updated_at",
      )
      .eq("guild_id", access.guildId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("event_areas")
      .select("event_id")
      .eq("guild_id", access.guildId),
    supabase
      .from("event_sections")
      .select("event_id")
      .eq("guild_id", access.guildId),
    supabase
      .from("event_parties")
      .select("event_id")
      .eq("guild_id", access.guildId),
    supabase
      .from("event_slots")
      .select("event_id")
      .eq("guild_id", access.guildId),
    supabase
      .from("event_templates")
      .select(
        "id,event_type_id,name,description,status,uses_areas,updated_at",
      )
      .eq("guild_id", access.guildId)
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("event_types")
      .select("id,name,status")
      .eq("guild_id", access.guildId),
    supabase
      .from("event_template_slots")
      .select("template_id")
      .eq("guild_id", access.guildId),
  ]);

  if (
    eventsResult.error ||
    areasResult.error ||
    sectionsResult.error ||
    partiesResult.error ||
    slotsResult.error ||
    templatesResult.error ||
    eventTypesResult.error ||
    templateSlotsResult.error
  ) {
    return { status: "error", events: [], activeTemplates: [] };
  }

  const areaCounts = countByEvent(areasResult.data ?? []);
  const sectionCounts = countByEvent(sectionsResult.data ?? []);
  const partyCounts = countByEvent(partiesResult.data ?? []);
  const slotCounts = countByEvent(slotsResult.data ?? []);
  const templateSlotCounts = countByTemplate(templateSlotsResult.data ?? []);

  const eventTypesById = new Map(
    (eventTypesResult.data ?? []).map((eventType) => [
      eventType.id,
      eventType,
    ]),
  );

  const events: EventSummary[] = (eventsResult.data ?? []).map((event) => ({
    id: event.id,
    name: event.name,
    description: event.description,
    status: event.status as "active" | "archived",
    eventTypeName: event.event_type_name_snapshot,
    templateName: event.template_name_snapshot,
    sourceTemplateId: event.source_template_id,
    usesAreas: event.uses_areas,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    areaCount: areaCounts.get(event.id) ?? 0,
    sectionCount: sectionCounts.get(event.id) ?? 0,
    partyCount: partyCounts.get(event.id) ?? 0,
    slotCount: slotCounts.get(event.id) ?? 0,
  }));

  const activeTemplates: EventTemplateOption[] = (
    templatesResult.data ?? []
  ).flatMap((template) => {
    const eventType = eventTypesById.get(template.event_type_id);

    if (!eventType || eventType.status !== "active") {
      return [];
    }

    return [
      {
        id: template.id,
        eventTypeId: template.event_type_id,
        eventTypeName: eventType.name,
        name: template.name,
        description: template.description,
        usesAreas: template.uses_areas,
        slotCount: templateSlotCounts.get(template.id) ?? 0,
        updatedAt: template.updated_at,
      },
    ];
  });

  return { status: "ready", events, activeTemplates };
}
