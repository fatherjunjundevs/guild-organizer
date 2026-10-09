// Ephemeral local-only configuration for authenticated browser sharing tests.
// No secret files, CLI key arguments, production targets, or persistent test keys.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createConnection } from "node:net";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const project = readFileSync("supabase/config.toml", "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!project) throw new Error("Local project identity missing");
function docker(args, input, sensitive = false) {
  const result = spawnSync("docker", args, { input, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(sensitive ? "Local ephemeral key operation failed (details suppressed)" : "Local Docker verification failed");
  return result.stdout;
}
const ids = docker(["ps", "-q", "--filter", `label=com.supabase.cli.project=${project}`]).trim().split(/\s+/).filter(Boolean);
const container = ids.map((id) => JSON.parse(docker(["inspect", id]))[0]).find((c) => c.Config.Image.includes("supabase/postgres:"));
if (!container || resolve(container.Config.Labels["com.supabase.cli.workdir"] || "") !== root) throw new Error("Refusing unverified local Supabase container");
const portBusy = await new Promise((done) => {
  const socket = createConnection({ host: "127.0.0.1", port: 3000 });
  socket.once("connect", () => { socket.destroy(); done(true); });
  socket.once("error", () => { socket.destroy(); done(false); });
});
if (portBusy) throw new Error("Stop the existing local port-3000 server before running ephemeral sharing E2E");
const provisioning = randomBytes(32);
const aes = randomBytes(32);
const keyId = `local_e2e_${randomBytes(8).toString("hex")}`;
const aesId = "local_e2e_aes";
function sql(statement) {
  return docker(["exec", "-i", container.Id, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    "set log_statement='none'; set log_min_error_statement='panic'; set log_parameter_max_length=0; set log_parameter_max_length_on_error=0;\n" + statement, true);
}
let installed = false;
try {
  sql(`insert into private.event_share_link_provisioning_keys(id,key_material,activated_at,retired_at) values('${keyId}',decode('${provisioning.toString("hex")}','hex'),clock_timestamp()-interval '1 minute',clock_timestamp()+interval '30 minutes');`);
  installed = true;
  const result = spawnSync("pnpm", ["exec", "playwright", "test", "e2e/event-share-link.spec.ts", "e2e/event-publication-workflow.spec.ts", "--workers=1"], {
    shell: process.platform === "win32", stdio: "inherit",
    env: { ...process.env, APP_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000", SHARE_LINK_INTERFACE_ENABLED: "true", PLAYWRIGHT_NO_COPY_PROMPT: "1",
      SHARE_LINK_E2E_KEYS: "true", SHARE_LINK_PROVISIONING_KEY_ID: keyId,
      SHARE_LINK_PROVISIONING_KEY_BASE64: provisioning.toString("base64"),
      SHARE_LINK_RECOVERY_KEY_ID: aesId, SHARE_LINK_RECOVERY_KEYS_JSON: JSON.stringify({ [aesId]: aes.toString("base64") }) },
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (installed) {
    sql(`delete from private.event_share_link_provisioning_keys where id='${keyId}' and key_material=decode('${provisioning.toString("hex")}','hex');`);
    if (sql(`select count(*) from private.event_share_link_provisioning_keys where id='${keyId}';`).trim() !== "0") throw new Error("Ephemeral test-key cleanup failed");
    console.log("Ephemeral local sharing key removed; environment files unchanged.");
  }
}
