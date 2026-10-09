// Privileged operations in this module are ONLY for the verified local CLI stack.
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { createConnection, createServer, type Server } from "node:net";
import { hostname, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const uuid = z.uuid();
const targetSchema = z.object({ root: z.string(), project: z.literal("guild-organizer"), container: z.string().regex(/^[a-f0-9]{64}$/), system: z.string(), databaseOid: z.string(), api: z.string(), fingerprint: z.string() }).strict();
const stageSchema = z.enum(["planned", "submitted", "confirmed", "rejected"]).default("planned");
const userSchema = z.object({ intent: uuid, email: z.string(), id: uuid.nullable(), createdAt: z.string().nullable(), stage: stageSchema }).strict();
const guildSchema = z.object({ intent: uuid, name: z.string(), owner: uuid, id: uuid.nullable(), createdAt: z.string().nullable(), stage: stageSchema }).strict();
export const manifestSchema = z.object({ version: z.literal(1), run: uuid, batch: uuid.nullable().default(null), target: targetSchema, host: z.string(), pid: z.number().int().positive(), port: z.number().int().positive(), startedAt: z.string(), status: z.enum(["active", "failed", "complete"]), users: z.array(userSchema), guilds: z.array(guildSchema), failures: z.array(z.string()) }).strict();
export type Manifest = z.infer<typeof manifestSchema>;
export type Target = Manifest["target"];
export type UserIntent = Manifest["users"][number];
export type GuildIntent = Manifest["guilds"][number];
export type UserRecord = {
    id: string;
    email: string;
    createdAt: string;
    tag: unknown;
};
export type GuildRecord = {
    id: string;
    name: string;
    owner: string | null;
    createdAt: string;
    members: string[];
};
export interface FixtureBackend {
    target: Target;
    verifyTarget(): Promise<void>;
    users(intent: UserIntent): Promise<UserRecord[]>;
    guilds(intent: GuildIntent): Promise<GuildRecord[]>;
    outsideReferences(users: string[], guilds: string[]): Promise<string[]>;
    deleteGuild(guild: GuildRecord, users: string[]): Promise<void>;
    deleteUser(user: UserRecord): Promise<void>;
    authDependents(users: UserIntent[], startedAt: string): Promise<void>;
    remaining(users: string[], guilds: string[]): Promise<number>;
    exclusive<T>(run: string, work: () => Promise<T>): Promise<T>;
}
function literal(value: string) { return "'" + value.replaceAll("'", "''") + "'"; }
function ident(value: string) { return '"' + value.replaceAll('"', '""') + '"'; }
function docker(args: string[], input?: string) {
    const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 20000 });
    if (result.error || result.status !== 0)
        throw new Error("Verified local Docker/database operation failed (details suppressed)");
    return result.stdout.trim();
}
export function localSql(target: Target, input: string) {
    return docker(["exec", "-i", target.container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], "set log_statement='none'; set log_min_error_statement='panic'; set log_parameter_max_length=0; set log_parameter_max_length_on_error=0; set statement_timeout='15s';\n" + input);
}
function loopback(url: string, port: number) {
    const parsed = new URL(url);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) || parsed.port !== String(port) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/")
        throw new Error("Refusing nonlocal or unexpected endpoint");
    return parsed;
}
export function verifiedLocalEnvironment(root = process.cwd()) {
    root = realpathSync(root);
    if (JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name !== "guild-organizer")
        throw new Error("Unexpected repository");
    const config = readFileSync(join(root, "supabase/config.toml"), "utf8");
    if (!/^project_id\s*=\s*"guild-organizer"/m.test(config))
        throw new Error("Unexpected Docker project");
    const apiPort = Number(config.match(/\[api\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1]);
    const dbPort = Number(config.match(/\[db\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1]);
    const dockerHost = docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
    if (!/^(npipe:|unix:)/.test(dockerHost) || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT)
        throw new Error("Refusing overridden/remote Docker target");
    const ids = docker(["ps", "-q", "--filter", "label=com.supabase.cli.project=guild-organizer"]).split(/\s+/).filter(Boolean);
    // inspect output contains local credentials; never report it.
    const containers = JSON.parse(docker(["inspect", ...ids])) as Array<{
        Id: string;
        Name: string;
        Config: {
            Image: string;
            Labels: Record<string, string>;
            Env: string[];
        };
        NetworkSettings: {
            Ports: Record<string, Array<{
                HostPort: string;
            }> | null>;
            Networks: Record<string, {
                Aliases: string[];
            }>;
        };
    }>;
    for (const c of containers)
        if (resolve(c.Config.Labels["com.supabase.cli.workdir"] ?? "") !== root)
            throw new Error("Local container repository mismatch");
    const db = containers.filter(c => c.Config.Image.includes("supabase/postgres:"));
    const gateway = containers.find(c => c.Config.Image.includes("kong:"));
    const rest = containers.find(c => c.Config.Env.some(e => e.startsWith("PGRST_DB_URI=")));
    const auth = containers.find(c => c.Config.Env.some(e => e.startsWith("GOTRUE_DB_DATABASE_URL=")));
    if (db.length !== 1 || !gateway || !rest || !auth || !db[0].NetworkSettings.Ports["5432/tcp"]?.some(p => p.HostPort === String(dbPort)) || !gateway.NetworkSettings.Ports["8000/tcp"]?.some(p => p.HostPort === String(apiPort)))
        throw new Error("Local stack identity/ports mismatch");
    const aliases = Object.values(db[0].NetworkSettings.Networks).flatMap(n => n.Aliases ?? []);
    aliases.push(db[0].Name.replace(/^\//, ""));
    for (const [c, key] of [[rest, "PGRST_DB_URI="], [auth, "GOTRUE_DB_DATABASE_URL="]] as const) {
        const url = new URL(c.Config.Env.find(e => e.startsWith(key))!.slice(key.length));
        if (!aliases.includes(url.hostname) || url.pathname !== "/postgres" || (url.port && url.port !== "5432"))
            throw new Error("Auth/REST database mismatch");
    }
    const status = spawnSync("pnpm exec supabase status -o env", { shell: true, cwd: root, encoding: "utf8" });
    if (status.error || status.status !== 0)
        throw new Error("Local CLI status unavailable");
    const values = new Map(status.stdout.split(/\r?\n/).map(line => { const m = line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?$/); return m ? [m[1], m[2]] : ["", ""]; }));
    const api = values.get("API_URL")!;
    if (loopback(api, apiPort).protocol !== "http:")
        throw new Error("Unexpected local API protocol");
    const dbUrl = new URL(values.get("DB_URL")!);
    loopback(`${dbUrl.protocol}//${dbUrl.hostname}:${dbUrl.port}/`, dbPort);
    if (dbUrl.pathname !== "/postgres")
        throw new Error("Unexpected CLI database");
    const partial = { root, project: "guild-organizer" as const, container: db[0].Id, api, system: "", databaseOid: "", fingerprint: "" };
    const identity = JSON.parse(localSql(partial, "select json_build_object('system',system_identifier::text,'oid',(select oid::text from pg_database where datname=current_database()),'database',current_database()) from pg_control_system();"));
    if (identity.database !== "postgres")
        throw new Error("Unexpected database identity");
    partial.system = identity.system;
    partial.databaseOid = identity.oid;
    partial.fingerprint = createHash("sha256").update(JSON.stringify({ ...partial, fingerprint: undefined })).digest("hex");
    const publishableKey = values.get("PUBLISHABLE_KEY") ?? values.get("ANON_KEY");
    const adminKey = values.get("SERVICE_ROLE_KEY") ?? values.get("SECRET_KEY");
    if (!publishableKey || !adminKey)
        throw new Error("Local Auth keys unavailable");
    loopback(process.env.APP_ORIGIN ?? "http://127.0.0.1:3000", 3000);
    return { target: targetSchema.parse(partial), apiUrl: api, publishableKey, adminKey };
}
type ForeignKey = {
    schema: string;
    table: string;
    column: string;
    scope: string | null;
};
export function profileReferences(target: Target): ForeignKey[] {
    return JSON.parse(localSql(target, `select coalesce(json_agg(x),'[]') from (select ns.nspname as schema,c.relname as table,a.attname as column,
    case when c.relname='guilds' and ns.nspname='public' then 'id' when exists(select 1 from pg_attribute where attrelid=c.oid and attname='guild_id' and not attisdropped) then 'guild_id' end as scope
    from pg_constraint fk join pg_class c on c.oid=fk.conrelid join pg_namespace ns on ns.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=fk.conkey[1]
    where fk.contype='f' and fk.confrelid in ('public.profiles'::regclass,'auth.users'::regclass) and cardinality(fk.conkey)=1 and ns.nspname in ('public','private')) x;`));
}
export function scopedTables(target: Target): Array<{
    schema: string;
    table: string;
}> {
    return JSON.parse(localSql(target, "select coalesce(json_agg(x),'[]') from (select table_schema as schema,table_name as table from information_schema.columns where table_schema in ('public','private') and column_name='guild_id') x;"));
}
export function createLocalBackend(env = verifiedLocalEnvironment()): FixtureBackend {
    const { target } = env;
    if (env.apiUrl !== target.api || loopback(env.apiUrl, 55421).protocol !== "http:")
        throw new Error("Auth cleanup endpoint mismatch");
    const admin = createClient(env.apiUrl, env.adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let held: {
        alive: boolean;
    } | null = null;
    const assertLock = () => { if (held && !held.alive)
        throw new Error("Cleanup authority lock ended"); };
    const sql = (text: string) => { assertLock(); return localSql(target, text); };
    const backend: FixtureBackend = {
        target,
        async verifyTarget() { assertLock(); if (JSON.stringify(verifiedLocalEnvironment(target.root).target) !== JSON.stringify(target))
            throw new Error("Original local target changed"); },
        async users(intent) {
            return JSON.parse(sql(`select coalesce(json_agg(x),'[]') from (select id,email,created_at::text as "createdAt",raw_app_meta_data->'go_e2e_fixture' as tag from auth.users where ${intent.id ? `id=${literal(intent.id)}::uuid or ` : ""}email=${literal(intent.email)}) x;`));
        },
        async guilds(intent) {
            return JSON.parse(sql(`select coalesce(json_agg(x),'[]') from (select id,name,created_by as owner,created_at::text as "createdAt",coalesce((select json_agg(user_id) from public.guild_memberships where guild_id=g.id),'[]') as members from public.guilds g where ${intent.id ? `id=${literal(intent.id)}::uuid or ` : ""}name=${literal(intent.name)}) x;`));
        },
        async outsideReferences(users, guilds) {
            if (!users.length)
                return [];
            const allowed = guilds.length ? guilds.map(literal).join(",") : "null";
            const queries = profileReferences(target).filter(f => f.table !== "profiles").map(f => `select ${literal(`${f.schema}.${f.table}.${f.column}`)} as reference where exists(select 1 from ${ident(f.schema)}.${ident(f.table)} where ${ident(f.column)} in (${users.map(literal).join(",")}) ${f.scope && guilds.length ? `and (${ident(f.scope)} is null or ${ident(f.scope)} not in (${allowed}))` : ""})`);
            return JSON.parse(sql(`select coalesce(json_agg(reference),'[]') from (${queries.join(" union all ")}) r;`));
        },
        async deleteGuild(guild, users) {
            if (!guild.owner) throw new Error("Guild creator cannot be verified");
            // No trigger disabling: DELETE cascades are supported; profile SET NULL on
            // sealed versions is forbidden, so Guild removal MUST precede Auth removal.
            sql(`begin; set local lock_timeout='3s';
        do $cleanup$ declare g public.guilds; begin
          select * into g from public.guilds where id=${literal(guild.id)} for update;
          if not found then return; end if;
          if g.name is distinct from ${literal(guild.name)} or g.created_by is distinct from ${literal(guild.owner)}::uuid or g.created_at is distinct from ${literal(guild.createdAt)}::timestamptz then raise exception 'fixture ownership mismatch'; end if;
          perform 1 from public.guild_memberships where guild_id=g.id for update;
          if exists(select 1 from public.guild_memberships where guild_id=g.id and user_id not in (${users.map(literal).join(",")})) then raise exception 'unregistered member'; end if;
          -- Restrictive same-Guild FKs require dependent-first deletion. All
          -- predicates use the already locked, ownership-verified Guild.
          delete from public.events where guild_id=g.id;
          delete from public.event_templates where guild_id=g.id;
          delete from public.event_types where guild_id=g.id;
          delete from public.roster_sync_run_changes where guild_id=g.id;
          delete from public.character_reconciliations where guild_id=g.id;
          delete from public.guilds where id=g.id;
        end $cleanup$; commit;`);
            if (Number(sql(`select count(*) from public.guilds where id=${literal(guild.id)};`)) || scopedTables(target).some(t => Number(sql(`select count(*) from ${ident(t.schema)}.${ident(t.table)} where guild_id=${literal(guild.id)};`))))
                throw new Error("Guild/dependent deletion not verified");
        },
        async deleteUser(user) {
            if (Number(sql(`select count(*) from auth.scim_users where user_id=${literal(user.id)};`)))
                throw new Error("Unexpected SCIM ownership; manual review required");
            const { error } = await admin.auth.admin.deleteUser(user.id);
            if (error)
                throw new Error("Local Auth deletion rejected");
            if (Number(sql(`select (select count(*) from auth.users where id=${literal(user.id)})+(select count(*) from public.profiles where id=${literal(user.id)});`)))
                throw new Error("Auth/profile deletion not verified");
        },
        async authDependents(users, startedAt) {
            for (const user of users.filter(u => u.id && u.createdAt)) {
                const id = literal(user.id!), email = literal(user.email);
                // GoTrue does not FK all flow/token/log records to users. Match exact
                // recorded IDs AND email for audit records; never use a name prefix.
                const audit = `created_at>=${literal(startedAt)}::timestamptz and ((payload->>'actor_id'=${id} and payload->>'actor_username'=${email}) or (payload->'traits'->>'user_id'=${id} and payload->'traits'->>'user_email'=${email}))`;
                sql(`begin; set local lock_timeout='3s';
          do $cleanup$ begin if exists(select 1 from auth.users where id=${id}) then raise exception 'account still exists'; end if; end $cleanup$;
          delete from auth.flow_state where user_id=${id};
          delete from auth.refresh_tokens where user_id=${id};
          delete from auth.audit_log_entries where ${audit};
          commit;`);
                const direct = JSON.parse(sql("select coalesce(json_agg(x),'[]') from (select c.relname as table,a.attname as column from pg_constraint fk join pg_class c on c.oid=fk.conrelid join pg_namespace ns on ns.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=fk.conkey[1] where fk.contype='f' and fk.confrelid='auth.users'::regclass and ns.nspname='auth' and cardinality(fk.conkey)=1) x;")) as Array<{
                    table: string;
                    column: string;
                }>;
                const checks = direct.map(f => `(select count(*) from auth.${ident(f.table)} where ${ident(f.column)}=${id})`);
                checks.push(`(select count(*) from auth.flow_state where user_id=${id})`, `(select count(*) from auth.refresh_tokens where user_id=${id})`, `(select count(*) from auth.audit_log_entries where ${audit})`);
                if (Number(sql(`select ${checks.join("+")};`)))
                    throw new Error("Auth dependent deletion not verified");
            }
        },
        async remaining(users, guilds) {
            return Number(sql(`select (select count(*) from auth.users where id in (${users.map(literal).join(",") || "null"}))+(select count(*) from public.profiles where id in (${users.map(literal).join(",") || "null"}))+(select count(*) from public.guilds where id in (${guilds.map(literal).join(",") || "null"}));`));
        },
        async exclusive(run, work) {
            const child = spawn("docker", ["exec", "-i", target.container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { stdio: "pipe" });
            const lock = { alive: true };
            child.on("exit", () => { lock.alive = false; });
            const acquired = new Promise<void>((done, reject) => {
                const timer = setTimeout(() => reject(new Error("Cleanup lock unavailable")), 10000);
                child.once("error", () => { clearTimeout(timer); reject(new Error("Cleanup lock unavailable")); });
                child.once("exit", () => { clearTimeout(timer); reject(new Error("Cleanup lock ended")); });
                child.stdout.once("data", data => { clearTimeout(timer); if (String(data).trim() === "t")
                    done();
                else
                    reject(new Error("Another cleanup owns this run")); });
            });
            child.stdin.write(`select pg_try_advisory_lock(hashtextextended(${literal(`go_e2e_cleanup:${run}`)},0));\n`);
            try {
                await acquired;
                held = lock;
                assertLock();
                return await work();
            }
            finally {
                held = null;
                child.stdin.end();
                child.kill();
            }
        },
    };
    return backend;
}
export function manifestDirectory(root = process.cwd()) {
    return join(tmpdir(), "guild-organizer-e2e", createHash("sha256").update(realpathSync(root)).digest("hex").slice(0, 16));
}
function persist(path: string, record: Manifest) {
    const temporary = `${path}.${randomUUID()}.tmp`;
    const fd = openSync(temporary, "wx", 0o600);
    try {
        writeFileSync(fd, JSON.stringify(manifestSchema.parse(record), null, 2));
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
    renameSync(temporary, path);
}
export function ownershipTag(record: Manifest, user: UserIntent) { return { version: 1, run: record.run, intent: user.intent, target: record.target.fingerprint }; }
export class LocalFixtureRun {
    readonly backend: FixtureBackend;
    readonly path: string;
    record: Manifest;
    private lease: Server | null;
    private resources = new Set<() => Promise<unknown>>();
    private cleaning: Promise<void> | null = null;
    private save: typeof persist;
    private constructor(backend: FixtureBackend, path: string, record: Manifest, lease: Server | null, save = persist) { this.backend = backend; this.path = path; this.record = record; this.lease = lease; this.save = save; }
    static async start(backend = createLocalBackend(), directory = manifestDirectory(backend.target.root), save = persist) {
        await backend.verifyTarget();
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        const batch = process.env.GO_LOCAL_FIXTURE_BATCH ? uuid.parse(process.env.GO_LOCAL_FIXTURE_BATCH) : null;
        const lease = createServer(socket => {
            socket.on("error", () => socket.destroy());
            socket.end("active local fixture run\n");
        });
        await new Promise<void>((done, reject) => { lease.once("error", reject); lease.listen(0, "127.0.0.1", done); });
        const address = lease.address();
        if (!address || typeof address === "string")
            throw new Error("Fixture lease unavailable");
        const record: Manifest = { version: 1, run: randomUUID(), batch, target: backend.target, host: hostname(), pid: process.pid, port: address.port, startedAt: new Date().toISOString(), status: "active", users: [], guilds: [], failures: [] };
        const path = join(directory, `${record.run}.json`);
        try {
            save(path, record);
            return new LocalFixtureRun(backend, path, record, lease, save);
        }
        catch (error) {
            lease.close();
            throw error;
        }
    }
    static async recover(runId: string, backend = createLocalBackend(), directory = manifestDirectory(backend.target.root)) {
        uuid.parse(runId);
        const path = join(directory, `${runId}.json`);
        const record = manifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
        if (record.run !== runId || JSON.stringify(record.target) !== JSON.stringify(backend.target) || record.host !== hostname())
            throw new Error("Recovery target/ownership mismatch");
        await backend.verifyTarget();
        // PID is only a conservative liveness veto, NEVER proof of ownership.
        try {
            process.kill(record.pid, 0);
            throw new Error("Recorded runner may still be active");
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH")
                throw error;
        }
        const busy = await new Promise<boolean>((done, reject) => {
            const socket = createConnection({ host: "127.0.0.1", port: record.port });
            socket.setTimeout(2000, () => { socket.destroy(); reject(new Error("Cannot establish lease inactivity")); });
            socket.once("connect", () => { socket.destroy(); done(true); });
            socket.once("error", error => { socket.destroy(); if ((error as NodeJS.ErrnoException).code === "ECONNREFUSED")
                done(false);
            else
                reject(new Error("Cannot establish lease inactivity")); });
        });
        if (busy)
            throw new Error("Fixture lease is still active");
        const run = new LocalFixtureRun(backend, path, record, null);
        await run.cleanup();
    }
    userIntent() {
        if (this.cleaning || this.record.status !== "active")
            throw new Error("Fixture run closed");
        const intent = randomUUID();
        const user: UserIntent = { intent, email: `go-e2e-${this.record.run}-${intent}@example.test`, id: null, createdAt: null, stage: "planned" };
        this.record.users.push(user);
        this.save(this.path, this.record);
        return user;
    }
    guildIntent(owner: string) {
        uuid.parse(owner);
        if (!this.record.users.some(u => u.id === owner) || this.cleaning || this.record.status !== "active")
            throw new Error("Unregistered fixture owner");
        const intent = randomUUID();
        const guild: GuildIntent = { intent, name: `E2E ${this.record.run} ${intent}`, owner, id: null, createdAt: null, stage: "planned" };
        this.record.guilds.push(guild);
        this.save(this.path, this.record);
        return guild;
    }
    submitted(intent: UserIntent | GuildIntent) {
        if (this.cleaning || this.record.status !== "active" || intent.stage !== "planned" || ![...this.record.users, ...this.record.guilds].includes(intent)) throw new Error("Unregistered or already submitted creation intent");
        intent.stage = "submitted";
        this.save(this.path, this.record);
    }
    rejected(intent: UserIntent | GuildIntent) {
        if (intent.stage !== "submitted" || ![...this.record.users, ...this.record.guilds].includes(intent)) throw new Error("Unregistered rejection");
        intent.stage = "rejected";
        this.save(this.path, this.record);
    }
    async registeredUser(intent: UserIntent, id: string) {
        if (!this.record.users.includes(intent))
            throw new Error("Unregistered user intent");
        uuid.parse(id);
        intent.id = id;
        const records = await this.backend.users(intent);
        if (records.length !== 1 || records[0].id !== id || !this.ownsUser(intent, records[0]))
            throw new Error("Auth ownership mismatch");
        intent.createdAt = records[0].createdAt;
        intent.stage = "confirmed";
        this.save(this.path, this.record);
    }
    async registeredGuild(intent: GuildIntent, id: string) {
        if (!this.record.guilds.includes(intent))
            throw new Error("Unregistered Guild intent");
        uuid.parse(id);
        intent.id = id;
        const records = await this.backend.guilds(intent);
        if (records.length !== 1 || records[0].id !== id || !this.ownsGuild(intent, records[0]))
            throw new Error("Guild ownership mismatch");
        intent.createdAt = records[0].createdAt;
        intent.stage = "confirmed";
        this.save(this.path, this.record);
    }
    resource(close: () => Promise<unknown>) { this.resources.add(close); }
    private ownsUser(intent: UserIntent, user: UserRecord) {
        const tag = user.tag as ReturnType<typeof ownershipTag> | null;
        return intent.email === `go-e2e-${this.record.run}-${intent.intent}@example.test` && user.email === intent.email && (!intent.id || intent.id === user.id) && (!intent.createdAt || intent.createdAt === user.createdAt) && new Date(user.createdAt) >= new Date(this.record.startedAt) && tag?.version === 1 && tag.run === this.record.run && tag.intent === intent.intent && tag.target === this.record.target.fingerprint;
    }
    private ownsGuild(intent: GuildIntent, guild: GuildRecord) {
        return intent.name === `E2E ${this.record.run} ${intent.intent}` && guild.name === intent.name && guild.owner === intent.owner && (!intent.id || intent.id === guild.id) && (!intent.createdAt || intent.createdAt === guild.createdAt) && new Date(guild.createdAt) >= new Date(this.record.startedAt) && this.record.users.some(u => u.id === guild.owner) && guild.members.every(id => this.record.users.some(u => u.id === id));
    }
    async cleanup() {
        if (this.cleaning)
            return this.cleaning;
        this.cleaning = this.performCleanup();
        return this.cleaning;
    }
    private async performCleanup() {
        const failures: string[] = [];
        try {
            for (const close of this.resources)
                try {
                    await close();
                }
                catch {
                    failures.push("Active resource could not be closed");
                }
            if (failures.length)
                throw new Error("Active resources remain");
            await this.backend.verifyTarget();
            await this.backend.exclusive(this.record.run, async () => {
                const users: UserRecord[] = [], guilds: GuildRecord[] = [];
                for (const intent of this.record.users) {
                    const found = await this.backend.users(intent);
                    if (!found.length && intent.stage === "submitted") throw new Error(`Account creation outcome remains unconfirmed: ${intent.intent}`);
                    if (found.length > 1 || found.some(u => !this.ownsUser(intent, u)))
                        throw new Error("Auth fixture ownership mismatch");
                    if (found[0]) {
                        intent.id = found[0].id;
                        intent.createdAt = found[0].createdAt;
                        intent.stage = "confirmed";
                        users.push(found[0]);
                    }
                }
                for (const intent of this.record.guilds) {
                    const found = await this.backend.guilds(intent);
                    if (!found.length && intent.stage === "submitted") throw new Error(`Guild creation outcome remains unconfirmed: ${intent.intent}`);
                    if (found.length > 1 || found.some(g => !this.ownsGuild(intent, g)))
                        throw new Error("Guild fixture ownership mismatch");
                    if (found[0]) {
                        intent.id = found[0].id;
                        intent.createdAt = found[0].createdAt;
                        intent.stage = "confirmed";
                        guilds.push(found[0]);
                    }
                }
                this.save(this.path, this.record);
                const userIds = this.record.users.flatMap(u => u.id ? [u.id] : []), guildIds = this.record.guilds.flatMap(g => g.id ? [g.id] : []);
                if ((await this.backend.outsideReferences(userIds, guildIds)).length)
                    throw new Error("Fixture references outside registered Guilds");
                for (const guild of guilds)
                    try {
                        await this.backend.verifyTarget();
                        await this.backend.deleteGuild(guild, userIds);
                    }
                    catch {
                        failures.push(`Guild deletion failed: ${guild.id}`);
                    }
                // Never attempt account removal while any Guild failed.
                if (!failures.length)
                    for (const user of users)
                        try {
                            await this.backend.verifyTarget();
                            if ((await this.backend.outsideReferences([user.id], [])).length)
                                throw new Error("Account still has application references");
                            const current = await this.backend.users(this.record.users.find(u => u.id === user.id)!);
                            if (current.length !== 1 || !this.ownsUser(this.record.users.find(u => u.id === user.id)!, current[0]))
                                throw new Error("Auth ownership changed");
                            await this.backend.deleteUser(user);
                        }
                        catch {
                            failures.push(`Auth deletion failed: ${user.id}`);
                        }
                if (!failures.length) {
                    await this.backend.verifyTarget();
                    await this.backend.authDependents(this.record.users, this.record.startedAt);
                }
                if (await this.backend.remaining(userIds, guildIds))
                    failures.push("Registered fixture records remain");
            });
        }
        catch (error) {
            failures.push(error instanceof Error ? error.message : "Fixture cleanup rejected");
        }
        this.record.status = failures.length ? "failed" : "complete";
        this.record.failures = failures;
        try {
            this.save(this.path, this.record);
        }
        catch {
            failures.push("Unable to persist cleanup evidence");
        }
        if (this.lease) {
            await new Promise<void>(done => this.lease!.close(() => done()));
            this.lease = null;
        }
        if (failures.length)
            throw new AggregateError(failures.map(f => new Error(f)), `Local fixture cleanup failed (${this.record.run}); manifest: ${this.path}`);
    }
}
