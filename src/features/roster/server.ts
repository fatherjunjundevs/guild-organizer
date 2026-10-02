import "server-only";

import type { GuildAccess } from "@/features/guilds/server";
import type {
  RosterCustomFieldType,
  RosterCustomFieldValue,
} from "@/features/roster/custom-fields";
import { createClient } from "@/lib/supabase/server";

export type MasterRosterTag = {
  id: string;
  name: string;
};

export type MasterRosterCustomField = {
  id: string;
  name: string;
  fieldType: RosterCustomFieldType;
  selectOptions: string[];
};

export type MasterRosterCharacter = {
  id: string;
  ign: string;
  level: number | null;
  className: string | null;
  title: string | null;
  gender: string | null;
  guildPosition: string | null;
  gearScore: number | null;
  weeklyActivity: number | null;
  weeklyContribution: number | null;
  totalContribution: number | null;
  onlineStatus: string | null;
  status: string;
  inactiveReason: string | null;
  leftGuildAt: string | null;
  sourceOrigin: string;
  designation: string | null;
  roleLabel: string | null;
  tags: MasterRosterTag[];
  customFieldValues?: Record<string, RosterCustomFieldValue>;
};

export type MasterRosterLoadResult =
  | {
      status: "ready";
      characters: MasterRosterCharacter[];
      tags: MasterRosterTag[];
      customFields: MasterRosterCustomField[];
    }
  | {
      status: "forbidden";
      characters: [];
      tags: [];
      customFields: [];
    }
  | {
      status: "error";
      characters: [];
      tags: [];
      customFields: [];
    };

async function canManageRoster(
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
    .eq("capability_key", "roster.manage")
    .maybeSingle();

  if (error) {
    return "error";
  }

  return data ? "allowed" : "forbidden";
}

export async function loadMasterRoster(
  access: GuildAccess,
): Promise<MasterRosterLoadResult> {
  const authorization = await canManageRoster(access);

  if (authorization === "forbidden") {
    return {
      status: "forbidden",
      characters: [],
      tags: [],
      customFields: [],
    };
  }

  if (authorization === "error") {
    return {
      status: "error",
      characters: [],
      tags: [],
      customFields: [],
    };
  }

  const supabase = await createClient();
  const [
    charactersResult,
    profilesResult,
    tagsResult,
    assignmentsResult,
    customFieldsResult,
    customValuesResult,
  ] = await Promise.all([
    supabase
      .from("characters")
      .select(
        "id,ign,level,class_name,title,gender,guild_position,gear_score,weekly_activity,weekly_contribution,total_contribution,online_status,status,inactive_reason,left_guild_at,source_origin",
      )
      .eq("guild_id", access.guildId)
      .order("ign", { ascending: true }),
    supabase
      .from("character_roster_profiles")
      .select("character_id,designation,role_label")
      .eq("guild_id", access.guildId),
    supabase
      .from("roster_tags")
      .select("id,name")
      .eq("guild_id", access.guildId)
      .order("name", { ascending: true }),
    supabase
      .from("character_roster_tags")
      .select("character_id,tag_id")
      .eq("guild_id", access.guildId),
    supabase
      .from("roster_custom_fields")
      .select("id,name,field_type,select_options")
      .eq("guild_id", access.guildId)
      .order("created_at", { ascending: true }),
    supabase
      .from("character_roster_custom_field_values")
      .select("character_id,field_id,value")
      .eq("guild_id", access.guildId),
  ]);

  if (
    charactersResult.error ||
    profilesResult.error ||
    tagsResult.error ||
    assignmentsResult.error ||
    customFieldsResult.error ||
    customValuesResult.error
  ) {
    return {
      status: "error",
      characters: [],
      tags: [],
      customFields: [],
    };
  }

  const profiles = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.character_id,
      profile,
    ]),
  );

  const tags: MasterRosterTag[] = (tagsResult.data ?? []).map((tag) => ({
    id: tag.id,
    name: tag.name,
  }));

  const customFields: MasterRosterCustomField[] =
    (customFieldsResult.data ?? []).map((field) => ({
      id: field.id,
      name: field.name,
      fieldType: field.field_type as RosterCustomFieldType,
      selectOptions: field.select_options,
    }));

  const customFieldValuesByCharacter = new Map<
    string,
    Record<string, RosterCustomFieldValue>
  >();

  for (const customValue of customValuesResult.data ?? []) {
    if (
      typeof customValue.value !== "string" &&
      typeof customValue.value !== "number" &&
      typeof customValue.value !== "boolean"
    ) {
      continue;
    }

    const values =
      customFieldValuesByCharacter.get(customValue.character_id) ?? {};
    values[customValue.field_id] = customValue.value;
    customFieldValuesByCharacter.set(customValue.character_id, values);
  }

  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const tagsByCharacter = new Map<string, MasterRosterTag[]>();

  for (const assignment of assignmentsResult.data ?? []) {
    const tag = tagsById.get(assignment.tag_id);
    if (!tag) continue;

    const characterTags =
      tagsByCharacter.get(assignment.character_id) ?? [];
    characterTags.push(tag);
    tagsByCharacter.set(assignment.character_id, characterTags);
  }

  return {
    status: "ready",
    tags,
    customFields,
    characters: (charactersResult.data ?? []).map((character) => {
      const profile = profiles.get(character.id);

      return {
        id: character.id,
        ign: character.ign,
        level: character.level,
        className: character.class_name,
        title: character.title,
        gender: character.gender,
        guildPosition: character.guild_position,
        gearScore: character.gear_score,
        weeklyActivity: character.weekly_activity,
        weeklyContribution: character.weekly_contribution,
        totalContribution: character.total_contribution,
        onlineStatus: character.online_status,
        status: character.status,
        inactiveReason: character.inactive_reason,
        leftGuildAt: character.left_guild_at,
        sourceOrigin: character.source_origin,
        designation: profile?.designation ?? null,
        roleLabel: profile?.role_label ?? null,
        tags: tagsByCharacter.get(character.id) ?? [],
        customFieldValues:
          customFieldValuesByCharacter.get(character.id) ?? {},
      };
    }),
  };
}
