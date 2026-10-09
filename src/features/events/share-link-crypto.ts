import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SHARE_KEY_ID, type ShareLinkProvisioningConfig, type ShareLinkRecoveryConfig } from "./share-link-config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^v1\.[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export type ShareLinkScope = { guildId: string; eventId: string };
export type ShareLinkIdentity = ShareLinkScope & { linkId: string };
export type ShareLinkEnvelope = {
  digest: string; ciphertext: Buffer; nonce: Buffer; authTag: Buffer; encryptionKeyId: string;
};

function invalid(): never { throw new Error("Share-link cryptographic material is invalid."); }
export function canonicalShareUuid(value: unknown): string {
  if (typeof value !== "string" || value.length !== 36 || !UUID.test(value)) invalid();
  return value.toLowerCase();
}
export function parseShareToken(token: unknown): Buffer {
  if (typeof token !== "string" || token.length !== 46 || !TOKEN.test(token)) invalid();
  const bytes = Buffer.from(token.slice(3), "base64url");
  if (bytes.length !== 32 || `v1.${bytes.toString("base64url")}` !== token) invalid();
  return bytes;
}
export function shareTokenDigest(token: string): string {
  parseShareToken(token);
  return createHash("sha256").update(token, "utf8").digest("hex");
}
function associatedData(identity: ShareLinkIdentity): Buffer {
  return Buffer.from(["go.share.recovery.v1", "v1", canonicalShareUuid(identity.guildId),
    canonicalShareUuid(identity.eventId), canonicalShareUuid(identity.linkId)].join("\n"), "utf8");
}
export function createShareLinkEnvelope(identity: ShareLinkIdentity, config: ShareLinkRecoveryConfig): ShareLinkEnvelope {
  const bytes = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key(config.activeKeyId), nonce);
  cipher.setAAD(associatedData(identity));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { digest: shareTokenDigest(`v1.${bytes.toString("base64url")}`), ciphertext, nonce,
    authTag: cipher.getAuthTag(), encryptionKeyId: config.activeKeyId };
}
function validateEnvelope(envelope: ShareLinkEnvelope) {
  if (envelope.digest.length !== 64 || !/^[0-9a-f]{64}$/.test(envelope.digest) || !SHARE_KEY_ID.test(envelope.encryptionKeyId) ||
      !Buffer.isBuffer(envelope.ciphertext) || envelope.ciphertext.length !== 32 ||
      !Buffer.isBuffer(envelope.nonce) || envelope.nonce.length !== 12 ||
      !Buffer.isBuffer(envelope.authTag) || envelope.authTag.length !== 16) invalid();
}
export function recoverShareToken(identity: ShareLinkIdentity, envelope: ShareLinkEnvelope, config: ShareLinkRecoveryConfig): string {
  try {
    validateEnvelope(envelope);
    const decipher = createDecipheriv("aes-256-gcm", config.key(envelope.encryptionKeyId), envelope.nonce);
    decipher.setAAD(associatedData(identity));
    decipher.setAuthTag(envelope.authTag);
    const bytes = Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
    if (bytes.length !== 32) invalid();
    const token = `v1.${bytes.toString("base64url")}`;
    if (!timingSafeEqual(Buffer.from(shareTokenDigest(token), "hex"), Buffer.from(envelope.digest, "hex"))) invalid();
    return token;
  } catch { return invalid(); }
}
export function buildShareUrl(origin: string, token: string): string {
  parseShareToken(token);
  const url = new URL("/share/event", origin);
  url.hash = `token=${token}`;
  return url.toString();
}
export function toShareBytea(value: Buffer): string { return `\\x${value.toString("hex")}`; }
export function fromShareBytea(value: unknown, bytes: number): Buffer {
  if (typeof value !== "string" || value.length !== 2 + bytes * 2 || !new RegExp(`^\\\\x[0-9a-f]{${bytes * 2}}$`).test(value)) invalid();
  return Buffer.from(value.slice(2), "hex");
}
export type ProvisioningRequest = ShareLinkIdentity & {
  operation: "create" | "rotate"; actorId: string; previousLinkId: string | null; envelope: ShareLinkEnvelope;
};
// Internal server-only helper, never a Server Action or a general signing endpoint.
export function signShareLinkProvisioning(request: ProvisioningRequest, config: ShareLinkProvisioningConfig, now = Date.now()) {
  validateEnvelope(request.envelope);
  if (!Number.isSafeInteger(now) || now < 0 ||
      (request.operation !== "create" && request.operation !== "rotate") ||
      (request.operation === "create" && request.previousLinkId !== null) ||
      (request.operation === "rotate" && request.previousLinkId === null) || !SHARE_KEY_ID.test(config.keyId)) invalid();
  const expiresAt = Math.floor(now / 1000) + 120;
  const e = request.envelope;
  const message = ["go.share.provision.v1", request.operation, canonicalShareUuid(request.actorId),
    canonicalShareUuid(request.guildId), canonicalShareUuid(request.eventId), canonicalShareUuid(request.linkId),
    request.previousLinkId === null ? "-" : canonicalShareUuid(request.previousLinkId), e.digest,
    e.ciphertext.toString("hex"), e.nonce.toString("hex"), e.authTag.toString("hex"), e.encryptionKeyId,
    config.keyId, String(expiresAt)].join("\n");
  return { keyId: config.keyId, expiresAt, mac: createHmac("sha256", config.key()).update(message, "utf8").digest() };
}
