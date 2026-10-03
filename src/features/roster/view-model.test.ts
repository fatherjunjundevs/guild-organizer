import { describe, expect, it } from "vitest";
import type {
  MasterRosterCharacter,
  MasterRosterCustomField,
} from "@/features/roster/server";
import {
  filterAndSortRoster,
  getRosterClassOptions,
  getRosterSummary,
  paginateRoster,
} from "@/features/roster/view-model";

const customFields: MasterRosterCustomField[] = [
  {
    id: "field-discord",
    name: "Discord Name",
    fieldType: "text",
    selectOptions: [],
  },
  {
    id: "field-team",
    name: "Event Team",
    fieldType: "select",
    selectOptions: ["Main Team", "Reserve"],
  },
  {
    id: "field-available",
    name: "Available",
    fieldType: "boolean",
    selectOptions: [],
  },
  {
    id: "field-priority",
    name: "Priority",
    fieldType: "number",
    selectOptions: [],
  },
];

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
    customFieldValues: {
      "field-discord": "jmc-priest#777",
      "field-team": "Main Team",
      "field-available": true,
      "field-priority": 7.5,
    },
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
    customFieldValues: {
      "field-team": "Reserve",
      "field-available": false,
      "field-priority": 2,
    },
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
    customFieldValues: {},
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
    customFieldValues: {
      "field-discord": "crafter-alt#55",
    },
  },
];

const baseOptions = {
  query: "",
  status: "all" as const,
  className: "all",
  tagId: "all",
  customFields,
  customFieldId: "all",
  customFieldValue: "",
  sort: "gear-desc" as const,
};

describe("roster view model", () => {
  it("paginates large result sets and clamps invalid page indexes", () => {
    const values = Array.from({ length: 450 }, (_, index) => index + 1);

    expect(paginateRoster(values, 0)).toMatchObject({
      pageIndex: 0,
      pageCount: 3,
      startIndex: 0,
      endIndex: 200,
    });
    expect(paginateRoster(values, 0).rows).toHaveLength(200);

    expect(paginateRoster(values, 2)).toMatchObject({
      pageIndex: 2,
      pageCount: 3,
      startIndex: 400,
      endIndex: 450,
    });
    expect(paginateRoster(values, 2).rows).toHaveLength(50);

    expect(paginateRoster(values, 99).pageIndex).toBe(2);
    expect(paginateRoster(values, -5).pageIndex).toBe(0);
  });

  it("summarizes active, left, and manually inactive characters", () => {
    expect(getRosterSummary(rows)).toEqual({
      total: 4,
      active: 2,
      left: 1,
      inactive: 1,
      reconciled: 0,
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
    ).toEqual(["2", "4"]);
  });

  it("searches custom field names and values", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        query: "jmc-priest",
      }).map((row) => row.id),
    ).toEqual(["1"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        query: "event team",
      }).map((row) => row.id),
    ).toEqual(["2", "1"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        query: "yes",
      }).map((row) => row.id),
    ).toEqual(["1"]);
  });

  it("filters characters that have any value for a custom field", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        customFieldId: "field-discord",
        customFieldValue: "",
      }).map((row) => row.id),
    ).toEqual(["1", "4"]);
  });

  it("filters typed custom field values", () => {
    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        customFieldId: "field-discord",
        customFieldValue: "priest",
      }).map((row) => row.id),
    ).toEqual(["1"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        customFieldId: "field-team",
        customFieldValue: "Reserve",
      }).map((row) => row.id),
    ).toEqual(["2"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        customFieldId: "field-available",
        customFieldValue: "false",
      }).map((row) => row.id),
    ).toEqual(["2"]);

    expect(
      filterAndSortRoster(rows, {
        ...baseOptions,
        customFieldId: "field-priority",
        customFieldValue: "7.5",
      }).map((row) => row.id),
    ).toEqual(["1"]);
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

  it("separates reconciled historical identities from other inactive rows", () => {
    const reconciled: MasterRosterCharacter = {
      ...rows[2],
      id: "5",
      ign: "OldName",
      inactiveReason: "reconciled",
      leftGuildAt: null,
      reconciledIntoCharacterId: "1",
      reconciledIntoIgn: "焱｜FatherJunJun",
      reconciledAt: "2026-10-03T15:00:00Z",
    };
    const withReconciled = [...rows, reconciled];

    expect(getRosterSummary(withReconciled)).toEqual({
      total: 5,
      active: 2,
      left: 1,
      inactive: 1,
      reconciled: 1,
    });

    expect(
      filterAndSortRoster(withReconciled, {
        ...baseOptions,
        status: "reconciled",
      }).map((row) => row.id),
    ).toEqual(["5"]);

    expect(
      filterAndSortRoster(withReconciled, {
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
