import { describe, expect, it } from "vitest";
import type { MasterRosterCharacter } from "@/features/roster/server";
import {
  filterAndSortRoster,
  getRosterClassOptions,
  getRosterSummary,
} from "@/features/roster/view-model";

const rows: MasterRosterCharacter[] = [
  {
    id: "1",
    ign: "焱｜FatherJunJun",
    level: 82,
    className: "High Priest",
    title: "Pathfinder I",
    gender: "M",
    guildPosition: "Elite",
    gearScore: 55000,
    weeklyActivity: 700,
    weeklyContribution: 2200,
    totalContribution: 15000,
    onlineStatus: "[Online]",
    status: "active",
    inactiveReason: null,
    leftGuildAt: null,
    sourceOrigin: "rtnw_export",
    designation: "main",
    roleLabel: "Healer",
    tags: [
      { id: "tag-raid", name: "Raid Team" },
      { id: "tag-siege", name: "Siege" },
    ],
  },
  {
    id: "2",
    ign: "ArcherMain",
    level: 81,
    className: "Sniper",
    title: null,
    gender: "F",
    guildPosition: "Member",
    gearScore: 61000,
    weeklyActivity: 650,
    weeklyContribution: 2100,
    totalContribution: 17000,
    onlineStatus: "Offline for 1 hr",
    status: "active",
    inactiveReason: null,
    leftGuildAt: null,
    sourceOrigin: "rtnw_export",
    designation: null,
    roleLabel: "Ranged DPS",
    tags: [{ id: "tag-siege", name: "Siege" }],
  },
  {
    id: "3",
    ign: "OldTank",
    level: 80,
    className: "Lord Knight",
    title: null,
    gender: "M",
    guildPosition: "Member",
    gearScore: 58000,
    weeklyActivity: 500,
    weeklyContribution: 1800,
    totalContribution: 13000,
    onlineStatus: "Offline for 2 d",
    status: "inactive",
    inactiveReason: "left_guild",
    leftGuildAt: "2026-10-01T12:00:00Z",
    sourceOrigin: "rtnw_export",
    designation: null,
    roleLabel: "Tank",
    tags: [],
  },
  {
    id: "4",
    ign: "ReserveCreator",
    level: 79,
    className: "Creator",
    title: null,
    gender: "F",
    guildPosition: "Member",
    gearScore: null,
    weeklyActivity: null,
    weeklyContribution: null,
    totalContribution: null,
    onlineStatus: null,
    status: "inactive",
    inactiveReason: "manual",
    leftGuildAt: null,
    sourceOrigin: "manual",
    designation: "sub",
    roleLabel: "Support",
    tags: [{ id: "tag-reserve", name: "Reserve" }],
  },
];

const baseOptions = {
  query: "",
  status: "all" as const,
  className: "all",
  tagId: "all",
  sort: "gear-desc" as const,
};

describe("roster view model", () => {
  it("summarizes active, left, and manually inactive characters", () => {
    expect(getRosterSummary(rows)).toEqual({
      total: 4,
      active: 2,
      left: 1,
      inactive: 1,
    });
  });

  it("searches across IGN, class, position, organizer role, and tags", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        query: "healer",
      }).map((row) => row.id),
    ).toEqual(["1"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        query: "sniper",
      }).map((row) => row.id),
    ).toEqual(["2"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        query: "reserve",
      }).map((row) => row.id),
    ).toEqual(["4"]);
  });

  it("filters by organizer tag", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        tagId: "tag-siege",
      }).map((row) => row.id),
    ).toEqual(["2", "1"]);
  });

  it("filters the active roster", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        status: "active",
      }).map((row) => row.id),
    ).toEqual(["2", "1"]);
  });

  it("separates left-guild history from manually inactive characters", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        status: "left",
      }).map((row) => row.id),
    ).toEqual(["3"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        status: "inactive",
      }).map((row) => row.id),
    ).toEqual(["4"]);
  });

  it("filters by exact class selection", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        className: "High Priest",
      }).map((row) => row.id),
    ).toEqual(["1"]);
  });

  it("sorts numeric values descending with missing values last", () => {
    expect(
      filterAndSortRoster(rows, baseOptions).map((row) => row.id),
    ).toEqual(["2", "3", "1", "4"]);
  });

  it("sorts weekly contribution high and low with missing values last", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        sort: "weekly-contribution-desc",
      }).map((row) => row.id),
    ).toEqual(["1", "2", "3", "4"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        sort: "weekly-contribution-asc",
      }).map((row) => row.id),
    ).toEqual(["3", "2", "1", "4"]);
  });

  it("sorts total contribution high and low with missing values last", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        sort: "total-contribution-desc",
      }).map((row) => row.id),
    ).toEqual(["2", "1", "3", "4"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        sort: "total-contribution-asc",
      }).map((row) => row.id),
    ).toEqual(["3", "1", "2", "4"]);
  });

  it("sorts Guild positions by hierarchy before Gear Score", () => {
    const hierarchyRows: MasterRosterCharacter[] = [
      {
        ...rows[0],
        id: "emperor",
        ign: "Mastering",
        guildPosition: "Emperor",
        gearScore: 51031,
      },
      {
        ...rows[0],
        id: "elite",
        ign: "EliteHighGear",
        guildPosition: "Elite",
        gearScore: 99999,
      },
      {
        ...rows[0],
        id: "raid-low",
        ign: "RaidLeaderLowGear",
        guildPosition: "Raid Leader",
        gearScore: 42000,
      },
      {
        ...rows[0],
        id: "raid-high",
        ign: "RaidLeaderHighGear",
        guildPosition: "Raid Leader",
        gearScore: 47000,
      },
      {
        ...rows[0],
        id: "unknown",
        ign: "UnknownRank",
        guildPosition: "Special Rank",
        gearScore: 120000,
      },
    ];

    expect(
      filterAndSortRoster(hierarchyRows, {
        ...baseOptions,
        sort: "position-hierarchy",
      }).map((row) => row.id),
    ).toEqual([
      "emperor",
      "raid-high",
      "raid-low",
      "elite",
      "unknown",
    ]);
  });

  it("builds unique alphabetized class options", () => {
    expect(getRosterClassOptions(rows)).toEqual([
      "Creator",
      "High Priest",
      "Lord Knight",
      "Sniper",
    ]);
  });
});
