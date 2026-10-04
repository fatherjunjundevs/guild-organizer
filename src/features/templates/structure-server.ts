import "server-only";

import type { GuildAccess } from "@/features/guilds/server";
import {
  buildTemplateStructureTree,
  type TemplateAreaRow,
  type TemplatePartyRow,
  type TemplateSectionRow,
  type TemplateSlotRow,
  type TemplateStructureTree,
} from "@/features/templates/template-structure";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TemplateStructureSummary = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  usesAreas: boolean;
  eventTypeId: string;
  eventTypeName: string;
  eventTypeStatus: "active" | "archived";
  updatedAt: string;
  tree: TemplateStructureTree;
  areaCount: number;
  sectionCount: number;
  partyCount: number;
  slotCount: number;
};

export type TemplateStructureLoadResult =
  | {
      status: "ready";
      template: TemplateStructureSummary;
    }
  | {
      status: "forbidden" | "not-found" | "error";
      template: null;
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

export async function loadTemplateStructure(
  access: GuildAccess,
  templateId: string,
): Promise<TemplateStructureLoadResult> {
  if (!UUID_PATTERN.test(templateId)) {
    return { status: "not-found", template: null };
  }

  const authorization = await canManageTemplates(access);

  if (authorization !== "allowed") {
    return {
      status: authorization,
      template: null,
    };
  }

  const supabase = await createClient();
  const { data: template, error: templateError } = await supabase
    .from("event_templates")
    .select(
      "id,event_type_id,name,description,status,uses_areas,updated_at",
    )
    .eq("guild_id", access.guildId)
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) {
    return { status: "error", template: null };
  }

  if (!template) {
    return { status: "not-found", template: null };
  }

  const [
    eventTypeResult,
    areasResult,
    sectionsResult,
    partiesResult,
    slotsResult,
  ] = await Promise.all([
    supabase
      .from("event_types")
      .select("id,name,status")
      .eq("guild_id", access.guildId)
      .eq("id", template.event_type_id)
      .maybeSingle(),
    supabase
      .from("event_template_areas")
      .select("id,name,sort_order")
      .eq("guild_id", access.guildId)
      .eq("template_id", templateId),
    supabase
      .from("event_template_sections")
      .select("id,area_id,name,sort_order")
      .eq("guild_id", access.guildId)
      .eq("template_id", templateId),
    supabase
      .from("event_template_parties")
      .select("id,section_id,name,sort_order")
      .eq("guild_id", access.guildId)
      .eq("template_id", templateId),
    supabase
      .from("event_template_slots")
      .select("id,party_id,name,role_label,sort_order")
      .eq("guild_id", access.guildId)
      .eq("template_id", templateId),
  ]);

  if (
    eventTypeResult.error ||
    areasResult.error ||
    sectionsResult.error ||
    partiesResult.error ||
    slotsResult.error ||
    !eventTypeResult.data
  ) {
    return { status: "error", template: null };
  }

  const areas: TemplateAreaRow[] = (areasResult.data ?? []).map(
    (area) => ({
      id: area.id,
      name: area.name,
      sortOrder: area.sort_order,
    }),
  );

  const sections: TemplateSectionRow[] = (
    sectionsResult.data ?? []
  ).map((section) => ({
    id: section.id,
    areaId: section.area_id,
    name: section.name,
    sortOrder: section.sort_order,
  }));

  const parties: TemplatePartyRow[] = (partiesResult.data ?? []).map(
    (party) => ({
      id: party.id,
      sectionId: party.section_id,
      name: party.name,
      sortOrder: party.sort_order,
    }),
  );

  const slots: TemplateSlotRow[] = (slotsResult.data ?? []).map(
    (slot) => ({
      id: slot.id,
      partyId: slot.party_id,
      name: slot.name,
      roleLabel: slot.role_label,
      sortOrder: slot.sort_order,
    }),
  );

  return {
    status: "ready",
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      status: template.status as "draft" | "active" | "archived",
      usesAreas: template.uses_areas,
      eventTypeId: template.event_type_id,
      eventTypeName: eventTypeResult.data.name,
      eventTypeStatus: eventTypeResult.data.status as
        | "active"
        | "archived",
      updatedAt: template.updated_at,
      tree: buildTemplateStructureTree(
        areas,
        sections,
        parties,
        slots,
      ),
      areaCount: areas.length,
      sectionCount: sections.length,
      partyCount: parties.length,
      slotCount: slots.length,
    },
  };
}
