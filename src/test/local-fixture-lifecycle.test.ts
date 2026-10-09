// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalBackend, LocalFixtureRun, ownershipTag, verifiedLocalEnvironment, type FixtureBackend, type GuildRecord, type UserRecord } from "../../e2e/helpers/local-fixture-lifecycle";
const directories: string[] = [];
const runs: LocalFixtureRun[] = [];
afterEach(async () => {
    for (const run of runs.splice(0))
        await run.cleanup().catch(() => { });
    for (const directory of directories.splice(0))
        rmSync(directory, { recursive: true });
    vi.restoreAllMocks();
});
function setup() {
    const directory = mkdtempSync(join(tmpdir(), "go-fixture-unit-"));
    directories.push(directory);
    const users = new Map<string, UserRecord>(), guilds = new Map<string, GuildRecord>();
    let locked = false;
    const backend: FixtureBackend = {
        target: { root: process.cwd(), project: "guild-organizer", container: "a".repeat(64), system: "123", databaseOid: "5", api: "http://127.0.0.1:55421", fingerprint: "unit-local-target" },
        verifyTarget: vi.fn(async () => { }),
        users: vi.fn(async (intent) => [...users.values()].filter(u => u.id === intent.id || u.email === intent.email)),
        guilds: vi.fn(async (intent) => [...guilds.values()].filter(g => g.id === intent.id || g.name === intent.name)),
        outsideReferences: vi.fn(async () => []),
        deleteGuild: vi.fn(async (g) => { guilds.delete(g.id); }),
        deleteUser: vi.fn(async (u) => { users.delete(u.id); }),
        authDependents: vi.fn(async () => { }),
        remaining: vi.fn(async (u: string[], g: string[]) => u.filter(id => users.has(id)).length + g.filter(id => guilds.has(id)).length),
        exclusive: async (_run, work) => { if (locked)
            throw new Error("Another cleanup owns this run"); locked = true; try {
            return await work();
        }
        finally {
            locked = false;
        } },
    };
    async function start() { const run = await LocalFixtureRun.start(backend, directory); runs.push(run); return run; }
    async function account(run: LocalFixtureRun, register = true) {
        const intent = run.userIntent(), id = randomUUID();
        users.set(id, { id, email: intent.email, createdAt: new Date(Date.now() + 10).toISOString(), tag: ownershipTag(run.record, intent) });
        if (register)
            await run.registeredUser(intent, id);
        return { intent, id };
    }
    async function guild(run: LocalFixtureRun, owner: string, register = true) {
        const intent = run.guildIntent(owner), id = randomUUID();
        guilds.set(id, { id, name: intent.name, owner, members: [owner], createdAt: new Date(Date.now() + 10).toISOString() });
        if (register)
            await run.registeredGuild(intent, id);
        return { intent, id };
    }
    return { backend, directory, start, account, guild, users, guilds };
}
describe("verified local fixture lifecycle", () => {
    it("closes resources, removes Guilds before Auth, and verifies deletion", async () => {
        const s = setup(), run = await s.start(), user = await s.account(run);
        await s.guild(run, user.id);
        const close = vi.fn(async () => { });
        run.resource(close);
        await run.cleanup();
        expect(close).toHaveBeenCalledOnce();
        expect(close.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(s.backend.deleteGuild).mock.invocationCallOrder[0]);
        expect(vi.mocked(s.backend.deleteGuild).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(s.backend.deleteUser).mock.invocationCallOrder[0]);
        expect(s.users.size + s.guilds.size).toBe(0);
        expect(run.record.status).toBe("complete");
    });
    it("reconciles lost Auth and Guild creation responses from persisted intents", async () => {
        const s = setup(), run = await s.start();
        const u = await s.account(run, false);
        await run.registeredUser(u.intent, u.id);
        await s.guild(run, u.id, false);
        await run.cleanup();
        expect(s.users.size + s.guilds.size).toBe(0);
    });
    it("cleans an account created before a session or Guild could be created", async () => {
        const s = setup(), run = await s.start();
        await s.account(run, false);
        await run.cleanup();
        expect(s.users.size).toBe(0);
    });
    it("handles intents whose requests never reached the server", async () => {
        const s = setup(), run = await s.start();
        run.userIntent();
        await run.cleanup();
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("fails the run on Guild deletion failure and preserves accounts/evidence", async () => {
        const s = setup(), run = await s.start(), u = await s.account(run);
        await s.guild(run, u.id);
        vi.mocked(s.backend.deleteGuild).mockRejectedValue(new Error("failure"));
        await expect(run.cleanup()).rejects.toThrow("Local fixture cleanup failed");
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
        expect(JSON.parse(readFileSync(run.path, "utf8")).status).toBe("failed");
    });
    it("aggregates every Auth deletion failure", async () => {
        const s = setup(), run = await s.start();
        await s.account(run);
        await s.account(run);
        vi.mocked(s.backend.deleteUser).mockRejectedValue(new Error("failure"));
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteUser).toHaveBeenCalledTimes(2);
        expect(run.record.failures.filter(f => f.startsWith("Auth deletion failed"))).toHaveLength(2);
    });
    it("detects deletion APIs returning success while records remain", async () => {
        const s = setup(), run = await s.start();
        await s.account(run);
        vi.mocked(s.backend.deleteUser).mockImplementation(async () => { });
        await expect(run.cleanup()).rejects.toThrow();
        expect(run.record.failures).toContain("Registered fixture records remain");
    });
    it("is idempotent and joins competing cleanup calls", async () => {
        const s = setup(), run = await s.start();
        await s.account(run);
        await Promise.all([run.cleanup(), run.cleanup()]);
        await run.cleanup();
        expect(s.backend.deleteUser).toHaveBeenCalledOnce();
    });
    it("does not allow another run to adopt a fixture with matching email or ID", async () => {
        const s = setup(), run = await s.start(), u = await s.account(run);
        s.users.get(u.id)!.tag = { ...ownershipTag(run.record, u.intent), run: randomUUID() };
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it.each(["name", "owner", "createdAt", "members"] as const)("rejects changed Guild %s", async (field) => {
        const s = setup(), run = await s.start(), u = await s.account(run), g = await s.guild(run, u.id);
        if (field === "members")
            s.guilds.get(g.id)!.members.push(randomUUID());
        else
            s.guilds.get(g.id)![field] = field === "owner" ? randomUUID() : "mismatch";
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteGuild).not.toHaveBeenCalled();
    });
    it("refuses application references outside the registered Guilds", async () => {
        const s = setup(), run = await s.start();
        await s.account(run);
        vi.mocked(s.backend.outsideReferences).mockResolvedValue(["public.events.created_by"]);
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("refuses target identity changes before deleting anything", async () => {
        const s = setup(), run = await s.start();
        await s.account(run);
        vi.mocked(s.backend.verifyTarget).mockRejectedValue(new Error("Original local target changed"));
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("rejects unregistered owners and resource registration", async () => {
        const s = setup(), run = await s.start();
        expect(() => run.guildIntent(randomUUID())).toThrow("Unregistered");
        await expect(run.registeredUser({ intent: randomUUID(), email: "x", id: null, createdAt: null, stage: "planned" }, randomUUID())).rejects.toThrow("Unregistered");
    });
    it("fails before creation when initial manifest persistence fails", async () => {
        const s = setup();
        await expect(LocalFixtureRun.start(s.backend, s.directory, () => { throw new Error("disk failure"); })).rejects.toThrow("disk failure");
        expect(s.backend.users).not.toHaveBeenCalled();
    });
    it("persists intent before exposing it to a creation request", async () => {
        const s = setup(), run = await s.start(), intent = run.userIntent();
        expect(JSON.parse(readFileSync(run.path, "utf8")).users[0]).toEqual(intent);
        expect(readFileSync(run.path, "utf8")).not.toMatch(/password|session_token|bearer|adminKey|publishableKey|ciphertext/);
    });
    it("refuses recovery while the original process is alive", async () => {
        const s = setup(), run = await s.start();
        await expect(LocalFixtureRun.recover(run.record.run, s.backend, s.directory)).rejects.toThrow("active");
    });
    it("recovers interrupted failed runs and can repeat after partial cleanup", async () => {
        const s = setup(), run = await s.start(), u = await s.account(run);
        await s.guild(run, u.id);
        vi.mocked(s.backend.deleteUser).mockRejectedValueOnce(new Error("failure"));
        await expect(run.cleanup()).rejects.toThrow();
        const record = JSON.parse(readFileSync(run.path, "utf8"));
        record.pid = 2147483647;
        writeFileSync(run.path, JSON.stringify(record));
        await LocalFixtureRun.recover(record.run, s.backend, s.directory);
        await LocalFixtureRun.recover(record.run, s.backend, s.directory);
        expect(s.users.size + s.guilds.size).toBe(0);
    });
    it("refuses ambiguous intent lookup", async () => {
        const s = setup(), run = await s.start(), u = await s.account(run);
        const duplicate = { ...s.users.get(u.id)!, id: randomUUID() };
        s.users.set(duplicate.id, duplicate);
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("isolates concurrent runs and never deletes unregistered resources", async () => {
        const s = setup(), a = await s.start(), b = await s.start();
        const ua = await s.account(a), ub = await s.account(b);
        await s.guild(a, ua.id);
        await s.guild(b, ub.id);
        await a.cleanup();
        expect(s.users.has(ub.id)).toBe(true);
        await b.cleanup();
        expect(s.users.size + s.guilds.size).toBe(0);
    });
    it("fails closed when resources cannot be closed", async () => {
        const s = setup(), run = await s.start();
        await s.account(run);
        run.resource(async () => { throw new Error("open browser"); });
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("fails if Auth dependent verification fails after account removal", async () => {
        const s = setup(), run = await s.start();
        await s.account(run);
        vi.mocked(s.backend.authDependents).mockRejectedValue(new Error("Auth dependent deletion not verified"));
        await expect(run.cleanup()).rejects.toThrow();
        expect(run.record.status).toBe("failed");
    });
    it("attempts every registered Guild deletion while keeping all accounts if any fail", async () => {
        const s = setup(), run = await s.start(), u = await s.account(run);
        await s.guild(run, u.id);
        await s.guild(run, u.id);
        vi.mocked(s.backend.deleteGuild).mockRejectedValue(new Error("failure"));
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteGuild).toHaveBeenCalledTimes(2);
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("refuses an unexpected repository before inspecting or changing Docker", () => {
        const s = setup();
        writeFileSync(join(s.directory, "package.json"), JSON.stringify({ name: "different-repository" }));
        expect(() => verifiedLocalEnvironment(s.directory)).toThrow("Unexpected repository");
    });
    it("refuses an incorrect configured project before inspecting or changing Docker", () => {
        const s = setup();
        writeFileSync(join(s.directory, "package.json"), JSON.stringify({ name: "guild-organizer" }));
        // No real local stack is ever addressed by this invalid target.
        mkdirSync(join(s.directory, "supabase"));
        writeFileSync(join(s.directory, "supabase/config.toml"), 'project_id="wrong-project"');
        expect(() => verifiedLocalEnvironment(s.directory)).toThrow("Unexpected Docker project");
    });
    it("refuses remote Auth cleanup endpoints even when a target record claims them", () => {
        const s = setup();
        expect(() => createLocalBackend({ target: { ...s.backend.target, api: "https://remote.example.test" }, apiUrl: "https://remote.example.test", publishableKey: "never-used", adminKey: "never-used" })).toThrow("Refusing");
    });
    it("refuses an Auth endpoint that differs from the recorded target", () => {
        const s = setup();
        expect(() => createLocalBackend({ target: s.backend.target, apiUrl: "http://127.0.0.1:55423", publishableKey: "never-used", adminKey: "never-used" })).toThrow("mismatch");
    });
    it("does not expose an intent when its manifest cannot be persisted", async () => {
        const s = setup();
        let calls = 0;
        const run = await LocalFixtureRun.start(s.backend, s.directory, (path, record) => { if (++calls > 1)
            throw new Error("disk failure"); writeFileSync(path, JSON.stringify(record)); });
        runs.push(run);
        expect(() => run.userIntent()).toThrow("disk failure");
        expect(s.backend.users).not.toHaveBeenCalled();
        await expect(run.cleanup()).rejects.toThrow();
    });
    it("rejects malformed manifests and unknown fields before recovery", async () => {
        const s = setup(), id = randomUUID();
        writeFileSync(join(s.directory, `${id}.json`), JSON.stringify({ run: id, adminKey: "must-never-be-accepted" }));
        await expect(LocalFixtureRun.recover(id, s.backend, s.directory)).rejects.toThrow();
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("rejects a mismatched database fingerprint during recovery", async () => {
        const s = setup(), run = await s.start();
        const record = JSON.parse(readFileSync(run.path, "utf8"));
        record.target.fingerprint = "different-database";
        writeFileSync(run.path, JSON.stringify(record));
        await expect(LocalFixtureRun.recover(record.run, s.backend, s.directory)).rejects.toThrow("mismatch");
    });
    it("rejects lease activity even if the recorded PID is not alive", async () => {
        const s = setup(), run = await s.start();
        const record = JSON.parse(readFileSync(run.path, "utf8"));
        record.pid = 2147483647;
        writeFileSync(run.path, JSON.stringify(record));
        await expect(LocalFixtureRun.recover(record.run, s.backend, s.directory)).rejects.toThrow("lease is still active");
    });
    it("rejects fixture creation after cleanup begins", async () => {
        const s = setup(), run = await s.start();
        await run.cleanup();
        expect(() => run.userIntent()).toThrow("closed");
    });
    it("does not claim a submitted account was never created from one empty read", async () => {
        const s = setup(), run = await s.start(), intent = run.userIntent();
        run.submitted(intent);
        await expect(run.cleanup()).rejects.toThrow();
        expect(run.record.failures.join(" ")).toContain("creation outcome remains unconfirmed");
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("preserves resources when a Guild creation outcome remains unknown", async () => {
        const s = setup(), run = await s.start(), u = await s.account(run);
        run.submitted(run.guildIntent(u.id));
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteUser).not.toHaveBeenCalled();
    });
    it("cleans a definitive pre-write rejection without retrying creation", async () => {
        const s = setup(), run = await s.start(), intent = run.userIntent();
        run.submitted(intent); run.rejected(intent);
        await run.cleanup(); expect(run.record.status).toBe("complete");
    });
    it("refuses a second submission of the same creation intent", async () => {
        const s = setup(), run = await s.start(), intent = run.userIntent();
        run.submitted(intent); expect(() => run.submitted(intent)).toThrow("already submitted");
        run.rejected(intent);
    });
    it("refuses a Guild whose creator has become null", async () => {
        const s = setup(), run = await s.start(), user = await s.account(run), guild = await s.guild(run, user.id);
        s.guilds.get(guild.id)!.owner = null;
        await expect(run.cleanup()).rejects.toThrow();
        expect(s.backend.deleteGuild).not.toHaveBeenCalled();
    });
});
