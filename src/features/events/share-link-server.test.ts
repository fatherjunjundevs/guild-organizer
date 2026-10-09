import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn(), user: vi.fn(), retry: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { copyEventShareLink, createEventShareLink, readEventShareLinkState, revokeEventShareLink, rotateEventShareLink } from "./share-link-server";
import { createShareLinkEnvelope, recoverShareToken, toShareBytea } from "./share-link-crypto";
import { loadShareLinkRecoveryConfig } from "./share-link-config";

const scope = { guildId: "11111111-1111-4111-8111-111111111111", eventId: "22222222-2222-4222-8222-222222222222" };
const actorId = "33333333-3333-4333-8333-333333333333";
const linkId = "44444444-4444-4444-8444-444444444444";
let active: string | null;
let stored: Record<string, string>;
function state() { return { data: [{ link_id: active, created_at: active ? "2026-10-08T00:00:00Z" : null, available: false }], error: null }; }
function mutations() { return mocks.rpc.mock.calls.filter(([name]) => ["create_event_share_link", "rotate_event_share_link", "revoke_event_share_link"].includes(name)); }
beforeEach(() => {
  vi.resetAllMocks(); active = null; stored = {};
  for (const [key, value] of Object.entries({ APP_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000",
    SHARE_LINK_RECOVERY_KEY_ID: "test_aes_v1", SHARE_LINK_RECOVERY_KEYS_JSON: JSON.stringify({ test_aes_v1: Buffer.alloc(32, 1).toString("base64") }),
    SHARE_LINK_PROVISIONING_KEY_ID: "test_provision_v1", SHARE_LINK_PROVISIONING_KEY_BASE64: Buffer.alloc(32, 2).toString("base64") })) vi.stubEnv(key, value);
  mocks.user.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: (name: string, args: unknown) => {
    const builder = { retry: (enabled: boolean) => { mocks.retry(enabled); return builder; },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(mocks.rpc(name, args)).then(resolve, reject) };
    return builder;
  } });
  mocks.rpc.mockImplementation(async (name, args) => {
    if (name === "get_event_share_link_state") return state();
    if (name === "get_event_share_link_copy_payload") return { data: active === args.p_link_id ? [stored] : [], error: null };
    if (name === "revoke_event_share_link") { if (active === args.p_link_id) active = null; return { data: null, error: null }; }
    active = args.p_link_id ?? args.p_new_link_id;
    stored = { link_id: active!, token_digest: args.p_token_digest, token_ciphertext: args.p_token_ciphertext,
      token_nonce: args.p_token_nonce, token_auth_tag: args.p_token_auth_tag, encryption_key_id: args.p_encryption_key_id };
    return { data: active, error: null };
  });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("authenticated share-link operations", () => {
  it("creates and rotates internally generated envelopes, with URLs only on explicit copy", async () => {
    const create = await createEventShareLink(scope);
    expect(create).toMatchObject({ ok: true, operation: "create", outcome: "confirmed", refresh: "ready" });
    const first = active!;
    expect(JSON.stringify(create)).not.toMatch(/token|ciphertext|digest|mac|v1\./);
    const copied = await copyEventShareLink({ ...scope, linkId: first });
    expect(copied).toMatchObject({ ok: true, operation: "copy" });
    if (!copied.ok) throw new Error("Expected copy");
    expect(new URL(copied.url).hash).toMatch(/^#token=v1\./);
    expect(await rotateEventShareLink({ ...scope, linkId: first })).toMatchObject({ ok: true, operation: "rotate" });
    expect(active).not.toBe(first);
    expect(await copyEventShareLink({ ...scope, linkId: first })).toMatchObject({ ok: false, code: "unavailable" });
    const second = active!;
    expect(await revokeEventShareLink({ ...scope, linkId: first })).toMatchObject({ ok: true });
    expect(active).toBe(second);
    expect(await revokeEventShareLink({ ...scope, linkId: second })).toMatchObject({ ok: true, state: { linkId: null } });
  });
  it.each([readEventShareLinkState, createEventShareLink])("rejects supplied actors/crypto fields before using Supabase", async (operation) => {
    const supplied = { ...scope, actorId, p_token_digest: "chosen" };
    expect(await operation(supplied)).toMatchObject({ ok: false, code: "invalid" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin", "publish.manage officer"])("preserves the actual authenticated actor for %s", async () => {
    expect(await createEventShareLink(scope)).toMatchObject({ ok: true });
    expect(mocks.user).toHaveBeenCalledOnce();
    const args = mutations()[0][1];
    expect(args.p_guild_id).toBe(scope.guildId); expect(args.p_event_id).toBe(scope.eventId);
    expect(args.p_provisioning_expires_at - Math.floor(Date.now() / 1000)).toBeGreaterThanOrEqual(119);
    expect(args.p_provisioning_mac).toMatch(/^\\x[0-9a-f]{64}$/);
    expect(args).not.toHaveProperty("p_actor_id");
  });
  it.each(["member", "events.manage only", "foreign Guild", "inactive member"])("honors PostgreSQL denial for %s", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "PRIVATE_DATABASE_DETAIL" } });
    expect(await createEventShareLink(scope)).toMatchObject({ ok: false, code: "forbidden" });
    expect(mutations()).toHaveLength(0);
  });
  it.each([readEventShareLinkState, createEventShareLink, copyEventShareLink, rotateEventShareLink, revokeEventShareLink])("rejects unauthenticated calls", async (operation) => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    expect(await operation({ ...scope, ...(operation === readEventShareLinkState || operation === createEventShareLink ? {} : { linkId }) } as typeof scope & { linkId: string })).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reads state and revokes without crypto configuration", async () => {
    vi.stubEnv("SHARE_LINK_RECOVERY_KEYS_JSON", undefined); vi.stubEnv("SHARE_LINK_PROVISIONING_KEY_BASE64", undefined);
    expect(await readEventShareLinkState(scope)).toMatchObject({ ok: true, state: { linkId: null } });
    expect(await revokeEventShareLink({ ...scope, linkId })).toMatchObject({ ok: true });
    expect(await createEventShareLink(scope)).toMatchObject({ ok: false, code: "configuration" });
  });
  it.each(["create", "rotate", "revoke"])("preserves confirmed %s when refresh fails and recovers using reads only", async (operation) => {
    if (operation !== "create") active = linkId;
    let wrote = false;
    const base = mocks.rpc.getMockImplementation()!;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "get_event_share_link_state" && wrote) throw new Error("sensitive transport details");
      const result = await base(name, args);
      if (name === `${operation}_event_share_link`) wrote = true;
      return result;
    });
    const result = operation === "create" ? await createEventShareLink(scope) : operation === "rotate" ? await rotateEventShareLink({ ...scope, linkId }) : await revokeEventShareLink({ ...scope, linkId });
    expect(result).toMatchObject({ ok: true, refresh: "required", state: null });
    expect(mutations()).toHaveLength(1);
    expect(mocks.retry).toHaveBeenCalledWith(false);
    mocks.rpc.mockImplementation(base);
    expect(await readEventShareLinkState(scope)).toMatchObject({ ok: true, state: { linkId: active } });
    expect(mutations()).toHaveLength(1);
  });
  it.each(["create", "rotate", "revoke"])("handles unknown %s outcomes without retrying", async (operation) => {
    if (operation !== "create") active = linkId;
    const base = mocks.rpc.getMockImplementation()!;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === `${operation}_event_share_link`) {
        await base(name, args); throw new Error("SECRET_TOKEN_AND_TRANSPORT_METADATA");
      }
      return base(name, args);
    });
    const result = operation === "create" ? await createEventShareLink(scope) : operation === "rotate" ? await rotateEventShareLink({ ...scope, linkId }) : await revokeEventShareLink({ ...scope, linkId });
    expect(result).toMatchObject({ ok: false, code: "mutation_unknown", recovery: "read_state" });
    expect(JSON.stringify(result)).not.toContain("SECRET_TOKEN");
    expect(mutations()).toHaveLength(1);
    expect(await readEventShareLinkState(scope)).toMatchObject({ ok: true });
    expect(mutations()).toHaveLength(1);
  });
  it("treats network errors returned as RPC data as uncertain writes", async () => {
    const base = mocks.rpc.getMockImplementation()!;
    mocks.rpc.mockImplementation((name, args) => name === "create_event_share_link" ? { data: null, error: { code: "", message: "fetch failed" } } : base(name, args));
    expect(await createEventShareLink(scope)).toMatchObject({ ok: false, code: "mutation_unknown" });
    expect(mutations()).toHaveLength(1);
  });
  it("does not sign stale rotations or duplicate create requests", async () => {
    active = linkId;
    expect(await createEventShareLink(scope)).toMatchObject({ ok: false, code: "conflict" });
    expect(await rotateEventShareLink({ ...scope, linkId: actorId })).toMatchObject({ ok: false, code: "conflict" });
    expect(mutations()).toHaveLength(0);
  });
  it("checks active identity again after decrypting, withholding stale copied URLs", async () => {
    await createEventShareLink(scope); const first = active!;
    const base = mocks.rpc.getMockImplementation()!;
    mocks.rpc.mockImplementation(async (name, args) => {
      const result = await base(name, args);
      if (name === "get_event_share_link_copy_payload") active = linkId;
      return result;
    });
    expect(await copyEventShareLink({ ...scope, linkId: first })).toMatchObject({ ok: false, code: "conflict" });
    expect(mutations()).toHaveLength(1);
  });
  it("never rotates after recovery failure and does not require provisioning for copy", async () => {
    await createEventShareLink(scope); vi.stubEnv("SHARE_LINK_PROVISIONING_KEY_BASE64", undefined);
    expect(await copyEventShareLink({ ...scope, linkId: active! })).toMatchObject({ ok: true });
    stored.token_digest = "f".repeat(64);
    expect(await copyEventShareLink({ ...scope, linkId: active! })).toMatchObject({ ok: false, code: "recovery_failed" });
    expect(mutations()).toHaveLength(1);
  });
  it("does not log secrets or return raw error/envelope material", async () => {
    const log = vi.spyOn(console, "log"), error = vi.spyOn(console, "error"), warn = vi.spyOn(console, "warn");
    try {
      await createEventShareLink(scope);
      const result = await readEventShareLinkState(scope);
      expect(Object.keys(result).sort()).toEqual(["ok", "operation", "state"]);
      expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled();
    } finally { log.mockRestore(); error.mockRestore(); warn.mockRestore(); }
  });
  it("rejects malformed state and encrypted payload wire values", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ link_id: null, created_at: null, available: true }], error: null });
    expect(await readEventShareLinkState(scope)).toMatchObject({ ok: false, code: "read_failed" });
  });
  it("matches a recovered token to the actual generated ciphertext", () => {
    const config = loadShareLinkRecoveryConfig();
    const envelope = createShareLinkEnvelope({ ...scope, linkId }, config);
    expect(recoverShareToken({ ...scope, linkId }, envelope, config)).toMatch(/^v1\./);
    expect(toShareBytea(envelope.ciphertext)).toHaveLength(66);
  });
});
