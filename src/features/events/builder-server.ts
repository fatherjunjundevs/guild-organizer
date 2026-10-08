import "server-only";

import type { GuildAccess } from "@/features/guilds/server";
import { buildEventBuilderStructure } from "@/features/events/event-builder";
import type {
  EventBuilderCharacter,
  EventBuilderEvent,
} from "@/features/events/event-assignment";
import type {
  EventPublicationState,
} from "@/features/events/event-publication";
import {
  canPublishEvent,
  loadEventPublicationState,
} from "@/features/events/publication-server";
import { createClient } from "@/lib/supabase/server";

export type EventBuilderLoadResult =
  | {
      status: "ready";
      event: EventBuilderEvent;
      publication: EventPublicationState;
      publicationHistoryCount: number;
      canPublish: boolean;
    }
  | {
      status: "forbidden" | "not-found" | "error";
      event: null;
      publication: null;
      publicationHistoryCount: 0;
      canPublish: false;
    };

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
    return {
      status: authorization,
      event: null,
      publication: null,
      publicationHistoryCount: 0,
      canPublish: false,
    };
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
    return {
      status: "error",
      event: null,
      publication: null,
      publicationHistoryCount: 0,
      canPublish: false,
    };
  }

  if (!eventResult.data) {
    return {
      status: "not-found",
      event: null,
      publication: null,
      publicationHistoryCount: 0,
      canPublish: false,
    };
  }

  const [
    areasResult,
    sectionsResult,
    partiesResult,
    slotsResult,
    charactersResult,
    publicationResult,
    publishAuthorization,
  ] = await Promise.all([
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
    supabase.rpc("get_event_builder_characters", {
      p_event_id: eventId,
    }),
    loadEventPublicationState(access.guildId, eventId),
    canPublishEvent(access),
  ]);

  if (
    areasResult.error ||
    sectionsResult.error ||
    partiesResult.error ||
    slotsResult.error ||
    charactersResult.error ||
    publicationResult.status === "error" ||
    publishAuthorization === "error"
  ) {
    return {
      status: "error",
      event: null,
      publication: null,
      publicationHistoryCount: 0,
      canPublish: false,
    };
  }

  const source = eventResult.data;
  const structure = buildEventBuilderStructure({
    usesAreas: source.uses_areas,
    areas: areasResult.data ?? [],
    sections: sectionsResult.data ?? [],
    parties: partiesResult.data ?? [],
    slots: slotsResult.data ?? [],
  });

  const characters: EventBuilderCharacter[] = (
    charactersResult.data ?? []
  ).map((character) => ({
    id: character.character_id,
    ign: character.ign,
    level: character.level,
    className: character.class_name,
    guildPosition: character.guild_position,
    gearScore: character.gear_score,
    onlineStatus: character.online_status,
    designation: character.designation,
    roleLabel: character.role_label,
    status: character.character_status as "active" | "inactive",
    assignedSlotIds: character.assigned_slot_ids ?? [],
  }));

  return {
    status: "ready",
    publication: publicationResult.publication,
    publicationHistoryCount: publicationResult.historyCount,
    canPublish: publishAuthorization === "allowed",
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
      characters,
    },
  };
}
