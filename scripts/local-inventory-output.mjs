// Detailed local database inventories must never be written into a Git worktree.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, openSync, closeSync, fsyncSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const inventoryNames = [
  "PHASE_6_3A_5B_HISTORICAL_FIXTURES.json",
  "PHASE_6_3A_5B_PROPOSED_DELETIONS.json",
];

export function defaultInventoryDestination() {
  const base = process.platform === "win32" ? process.env.LOCALAPPDATA : join(homedir(), ".local", "share");
  if (!base || !isAbsolute(base)) throw new Error("Local-only inventory storage is unavailable.");
  return join(base, "GuildOrganizer", "local-only", "fixture-inventories");
}

function inside(root, destination) {
  const path = relative(root, destination);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

function existingAncestor(destination) {
  let ancestor = destination;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new Error("Cannot establish inventory destination identity.");
    ancestor = parent;
  }
  return ancestor;
}

export function verifyInventoryDestination(root, destination) {
  if (!isAbsolute(destination)) throw new Error("Inventory destination must be absolute and local-only.");
  if (process.platform === "win32" && !/^[a-z]:[\\/]/i.test(destination)) throw new Error("Inventory destination must use local drive storage.");
  const repository = realpathSync(root);
  const requested = resolve(destination);
  const ancestor = existingAncestor(requested);
  const physical = resolve(realpathSync(ancestor), relative(ancestor, requested));
  if (inside(resolve(root), requested) || inside(repository, physical)) {
    throw new Error("Detailed inventories cannot be stored in the repository.");
  }
  // Detect other worktrees, bare repositories and .git paths, including junctions.
  for (const start of [ancestor, realpathSync(ancestor)]) {
    for (let cursor = start; ; cursor = dirname(cursor)) {
      if (existsSync(join(cursor, ".git"))) throw new Error("Detailed inventories cannot be stored in a Git repository.");
      if (dirname(cursor) === cursor) break;
    }
    try {
      execFileSync("git", ["-C", start, "rev-parse", "--absolute-git-dir"], { stdio: "pipe", env: { ...process.env, LC_ALL: "C" } });
    } catch (error) {
      if (error.status === 128 && error.stderr?.toString().includes("not a git repository")) continue;
      throw new Error("Cannot verify that inventory storage is outside Git.");
    }
    throw new Error("Detailed inventories cannot be stored in a Git repository.");
  }
  return physical;
}

export function prepareInventoryOutput(root, destination = defaultInventoryDestination()) {
  verifyInventoryDestination(root, destination); // Before any database inspection or output.
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  const base = verifyInventoryDestination(root, destination);
  // Fresh snapshots never overwrite the independently reviewed original candidate list.
  const directory = mkdtempSync(join(base, "snapshot-"));
  verifyInventoryDestination(root, directory);
  return {
    directory,
    write(report, plan) {
      verifyInventoryDestination(root, directory);
      for (const [index, data] of [report, plan].entries()) {
        const contents = Buffer.from(JSON.stringify(data, null, 2) + "\n");
        const path = join(directory, inventoryNames[index]);
        const fd = openSync(path, "wx", 0o600); // Refuse overwrites and pre-existing symlinks.
        try {
          writeFileSync(fd, contents);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        const digest = value => createHash("sha256").update(value).digest("hex");
        if (digest(contents) !== digest(readFileSync(path))) throw new Error("Local inventory verification failed.");
      }
    },
  };
}

// Explicit numeric allowlist: never serialize IDs, emails, names, targets or paths.
export function inventorySummary(report, plan) {
  const count = value => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid inventory aggregate count.");
    return value;
  };
  const cohorts = ["original-audit-validation", "authorization-repair-validation", "earlier-validation"];
  return {
    totals: Object.fromEntries(["guilds", "accounts", "marked_guilds", "marked_accounts"].map(key => [key, count(report.totals[key])])),
    unmatched: { guilds: count(report.unmatched_guilds.length), accounts: count(report.unmatched_accounts.length) },
    proposed: count(plan.proposed.length),
    held: count(plan.held.length),
    fixtureKinds: Object.fromEntries(["event-builder-e2e", "owner-e2e", "role-owner"].map(kind => [kind, count(plan.proposed.filter(item => item.email?.startsWith(`${kind}-`)).length)])),
    cohorts: Object.fromEntries(cohorts.map(cohort => [cohort, count(plan.proposed.filter(item => item.cohort === cohort).length)])),
    reportedEventBuilderCohorts: Object.fromEntries(cohorts.slice(0, 2).map(cohort => [cohort, count(plan.proposed.filter(item => item.cohort === cohort && item.email?.startsWith("event-builder-e2e-")).length)])),
    outsideReferences: count(report.outside_references.length),
    authorization: "NOT APPROVED FOR DELETION",
  };
}
