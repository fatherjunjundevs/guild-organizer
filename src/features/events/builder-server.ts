import "server-only";

import type { GuildAccess } from "@/features/guilds/server";
import {
  buildEventBuilderStructure,
  type EventBuilderStructure,
} from "@/features/events/event-builder";
import { createClient } from "@/lib/supabase/server";

export type EventBuilderEvent = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  eventTypeName: string;
  templateName: string;
  usesAreas: boolean;
  createdAt: string;
  updatedAt: string;
  structure: EventBuilderStructure;
};

export type EventBuilderLoadResult =
  | { status: "ready"; event: EventBuilderEvent }
  | { status: "forbidden" | "not-found" | "error"; event: null };

async function canManageEventBuilder(
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

export async function loadEventBuilder(
  access: GuildAccess,
  eventId: string,
): Promise<EventBuilderLoadResult> {
  const authorization = await canManageEventBuilder(access);

  if (authorization !== "allowed") {
    return { status: authorization, event: null };
  }

  const supabase = await createClient();
  const eventResult = await supabase
    .from("events")
    .select(
      "id,name,description,status,event_type_name_snapshot,template_name_snapshot,uses_areas,created_at,updated_at",
    )
    .eq("guild_id", access.guildId)
    .eq("id", eventId)
    .maybeSingle();

  if (eventResult.error) {
    return { status: "error", event: null };
  }

  if (!eventResult.data) {
    return { status: "not-found", event: null };
  }

  const [areasResult, sectionsResult, partiesResult, slotsResult] =
    await Promise.all([
      supabase
        .from("event_areas")
        .select("id,name,sort_order")
        .eq("guild_id", access.guildId)
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("event_sections")
        .select("id,area_id,name,sort_order")
        .eq("guild_id", access.guildId)
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("event_parties")
        .select("id,section_id,name,sort_order")
        .eq("guild_id", access.guildId)
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("event_slots")
        .select("id,party_id,name,role_label,sort_order")
        .eq("guild_id", access.guildId)
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
    ]);

  if (
    areasResult.error ||
    sectionsResult.error ||
    partiesResult.error ||
    slotsResult.error
  ) {
    return { status: "error", event: null };
  }

  const source = eventResult.data;
  const structure = buildEventBuilderStructure({
    usesAreas: source.uses_areas,
    areas: areasResult.data ?? [],
    sections: sectionsResult.data ?? [],
    parties: partiesResult.data ?? [],
    slots: slotsResult.data ?? [],
  });

  return {
    status: "ready",
    event: {
      id: source.id,
      name: source.name,
      description: source.description,
      status: source.status as "active" | "archived",
      eventTypeName: source.event_type_name_snapshot,
      templateName: source.template_name_snapshot,
      usesAreas: source.uses_areas,
      createdAt: source.created_at,
      updatedAt: source.updated_at,
      structure,
    },
  };
}
