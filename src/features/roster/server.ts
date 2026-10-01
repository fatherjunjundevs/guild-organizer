import "server-only";

import type { GuildAccess } from "@/features/guilds/server";
import { createClient } from "@/lib/supabase/server";

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
};

export type MasterRosterLoadResult =
  | {
      status: "ready";
      characters: MasterRosterCharacter[];
    }
  | {
      status: "forbidden";
      characters: [];
    }
  | {
      status: "error";
      characters: [];
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
    };
  }

  if (authorization === "error") {
    return {
      status: "error",
      characters: [],
    };
  }

  const supabase = await createClient();
  const [charactersResult, profilesResult] = await Promise.all([
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
  ]);

  if (charactersResult.error || profilesResult.error) {
    return {
      status: "error",
      characters: [],
    };
  }

  const profiles = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.character_id,
      profile,
    ]),
  );

  return {
    status: "ready",
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
      };
    }),
  };
}
