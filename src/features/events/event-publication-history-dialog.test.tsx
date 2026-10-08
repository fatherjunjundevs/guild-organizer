import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { historyPage, installTestDialogs, publicationSnapshot } from "@/test/publication-fixtures";
const { history, snapshot } = vi.hoisted(() => ({ history: vi.fn(), snapshot: vi.fn() }));
vi.mock("./publication-actions", () => ({ loadEventPublicationHistoryAction: history, loadEventPublicationVersionAction: snapshot }));
import { PublicationHistoryDialog } from "./event-publication-history";

beforeEach(() => {
  installTestDialogs(); vi.resetAllMocks();
  history.mockResolvedValue({ ok: true, page: historyPage });
  snapshot.mockResolvedValue({ ok: true, snapshot: publicationSnapshot(1) });
});
afterEach(cleanup);
function mount() { render(<PublicationHistoryDialog guildId="guild" eventId="event" historyCount={2} disabled={false} />); }
async function open() {
  fireEvent.click(screen.getByRole("button", { name: "History (2)" }));
  await screen.findByRole("button", { name: "View v1 snapshot" });
}

describe("publication history request lifecycle", () => {
  it("does not fetch or render history while closed; loads stored inactive status and announces completion", async () => {
    mount(); expect(history).not.toHaveBeenCalled();
    expect(screen.queryByText("Siege")).not.toBeInTheDocument();
    await open();
    fireEvent.click(screen.getByRole("button", { name: "View v1 snapshot" }));
    expect(await screen.findByText("Inactive")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Loaded immutable version 1 snapshot.");
    fireEvent.click(screen.getByRole("button", { name: "Close history" }));
    expect(screen.queryByText("Sealed Character")).not.toBeInTheDocument();
  });

  it("recovers from rejected history and snapshot requests without disabling Close or retry", async () => {
    history.mockRejectedValueOnce(new Error("offline")); mount();
    fireEvent.click(screen.getByRole("button", { name: "History (2)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("history could not be loaded");
    expect(screen.getByRole("button", { name: "Close history" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    await screen.findByRole("button", { name: "View v1 snapshot" });
    snapshot.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "View v1 snapshot" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("snapshot could not be loaded");
    expect(screen.getByRole("button", { name: "View v1 snapshot" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(await screen.findByText("Sealed Character")).toBeVisible();
  });

  it.each(["close", "escape"])("ignores an old snapshot after %s and reopen, preserving the new pending request", async (method) => {
    let resolveOld!: (result: unknown) => void;
    let resolveNew!: (result: unknown) => void;
    snapshot.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve; }));
    mount(); await open();
    fireEvent.click(screen.getByRole("button", { name: "View v1 snapshot" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading immutable");
    expect(screen.getByRole("button", { name: "Close history" })).toBeEnabled();
    if (method === "close") fireEvent.click(screen.getByRole("button", { name: "Close history" }));
    else {
      const dialog = screen.getByRole("dialog");
      fireEvent(dialog, new Event("cancel", { cancelable: true }));
      (dialog as HTMLDialogElement).close();
    }
    await open();
    fireEvent.click(screen.getByRole("button", { name: "View v2 snapshot" }));
    await act(async () => { resolveOld({ ok: true, snapshot: publicationSnapshot(1) }); });
    expect(screen.queryByText("Sealed Character")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
    await act(async () => { resolveNew({ ok: true, snapshot: publicationSnapshot(2) }); });
    expect(screen.getByRole("status")).toHaveTextContent("Loaded immutable version 2");
  });

  it("uses bounded page cursors in both directions", async () => {
    history.mockResolvedValueOnce({ ok: true, page: { ...historyPage, maxVersionNumber: 12, totalVersions: 12, nextBeforeVersion: 3 } })
      .mockResolvedValueOnce({ ok: true, page: historyPage });
    mount(); await open();
    fireEvent.click(screen.getByRole("button", { name: "Older versions" }));
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    const data = history.mock.calls[1][0] as FormData;
    expect(data.get("beforeVersion")).toBe("3"); expect(data.get("maxVersion")).toBe("12");
    await waitFor(() => expect(screen.getByRole("button", { name: "Newer versions" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Newer versions" }));
    await waitFor(() => expect(history).toHaveBeenCalledTimes(3));
    expect((history.mock.calls[2][0] as FormData).get("beforeVersion")).toBeNull();
  });
});
