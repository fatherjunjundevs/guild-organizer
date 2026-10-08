import { describe, expect, it } from "vitest";
import {
  getEventPublicationUi,
  getNextEventPublicationVersion,
  type EventPublicationState,
} from "@/features/events/event-publication";

function state(
  overrides: Partial<EventPublicationState> = {},
): EventPublicationState {
  return {
    lifecycle: "draft",
    currentVersionId: null,
    currentVersionNumber: null,
    latestVersionNumber: null,
    publishedAt: null,
    unpublishedAt: null,
    ...overrides,
  };
}

describe("Event publication UI state", () => {
  it("starts a never-published Event at immutable version 1", () => {
    const publication = state();

    expect(getNextEventPublicationVersion(publication)).toBe(1);
    expect(getEventPublicationUi(publication)).toMatchObject({
      statusLabel: "Draft only",
      previewButtonLabel: "Preview & publish",
      confirmButtonLabel: "Publish v1",
      nextVersionNumber: 1,
    });
  });

  it("keeps the current published version distinct from the next draft publication", () => {
    const publication = state({
      lifecycle: "published",
      currentVersionId: "version-2",
      currentVersionNumber: 2,
      latestVersionNumber: 2,
      publishedAt: "2026-10-08T12:00:00.000Z",
    });

    expect(getEventPublicationUi(publication)).toMatchObject({
      statusLabel: "Published v2",
      previewButtonLabel: "Preview update",
      confirmButtonLabel: "Publish update as v3",
      nextVersionNumber: 3,
    });
  });

  it("republishes after an unpublish as a new version instead of reusing history", () => {
    const publication = state({
      lifecycle: "unpublished",
      latestVersionNumber: 4,
      unpublishedAt: "2026-10-08T13:00:00.000Z",
    });

    expect(getEventPublicationUi(publication)).toMatchObject({
      statusLabel: "Unpublished · last v4",
      previewButtonLabel: "Preview & republish",
      confirmButtonLabel: "Republish as v5",
      nextVersionNumber: 5,
    });
  });

  it("uses the latest immutable history number when calculating the next version", () => {
    const publication = state({
      lifecycle: "unpublished",
      latestVersionNumber: 11,
    });

    expect(getNextEventPublicationVersion(publication)).toBe(12);
  });
});
