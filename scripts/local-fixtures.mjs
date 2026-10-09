// Explicit recovery only. Historical resources have no ownership manifests and
// cannot be adopted by this command. No prefix-based deletion is supported.
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { LocalFixtureRun, manifestDirectory, manifestSchema, verifiedLocalEnvironment } from "../e2e/helpers/local-fixture-lifecycle.ts";
process.chdir(resolve(import.meta.dirname, ".."));
const env = verifiedLocalEnvironment();
const directory = manifestDirectory();
if (process.argv[2] === "recover" && process.argv.length === 4) {
  await LocalFixtureRun.recover(process.argv[3]);
  console.log("Exact recorded local run verified and cleaned.");
} else if (process.argv[2] === "list" && process.argv.length === 3) {
  let names = [];
  try { names = readdirSync(directory).filter(n => n.endsWith(".json")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const name of names) {
    const m = manifestSchema.parse(JSON.parse(readFileSync(join(directory, name), "utf8")));
    console.log(JSON.stringify({ run: m.run, status: m.status, startedAt: m.startedAt, sameTarget: m.target.fingerprint === env.target.fingerprint, accounts: m.users.length, guilds: m.guilds.length, failures: m.failures }));
  }
} else throw new Error("Usage: node scripts/local-fixtures.mjs list | recover <exact-run-UUID>");
