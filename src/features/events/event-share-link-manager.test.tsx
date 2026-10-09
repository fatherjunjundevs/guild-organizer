import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installTestDialogs } from "@/test/publication-fixtures";
const actions = vi.hoisted(() => ({ read: vi.fn(), create: vi.fn(), copy: vi.fn(), rotate: vi.fn(), revoke: vi.fn() }));
vi.mock("./share-link-actions", () => ({ readEventShareLinkAction: actions.read, createEventShareLinkAction: actions.create,
  copyEventShareLinkAction: actions.copy, rotateEventShareLinkAction: actions.rotate, revokeEventShareLinkAction: actions.revoke }));
import { EventShareLinkManager } from "./event-share-link-manager";
const active = { state: "active", linkId: "link", createdAt: "2026-10-09T12:00:00Z", available: true };
const absent = { state: "absent", linkId: null, createdAt: null, available: false };
const revoked = { ...absent, state: "revoked" };
const url = "http://127.0.0.1:3000/share/event#token=v1.temporary";
let clipboard: ReturnType<typeof vi.fn>;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function button(name: string) { return screen.getByRole("button", { name }); }
function mount() { return render(<EventShareLinkManager guildId="guild" eventId="event" eventName="Siege" />); }
async function open() { fireEvent.click(button("Share Link")); await screen.findByText("Share-link status loaded."); }
beforeEach(() => {
  vi.resetAllMocks(); installTestDialogs(); clipboard = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: clipboard }, configurable: true });
  actions.read.mockResolvedValue({ ok: true, state: active });
  actions.copy.mockResolvedValue({ ok: true, operation: "copy", linkId: "link", url });
});
afterEach(cleanup);
describe("EventShareLinkManager", () => {
  it("loads only on demand and returns focus to its trigger", async () => {
    mount(); expect(actions.read).not.toHaveBeenCalled(); await open();
    expect(screen.getByText("Active · published")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(actions.copy).not.toHaveBeenCalled(); expect(button("Close")).toHaveFocus();
    fireEvent.click(button("Close")); expect(button("Share Link")).toHaveFocus();
  });
  it.each([
    [absent, "No link created"], [revoked, "Link revoked"], [{ ...active, available: false }, "Active · unavailable"],
  ])("distinguishes state %#", async (state, label) => {
    actions.read.mockResolvedValue({ ok: true, state }); mount(); await open();
    expect(screen.getByText(label as string)).toBeVisible();
    if ((state as typeof active).state !== "active") expect(button("Create Link")).toBeEnabled();
    else expect(button("Copy Link")).toBeEnabled();
  });
  it("creates once without recovering or displaying a bearer URL", async () => {
    actions.read.mockResolvedValue({ ok: true, state: absent });
    actions.create.mockResolvedValue({ ok: true, state: active }); mount(); await open();
    fireEvent.click(button("Create Link")); await screen.findByText("Link created.");
    expect(actions.create).toHaveBeenCalledOnce(); expect(actions.copy).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("#token");
  });
  it.each(["rotate", "revoke"] as const)("confirms and cancels %s without unnecessary mutations", async (mode) => {
    actions[mode].mockResolvedValue({ ok: true, state: mode === "revoke" ? revoked : { ...active, linkId: "new" } });
    mount(); await open(); fireEvent.click(button(mode === "rotate" ? "Rotate Link" : "Revoke Link"));
    expect(button("Cancel")).toHaveFocus(); expect(actions[mode]).not.toHaveBeenCalled();
    expect(screen.getByText(mode === "rotate" ? /Older Discord links/ : /does not unpublish/)).toBeVisible();
    fireEvent.click(button("Cancel")); expect(actions[mode]).not.toHaveBeenCalled();
    expect(button(mode === "rotate" ? "Rotate Link" : "Revoke Link")).toHaveFocus();
    fireEvent.click(button(mode === "rotate" ? "Rotate Link" : "Revoke Link"));
    fireEvent.click(button(mode === "rotate" ? "Rotate Link now" : "Revoke Link now"));
    await screen.findByText(mode === "rotate" ? "Link rotated. Older links are invalid." : "Link revoked.");
    expect(actions[mode]).toHaveBeenCalledOnce(); expect(actions[mode]).toHaveBeenCalledWith({ guildId: "guild", eventId: "event", linkId: "link" });
  });
  it("copies explicitly and never persists a successfully copied URL in the DOM", async () => {
    mount(); await open(); fireEvent.click(button("Copy Link"));
    await screen.findByText(/Development link copied/);
    expect(clipboard).toHaveBeenCalledWith(url); expect(actions.copy).toHaveBeenCalledOnce();
    expect(screen.queryByDisplayValue(url)).not.toBeInTheDocument();
  });
  it("offers labeled/selectable manual fallback and clears it on reload, close and identity change", async () => {
    clipboard.mockRejectedValue(new Error("sensitive clipboard error"));
    const view = mount(); await open(); fireEvent.click(button("Copy Link"));
    const field = await screen.findByLabelText("Temporary development link");
    expect(field).toHaveValue(url); expect(field).toHaveFocus(); expect(actions.rotate).not.toHaveBeenCalled();
    expect(screen.queryByText("sensitive clipboard error")).not.toBeInTheDocument();
    fireEvent.click(button("Reload Status")); await waitFor(() => expect(screen.queryByDisplayValue(url)).not.toBeInTheDocument());
    await screen.findByText("Share-link status loaded."); fireEvent.click(button("Copy Link")); await screen.findByDisplayValue(url);
    fireEvent.click(button("Close")); expect(screen.queryByDisplayValue(url)).not.toBeInTheDocument(); await open();
    expect(screen.queryByDisplayValue(url)).not.toBeInTheDocument();
    fireEvent.click(button("Copy Link")); await screen.findByDisplayValue(url);
    view.rerender(<EventShareLinkManager guildId="other" eventId="other" eventName="Other" />);
    expect(screen.queryByDisplayValue(url)).not.toBeInTheDocument();
  });
  it("supports manual copying without Clipboard API", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    mount(); await open(); fireEvent.click(button("Copy Link")); await screen.findByDisplayValue(url);
    expect(actions.rotate).not.toHaveBeenCalled();
  });
  it.each(["transport", "mutation_unknown", "confirmed-refresh-failed", "conflict", "mutation_failed", "read_failed", "forbidden", "unavailable"])("recovers %s through reads only, hiding obsolete state", async (mode) => {
    if (mode === "transport") actions.rotate.mockRejectedValue(new Error("sensitive transport error"));
    else if (mode === "confirmed-refresh-failed") actions.rotate.mockResolvedValue({ ok: true, state: null, outcome: "confirmed" });
    else actions.rotate.mockResolvedValue({ ok: false, code: mode, message: "Reload Status before continuing." });
    mount(); await open(); fireEvent.click(button("Rotate Link")); fireEvent.click(button("Rotate Link now"));
    await screen.findByRole("alert"); expect(screen.getByText("Status unknown")).toBeVisible();
    expect(screen.queryByText("Active · published")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rotate Link" })).not.toBeInTheDocument();
    expect(actions.rotate).toHaveBeenCalledOnce(); expect(actions.read).toHaveBeenCalledOnce();
    expect(screen.queryByText("sensitive transport error")).not.toBeInTheDocument();
    actions.read.mockResolvedValue({ ok: true, state: revoked }); fireEvent.click(button("Reload Status"));
    await screen.findByText("Link revoked"); expect(actions.rotate).toHaveBeenCalledOnce();
    expect(actions.read).toHaveBeenCalledTimes(2);
  });
  it("clears authoritative status after rejected reads", async () => {
    mount(); await open(); actions.read.mockRejectedValueOnce(new Error("sensitive"));
    fireEvent.click(button("Reload Status")); await screen.findByRole("alert");
    expect(screen.getByText("Status unknown")).toBeVisible();
    actions.read.mockResolvedValue({ ok: true, state: absent }); fireEvent.click(button("Reload Status")); await screen.findByText("No link created");
  });
  it.each([
    [absent, "No link created"], [revoked, "Link revoked"],
  ])("preserves verified %s state after Create configuration rejection without retrying", async (state, label) => {
    actions.read.mockResolvedValue({ ok: true, state });
    actions.create.mockResolvedValue({ ok: false, operation: "create", code: "configuration", recovery: "none", message: "Share-link server configuration is unavailable." });
    mount(); await open(); fireEvent.click(button("Create Link"));
    expect(await screen.findByRole("alert")).toHaveTextContent("configuration");
    expect(screen.getByText(label as string)).toBeVisible(); expect(button("Create Link")).toBeEnabled();
    expect(screen.queryByText("Status unknown")).not.toBeInTheDocument();
    expect(actions.create).toHaveBeenCalledOnce(); expect(actions.read).toHaveBeenCalledOnce();
    fireEvent.click(button("Reload Status")); await screen.findByText("Share-link status loaded.");
    expect(actions.read).toHaveBeenCalledTimes(2); expect(actions.create).toHaveBeenCalledOnce();
  });
  it.each(["invalid", "unauthenticated"])("preserves verified state for the pre-write %s rejection", async (code) => {
    actions.read.mockResolvedValue({ ok: true, state: absent });
    actions.create.mockResolvedValue({ ok: false, code, recovery: "none", message: "The operation was rejected before a write." });
    mount(); await open(); fireEvent.click(button("Create Link")); await screen.findByRole("alert");
    expect(screen.getByText("No link created")).toBeVisible();
    expect(actions.create).toHaveBeenCalledOnce(); expect(actions.read).toHaveBeenCalledOnce();
  });
  it.each(["transport", "mutation_unknown"])("does not assume Create failed after a %s outcome", async (mode) => {
    actions.read.mockResolvedValue({ ok: true, state: absent });
    if (mode === "transport") actions.create.mockRejectedValue(new Error("configuration response interrupted"));
    else actions.create.mockResolvedValue({ ok: false, code: "mutation_unknown", recovery: "read_state", message: "The change has an unknown outcome." });
    mount(); await open(); fireEvent.click(button("Create Link")); await screen.findByRole("alert");
    expect(screen.getByText("Status unknown")).toBeVisible();
    expect(screen.queryByText("No link created")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Link" })).not.toBeInTheDocument();
    expect(actions.create).toHaveBeenCalledOnce(); expect(actions.read).toHaveBeenCalledOnce();
    actions.read.mockResolvedValue({ ok: true, state: active }); fireEvent.click(button("Reload Status"));
    await screen.findByText("Active · published");
    expect(actions.create).toHaveBeenCalledOnce(); expect(actions.read).toHaveBeenCalledTimes(2);
  });
  it.each(["rotate", "revoke"] as const)("preserves active state after %s configuration rejection", async (mode) => {
    actions[mode].mockResolvedValue({ ok: false, code: "configuration", recovery: "none", message: "Share-link server configuration is unavailable." });
    mount(); await open(); fireEvent.click(button(mode === "rotate" ? "Rotate Link" : "Revoke Link"));
    fireEvent.click(button(mode === "rotate" ? "Rotate Link now" : "Revoke Link now")); await screen.findByRole("alert");
    expect(screen.getByText("Active · published")).toBeVisible();
    expect(actions[mode]).toHaveBeenCalledOnce(); expect(actions.read).toHaveBeenCalledOnce();
  });
  it("preserves unavailable active state after Copy configuration rejection without recovering a URL", async () => {
    actions.read.mockResolvedValue({ ok: true, state: { ...active, available: false } });
    actions.copy.mockResolvedValue({ ok: false, code: "configuration", recovery: "none", message: "Share-link server configuration is unavailable." });
    mount(); await open(); fireEvent.click(button("Copy Link")); await screen.findByRole("alert");
    expect(screen.getByText("Active · unavailable")).toBeVisible(); expect(button("Copy Link")).toBeEnabled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); expect(clipboard).not.toHaveBeenCalled();
    expect(actions.copy).toHaveBeenCalledOnce(); expect(actions.rotate).not.toHaveBeenCalled(); expect(actions.read).toHaveBeenCalledOnce();
  });
  it("ignores an old read after dismissal/reopen", async () => {
    const old = deferred<unknown>(); actions.read.mockReturnValueOnce(old.promise); mount(); fireEvent.click(button("Share Link"));
    fireEvent.click(button("Close")); actions.read.mockResolvedValue({ ok: true, state: revoked }); await open();
    await act(async () => old.resolve({ ok: true, state: active }));
    expect(screen.getByText("Link revoked")).toBeVisible();
  });
  it("never copies a late bearer response after dismissal or unmount", async () => {
    const late = deferred<unknown>(); actions.copy.mockReturnValue(late.promise); const view = mount(); await open();
    fireEvent.click(button("Copy Link")); fireEvent.click(button("Close")); await open(); view.unmount();
    await act(async () => late.resolve({ ok: true, linkId: "link", url })); expect(clipboard).not.toHaveBeenCalled();
  });
  it.each(["confirmed", "configuration"])("blocks new writes/reloads until a dismissed %s write settles, then requires a fresh read", async (outcome) => {
    const late = deferred<unknown>(); actions.rotate.mockReturnValue(late.promise); mount(); await open();
    fireEvent.click(button("Rotate Link")); fireEvent.click(button("Rotate Link now")); fireEvent.click(button("Close"));
    fireEvent.click(button("Share Link")); expect(button("Reload Status")).toBeDisabled();
    expect(actions.read).toHaveBeenCalledOnce();
    await act(async () => late.resolve(outcome === "confirmed" ? { ok: true, state: active }
      : { ok: false, code: "configuration", recovery: "none", message: "Configuration unavailable." }));
    expect(screen.getByText("Status unknown")).toBeVisible(); expect(button("Reload Status")).toBeEnabled();
    fireEvent.click(button("Reload Status")); await screen.findByText("Active · published"); expect(actions.rotate).toHaveBeenCalledOnce();
  });
  it.each(["Rotate Link", "Revoke Link"])("Escape restores focus to %s, then dismisses the manager without writing", async (origin) => {
    mount(); await open(); fireEvent.click(button(origin));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByText("Event share link")).toBeVisible(); expect(actions.revoke).not.toHaveBeenCalled();
    expect(button(origin)).toHaveFocus(); expect(actions.rotate).not.toHaveBeenCalled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(button("Share Link")).toHaveFocus(); expect(screen.queryByText("Event share link")).not.toBeInTheDocument();
  });
});
