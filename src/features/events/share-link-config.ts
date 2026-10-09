import "server-only";

import { timingSafeEqual } from "node:crypto";

export const SHARE_KEY_ID = /^[A-Za-z0-9_-]{1,32}(?![\s\S])/;
type Environment = Record<string, string | undefined>;

function invalid(): never {
  throw new Error("Share-link server configuration is unavailable.");
}

function keyId(value: unknown, production: boolean): string {
  if (typeof value !== "string" || !SHARE_KEY_ID.test(value) ||
      (production && /^(test_|local_)/.test(value))) invalid();
  return value;
}

function keyBytes(value: unknown): Buffer {
  if (typeof value !== "string" || value.length !== 44 || !/^[A-Za-z0-9+/]{43}=$/.test(value)) invalid();
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== value) invalid();
  return bytes;
}

function applicationOrigin(env: Environment): string {
  if (!["local", "staging", "production"].includes(env.APP_ENV ?? "")) invalid();
  try {
    const url = new URL(env.APP_ORIGIN ?? "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") invalid();
    const localHttp = env.APP_ENV === "local" && url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) invalid();
    return url.origin;
  } catch { return invalid(); }
}

// Private fields prevent accidental JSON serialization of key material.
export class ShareLinkRecoveryConfig {
  #keys: Map<string, Buffer>;
  constructor(readonly origin: string, readonly activeKeyId: string, keys: Map<string, Buffer>) {
    this.#keys = keys;
  }
  key(id: string): Buffer {
    const value = this.#keys.get(id);
    if (!value) invalid();
    return Buffer.from(value);
  }
  conflictsWith(key: Buffer): boolean {
    return [...this.#keys.values()].some((value) => timingSafeEqual(value, key));
  }
}

export class ShareLinkProvisioningConfig {
  #key: Buffer;
  constructor(readonly keyId: string, key: Buffer) { this.#key = Buffer.from(key); }
  key(): Buffer { return Buffer.from(this.#key); }
}

export function loadShareLinkRecoveryConfig(env: Environment = process.env): ShareLinkRecoveryConfig {
  const origin = applicationOrigin(env);
  const production = env.APP_ENV !== "local";
  const active = keyId(env.SHARE_LINK_RECOVERY_KEY_ID, production);
  let parsed: unknown;
  try { parsed = JSON.parse(env.SHARE_LINK_RECOVERY_KEYS_JSON ?? ""); } catch { invalid(); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) invalid();
  const entries = Object.entries(parsed);
  if (entries.length < 1 || entries.length > 16) invalid();
  const keys = new Map(entries.map(([id, value]) => [keyId(id, production), keyBytes(value)]));
  if (!keys.has(active)) invalid();
  return new ShareLinkRecoveryConfig(origin, active, keys);
}

export function loadShareLinkProvisioningConfig(
  recovery: ShareLinkRecoveryConfig,
  env: Environment = process.env,
): ShareLinkProvisioningConfig {
  if (!["local", "staging", "production"].includes(env.APP_ENV ?? "")) invalid();
  const id = keyId(env.SHARE_LINK_PROVISIONING_KEY_ID, env.APP_ENV !== "local");
  const key = keyBytes(env.SHARE_LINK_PROVISIONING_KEY_BASE64);
  if (recovery.conflictsWith(key)) invalid();
  return new ShareLinkProvisioningConfig(id, key);
}
