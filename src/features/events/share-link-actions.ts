"use server";

import { isShareLinkInterfaceEnabled } from "./share-link-feature";
import { readEventShareLinkManagementState } from "./share-link-management-server";
import { createEventShareLink, copyEventShareLink, rotateEventShareLink, revokeEventShareLink } from "./share-link-server";
import type { ShareLinkCopyResult, ShareLinkFailure, ShareLinkManagementMutationResult, ShareLinkManagementResult,
  ShareLinkScopeInput, ShareLinkIdentityInput, ShareLinkOperation, ShareLinkMutationResult } from "./share-link";

function disabled(operation: ShareLinkOperation): ShareLinkFailure {
  return { ok: false, operation, code: "configuration", recovery: "none", message: "The share-link interface is disabled." };
}

export async function readEventShareLinkAction(input: ShareLinkScopeInput): Promise<ShareLinkManagementResult> {
  return isShareLinkInterfaceEnabled() ? readEventShareLinkManagementState(input) : disabled("state");
}
export async function copyEventShareLinkAction(input: ShareLinkIdentityInput): Promise<ShareLinkCopyResult> {
  return isShareLinkInterfaceEnabled() ? copyEventShareLink(input) : disabled("copy");
}
async function mutate(input: ShareLinkScopeInput, operation: "create" | "rotate" | "revoke",
  run: () => Promise<ShareLinkMutationResult>): Promise<ShareLinkManagementMutationResult> {
  if (!isShareLinkInterfaceEnabled()) return disabled(operation);
  // Existing operations authenticate, validate strict inputs and submit one RPC
  // with retries disabled. Never derive management state from legacy null IDs.
  const result = await run();
  if (!result.ok) return result;
  if (result.refresh === "required") return { ...result, state: null };
  const read = await readEventShareLinkManagementState({ guildId: input.guildId, eventId: input.eventId });
  return { ...result, state: read.ok ? read.state : null, refresh: read.ok ? "ready" : "required" };
}
export async function createEventShareLinkAction(input: ShareLinkScopeInput): Promise<ShareLinkManagementMutationResult> {
  return mutate(input, "create", () => createEventShareLink(input));
}
export async function rotateEventShareLinkAction(input: ShareLinkIdentityInput): Promise<ShareLinkManagementMutationResult> {
  return mutate(input, "rotate", () => rotateEventShareLink(input));
}
export async function revokeEventShareLinkAction(input: ShareLinkIdentityInput): Promise<ShareLinkManagementMutationResult> {
  return mutate(input, "revoke", () => revokeEventShareLink(input));
}
