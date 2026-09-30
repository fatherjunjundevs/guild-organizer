export type GuildRole = "owner" | "admin" | "officer" | "member";

export function isGuildRole(value: string): value is GuildRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "officer" ||
    value === "member"
  );
}

export function getGuildDestination(
  guildId: string,
  role: GuildRole,
) {
  if (role === "member") {
    return `/member/guild/${guildId}/home`;
  }

  return `/app/guild/${guildId}/dashboard`;
}
