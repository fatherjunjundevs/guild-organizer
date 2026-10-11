import "server-only";
import { publicRequestSchema, publicResponseHeaders, parsePublicLineup, type PublicLineupRequest } from "./public-lineup";
import { readPublicEventConfig, type PublicEventConfig } from "./public-event-config";
import { admitPublicRequest } from "./public-event-admission";
import { readBoundedJson, PublicBodyError } from "./public-bounded-json";

export function publicReply(status: number, body: unknown) {
  return Response.json(body, { status, headers: { ...publicResponseHeaders,
    ...(status === 405 ? { Allow: "POST" } : {}), ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}

type Dependencies = {
  config: () => PublicEventConfig | null;
  admit: typeof admitPublicRequest;
  resolve: (input: PublicLineupRequest, config: PublicEventConfig, signal?: AbortSignal) => Promise<unknown>;
};
export function createPublicEventHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const failure = (status: number) => publicReply(status, { status: "unavailable" });
    try {
      if (request.method !== "POST") return failure(405);
      const config = deps.config(); if (!config) return failure(503);
      if (new URL(request.url).search || request.headers.get("origin") !== config.origin
        || request.headers.get("sec-fetch-site") !== "same-origin"
        || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return failure(403);
      const length = request.headers.get("content-length");
      if (length !== null && (!/^\d{1,4}$/.test(length) || Number(length) > 1024)) return failure(413);
      const admission = await deps.admit(request, config);
      if (admission !== "allowed") return failure(admission === "limited" ? 429 : 503);
      const parsed = publicRequestSchema.safeParse(await readBoundedJson(request.body, 1024, 2000)); if (!parsed.success) return failure(400);
      if (request.signal.aborted) return failure(503);
      const raw = await deps.resolve(parsed.data, config, request.signal);
      if (raw === null) return failure(404);
      const dto = parsePublicLineup(raw); if (!dto || Buffer.byteLength(JSON.stringify(dto)) > 262144) return failure(503);
      return publicReply(200, dto);
    } catch (error) { return failure(error instanceof PublicBodyError ? error.status : 503); }
  };
}

export const publicHandlerConfig = readPublicEventConfig;
