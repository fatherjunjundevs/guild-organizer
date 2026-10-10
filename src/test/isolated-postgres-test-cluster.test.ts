// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { assertInactive, imageDigest, imageId, localTarget, ownershipLabels, persistManifest,
  readManifest, repositoryRoot, safeError, verifyContainer, verifyManifest, verifyManifestDestination, verifyTarget } from "../../scripts/isolated-postgres-test-cluster.mjs";

const runId = "a".repeat(32);
const target = { context: "desktop-linux", endpoint: "npipe:////./pipe/dockerDesktopLinuxEngine", daemonId: "owned-daemon", imageId, imageDigest };
const record = { version: 1, runId, repoRoot: repositoryRoot,
  repoId: createHash("sha256").update(repositoryRoot).digest("hex"), target,
  containerName: `go-security-pg-${runId}`, containerId: "b".repeat(64), intentAt: "2026-10-10T00:00:00.000Z",
  createdAt: "2026-10-10T00:00:01.000Z", phase: "created", pid: process.pid, leasePort: 50000,
  database: `go_share_test_${runId}`, marker: `go-disposable:${runId}`, identity: null };
const container = { id: record.containerId, name: `/${record.containerName}`, created: record.createdAt,
  image: imageId, configImage: imageDigest, labels: ownershipLabels(record), state: "created", mounts: [], ports: { "5432/tcp": null },
  host: { NetworkMode: "none", Privileged: false, AutoRemove: false, PidMode: "", IpcMode: "private", RestartPolicy: { Name: "no" },
    Memory: 2 * 1024 ** 3, NanoCpus: 2 * 10 ** 9, ShmSize: 128 * 1024 ** 2, Binds: [], PortBindings: {}, Mounts: [],
    Tmpfs: { "/var/lib/postgresql/data": "rw,noexec,nosuid,nodev,size=1073741824" } } };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("isolated PostgreSQL ownership boundary", () => {
  it("accepts an exact registered container, never requiring a development target", () => {
    expect(verifyManifest(record)).toEqual(record);
    expect(verifyContainer(record, container)).toEqual(container);
  });
  for (const field of ["daemonId", "endpoint", "imageId", "imageDigest", "context"]) {
    it(`refuses changed target ${field}`, () => expect(() => verifyTarget(target, { ...target, [field]: "other" })).toThrow());
  }
  for (const [label, changes] of Object.entries({ missingId: { containerId: null }, wrongRun: { runId: "x" },
    otherRepo: { repoRoot: "unregistered" }, otherDatabase: { database: "postgres" }, wrongMarker: { marker: "other" },
    unrecordedStage: { phase: "unknown" }, missingIdentity: { phase: "ready" }, credential: { password: "must-never-persist" },
    nestedCredential: { target: { ...target, password: "must-never-persist" } } })) {
    it(`refuses ${label} manifest`, () => expect(() => verifyManifest({ ...record, ...changes })).toThrow());
  }
  for (const [label, changes] of Object.entries({ wrongId: { id: "c".repeat(64) }, wrongImage: { image: "other" },
    mutableTag: { configImage: "supabase/postgres:latest" }, misleadingName: { name: "/supabase_db_guild-organizer" },
    wrongTimestamp: { created: "2026-10-11T00:00:00.000Z" }, missingLabel: { labels: {} },
    developmentLabel: { labels: { ...container.labels, "com.supabase.cli.project": "guild-organizer" } },
    publishedPort: { ports: { "5432/tcp": [{ HostPort: "55422" }] } },
    volume: { mounts: [{ Type: "volume", Destination: "/var/lib/postgresql/data" }] } })) {
    it(`refuses ${label} container`, () => expect(() => verifyContainer(record, { ...container, ...changes })).toThrow());
  }
  for (const [label, changes] of Object.entries({ developmentNetwork: { NetworkMode: "supabase_network" },
    privileged: { Privileged: true }, hostPid: { PidMode: "host" }, sharedIpc: { IpcMode: "host" },
    autoRemove: { AutoRemove: true }, restart: { RestartPolicy: { Name: "always" } },
    bind: { Binds: ["development:/data"] }, additionalMount: { Mounts: [{}] },
    hostPort: { PortBindings: { "5432/tcp": [] } }, unboundedMemory: { Memory: 0 },
    wrongStorage: { Tmpfs: { "/unregistered": "rw" } } })) {
    it(`refuses ${label}`, () => expect(() => verifyContainer(record, { ...container, host: { ...container.host, ...changes } })).toThrow());
  }
  it("refuses current or reused live PIDs as recovery ownership evidence", async () => {
    await expect(assertInactive(record)).rejects.toThrow(/active|reused/);
  });
  it("refuses uncertain process inactivity", async () => {
    vi.spyOn(process, "kill").mockImplementation(() => { throw Object.assign(new Error("access denied"), { code: "EPERM" }); });
    await expect(assertInactive(record)).rejects.toThrow("access denied");
  });
  it("refuses an active lease even with a misleading dead process identifier", async () => {
    const server = createServer(socket => socket.destroy());
    await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test lease");
    vi.spyOn(process,"kill").mockImplementation(() => { throw Object.assign(new Error("dead"), { code: "ESRCH" }); });
    try { await expect(assertInactive({ ...record, leasePort: address.port })).rejects.toThrow(/lease/); }
    finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it("refuses Docker overrides before contacting any daemon", () => {
    vi.stubEnv("DOCKER_HOST", "tcp://production:2376");
    expect(() => localTarget()).toThrow(/overrides/);
  });
  it("refuses local-only manifests inside the source checkout", () => {
    expect(() => verifyManifestDestination(repositoryRoot)).toThrow();
    expect(() => verifyManifestDestination(join(repositoryRoot,"docs"))).toThrow();
  });
  it("persists exact creation intent and atomically updates without secrets", () => {
    const directory = mkdtempSync(join(tmpdir(), "go-isolation-unit-"));
    try {
      const path = join(directory, "record.json");
      persistManifest(path, record, true);
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(record);
      expect(() => persistManifest(path, record, true)).toThrow();
      persistManifest(path, { ...record, phase: "starting" });
      expect(JSON.parse(readFileSync(path, "utf8")).phase).toBe("starting");
      expect(() => persistManifest(path, { ...record, password: "secret" })).toThrow();
    } finally { rmSync(directory, { recursive: true }); }
  });
  it("fails creation intent persistence when the destination is unavailable", () => {
    expect(() => persistManifest(join(tmpdir(), "missing-" + runId, "manifest.json"), record, true)).toThrow();
  });
  it("refuses missing and corrupt durable ownership evidence", () => {
    const directory = mkdtempSync(join(tmpdir(), "go-isolation-unit-"));
    try {
      const path = join(directory, "missing.json");
      expect(() => readManifest(path)).toThrow();
      writeFileSync(path, "{corrupted");
      expect(() => readManifest(path)).toThrow();
    } finally { rmSync(directory, { recursive: true }); }
  });
  it("never emits raw SQL, connection strings or bearer credentials", () => {
    expect(safeError(new Error("postgres://user:password@host v1.secret"))).not.toMatch(/postgres:|password|v1\./);
  });
});
