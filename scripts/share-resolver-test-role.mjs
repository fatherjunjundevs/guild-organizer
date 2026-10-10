// A disposable database does NOT make its roles disposable. Never adopt a role.
export const resolverRoleName = "go_event_share_resolver";

export function trustedCreatorMemberships(memberships) {
  // PostgreSQL 17 automatically gives a non-superuser creator ADMIN authority.
  // Only this exact trusted creator grant is acceptable; SET is enabled solely
  // by the disposable runner to exercise the NOLOGIN role without credentials.
  return Array.isArray(memberships) && memberships.length <= 1 && memberships.every(m =>
    m.role === resolverRoleName && m.member === "postgres" && m.grantor === "supabase_admin"
    && m.admin === true && m.inherit === false && typeof m.set === "boolean");
}

export function verifyResolverRoleOwnership(record, role, memberships, dependencies) {
  if (record?.name !== resolverRoleName || record.stage !== "confirmed"
    || !/^[1-9][0-9]*$/.test(String(record.oid)) || !Number.isSafeInteger(Number(record.oid))
    || !role || String(role.oid) !== String(record.oid) || role.name !== record.name
    || role.login || role.inherit || role.superuser || role.bypassRls
    || role.createDb || role.createRole || role.replication
    || role.marker !== record.marker || !trustedCreatorMemberships(memberships) || dependencies !== 0) {
    throw new Error("Resolver test role ownership/privileges changed; refusing role cleanup");
  }
}
