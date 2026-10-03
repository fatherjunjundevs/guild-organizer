import "server-only";

import type { GuildAccess } from "@/features/guilds/server";
import type {
  RosterCustomFieldType,
  RosterCustomFieldValue,
} from "@/features/roster/custom-fields";
import type { RosterImportRunSummary } from "@/features/roster/import-history";
import type { CharacterReconciliationHistoryEntry } from "@/features/roster/character-reconciliation";
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
  reconciledIntoCharacterId?: string | null;
  reconciledIntoIgn?: string | null;
  reconciledAt?: string | null;
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

export type RosterImportHistoryLoadResult =
  | {
      status: "ready";
      runs: RosterImportRunSummary[];
    }
  | {
      status: "forbidden" | "error";
      runs: [];
    };

async function canViewRosterImportHistory(
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
    .in("capability_key", ["imports.manage", "audit.view"])
    .limit(1);

  if (error) {
    return "error";
  }

  return data && data.length > 0 ? "allowed" : "forbidden";
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
        "id,ign,level,class_name,title,gender,guild_position,gear_score,weekly_activity,weekly_contribution,total_contribution,online_status,status,inactive_reason,left_guild_at,source_origin,reconciled_into_character_id,reconciled_at",
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

  const characterRows = charactersResult.data ?? [];
  const characterIgnById = new Map(
    characterRows.map((character) => [character.id, character.ign]),
  );

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
    characters: characterRows.map((character) => {
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
        reconciledIntoCharacterId:
          character.reconciled_into_character_id,
        reconciledIntoIgn: character.reconciled_into_character_id
          ? characterIgnById.get(
              character.reconciled_into_character_id,
            ) ?? null
          : null,
        reconciledAt: character.reconciled_at,
        designation: profile?.designation ?? null,
        roleLabel: profile?.role_label ?? null,
        tags: tagsByCharacter.get(character.id) ?? [],
        customFieldValues:
          customFieldValuesByCharacter.get(character.id) ?? {},
      };
    }),
  };
}

export async function loadRosterImportHistory(
  access: GuildAccess,
): Promise<RosterImportHistoryLoadResult> {
  const authorization = await canViewRosterImportHistory(access);

  if (authorization !== "allowed") {
    return {
      status: authorization,
      runs: [],
    };
  }

  const supabase = await createClient();
  const { data: runs, error: runsError } = await supabase
    .from("roster_sync_runs")
    .select(
      "id,source_type,source_filename,source_row_count,created_count,updated_count,reactivated_count,left_guild_count,unchanged_count,imported_by,applied_at",
    )
    .eq("guild_id", access.guildId)
    .order("applied_at", { ascending: false })
    .limit(25);

  if (runsError) {
    return {
      status: "error",
      runs: [],
    };
  }

  const importedByIds = [
    ...new Set(
      (runs ?? [])
        .map((run) => run.imported_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const displayNames = new Map<string, string>();

  if (importedByIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", importedByIds);

    for (const profile of profiles ?? []) {
      if (profile.display_name) {
        displayNames.set(profile.id, profile.display_name);
      }
    }
  }

  return {
    status: "ready",
    runs: (runs ?? []).map((run) => ({
      id: run.id,
      sourceType: run.source_type,
      sourceFilename: run.source_filename,
      sourceRowCount: run.source_row_count,
      createdCount: run.created_count,
      updatedCount: run.updated_count,
      reactivatedCount: run.reactivated_count,
      leftGuildCount: run.left_guild_count,
      unchangedCount: run.unchanged_count,
      importedByName: run.imported_by
        ? displayNames.get(run.imported_by) ?? "Organizer"
        : null,
      appliedAt: run.applied_at,
    })),
  };
}

export type CharacterReconciliationHistoryLoadResult =
  | {
      status: "ready";
      entries: CharacterReconciliationHistoryEntry[];
    }
  | {
      status: "forbidden" | "error";
      entries: [];
    };

export async function loadCharacterReconciliationHistory(
  access: GuildAccess,
): Promise<CharacterReconciliationHistoryLoadResult> {
  const authorization = await canManageRoster(access);

  if (authorization !== "allowed") {
    return {
      status: authorization,
      entries: [],
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_reconciliations")
    .select(
      "id,source_character_id,target_character_id,source_ign_snapshot,target_ign_snapshot,note,reconciled_at",
    )
    .eq("guild_id", access.guildId)
    .order("reconciled_at", { ascending: false })
    .limit(20);

  if (error) {
    return {
      status: "error",
      entries: [],
    };
  }

  return {
    status: "ready",
    entries: (data ?? []).map((entry) => ({
      id: entry.id,
      sourceCharacterId: entry.source_character_id,
      targetCharacterId: entry.target_character_id,
      sourceIgn: entry.source_ign_snapshot,
      targetIgn: entry.target_ign_snapshot,
      note: entry.note,
      reconciledAt: entry.reconciled_at,
    })),
  };
}
