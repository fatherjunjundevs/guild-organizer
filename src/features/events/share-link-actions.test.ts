import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn(), create: vi.fn(), copy: vi.fn(), rotate: vi.fn(), revoke: vi.fn() }));
vi.mock("./share-link-management-server", () => ({ readEventShareLinkManagementState: mocks.read }));
vi.mock("./share-link-server", () => ({ createEventShareLink: mocks.create, copyEventShareLink: mocks.copy, rotateEventShareLink: mocks.rotate, revokeEventShareLink: mocks.revoke }));
import { copyEventShareLinkAction, createEventShareLinkAction, readEventShareLinkAction, revokeEventShareLinkAction, rotateEventShareLinkAction } from "./share-link-actions";
import { isShareLinkInterfaceEnabled } from "./share-link-feature";
const input = { guildId: "guild", eventId: "event", linkId: "link" };
const operations = [readEventShareLinkAction, createEventShareLinkAction, copyEventShareLinkAction, rotateEventShareLinkAction, revokeEventShareLinkAction];
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_ENV", "local"); vi.stubEnv("SHARE_LINK_INTERFACE_ENABLED", "true"); });
afterEach(() => vi.unstubAllEnvs());
describe("sharing action feature boundary", () => {
  it.each([undefined, "false", "1", "TRUE"])("defaults closed for %s", (value) => {
    expect(isShareLinkInterfaceEnabled({ APP_ENV: "local", SHARE_LINK_INTERFACE_ENABLED: value })).toBe(false);
  });
  it.each(["production", "staging", undefined])("cannot enable unfinished sharing in %s", (APP_ENV) => {
    expect(isShareLinkInterfaceEnabled({ APP_ENV, SHARE_LINK_INTERFACE_ENABLED: "true" })).toBe(false);
  });
  it.each(operations)("gates each action before touching authenticated operations", async (action) => {
    vi.stubEnv("SHARE_LINK_INTERFACE_ENABLED", undefined);
    expect(await action(input)).toMatchObject({ ok: false, code: "configuration" });
    for (const fn of Object.values(mocks)) expect(fn).not.toHaveBeenCalled();
  });
  it("delegates explicit Copy only; reads never call recovery", async () => {
    mocks.read.mockResolvedValue({ ok: true, operation: "state", state: { state: "absent", linkId: null, createdAt: null, available: false } });
    await readEventShareLinkAction(input); expect(mocks.copy).not.toHaveBeenCalled();
    mocks.copy.mockResolvedValue({ ok: true, operation: "copy", linkId: "link", url: "http://localhost/share/event#token=v1.example" });
    expect(await copyEventShareLinkAction(input)).toHaveProperty("url"); expect(mocks.copy).toHaveBeenCalledWith(input);
  });
  it.each(["create", "rotate", "revoke"] as const)("%s refreshes using the explicit state contract", async (operation) => {
    mocks[operation].mockResolvedValue({ ok: true, operation, outcome: "confirmed", requestedLinkId: "new", state: { linkId: null }, refresh: "ready", message: "Confirmed" });
    mocks.read.mockResolvedValue({ ok: true, state: { state: "revoked", linkId: null, createdAt: null, available: false } });
    const action = operation === "create" ? createEventShareLinkAction : operation === "rotate" ? rotateEventShareLinkAction : revokeEventShareLinkAction;
    const result = await action(input);
    expect(result).toMatchObject({ ok: true, state: { state: "revoked" } });
    expect(mocks[operation]).toHaveBeenCalledOnce(); expect(mocks.copy).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/url|token|ciphertext|digest|mac/);
  });
  it.each(["required", "ready"])("confirmed write survives failed refresh (%s)", async (refresh) => {
    mocks.create.mockResolvedValue({ ok: true, operation: "create", outcome: "confirmed", requestedLinkId: "new", state: null, refresh, message: "Confirmed" });
    mocks.read.mockResolvedValue({ ok: false, operation: "state", code: "read_failed" });
    expect(await createEventShareLinkAction(input)).toMatchObject({ ok: true, outcome: "confirmed", state: null, refresh: "required" });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.read).toHaveBeenCalledTimes(refresh === "ready" ? 1 : 0);
  });
  it.each(["forbidden", "mutation_unknown", "configuration"])("preserves %s without retrying or reading automatically", async (code) => {
    const failure = { ok: false, operation: "rotate", code, recovery: "read_state", message: "Safe", requestedLinkId: "intended" };
    mocks.rotate.mockResolvedValue(failure);
    expect(await rotateEventShareLinkAction(input)).toEqual(failure);
    expect(mocks.rotate).toHaveBeenCalledOnce(); expect(mocks.read).not.toHaveBeenCalled();
  });
});
