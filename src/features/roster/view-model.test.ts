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
  },
];

const baseOptions = {
  query: "",
  status: "all" as const,
  className: "all",
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

  it("searches across IGN, class, position, and organizer role", () => {
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

  it("builds unique alphabetized class options", () => {
    expect(getRosterClassOptions(rows)).toEqual([
      "Creator",
      "High Priest",
      "Lord Knight",
      "Sniper",
    ]);
  });
});
