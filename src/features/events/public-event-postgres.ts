import "server-only";
import { Pool } from "pg";
import { publicPoolOptions, type PublicEventConfig } from "./public-event-config";
import { createPublicResolver } from "./public-event-resolver";

export function publicPostgresResolver(config: PublicEventConfig) {
  const pool = new Pool(publicPoolOptions(config));
  // pg removes the failed idle backend. Never forward its raw error to logs.
  pool.on("error", () => {});
  // Install before pg-pool removes its idle listener and resolves acquisition.
  // A FATAL in that parser interval must not become an unhandled process error.
  pool.on("connect", client => { client.on("error", () => {}); });
  let closed = false;
  let closing: Promise<void> | undefined;
  const resolve = createPublicResolver({
    async connect() {
      if (closed) throw new Error("Unavailable");
      const client = await pool.connect();
      let failed = false;
      // pg-pool removes its idle listener while the client is checked out.
      // Consume active socket errors too, and never return that backend to it.
      const error = () => { failed = true; };
      client.on("error", error);
      return {
        query: async (sql, values) => {
          if (failed) throw new Error("Unavailable");
          return client.query(sql, values ? Array.from(values) : undefined);
        },
        release: destroy => { client.removeListener("error", error); client.release(Boolean(destroy || failed)); },
      };
    },
  });
  // Explicit shutdown for the owned integration coordinator. Runtime idle and
  // lifetime limits retire pooled backends without retaining a process hook.
  return Object.assign(resolve, { close: () => { closed = true; return closing ??= pool.end(); } });
}
