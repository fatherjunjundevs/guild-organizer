import "server-only";

import { getAuthenticatedUserId } from "@/features/auth/server";
import {
  getGuildDestination,
  isGuildRole,
  type GuildRole,
} from "@/features/guilds/routing";
import { createClient } from "@/lib/supabase/server";

export type GuildMembershipSummary = {
  membershipId: string;
  guildId: string;
  guildName: string;
  role: GuildRole;
  destination: string;
};

export type GuildAccess = GuildMembershipSummary & {
  status: "active";
};

export async function getGuildMembershipSummaries(): Promise<
  GuildMembershipSummary[]
> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return [];
  }

  const supabase = await createClient();
  const { data: memberships, error: membershipError } =
    await supabase
      .from("guild_memberships")
      .select("id,guild_id,role,status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });

  if (membershipError || !memberships?.length) {
    return [];
  }

  const guildIds = memberships.map((membership) => membership.guild_id);
  const { data: guilds, error: guildError } = await supabase
    .from("guilds")
    .select("id,name,status")
    .in("id", guildIds)
    .eq("status", "active");

  if (guildError || !guilds) {
    return [];
  }

  const guildNames = new Map(
    guilds.map((guild) => [guild.id, guild.name]),
  );

  return memberships.flatMap((membership) => {
    const guildName = guildNames.get(membership.guild_id);

    if (!guildName || !isGuildRole(membership.role)) {
      return [];
    }

    return [
      {
        membershipId: membership.id,
        guildId: membership.guild_id,
        guildName,
        role: membership.role,
        destination: getGuildDestination(
          membership.guild_id,
          membership.role,
        ),
      },
    ];
  });
}

export async function getGuildAccess(
  guildId: string,
): Promise<GuildAccess | null> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return null;
  }

  const supabase = await createClient();
  const { data: membership, error: membershipError } =
    await supabase
      .from("guild_memberships")
      .select("id,guild_id,role,status")
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

  if (
    membershipError ||
    !membership ||
    !isGuildRole(membership.role)
  ) {
    return null;
  }

  const { data: guild, error: guildError } = await supabase
    .from("guilds")
    .select("id,name,status")
    .eq("id", guildId)
    .eq("status", "active")
    .maybeSingle();

  if (guildError || !guild) {
    return null;
  }

  return {
    membershipId: membership.id,
    guildId: guild.id,
    guildName: guild.name,
    role: membership.role,
    status: "active",
    destination: getGuildDestination(guild.id, membership.role),
  };
}
