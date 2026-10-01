export type GuildRole = "owner" | "admin" | "officer" | "member";

export function isGuildRole(value: string): value is GuildRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "officer" ||
    value === "member"
  );
}

export function isManagementGuildRole(role: GuildRole) {
  return role === "owner" || role === "admin" || role === "officer";
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

export function getGuildExperienceLabel(role: GuildRole) {
  return isManagementGuildRole(role) ? "Manage" : "Member view";
}
