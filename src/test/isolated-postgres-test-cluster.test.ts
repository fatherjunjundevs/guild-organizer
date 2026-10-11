// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { assertInactive, createIsolatedCluster, imageDigest, localTarget, ownershipLabels, persistManifest,
  readManifest, recoverIsolatedCluster, repositoryRoot, safeError, verifyContainer, verifyManifest,
  verifyManifestDestination, verifyPinnedPostgresImage, verifyTarget } from "../../scripts/isolated-postgres-test-cluster.mjs";
import { postgresStartupCommand, httpStartupSettings } from "../../scripts/isolated-postgres-test-cluster.mjs";

const mocks = vi.hoisted(() => ({ spawnSync: vi.fn(), home: null as string | null }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawnSync }));
vi.mock("node:os", async importOriginal => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => mocks.home ?? actual.homedir() };
});

const imageId = `sha256:${"d".repeat(64)}`;
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
beforeEach(() => { mocks.spawnSync.mockReset(); mocks.home = null; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const approvedImage = { id: imageId, digests: [imageDigest], os: "linux", architecture: "amd64" };
const daemon = { ID: target.daemonId, OSType: "linux", Architecture: "x86_64" };

// Every Docker/ACL subprocess is mocked. Real filesystem evidence and leases are
// confined to this test's temporary directory; no daemon or database is contacted.
function fakeDocker() {
  const state = { image: structuredClone(approvedImage), daemon: { ...daemon },
    container: null as (Omit<typeof container, "labels"> & { labels: Record<string, string> }) | null,
    imageAvailable: true, onCreate: null as (() => void) | null };
  mocks.spawnSync.mockImplementation((binary: string, args: string[]) => {
    const ok = (stdout: string) => ({ status: 0, stdout, stderr: "" });
    if (binary === "whoami") return ok('"user","S-1-5-21-1000"');
    if (binary === "icacls") return ok("");
    if (binary === "powershell") return ok(JSON.stringify({ owner: "S-1-5-21-1000", protected: true, allow: ["S-1-5-21-1000"] }));
    if (binary !== "docker") throw new Error("Unexpected subprocess");
    if (args[0] === "context") return ok(args[1] === "show" ? target.context : target.endpoint);
    if (args[0] === "info") return ok(JSON.stringify(state.daemon));
    if (args[0] === "image" && args[1] === "inspect") {
      expect(args[2]).toBe(imageDigest);
      return state.imageAvailable ? ok(JSON.stringify(state.image)) : { status: 1, stdout: "", stderr: "private failure" };
    }
    if (args[0] === "ps") return ok(state.container ? (args.includes("{{.Names}}") ? state.container.name.slice(1) : state.container.id) : "");
    if (args[0] === "create") {
      expect(args).toContain(imageDigest);
      const labels: Record<string, string> = {};
      args.forEach((value, i) => { if (value === "--label") { const [key, ...parts] = args[i + 1].split("="); labels[key] = parts.join("="); } });
      const created = { ...structuredClone(container), name: "/" + args[args.indexOf("--name") + 1],
        created: new Date().toISOString(), image: state.image.id, labels };
      state.container = created; state.onCreate?.(); return ok(created.id!);
    }
    if (args[0] === "inspect") return state.container ? ok(JSON.stringify(state.container)) : { status: 1, stdout: "", stderr: "absent" };
    if (args[0] === "rm") {
      expect(args).toEqual(["rm", "--force", state.container?.id]); state.container = null; return ok("");
    }
    throw new Error("Unexpected Docker operation");
  });
  return state;
}
async function inPrivateUnitDirectory(test: () => Promise<void>) {
  const directory = mkdtempSync(join(tmpdir(), "go-image-identity-unit-"));
  mocks.home = directory; vi.stubEnv("LOCALAPPDATA", directory);
  try { await test(); }
  finally { mocks.home = null; rmSync(directory, { recursive: true }); }
}
const removals = () => mocks.spawnSync.mock.calls.filter(([binary, args]) => binary === "docker" && args[0] === "rm");

describe("pinned PostgreSQL repository and local image identities", () => {
  it.each(["amd64", "x86_64"])("accepts distinct digests on an %s daemon", architecture => {
    expect(verifyPinnedPostgresImage(approvedImage, { ...daemon, Architecture: architecture })).toBe(imageId);
    expect(imageId).not.toBe(imageDigest.split("@")[1]);
  });
  it("also accepts the original image-ID-equals-repository-digest representation", () => {
    const legacyId = imageDigest.split("@")[1];
    expect(verifyPinnedPostgresImage({ ...approvedImage, id: legacyId }, daemon)).toBe(legacyId);
    const legacy = { ...record, target: { ...target, imageId: legacyId } };
    expect(verifyManifest(legacy)).toEqual(legacy);
    expect(verifyContainer(legacy, { ...container, image: legacyId })).toBeDefined();
  });
  it.each([
    { digests: [] }, { digests: null }, { digests: imageDigest },
    { digests: ["other/postgres@" + imageDigest.split("@")[1]] }, { digests: ["public.ecr.aws/supabase/postgres:latest"] },
    { id: "sha256:" + "a".repeat(63) }, { id: "sha256:" + "G".repeat(64) }, { id: "sha512:" + "a".repeat(64) },
    { id: null }, { os: "windows" }, { architecture: "arm64" }, { architecture: undefined },
  ])("rejects missing provenance, malformed IDs or unsupported image platforms: %j", changes => {
    expect(() => verifyPinnedPostgresImage({ ...approvedImage, ...changes }, daemon)).toThrow(/unavailable or incompatible/);
  });
  it.each([{ OSType: "windows" }, { Architecture: "aarch64" }, { Architecture: "unknown" }, { Architecture: undefined }])(
    "rejects an unsupported daemon platform: %j", changes => {
      expect(() => verifyPinnedPostgresImage(approvedImage, { ...daemon, ...changes })).toThrow();
    });
  it("records the inspected image ID in the target without a tag or pull fallback", () => {
    fakeDocker(); expect(localTarget()).toEqual(target);
    expect(mocks.spawnSync.mock.calls.every(([binary, args]) => binary === "docker" && ["context", "info", "image"].includes(args[0]))).toBe(true);
  });
  it("fails closed when the pinned image is absent and suppresses Docker stderr", () => {
    const state = fakeDocker(); state.imageAvailable = false;
    expect(() => localTarget()).toThrow(/details suppressed/);
    expect(() => localTarget()).not.toThrow(/private failure/);
  });
  it.each([{ imageId: "sha256:" + "0".repeat(63) }, { imageDigest: "other/postgres@" + imageDigest.split("@")[1] }])(
    "rejects invalid or incorrectly referenced ownership manifests: %j", changes => {
      expect(() => verifyManifest({ ...record, target: { ...target, ...changes } })).toThrow();
    });

  it("persists the verified ID, removes only the exact owned container, and repeats completed recovery", async () => {
    fakeDocker();
    await inPrivateUnitDirectory(async () => {
      const cluster = await createIsolatedCluster();
      try {
        expect(readManifest(cluster.path).target).toEqual(target);
        expect(cluster.verify().image).toBe(imageId);
        await cluster.cleanup(); await cluster.cleanup();
        await expect(recoverIsolatedCluster(cluster.record.runId)).resolves.toBe(cluster.record.runId);
        expect(readManifest(cluster.path).phase).toBe("removed");
        expect(removals()).toHaveLength(1);
        expect(removals()[0][1]).toEqual(["rm", "--force", cluster.record.containerId]);
      } finally { if (cluster.liveLease) await cluster.cleanup(); }
    });
  });
  it("recovers an interrupted exact owned resource using its recorded local image ID", async () => {
    fakeDocker();
    await inPrivateUnitDirectory(async () => {
      const cluster = await createIsolatedCluster();
      try {
        await new Promise<void>(resolve => cluster.liveLease!.close(resolve)); cluster.liveLease = null;
        vi.spyOn(process, "kill").mockImplementation(() => { throw Object.assign(new Error("dead"), { code: "ESRCH" }); });
        await expect(recoverIsolatedCluster(cluster.record.runId)).resolves.toBe(cluster.record.runId);
        expect(readManifest(cluster.path).phase).toBe("removed"); expect(removals()).toHaveLength(1);
      } finally { if (cluster.liveLease) await cluster.cleanup(); }
    });
  });
  it.each(["imageId", "daemonId"])("retains submitted ownership evidence when %s changes during creation", async change => {
    const state = fakeDocker();
    await inPrivateUnitDirectory(async () => {
      state.onCreate = () => {
        if (change === "imageId") state.image.id = "sha256:" + "e".repeat(64);
        else state.daemon.ID = "other-daemon";
      };
      await expect(createIsolatedCluster()).rejects.toThrow(/identity changed/);
      const base = process.platform === "win32" ? mocks.home! : join(mocks.home!, ".local", "state");
      const directory = join(base, "guild-organizer-isolated-postgres", record.repoId);
      const files = readdirSync(directory); expect(files).toHaveLength(1);
      const retained = readManifest(join(directory, files[0]));
      expect(retained.phase).toBe("submitted"); expect(retained.target).toEqual(target);
      expect(retained.containerId).toBeNull(); expect(state.container).not.toBeNull();
      expect(removals()).toHaveLength(0);
    });
  });
  it.each(["imageId", "daemonId", "digest", "platform"])("refuses execution, cleanup and recovery after %s changes", async change => {
    const state = fakeDocker();
    await inPrivateUnitDirectory(async () => {
      const cluster = await createIsolatedCluster();
      const original = readFileSync(cluster.path, "utf8");
      try {
        if (change === "imageId") state.image.id = "sha256:" + "e".repeat(64);
        if (change === "daemonId") state.daemon.ID = "other-daemon";
        if (change === "digest") state.image.digests = [];
        if (change === "platform") state.image.architecture = "arm64";
        expect(() => cluster.verify()).toThrow(); await expect(cluster.cleanup()).rejects.toThrow();
        await expect(recoverIsolatedCluster(cluster.record.runId)).rejects.toThrow();
        expect(removals()).toHaveLength(0); expect(readFileSync(cluster.path, "utf8")).toBe(original);
      } finally { state.image = structuredClone(approvedImage); state.daemon = { ...daemon }; await cluster.cleanup(); }
    });
  });
  it("does not let a forged image-ID manifest authorize a different Docker resource", async () => {
    fakeDocker();
    await inPrivateUnitDirectory(async () => {
      const cluster = await createIsolatedCluster(); const original = readFileSync(cluster.path, "utf8");
      try {
        const forged = { ...cluster.record, target: { ...target, imageId: "sha256:" + "e".repeat(64) } };
        // A syntactically valid record is not proof of current pinned-image ownership.
        expect(verifyManifest(forged)).toEqual(forged);
        writeFileSync(cluster.path, JSON.stringify(forged));
        expect(() => cluster.verify()).toThrow(/manifest changed/);
        await expect(cluster.cleanup()).rejects.toThrow(/manifest changed/);
        await expect(recoverIsolatedCluster(cluster.record.runId)).rejects.toThrow(/identity changed/);
        expect(removals()).toHaveLength(0);
      } finally { writeFileSync(cluster.path, original); await cluster.cleanup(); }
    });
  });
  it("rejects an unrelated inspected container without removing either resource", async () => {
    const state = fakeDocker();
    await inPrivateUnitDirectory(async () => {
      const cluster = await createIsolatedCluster(); const original = structuredClone(state.container);
      try {
        state.container = { ...state.container!, id: "c".repeat(64), image: "sha256:" + "e".repeat(64) };
        expect(() => cluster.verify()).toThrow(/ownership/); await expect(cluster.cleanup()).rejects.toThrow(/ownership/);
        expect(removals()).toHaveLength(0);
      } finally { state.container = original; await cluster.cleanup(); }
    });
  });
});
describe("isolated PostgreSQL ownership boundary", () => {
  it("pins the complete HTTP-only startup command and rejects masking or extra hooks",()=>{
    const r={...record,startupProfile:"http-private-v1"};
    const cmd=[...postgresStartupCommand,...httpStartupSettings.flatMap(s=>["-c",s])];
    const c={...container,cmd,env:[]};expect(verifyContainer(r,c)).toEqual(c);
    for(const change of [{cmd:[...cmd,"-c","shared_preload_libraries=pgaudit"]},
      {cmd:[...cmd,"-c","session_preload_libraries="]},{cmd:cmd.slice(0,-2)},
      {env:["PGOPTIONS=-c log_statement=none"]},{cmd:[...cmd,"-c","log_statement=all"]}]) {
      expect(()=>verifyContainer(r,{...c,...change})).toThrow(/startup profile/);
    }
    expect(()=>verifyManifest({...record,startupProfile:"unknown"})).toThrow();
  });
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
