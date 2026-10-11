import { z } from "zod";

// Canonical 32-byte base64url bearer; shared by browser and server, without secrets.
// The final lookahead enforces absolute end (JS $ also accepts a final newline).
export const publicTokenPattern = /^v1\.[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048](?![\s\S])/;
const label = z.string().min(1).max(120);
const slot = z.object({ name: label, roleLabel: label.nullable(), ign: label.nullable(),
  className: label.nullable(), characterRole: label.nullable() }).strict();
const card = z.object({ ordinal: z.number().int().min(1).max(5000), area: label.nullable(),
  team: label.nullable(), party: label.nullable(), slots: z.array(slot).max(8) }).strict();
export const publicLineupSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), eventName: label, eventType: label,
    version: z.number().int().positive().max(2147483647), publishedAt: z.iso.datetime({ offset: true }),
    page: z.number().int().min(0).max(416), pageSize: z.literal(12),
    totalCards: z.number().int().min(0).max(5000), matchedCards: z.number().int().min(0).max(5000),
    cards: z.array(card).max(12) }).strict(),
  z.object({ status: z.literal("updated"), version: z.number().int().positive().max(2147483647) }).strict(),
]);
export const publicRequestSchema = z.object({ token: z.string().regex(publicTokenPattern),
  page: z.number().int().min(0).max(416), version: z.number().int().positive().max(2147483647).nullable(),
  search: z.string().trim().max(80).refine(s => !/[\u0000-\u001f\u007f]/.test(s)) }).strict();
export type PublicLineup = z.infer<typeof publicLineupSchema>;
export type ReadyLineup = Extract<PublicLineup, { status: "ready" }>;
export type PublicLineupRequest = z.infer<typeof publicRequestSchema>;

export function parsePublicLineup(value: unknown): PublicLineup | null {
  const parsed = publicLineupSchema.safeParse(value);
  if (!parsed.success) return null;
  const v = parsed.data;
  if (v.status === "ready" && (v.matchedCards > v.totalCards
    || v.cards.length !== Math.min(12, Math.max(0, v.matchedCards - v.page * 12))
    || new Set(v.cards.map(c => c.ordinal)).size !== v.cards.length)) return null;
  return v;
}

export const publicResponseHeaders = {
  "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
};
