export type EventPublicationLifecycle =
  | "draft"
  | "published"
  | "unpublished";

export type EventPublicationState = {
  lifecycle: EventPublicationLifecycle;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  latestVersionNumber: number | null;
  publishedAt: string | null;
  unpublishedAt: string | null;
};

export type EventPublicationUi = {
  statusLabel: string;
  detail: string;
  previewButtonLabel: string;
  confirmButtonLabel: string;
  nextVersionNumber: number;
};

export function getNextEventPublicationVersion(
  publication: EventPublicationState,
) {
  return (publication.latestVersionNumber ?? 0) + 1;
}

export function getEventPublicationUi(
  publication: EventPublicationState,
): EventPublicationUi {
  const nextVersionNumber =
    getNextEventPublicationVersion(publication);

  if (publication.lifecycle === "published") {
    const current = publication.currentVersionNumber;

    return {
      statusLabel: current ? `Published v${current}` : "Published",
      detail: current
        ? `Members currently see immutable version ${current}. Draft edits stay private until you publish an update.`
        : "Members currently see an immutable published version. Draft edits stay private until you publish an update.",
      previewButtonLabel: "Preview update",
      confirmButtonLabel: `Publish update as v${nextVersionNumber}`,
      nextVersionNumber,
    };
  }

  if (publication.lifecycle === "unpublished") {
    const latest = publication.latestVersionNumber;

    return {
      statusLabel: latest ? `Unpublished · last v${latest}` : "Unpublished",
      detail: latest
        ? `No version is currently member-visible. Immutable version ${latest} remains in publication history.`
        : "No version is currently member-visible.",
      previewButtonLabel: "Preview & republish",
      confirmButtonLabel: `Republish as v${nextVersionNumber}`,
      nextVersionNumber,
    };
  }

  return {
    statusLabel: "Draft only",
    detail:
      "No member-facing version exists yet. Preview the current draft before creating the first immutable publication.",
    previewButtonLabel: "Preview & publish",
    confirmButtonLabel: `Publish v${nextVersionNumber}`,
    nextVersionNumber,
  };
}
