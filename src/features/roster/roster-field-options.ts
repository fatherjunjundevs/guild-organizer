export const RTNW_CLASS_OPTIONS = [
  "Alithea",
  "Assassin Cross",
  "Champion",
  "Clown",
  "Creator",
  "Gypsy",
  "High Priest",
  "High Wizard",
  "Lord Knight",
  "Night Watch",
  "Paladin",
  "Sniper",
  "Whitesmith",
] as const;

export const GUILD_POSITION_OPTIONS = [
  "Emperor",
  "Chancellor",
  "Commander",
  "Duchess",
  "Warmaster",
  "Raid Leader",
  "Elite",
  "Member",
] as const;

export const GENDER_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
] as const;

export const ONLINE_STATUS_OPTIONS = [
  { value: "[Online]", label: "Online" },
  { value: "[Offline]", label: "Offline" },
] as const;

export const ORGANIZER_ROLE_OPTIONS = [
  "Healer",
  "Tank",
  "Melee DPS",
  "Ranged DPS",
  "Support",
] as const;
