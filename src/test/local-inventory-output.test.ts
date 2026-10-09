// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defaultInventoryDestination, inventoryNames, inventorySummary, prepareInventoryOutput, verifyInventoryDestination } from "../../scripts/local-inventory-output.mjs";

const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "go-inventory-unit-"));
  directories.push(directory);
  const root = join(directory, "repository");
  mkdirSync(root);
  execFileSync("git", ["init", "--quiet", root]);
  return { directory, root, destination: join(directory, "local-only", "fixture-inventories") };
}

describe("local-only inventory output", () => {
  it("stores both detailed files outside Git with byte-for-byte contents", () => {
    const s = setup(), output = prepareInventoryOutput(s.root, s.destination);
    const report = { guilds: [{ id: "local-id", name: "local-name" }] }, plan = { proposed: ["local-id"] };
    output.write(report, plan);
    for (const [index, value] of [report, plan].entries()) {
      expect(readFileSync(join(output.directory, inventoryNames[index]), "utf8")).toBe(JSON.stringify(value, null, 2) + "\n");
    }
    expect(readdirSync(s.root)).toEqual([".git"]);
  });

  it("keeps reviewed originals and previous snapshots unchanged", () => {
    const s = setup();
    const original = join(s.destination, "phase-6-3a5b-originals");
    mkdirSync(original, { recursive: true });
    writeFileSync(join(original, inventoryNames[1]), "frozen candidate list");
    const first = prepareInventoryOutput(s.root, s.destination), second = prepareInventoryOutput(s.root, s.destination);
    first.write({ version: 1 }, { proposed: [1] });
    second.write({ version: 2 }, { proposed: [2] });
    expect(first.directory).not.toBe(second.directory);
    expect(readFileSync(join(original, inventoryNames[1]), "utf8")).toBe("frozen candidate list");
    expect(() => first.write({}, {})).toThrow();
    expect(JSON.parse(readFileSync(join(first.directory, inventoryNames[1]), "utf8"))).toEqual({ proposed: [1] });
  });

  it("refuses root, ignored directories and nonexistent paths inside the repository", () => {
    const s = setup();
    for (const path of [s.root, join(s.root, "docs", "reviews"), join(s.root, "ignored", "new")]) {
      expect(() => prepareInventoryOutput(s.root, path)).toThrow(/repository/);
    }
    expect(existsSync(join(s.root, "docs"))).toBe(false);
  });

  it("refuses another Git worktree and bare repository", () => {
    const s = setup(), other = join(s.directory, "other"), bare = join(s.directory, "bare");
    execFileSync("git", ["init", "--quiet", other]);
    execFileSync("git", ["init", "--bare", "--quiet", bare]);
    expect(() => prepareInventoryOutput(s.root, join(other, "reviews"))).toThrow(/Git/);
    expect(() => prepareInventoryOutput(s.root, bare)).toThrow(/Git/);
  });

  it("refuses junctions or symlinks into the repository", () => {
    const s = setup(), alias = join(s.directory, "alias");
    symlinkSync(s.root, alias, process.platform === "win32" ? "junction" : "dir");
    expect(() => prepareInventoryOutput(s.root, join(alias, "new"))).toThrow(/repository/);
    expect(existsSync(join(s.root, "new"))).toBe(false);
  });

  it("revalidates destination before writing if it is redirected", () => {
    const s = setup(), output = prepareInventoryOutput(s.root, s.destination);
    rmSync(output.directory, { recursive: true });
    symlinkSync(s.root, output.directory, process.platform === "win32" ? "junction" : "dir");
    expect(() => output.write({}, {})).toThrow(/repository/);
    expect(existsSync(join(s.root, inventoryNames[0]))).toBe(false);
  });

  it("refuses relative destinations and unavailable storage", () => {
    const s = setup();
    expect(() => verifyInventoryDestination(s.root, "docs/reviews")).toThrow(/absolute/);
    if (process.platform === "win32") {
      vi.stubEnv("LOCALAPPDATA", "");
      expect(() => defaultInventoryDestination()).toThrow(/unavailable/);
    }
    writeFileSync(join(s.directory, "file"), "not a directory");
    expect(() => prepareInventoryOutput(s.root, join(s.directory, "file", "child"))).toThrow();
  });

  it("uses user-local storage by default and rejects environment redirection into Git", () => {
    const s = setup();
    if (process.platform === "win32") {
      vi.stubEnv("LOCALAPPDATA", s.directory);
      expect(defaultInventoryDestination()).toBe(join(s.directory, "GuildOrganizer", "local-only", "fixture-inventories"));
      vi.stubEnv("LOCALAPPDATA", s.root);
      expect(() => prepareInventoryOutput(s.root)).toThrow(/repository/);
    } else {
      expect(defaultInventoryDestination()).not.toContain(s.root);
    }
  });

  it("refuses network paths on Windows and fails closed when Git verification is unavailable", () => {
    const s = setup();
    if (process.platform === "win32") {
      expect(() => prepareInventoryOutput(s.root, "\\\\remote\\share\\fixture-inventories")).toThrow(/local drive/);
    }
    vi.stubEnv("PATH", "");
    expect(() => prepareInventoryOutput(s.root, s.destination)).toThrow(/verify/);
    expect(existsSync(s.destination)).toBe(false);
  });

  it("prints only numeric allowlisted aggregates and fixed labels", () => {
    const privateValue = "do-not-export-private-record";
    const report = {
      totals: { guilds: 3, accounts: 3, marked_guilds: 2, marked_accounts: 2, personal: privateValue },
      target: privateValue, unmatched_guilds: [privateValue], unmatched_accounts: [privateValue], outside_references: [],
    };
    const plan = { target: privateValue, held: [], proposed: [
      { email: "event-builder-e2e-private@example.test", cohort: "original-audit-validation", id: privateValue, name: privateValue },
      { email: "owner-e2e-private@example.test", cohort: "earlier-validation", id: privateValue, name: privateValue },
    ] };
    const summary = inventorySummary(report, plan), serialized = JSON.stringify(summary);
    expect(serialized).not.toContain(privateValue);
    expect(serialized).not.toContain("@example.test");
    expect(summary.proposed).toBe(2);
    expect(summary.cohorts["original-audit-validation"]).toBe(1);
    expect(summary.fixtureKinds["event-builder-e2e"]).toBe(1);
    expect(summary.authorization).toBe("NOT APPROVED FOR DELETION");
    expect(() => inventorySummary({ ...report, totals: { ...report.totals, guilds: privateValue } }, plan)).toThrow(/count/);
  });

  it("keeps detailed filenames ignored and repository review reports sanitized", () => {
    const root = resolve(import.meta.dirname, "../..");
    for (const name of inventoryNames) {
      const result = execFileSync("git", ["check-ignore", "--no-index", `docs/reviews/${name}`], { cwd: root, encoding: "utf8" });
      expect(result.trim()).toBe(`docs/reviews/${name}`);
      expect(existsSync(join(root, "docs/reviews", name))).toBe(false);
    }
    for (const name of ["PHASE_6_3A_5B_HISTORICAL_REVIEW.md", "PHASE_6_3A_5B_VALIDATION.md"]) {
      const contents = readFileSync(join(root, "docs/reviews", name), "utf8");
      expect(contents).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
      expect(contents).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]+/i);
      expect(contents).not.toMatch(/[A-Z]:[\\/]Users[\\/]|\/home\/|supabase_db_|[0-9a-f]{64}/i);
    }
  });
});
