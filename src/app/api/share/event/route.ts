import "server-only";
import { publicHandlerConfig, createPublicEventHandler } from "@/features/events/public-event-handler";
import { admitPublicRequest } from "@/features/events/public-event-admission";
import { publicPostgresResolver } from "@/features/events/public-event-postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Operator configuration changes require a process restart. No pool is created
// until a validated, admitted POST reaches the database stage.
const config = publicHandlerConfig();
let resolve: ReturnType<typeof publicPostgresResolver> | undefined;
const handler = createPublicEventHandler({
  config: () => config,
  admit: admitPublicRequest,
  async resolve(input, current, signal) {
    if (!config || current !== config) throw new Error("Unavailable");
    resolve ??= publicPostgresResolver(config);
    return resolve(input, config, signal);
  },
});
export const POST = handler;
export const GET = handler;
export const HEAD = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
