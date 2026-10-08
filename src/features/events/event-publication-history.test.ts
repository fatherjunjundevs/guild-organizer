import { describe, expect, it } from "vitest";
import {
  getEventPublicationVersionStatusLabel,
  sortEventPublicationHistory,
  type EventPublicationVersionSummary,
} from "@/features/events/event-publication";

function version(
  versionNumber: number,
  isCurrent = false,
): EventPublicationVersionSummary {
  return {
    id: `version-${versionNumber}`,
    versionNumber,
    eventName: "Siege",
    eventTypeName: "Guild League",
    templateName: "Sunday Siege",
    usesAreas: false,
    createdAt: `2026-10-0${versionNumber}T12:00:00.000Z`,
    sealedAt: `2026-10-0${versionNumber}T12:00:01.000Z`,
    slotCount: 40,
    assignmentCount: versionNumber * 5,
    isCurrent,
  };
}

describe("Event publication history", () => {
  it("sorts immutable versions newest first without mutating the input", () => {
    const input = [version(1), version(3, true), version(2)];
    const sorted = sortEventPublicationHistory(input);

    expect(sorted.map((item) => item.versionNumber)).toEqual([3, 2, 1]);
    expect(input.map((item) => item.versionNumber)).toEqual([1, 3, 2]);
  });

  it("labels only the live version as the current member version", () => {
    expect(getEventPublicationVersionStatusLabel(version(4, true))).toBe(
      "Current member version",
    );
    expect(getEventPublicationVersionStatusLabel(version(3))).toBe(
      "Historical",
    );
  });

  it("keeps historical summaries self-contained for organizer review", () => {
    const historical = version(2);

    expect(historical).toMatchObject({
      versionNumber: 2,
      eventName: "Siege",
      templateName: "Sunday Siege",
      slotCount: 40,
      assignmentCount: 10,
      isCurrent: false,
    });
  });
});
