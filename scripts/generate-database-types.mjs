import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const outputPath = "src/types/database.types.ts";
const checkOnly = process.argv.includes("--check");

function normalize(value) {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trimEnd() + "\n";
}

const generated = normalize(
  execSync("pnpm supabase gen types typescript --local", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);

if (checkOnly) {
  const current = normalize(readFileSync(outputPath, "utf8"));

  if (current !== generated) {
    console.error("database.types.ts is out of date. Run: pnpm db:types");
    process.exit(1);
  }

  console.log("database.types.ts is up to date.");
} else {
  writeFileSync(outputPath, generated, "utf8");
  console.log(`Generated ${outputPath}`);
}
