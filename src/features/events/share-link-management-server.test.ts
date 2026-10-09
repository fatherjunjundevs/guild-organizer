import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { readEventShareLinkManagementState } from "./share-link-management-server";
const scope = { guildId: "11111111-1111-4111-8111-111111111111", eventId: "22222222-2222-4222-8222-222222222222" };
const active = { state: "active", link_id: "33333333-3333-4333-8333-333333333333", created_at: "2026-10-09T12:00:00+00:00", available: true };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc });
  mocks.user.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [active], error: null });
});
describe("management-state wire validation", () => {
  it.each(["absent", "revoked"])("distinguishes %s and returns only safe fields", async (state) => {
    mocks.rpc.mockResolvedValue({ data: [{ state, link_id: null, created_at: null, available: false }], error: null });
    expect(await readEventShareLinkManagementState(scope)).toEqual({ ok: true, operation: "state", state: { state, linkId: null, createdAt: null, available: false } });
  });
  it.each([true, false])("reads active availability %s with exact Guild/Event scope", async (available) => {
    mocks.rpc.mockResolvedValue({ data: [{ ...active, available }], error: null });
    expect(await readEventShareLinkManagementState(scope)).toMatchObject({ ok: true, state: { state: "active", available, linkId: active.link_id } });
    expect(mocks.user).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("get_event_share_link_management_state", { p_guild_id: scope.guildId, p_event_id: scope.eventId });
  });
  it.each([
    [], [active, active], [{ ...active, state: "unknown" }], [{ ...active, available: "true" }],
    [{ ...active, link_id: null }], [{ ...active, link_id: "invalid" }], [{ ...active, created_at: null }],
    [{ ...active, created_at: "not a date" }], [{ ...active, token_digest: "secret" }],
    [{ state: "absent", link_id: null, created_at: null, available: true }],
    [{ ...active, state: "revoked" }], [{ state: "revoked", link_id: null, created_at: "2026-10-09T12:00:00Z", available: false }],
  ].map((data) => ({ data })))("rejects malformed or excessive wire projection %#", async ({ data }) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await readEventShareLinkManagementState(scope)).toMatchObject({ ok: false, code: "read_failed" });
  });
  it("rejects untrusted additional inputs before authentication", async () => {
    expect(await readEventShareLinkManagementState({ ...scope, actor: "supplied" } as typeof scope)).toMatchObject({ ok: false, code: "invalid" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated access without issuing the RPC", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    expect(await readEventShareLinkManagementState(scope)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["42501", "P0002", "55000", ""])("sanitizes database denial/error %s", async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "PRIVATE_CREDENTIAL_DETAILS" } });
    const result = await readEventShareLinkManagementState(scope);
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("sanitizes thrown requests and never returns old state", async () => {
    mocks.rpc.mockRejectedValue(new Error("PRIVATE_URL"));
    const result = await readEventShareLinkManagementState(scope);
    expect(result).toMatchObject({ ok: false, recovery: "read_state" });
    expect(result).not.toHaveProperty("state");
  });
});
