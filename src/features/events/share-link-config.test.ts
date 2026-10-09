import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadShareLinkProvisioningConfig, loadShareLinkRecoveryConfig } from "./share-link-config";

export function testShareEnvironment() {
  return { APP_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000",
    SHARE_LINK_RECOVERY_KEY_ID: "test_aes_v1",
    SHARE_LINK_RECOVERY_KEYS_JSON: JSON.stringify({ test_aes_v1: Buffer.alloc(32, 1).toString("base64") }),
    SHARE_LINK_PROVISIONING_KEY_ID: "test_provision_v1",
    SHARE_LINK_PROVISIONING_KEY_BASE64: Buffer.alloc(32, 2).toString("base64") };
}
describe("server-only share-link configuration", () => {
  it("loads explicit keys without exposing their bytes through serialization", () => {
    const env = testShareEnvironment();
    const recovery = loadShareLinkRecoveryConfig(env);
    const provisioning = loadShareLinkProvisioningConfig(recovery, env);
    const text = JSON.stringify({ recovery, provisioning });
    expect(text).not.toContain(env.SHARE_LINK_PROVISIONING_KEY_BASE64);
    expect(text).not.toContain(Buffer.alloc(32, 1).toString("base64"));
    expect(recovery.origin).toBe(env.APP_ORIGIN);
    expect(recovery.key("test_aes_v1")).toHaveLength(32);
  });
  it.each(["APP_ENV", "APP_ORIGIN", "SHARE_LINK_RECOVERY_KEY_ID", "SHARE_LINK_RECOVERY_KEYS_JSON"])("fails closed without %s", (name) => {
    const env: Record<string, string | undefined> = testShareEnvironment(); delete env[name];
    expect(() => loadShareLinkRecoveryConfig(env)).toThrow("configuration is unavailable");
  });
  it.each(["SHARE_LINK_PROVISIONING_KEY_ID", "SHARE_LINK_PROVISIONING_KEY_BASE64"])("fails closed without %s", (name) => {
    const env: Record<string, string | undefined> = testShareEnvironment(); const recovery = loadShareLinkRecoveryConfig(env); delete env[name];
    expect(() => loadShareLinkProvisioningConfig(recovery, env)).toThrow("configuration is unavailable");
  });
  it.each(["", "not-json", "[]", "null", "{}", '{"bad key":"hidden"}', JSON.stringify({ test_aes_v1: Buffer.alloc(31).toString("base64") })])("rejects malformed recovery key configuration %s", (value) => {
    expect(() => loadShareLinkRecoveryConfig({ ...testShareEnvironment(), SHARE_LINK_RECOVERY_KEYS_JSON: value })).toThrow();
  });
  it.each(["", "hidden", Buffer.alloc(31).toString("base64"), Buffer.alloc(33).toString("base64"), Buffer.alloc(32).toString("base64") + "\n", "A".repeat(43) + "B"])("rejects invalid provisioning key encoding", (value) => {
    const env = testShareEnvironment();
    expect(() => loadShareLinkProvisioningConfig(loadShareLinkRecoveryConfig(env), { ...env, SHARE_LINK_PROVISIONING_KEY_BASE64: value })).toThrow();
  });
  it.each(["http://example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?x=1", "https://example.com#fragment", "javascript:alert(1)"])("rejects untrusted origin configuration %s", (origin) => {
    expect(() => loadShareLinkRecoveryConfig({ ...testShareEnvironment(), APP_ORIGIN: origin })).toThrow();
  });
  it("requires HTTPS and non-test IDs outside local mode", () => {
    expect(() => loadShareLinkRecoveryConfig({ ...testShareEnvironment(), APP_ENV: "production" })).toThrow();
    expect(() => loadShareLinkRecoveryConfig({ ...testShareEnvironment(), APP_ENV: "staging", APP_ORIGIN: "https://example.com" })).toThrow();
  });
  it("does not require provisioning credentials for recovery", () => {
    const env = testShareEnvironment();
    expect(loadShareLinkRecoveryConfig({ ...env, SHARE_LINK_PROVISIONING_KEY_BASE64: undefined }).key(env.SHARE_LINK_RECOVERY_KEY_ID)).toHaveLength(32);
  });
  it("rejects shared AES and HMAC key bytes", () => {
    const env = testShareEnvironment();
    expect(() => loadShareLinkProvisioningConfig(loadShareLinkRecoveryConfig(env), { ...env, SHARE_LINK_PROVISIONING_KEY_BASE64: Buffer.alloc(32, 1).toString("base64") })).toThrow();
  });
  it("supports retained recovery keys and rejects unknown IDs", () => {
    const env = testShareEnvironment();
    const recovery = loadShareLinkRecoveryConfig({ ...env, SHARE_LINK_RECOVERY_KEYS_JSON: JSON.stringify({ test_aes_v1: Buffer.alloc(32, 1).toString("base64"), test_aes_v2: Buffer.alloc(32, 3).toString("base64") }), SHARE_LINK_RECOVERY_KEY_ID: "test_aes_v2" });
    expect(recovery.key("test_aes_v1")).toHaveLength(32);
    expect(() => recovery.key("missing")).toThrow();
  });
  it("sanitizes invalid config errors rather than serializing supplied values", () => {
    try { loadShareLinkRecoveryConfig({ ...testShareEnvironment(), SHARE_LINK_RECOVERY_KEYS_JSON: "TOP_SECRET_INPUT" }); }
    catch (error) { expect(String(error)).not.toContain("TOP_SECRET_INPUT"); }
  });
});
