import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canonicalShareUuid } from "./share-link-crypto";
import type { ShareLinkManagementResult, ShareLinkScopeInput } from "./share-link";

const uuid = z.string().transform((value, context) => {
  try { return canonicalShareUuid(value); }
  catch { context.addIssue({ code: "custom", message: "Invalid identifier" }); return z.NEVER; }
});
const scopeSchema = z.object({ guildId: uuid, eventId: uuid }).strict();
const stateSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("active"), link_id: uuid,
    created_at: z.string().datetime({ offset: true }), available: z.boolean() }).strict(),
  z.object({ state: z.literal("absent"), link_id: z.null(), created_at: z.null(), available: z.literal(false) }).strict(),
  z.object({ state: z.literal("revoked"), link_id: z.null(), created_at: z.null(), available: z.literal(false) }).strict(),
]);

export async function readEventShareLinkManagementState(input: ShareLinkScopeInput): Promise<ShareLinkManagementResult> {
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, operation: "state", code: "invalid", recovery: "none", message: "The share-link identifiers are invalid." };
  const failed = { ok: false, operation: "state", code: "read_failed", recovery: "read_state",
    message: "Share-link status could not be loaded. Reload Status before continuing." } as const;
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { ok: false, operation: "state", code: "unauthenticated", recovery: "none", message: "Sign in to manage Event share links." };
    const { data, error } = await client.rpc("get_event_share_link_management_state", {
      p_guild_id: parsed.data.guildId, p_event_id: parsed.data.eventId,
    });
    if (error) {
      if (error.code === "42501") return { ok: false, operation: "state", code: "forbidden", recovery: "none", message: "Share-link management access is not enabled for your account." };
      if (["P0002", "55000"].includes(error.code)) return { ok: false, operation: "state", code: "unavailable", recovery: "none", message: "This Event is unavailable for the selected Guild." };
      return failed;
    }
    if (!data || data.length !== 1) return failed;
    const row = stateSchema.safeParse(data[0]);
    if (!row.success) return failed;
    const value = row.data;
    return { ok: true, operation: "state", state: value.state === "active"
      ? { state: "active", linkId: value.link_id, createdAt: value.created_at, available: value.available }
      : { state: value.state, linkId: null, createdAt: null, available: false } };
  } catch { return failed; }
}
