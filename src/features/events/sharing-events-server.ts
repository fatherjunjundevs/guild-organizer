import "server-only";

import { canonicalShareUuid } from "./share-link-crypto";
import { isShareLinkInterfaceEnabled } from "./share-link-feature";
import { canPublishEvent } from "./publication-server";
import { getGuildAccess } from "@/features/guilds/server";
import { createClient } from "@/lib/supabase/server";

export const SHARING_EVENT_PAGE_SIZE = 25;
export type SharingEvent = { id: string; name: string; status: "active" | "archived" };
export type SharingEventsResult =
  | { status: "ready"; events: SharingEvent[]; next: string | null }
  | { status: "disabled" | "forbidden" | "error"; events: []; next: null };

export async function loadSharingEvents(guildId: string, after: string | null = null): Promise<SharingEventsResult> {
  if (!isShareLinkInterfaceEnabled()) return { status: "disabled", events: [], next: null };
  const failed = { status: "error", events: [], next: null } as const;
  try {
    guildId = canonicalShareUuid(guildId);
    if (after !== null) after = canonicalShareUuid(after);
    const access = await getGuildAccess(guildId);
    if (!access) return { status: "forbidden", events: [], next: null };
    const authorization = await canPublishEvent(access);
    if (authorization !== "allowed") return { status: authorization === "error" ? "error" : "forbidden", events: [], next: null };
    const client = await createClient();
    let query = client.from("events").select("id,name,status").eq("guild_id", guildId)
      .order("id", { ascending: true }).limit(SHARING_EVENT_PAGE_SIZE + 1);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error || !data) return { ...failed, events: [] };
    const rows: SharingEvent[] = data.map((row) => {
      if (typeof row.name !== "string" || !["active", "archived"].includes(row.status)) throw new Error("Invalid selector row");
      return { id: canonicalShareUuid(row.id), name: row.name, status: row.status as SharingEvent["status"] };
    });
    const events = rows.slice(0, SHARING_EVENT_PAGE_SIZE);
    return { status: "ready", events, next: rows.length > SHARING_EVENT_PAGE_SIZE ? events.at(-1)!.id : null };
  } catch { return { ...failed, events: [] }; }
}
