import type { EventBuilderEvent } from "@/features/events/event-assignment";
import type { EventPublicationHistoryPage, EventPublicationState, EventPublicationVersionSnapshot, EventPublicationVersionSummary } from "@/features/events/event-publication";

export const publicationState: EventPublicationState = {
  lifecycle: "published", currentVersionId: "v2", currentVersionNumber: 2,
  latestVersionNumber: 2, publishedAt: "2026-10-08T12:00:00Z", unpublishedAt: null,
};
export function publicationVersion(versionNumber: number): EventPublicationVersionSummary {
  return { id: `v${versionNumber}`, versionNumber, eventName: "Siege", eventTypeName: "League",
    templateName: "Template", usesAreas: false, createdAt: "2026-10-08T12:00:00Z",
    sealedAt: "2026-10-08T12:00:00Z", slotCount: 1, assignmentCount: 1, isCurrent: versionNumber === 2 };
}
export const historyPage: EventPublicationHistoryPage = {
  versions: [publicationVersion(2), publicationVersion(1)], totalVersions: 2, maxVersionNumber: 2, nextBeforeVersion: null,
};
export function publicationSnapshot(versionNumber: number): EventPublicationVersionSnapshot {
  return {
    version: publicationVersion(versionNumber), description: "Sealed description",
    structure: { areas: [], rootSections: [{ id: "team", name: "Team", sortOrder: 0,
      parties: [{ id: "party", name: "Party", sortOrder: 0, slots: [{ id: "slot", name: "Seat", roleLabel: null, sortOrder: 0 }] }] }],
      totals: { areas: 0, sections: 1, parties: 1, slots: 1 } },
    characters: [{ id: "character", ign: "Sealed Character", level: null, className: "Knight", guildPosition: null,
      gearScore: null, onlineStatus: null, designation: "main", roleLabel: "Tank", status: "inactive", assignedSlotIds: ["slot"] }],
  };
}
export const publicationEvent: EventBuilderEvent = {
  id: "event", name: "Siege", description: "Draft description", status: "active", eventTypeName: "League", templateName: "Template",
  usesAreas: false, createdAt: "2026-10-08T12:00:00Z", updatedAt: "2026-10-08T12:00:00Z",
  structure: publicationSnapshot(2).structure, characters: [],
};

export function installTestDialogs() {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
