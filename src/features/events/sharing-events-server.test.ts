import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), authorize: vi.fn(), client: vi.fn(), from: vi.fn(),
  select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), gt: vi.fn() }));
vi.mock("@/features/guilds/server", () => ({ getGuildAccess: mocks.access }));
vi.mock("./publication-server", () => ({ canPublishEvent: mocks.authorize }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { loadSharingEvents } from "./sharing-events-server";
const guildId = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12,"0")}`;
let response: { data: unknown; error: unknown };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("APP_ENV", "local"); vi.stubEnv("SHARE_LINK_INTERFACE_ENABLED", "true");
  mocks.access.mockResolvedValue({ guildId, role: "officer" }); mocks.authorize.mockResolvedValue("allowed");
  const query = { select: mocks.select, eq: mocks.eq, order: mocks.order, limit: mocks.limit, gt: mocks.gt,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve) };
  for (const name of ["from", "select", "eq", "order", "limit", "gt"] as const) mocks[name].mockReturnValue(query);
  mocks.client.mockResolvedValue({ from: mocks.from }); response = { data: [], error: null };
});
afterEach(() => vi.unstubAllEnvs());
describe("minimal sharing Event selector", () => {
  it("loads only scoped safe metadata in bounded pages beyond 1000 Events", async () => {
    response.data = Array.from({ length: 26 }, (_, i) => ({ id: id(1000+i), name: `Event ${1000+i}`, status: "active", private_details: "excluded" }));
    const result = await loadSharingEvents(guildId,id(999));
    expect(result.status).toBe("ready"); expect(result.events).toHaveLength(25); expect(result.next).toBe(id(1024));
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("events"); expect(mocks.select).toHaveBeenCalledWith("id,name,status");
    expect(mocks.eq).toHaveBeenCalledWith("guild_id",guildId); expect(mocks.limit).toHaveBeenCalledWith(26);
    expect(mocks.gt).toHaveBeenCalledWith("id",id(999)); expect(JSON.stringify(result)).not.toContain("private");
  });
  it("returns explicit end-of-list for an empty/short page", async () => {
    expect(await loadSharingEvents(guildId)).toEqual({ status: "ready", events: [], next: null });
    expect(mocks.gt).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin", "publish.manage Officer"])("preserves capability authorization for %s", async () => {
    expect((await loadSharingEvents(guildId)).status).toBe("ready"); expect(mocks.authorize).toHaveBeenCalledOnce();
  });
  it.each(["Member", "events.manage-only Officer", "cross-Guild actor"])("rejects %s before querying Events", async () => {
    mocks.authorize.mockResolvedValue("forbidden"); expect((await loadSharingEvents(guildId)).status).toBe("forbidden"); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("fails closed for missing membership, malformed cursors and configuration", async () => {
    mocks.access.mockResolvedValue(null); expect((await loadSharingEvents(guildId)).status).toBe("forbidden");
    expect((await loadSharingEvents(guildId,"invalid")).status).toBe("error"); expect(mocks.from).not.toHaveBeenCalled();
    vi.stubEnv("SHARE_LINK_INTERFACE_ENABLED", undefined); expect((await loadSharingEvents(guildId)).status).toBe("disabled");
  });
  it("sanitizes a failed query without returning partial Events", async () => {
    response = { data: [{ id:id(1),name:"private" }],error:{message:"credential"} };
    expect(await loadSharingEvents(guildId)).toEqual({ status:"error",events:[],next:null });
  });
});
