import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadShareLinkProvisioningConfig, loadShareLinkRecoveryConfig } from "./share-link-config";
import { buildShareUrl, canonicalShareUuid, createShareLinkEnvelope, fromShareBytea, recoverShareToken,
  signShareLinkProvisioning, toShareBytea, type ShareLinkScope } from "./share-link-crypto";
import type { EventShareLinkState, ShareLinkCopyResult, ShareLinkFailure, ShareLinkMutationResult,
  ShareLinkOperation, ShareLinkStateResult } from "./share-link";

const uuid = z.string().transform((value, context) => {
  try { return canonicalShareUuid(value); } catch { context.addIssue({ code: "custom", message: "Invalid identifier" }); return z.NEVER; }
});
const scopeSchema = z.object({ guildId: uuid, eventId: uuid }).strict();
const identitySchema = scopeSchema.extend({ linkId: uuid }).strict();
type Client = Awaited<ReturnType<typeof createClient>>;
type Context = { client: Client; actorId: string };

function failure(operation: ShareLinkOperation, code: ShareLinkFailure["code"], requestedLinkId?: string): ShareLinkFailure {
  const messages: Record<ShareLinkFailure["code"], string> = {
    invalid: "The share-link identifiers are invalid.",
    unauthenticated: "Sign in to manage Event share links.",
    forbidden: "Share-link management access or trusted provisioning is unavailable.",
    unavailable: "This Event or active share link is unavailable for the selected Guild.",
    configuration: "Share-link server configuration is unavailable.",
    recovery_failed: "This share link could not be recovered safely. No link was changed.",
    read_failed: "Share-link state could not be loaded. Retry the read.",
    conflict: "Share-link state has changed or the Event is archived. Refresh its state before continuing.",
    mutation_failed: "The share-link change was rejected. Refresh its state before continuing.",
    mutation_unknown: "The share-link change has an unknown outcome. Read its state before taking further action.",
  };
  return { ok: false, operation, code, message: messages[code],
    recovery: code === "recovery_failed" ? "retry_copy" :
      ["read_failed", "conflict", "mutation_failed", "mutation_unknown"].includes(code) ? "read_state" : "none",
    ...(requestedLinkId ? { requestedLinkId } : {}) };
}
function rpcFailure(operation: ShareLinkOperation, code: string | undefined, requestedLinkId?: string): ShareLinkFailure {
  if (code === "42501") return failure(operation, "forbidden", requestedLinkId);
  if (code === "P0002") return failure(operation, "unavailable", requestedLinkId);
  if (["55000", "23505"].includes(code ?? "")) return failure(operation, "conflict", requestedLinkId);
  if (["23514", "22P02", "57014", "40001", "40P01", "55P03", "0A000"].includes(code ?? "")) return failure(operation, "mutation_failed", requestedLinkId);
  return failure(operation, operation === "state" || operation === "copy" ? "read_failed" : "mutation_unknown", requestedLinkId);
}
async function authenticate(operation: ShareLinkOperation): Promise<Context | ShareLinkFailure> {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return failure(operation, "unauthenticated");
    return { client, actorId: canonicalShareUuid(data.user.id) };
  } catch { return failure(operation, "read_failed"); }
}
async function readState(context: Context, scope: ShareLinkScope, operation: ShareLinkOperation): Promise<EventShareLinkState | ShareLinkFailure> {
  try {
    const { data, error } = await context.client.rpc("get_event_share_link_state", { p_guild_id: scope.guildId, p_event_id: scope.eventId });
    if (error) return rpcFailure(operation === "copy" ? "copy" : "state", error.code);
    if (!data || data.length !== 1) return failure(operation, "read_failed");
    const row = data[0];
    if (typeof row.available !== "boolean") return failure(operation, "read_failed");
    // Generated RETURNS TABLE types omit nullability; validate actual wire values.
    if (row.link_id === null && row.created_at === null && !row.available) {
      return { linkId: null, createdAt: null, available: false };
    }
    const linkId = canonicalShareUuid(row.link_id);
    if (typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))) return failure(operation, "read_failed");
    return { linkId, createdAt: row.created_at, available: row.available };
  } catch { return failure(operation, "read_failed"); }
}
function isFailure(value: Context | EventShareLinkState | ShareLinkFailure): value is ShareLinkFailure { return "ok" in value; }

export async function readEventShareLinkState(input: ShareLinkScope): Promise<ShareLinkStateResult> {
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return failure("state", "invalid");
  const context = await authenticate("state");
  if (isFailure(context)) return context;
  const state = await readState(context, parsed.data, "state");
  return isFailure(state) ? state : { ok: true, operation: "state", state };
}

export async function copyEventShareLink(input: ShareLinkScope & { linkId: string }): Promise<ShareLinkCopyResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) return failure("copy", "invalid");
  const identity = parsed.data;
  const context = await authenticate("copy");
  if (isFailure(context)) return context;
  const state = await readState(context, identity, "copy");
  if (isFailure(state)) return state;
  if (state.linkId !== identity.linkId) return failure("copy", "unavailable");
  let config;
  try { config = loadShareLinkRecoveryConfig(); } catch { return failure("copy", "configuration"); }
  try {
    const { data, error } = await context.client.rpc("get_event_share_link_copy_payload", {
      p_guild_id: identity.guildId, p_event_id: identity.eventId, p_link_id: identity.linkId,
    });
    if (error) return rpcFailure("copy", error.code);
    if (!data || data.length !== 1 || data[0].link_id !== identity.linkId) return failure("copy", "unavailable");
    const row = data[0];
    let token;
    try {
      token = recoverShareToken(identity, { digest: row.token_digest, ciphertext: fromShareBytea(row.token_ciphertext, 32),
        nonce: fromShareBytea(row.token_nonce, 12), authTag: fromShareBytea(row.token_auth_tag, 16), encryptionKeyId: row.encryption_key_id }, config);
    } catch { return failure("copy", "recovery_failed"); }
    // Reauthorize and check identity after recovery; never return an observed-stale URL.
    const current = await readState(context, identity, "copy");
    if (isFailure(current)) return current;
    if (current.linkId !== identity.linkId) return failure("copy", "conflict");
    return { ok: true, operation: "copy", linkId: identity.linkId, url: buildShareUrl(config.origin, token) };
  } catch { return failure("copy", "read_failed"); }
}

async function finishMutation(context: Context, scope: ShareLinkScope, operation: "create" | "rotate" | "revoke", linkId: string): Promise<ShareLinkMutationResult> {
  const refreshed = await readState(context, scope, operation);
  const state = isFailure(refreshed) ? null : refreshed;
  return { ok: true, operation, outcome: "confirmed", requestedLinkId: linkId, state,
    refresh: state ? "ready" : "required",
    message: state ? "Share-link change confirmed. Current state loaded." : "Share-link change confirmed. Read its state to recover the current status." };
}
async function provision(input: ShareLinkScope | (ShareLinkScope & { linkId: string }), operation: "create" | "rotate"): Promise<ShareLinkMutationResult> {
  const parsed = (operation === "create" ? scopeSchema : identitySchema).safeParse(input);
  if (!parsed.success) return failure(operation, "invalid");
  const scope = parsed.data;
  const previous = "linkId" in scope && typeof scope.linkId === "string" ? scope.linkId : null;
  if (operation === "rotate" && previous === null) return failure(operation, "invalid");
  const context = await authenticate(operation);
  if (isFailure(context)) return context;
  const state = await readState(context, scope, operation);
  if (isFailure(state)) return { ...state, operation };
  if (operation === "create" ? state.linkId !== null : state.linkId !== previous) return failure(operation, "conflict");
  let recovery, provisioning;
  try {
    recovery = loadShareLinkRecoveryConfig();
    provisioning = loadShareLinkProvisioningConfig(recovery);
  } catch { return failure(operation, "configuration"); }
  let linkId: string;
  let args;
  try {
    linkId = randomUUID();
    const envelope = createShareLinkEnvelope({ ...scope, linkId }, recovery);
    const proof = signShareLinkProvisioning({ ...scope, linkId, operation, actorId: context.actorId, previousLinkId: previous, envelope }, provisioning);
    args = { p_guild_id: scope.guildId, p_event_id: scope.eventId, p_token_digest: envelope.digest,
      p_token_ciphertext: toShareBytea(envelope.ciphertext), p_token_nonce: toShareBytea(envelope.nonce),
      p_token_auth_tag: toShareBytea(envelope.authTag), p_encryption_key_id: envelope.encryptionKeyId,
      p_provisioning_key_id: proof.keyId, p_provisioning_expires_at: proof.expiresAt, p_provisioning_mac: toShareBytea(proof.mac) };
  } catch { return failure(operation, "configuration"); }
  try {
    // Exactly one mutation request. Transport failures can mean a committed write.
    const result = operation === "create"
      ? await context.client.rpc("create_event_share_link", { ...args, p_link_id: linkId }).retry(false)
      : await context.client.rpc("rotate_event_share_link", { ...args, p_expected_link_id: previous!, p_new_link_id: linkId }).retry(false);
    if (result.error) return rpcFailure(operation, result.error.code, linkId);
    if (result.data !== linkId) return failure(operation, "mutation_unknown", linkId);
  } catch { return failure(operation, "mutation_unknown", linkId); }
  return finishMutation(context, scope, operation, linkId);
}
export async function createEventShareLink(input: ShareLinkScope): Promise<ShareLinkMutationResult> { return provision(input, "create"); }
export async function rotateEventShareLink(input: ShareLinkScope & { linkId: string }): Promise<ShareLinkMutationResult> { return provision(input, "rotate"); }
export async function revokeEventShareLink(input: ShareLinkScope & { linkId: string }): Promise<ShareLinkMutationResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) return failure("revoke", "invalid");
  const scope = parsed.data;
  const context = await authenticate("revoke");
  if (isFailure(context)) return context;
  try {
    const { error } = await context.client.rpc("revoke_event_share_link", { p_guild_id: scope.guildId, p_event_id: scope.eventId, p_link_id: scope.linkId }).retry(false);
    if (error) return rpcFailure("revoke", error.code, scope.linkId);
  } catch { return failure("revoke", "mutation_unknown", scope.linkId); }
  return finishMutation(context, scope, "revoke", scope.linkId);
}
