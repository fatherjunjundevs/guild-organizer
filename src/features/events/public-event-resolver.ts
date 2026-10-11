import "server-only";
import { parsePublicLineup, type PublicLineupRequest } from "./public-lineup";
import type { PublicEventConfig } from "./public-event-config";

export interface ResolverClient {
  query(sql: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean): void;
}
export interface ResolverPool { connect(): Promise<ResolverClient> }

// Checked on each actual backend before any bearer is submitted. Role catalog
// values alone are insufficient: connection_private inspects effective settings.
export const resolverIdentitySql = `select session_user = 'go_event_share_reader'
  and current_user = 'go_event_share_resolver'
  and (select count(*)=1 from pg_catalog.pg_auth_members where member=session_user::pg_catalog.regrole)
  and exists(select 1 from pg_catalog.pg_auth_members where member=session_user::pg_catalog.regrole
    and roleid='go_event_share_resolver'::pg_catalog.regrole and set_option and not inherit_option and not admin_option)
  and not exists(select 1 from pg_catalog.pg_roles where rolname in (session_user,current_user)
    and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolinherit))
  and (select rolcanlogin from pg_catalog.pg_roles where rolname=session_user)
  and (select rolconnlimit between 2 and 16 from pg_catalog.pg_roles where rolname=session_user)
  and (select not rolcanlogin from pg_catalog.pg_roles where rolname=current_user)
  and not exists(select 1 from pg_catalog.pg_auth_members where member=current_user::pg_catalog.regrole)
  and not pg_catalog.pg_has_role(session_user,'pg_read_all_settings','MEMBER')
  and not pg_catalog.has_schema_privilege(session_user,'private','USAGE')
  and not pg_catalog.has_schema_privilege(session_user,'auth','USAGE')
  and not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','auth') and c.relkind in ('r','p','v','m','f')
      and (pg_catalog.has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or pg_catalog.has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or pg_catalog.has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
        or pg_catalog.has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  and not exists(select 1 from pg_catalog.pg_namespace n
    where n.nspname in ('public','private','auth','extensions','go_event_share_private')
      and (pg_catalog.has_schema_privilege(session_user,n.oid,'CREATE') or pg_catalog.has_schema_privilege(current_user,n.oid,'CREATE')))
  and go_event_share_private.connection_private() is true as safe`;

export function createPublicResolver(pool: ResolverPool) {
  let active = 0;
  return async (input: PublicLineupRequest, config: PublicEventConfig, signal?: AbortSignal) => {
    // No unbounded per-process waiter queue; distributed admission is separate.
    if (active >= 2) throw new Error("Unavailable");
    active++; let client: ResolverClient | undefined; let healthy = false; let released = false;
    const release = (destroy: boolean) => { if (client && !released) { released = true; client.release(destroy); } };
    const cancelled = () => { if (signal?.aborted) throw new Error("Unavailable"); };
    const abort = () => { release(true); };
    try {
      cancelled();
      client = await pool.connect();
      signal?.addEventListener("abort", abort, { once: true });
      cancelled();
      await client.query("begin read only");
      await client.query("set local role go_event_share_resolver");
      await client.query("set local statement_timeout = '2s'");
      await client.query("set local idle_in_transaction_session_timeout = '3s'");
      const identity = await client.query(resolverIdentitySql);
      if (identity.rows.length !== 1 || identity.rows[0].safe !== true) throw new Error("Unavailable");
      if (config.isolatedRun) {
        const owned = await client.query(`select pg_catalog.current_database()=$1
          and (select pg_catalog.shobj_description(oid,'pg_database') from pg_catalog.pg_database
            where datname=pg_catalog.current_database())=$2 as safe`, [config.database, `go-disposable:${config.isolatedRun}`]);
        if (owned.rows.length !== 1 || owned.rows[0].safe !== true) throw new Error("Unavailable");
      } else {
        const tls = await client.query("select ssl and version in ('TLSv1.2','TLSv1.3') as safe from pg_catalog.pg_stat_ssl where pid=pg_catalog.pg_backend_pid()");
        if (tls.rows.length !== 1 || tls.rows[0].safe !== true) throw new Error("Unavailable");
      }
      cancelled();
      const result = await client.query("select go_event_share_private.resolve_lineup($1::text,$2::integer,$3::integer,$4::text) as lineup",
        [input.token, input.version, input.page, input.search]);
      if (result.rows.length !== 1) throw new Error("Unavailable");
      const value = result.rows[0].lineup;
      const dto = value === null ? null : parsePublicLineup(value);
      if (value !== null && !dto) throw new Error("Unavailable");
      cancelled();
      await client.query("commit"); cancelled(); healthy = true;
      return dto;
    } catch { throw new Error("Unavailable"); }
    finally { signal?.removeEventListener("abort", abort); try { release(!healthy); } finally { active--; } }
  };
}
