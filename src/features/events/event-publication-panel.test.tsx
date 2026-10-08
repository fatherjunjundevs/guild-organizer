import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installTestDialogs, publicationEvent, publicationState } from "@/test/publication-fixtures";
const actions = vi.hoisted(() => ({ publish: vi.fn(), update: vi.fn(), unpublish: vi.fn(), refresh: vi.fn() }));
vi.mock("./publication-actions", () => ({ publishEventAction: actions.publish, updateEventPublicationAction: actions.update,
  unpublishEventAction: actions.unpublish, refreshEventPublicationAction: actions.refresh }));
vi.mock("./event-publication-history", () => ({ PublicationHistoryDialog: () => null }));
import { EventPublicationPanel } from "./event-publication-panel";

beforeEach(() => { installTestDialogs(); vi.resetAllMocks(); });
afterEach(cleanup);
function mount(published = true) {
  render(<EventPublicationPanel guildId="guild" event={publicationEvent} characters={[]} initialPublication={published ? publicationState : {
    ...publicationState, lifecycle: "draft", currentVersionId: null, currentVersionNumber: null, latestVersionNumber: null,
  }} initialHistoryCount={2} canPublish={true} assignmentBusy={false} warningReport={{ warnings: [], partyStatuses: [],
    summary: { total: 0, duplicates: 0, missingRoles: 0, roleConflicts: 0, inactiveAssignments: 0 } }} onFeedback={vi.fn()} />);
}

describe("publication mutation read recovery", () => {
  it.each(["publish", "update", "unpublish"] as const)("hides obsolete state after confirmed %s when refresh fails, and retries only the read", async (mode) => {
    actions[mode].mockResolvedValue({ ok: true, message: "Saved", publication: null, historyCount: null });
    actions.refresh.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
      publication: { ...publicationState, lifecycle: "unpublished", currentVersionId: null, currentVersionNumber: null }, historyCount: 2,
    });
    mount(mode !== "publish");
    if (mode === "unpublish") {
      fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
      fireEvent.click(screen.getByRole("button", { name: "Unpublish now" }));
    } else {
      fireEvent.click(screen.getByRole("button", { name: mode === "publish" ? "Preview & publish" : "Preview update" }));
      fireEvent.click(screen.getByRole("button", { name: mode === "publish" ? "Publish v1" : "Publish update as v3" }));
    }
    expect(await screen.findByText("Publication status unavailable")).toBeVisible();
    expect(screen.queryByText("Published v2")).not.toBeInTheDocument();
    expect(screen.queryByText("Next immutable version")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("change was saved");
    fireEvent.click(screen.getByRole("button", { name: "Reload publication status" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("still unavailable"));
    expect(screen.getByRole("button", { name: "Reload publication status" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Reload publication status" }));
    await screen.findByRole("button", { name: "Preview & republish" });
    expect(actions[mode]).toHaveBeenCalledTimes(1); expect(actions.refresh).toHaveBeenCalledTimes(2);
  });

  it("cleans up rejected mutation requests and requires read recovery for an unknown outcome", async () => {
    actions.update.mockRejectedValue(new Error("connection lost")); mount();
    fireEvent.click(screen.getByRole("button", { name: "Preview update" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish update as v3" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("outcome is unknown");
    expect(screen.getByRole("button", { name: "Reload publication status" })).toBeEnabled();
    expect(actions.update).toHaveBeenCalledTimes(1);
  });
});
