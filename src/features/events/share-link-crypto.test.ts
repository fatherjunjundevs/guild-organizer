import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadShareLinkProvisioningConfig, loadShareLinkRecoveryConfig, ShareLinkProvisioningConfig } from "./share-link-config";
import { buildShareUrl, canonicalShareUuid, createShareLinkEnvelope, fromShareBytea, parseShareToken, recoverShareToken,
  shareTokenDigest, signShareLinkProvisioning, toShareBytea } from "./share-link-crypto";

const identity = { guildId: "6c100000-0000-4000-8000-000000000001", eventId: "6c500000-0000-4000-8000-000000000001", linkId: "6c800000-0000-4000-8000-000000000099" };
const env = { APP_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000", SHARE_LINK_RECOVERY_KEY_ID: "test_aes_v1",
  SHARE_LINK_RECOVERY_KEYS_JSON: JSON.stringify({ test_aes_v1: Buffer.alloc(32, 1).toString("base64") }),
  SHARE_LINK_PROVISIONING_KEY_ID: "test_provision_v1", SHARE_LINK_PROVISIONING_KEY_BASE64: Buffer.alloc(32, 2).toString("base64") };
const config = loadShareLinkRecoveryConfig(env);
describe("share-link token sealing and provisioning", () => {
  it("generates fresh 32-byte tokens and 12-byte nonces without returning plaintext in envelopes", () => {
    const first = createShareLinkEnvelope(identity, config), second = createShareLinkEnvelope(identity, config);
    const token = recoverShareToken(identity, first, config);
    expect(token).toHaveLength(46); expect(parseShareToken(token)).toHaveLength(32);
    expect(first.ciphertext).toHaveLength(32); expect(first.nonce).toHaveLength(12); expect(first.authTag).toHaveLength(16);
    expect(second.nonce.equals(first.nonce)).toBe(false); expect(second.digest).not.toBe(first.digest);
    expect(Object.keys(first).sort()).toEqual(["authTag", "ciphertext", "digest", "encryptionKeyId", "nonce"]);
    expect(JSON.stringify(first)).not.toContain(token);
  });
  it("hashes the complete canonical token representation reproducibly", () => {
    const token = `v1.${Buffer.alloc(32, 1).toString("base64url")}`;
    expect(shareTokenDigest(token)).toBe(createHash("sha256").update(token, "utf8").digest("hex"));
  });
  it.each([null, "", "v2." + "A".repeat(43), "v1." + "A".repeat(42), "v1." + "A".repeat(42) + "B", "v1." + "A".repeat(43) + "=", "v1." + "A".repeat(43) + "\n", "f".repeat(64)])("rejects malformed or noncanonical tokens", (token) => {
    expect(() => parseShareToken(token)).toThrow();
  });
  it.each(["ciphertext", "nonce", "authTag"] as const)("rejects tampered %s", (field) => {
    const envelope = createShareLinkEnvelope(identity, config); const bytes = Buffer.from(envelope[field]); bytes[0] ^= 1;
    expect(() => recoverShareToken(identity, { ...envelope, [field]: bytes }, config)).toThrow("material is invalid");
  });
  it.each(["guildId", "eventId", "linkId"] as const)("binds AES associated data to %s", (field) => {
    const envelope = createShareLinkEnvelope(identity, config);
    expect(() => recoverShareToken({ ...identity, [field]: "11111111-1111-4111-8111-111111111111" }, envelope, config)).toThrow();
  });
  it("rejects wrong recovery keys, unknown key IDs, and digest mismatches", () => {
    const envelope = createShareLinkEnvelope(identity, config);
    const wrong = loadShareLinkRecoveryConfig({ ...env, SHARE_LINK_RECOVERY_KEYS_JSON: JSON.stringify({ test_aes_v1: Buffer.alloc(32, 3).toString("base64") }) });
    expect(() => recoverShareToken(identity, envelope, wrong)).toThrow();
    expect(() => recoverShareToken(identity, { ...envelope, encryptionKeyId: "unknown" }, config)).toThrow();
    expect(() => recoverShareToken(identity, { ...envelope, digest: "a".repeat(64) }, config)).toThrow();
  });
  it("builds a fixed-origin URL with the token only in its fragment", () => {
    const envelope = createShareLinkEnvelope(identity, config); const token = recoverShareToken(identity, envelope, config);
    const url = new URL(buildShareUrl(config.origin, token));
    expect(url.pathname).toBe("/share/event"); expect(url.search).toBe(""); expect(url.hash).toBe(`#token=${token}`);
  });
  it("validates PostgREST bytea wire format exactly", () => {
    expect(fromShareBytea(toShareBytea(Buffer.alloc(12, 0xab)), 12)).toEqual(Buffer.alloc(12, 0xab));
    for (const value of ["ab".repeat(12), "\\x" + "AB".repeat(12), "\\x00", "\\x" + "ab".repeat(12) + "\n"]) expect(() => fromShareBytea(value, 12)).toThrow();
  });
  it("normalizes UUIDs and rejects trailing separators", () => {
    expect(canonicalShareUuid(identity.guildId.toUpperCase())).toBe(identity.guildId);
    expect(() => canonicalShareUuid(identity.guildId + "\n")).toThrow();
  });
  it("matches the established PostgreSQL golden-vector protocol", () => {
    const envelope = { digest: "a".repeat(64), ciphertext: Buffer.alloc(32, 0xab), nonce: Buffer.alloc(12, 0xef), authTag: Buffer.alloc(16, 0xcd), encryptionKeyId: "test_key_v1" };
    const proof = signShareLinkProvisioning({ ...identity, actorId: "6c000000-0000-4000-8000-000000000001", operation: "create", previousLinkId: null, envelope }, new ShareLinkProvisioningConfig("sql_test_v1", Buffer.alloc(32, 0x77)), (1800000000 - 120) * 1000);
    // Matches the fixed golden assertion in supabase/tests/event_share_links.test.sql.
    expect(proof.expiresAt).toBe(1800000000);
    expect(proof.mac.toString("hex")).toBe("88e196da02a40433791af57fce376f7cd19838d8d9f9ccf30eba0a8ce0ce5027");
  });
  it("binds all provisioning arguments and rejects malformed operation/clock", () => {
    const envelope = createShareLinkEnvelope(identity, config);
    const key = loadShareLinkProvisioningConfig(config, env);
    const request = { ...identity, actorId: "6c000000-0000-4000-8000-000000000001", operation: "create" as const, previousLinkId: null, envelope };
    const proof = signShareLinkProvisioning(request, key, 1800000000000);
    expect(signShareLinkProvisioning({ ...request, operation: "rotate", previousLinkId: identity.linkId }, key, 1800000000000).mac.equals(proof.mac)).toBe(false);
    expect(() => signShareLinkProvisioning({ ...request, previousLinkId: identity.linkId }, key)).toThrow();
    expect(() => signShareLinkProvisioning(request, key, NaN)).toThrow();
  });
});
