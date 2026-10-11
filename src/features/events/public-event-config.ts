import "server-only";
import { isIP } from "node:net";
import { checkServerIdentity, type PeerCertificate } from "node:tls";
import { isShareLinkInterfaceEnabled } from "./share-link-feature";

export class PublicEventConfig {
  #password: string;
  #redisCredential: string;
  #proxyKey: Buffer;
  #admissionKey: Buffer;
  constructor(readonly origin: string, readonly host: string, readonly port: number, readonly database: string,
    readonly ca: string | undefined, readonly isolatedRun: string | undefined,
    readonly redisUrl: string, password: string, redisCredential: string, proxyKey: Buffer, admissionKey: Buffer) {
    this.#password = password; this.#redisCredential = redisCredential;
    this.#proxyKey = proxyKey; this.#admissionKey = admissionKey;
  }
  databasePassword() { return this.#password; }
  admissionCredential() { return this.#redisCredential; }
  proxyKey() { return this.#proxyKey; }
  admissionKey() { return this.#admissionKey; }
}

function key(value: string | undefined): Buffer | null {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.length === 32 && bytes.toString("base64") === value ? bytes : null;
}

export function readPublicEventConfig(env: Record<string, string | undefined> = process.env): PublicEventConfig | null {
  // Hosted enablement requires a later independent privacy/deployment review.
  if (!isShareLinkInterfaceEnabled(env) || env.PUBLIC_EVENT_VIEWER_ENABLED !== "true") return null;
  if (Object.keys(env).some(name => /^PG(?:OPTIONS|SERVICE|SERVICEFILE|HOSTADDR|SSLMODE|SSLROOTCERT|SSLCERT|SSLKEY)$/.test(name) && env[name])) return null;
  try {
    const origin = new URL(env.APP_ORIGIN ?? "");
    const redis = new URL(env.PUBLIC_EVENT_ADMISSION_URL ?? "");
    const proxy = key(env.PUBLIC_EVENT_PROXY_KEY), admission = key(env.PUBLIC_EVENT_ADMISSION_KEY);
    const host = env.PUBLIC_EVENT_DB_HOST ?? "", database = env.PUBLIC_EVENT_DB_NAME ?? "";
    const password = env.PUBLIC_EVENT_DB_PASSWORD ?? "", credential = env.PUBLIC_EVENT_ADMISSION_CREDENTIAL ?? "";
    const port = Number(env.PUBLIC_EVENT_DB_PORT ?? "5432");
    const run = env.PUBLIC_EVENT_ISOLATED_RUN_ID;
    if ((origin.protocol !== "https:" && !(origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)))
      || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash
      || redis.protocol !== "https:" || redis.username || redis.password || redis.search || redis.hash
      || redis.pathname !== "/" || !proxy || !admission || !host || /[\s/@?#]/.test(host)
      || !/^[A-Za-z0-9_]{1,63}$/.test(database) || !Number.isInteger(port) || port < 1 || port > 65535
      || password.length < 32 || password.length > 256 || /[\r\n\0]/.test(password)
      || credential.length < 16 || credential.length > 2048 || /[\r\n\0]/.test(credential)) return null;
    if (run && (!/^[a-f0-9]{32}$/.test(run) || database !== `go_share_test_${run}`
      || !["127.0.0.1", "::1"].includes(host) || !isIP(host))) return null;
    return new PublicEventConfig(origin.origin, host, port, database, env.PUBLIC_EVENT_DB_CA, run,
      redis.origin, password, credential, proxy, admission);
  } catch { return null; }
}

// Explicit fields, never a connection URL (whose SSL options can replace TLS).
export function publicPoolOptions(config: PublicEventConfig) {
  return { host: config.host, port: config.port, database: config.database,
    user: "go_event_share_reader", password: config.databasePassword(),
    ssl: config.isolatedRun ? false as const : { rejectUnauthorized: true, minVersion: "TLSv1.2" as const,
      checkServerIdentity: (_hostname: string, certificate: PeerCertificate) => checkServerIdentity(config.host, certificate),
      ...(config.ca ? { ca: config.ca } : {}) },
    max: 2, connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000, maxLifetimeSeconds: 60,
    query_timeout: 3000, statement_timeout: 2000, idle_in_transaction_session_timeout: 3000,
    application_name: "guild-organizer-public-reader", options: "" };
}
