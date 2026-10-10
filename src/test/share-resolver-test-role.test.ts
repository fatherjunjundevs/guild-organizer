// @vitest-environment node
import { describe, expect, it } from "vitest";
// JavaScript runner module intentionally shared with its ownership regressions.
import { resolverRoleName, verifyResolverRoleOwnership } from "../../scripts/share-resolver-test-role.mjs";

const record = { name: resolverRoleName, stage: "confirmed", oid: 1234, marker: "owned-run" };
const role = { name: resolverRoleName, oid: 1234, marker: "owned-run", login: false,
  inherit: false, superuser: false, bypassRls: false, createDb: false, createRole: false, replication: false };
describe("cluster-wide disposable resolver role ownership", () => {
  it("accepts only the exact confirmed restricted role without external dependencies", () => {
    expect(() => verifyResolverRoleOwnership(record, role, [], 0)).not.toThrow();
    expect(() => verifyResolverRoleOwnership({ ...record, oid: "1234" }, { ...role, oid: "1234" }, [], 0)).not.toThrow();
  });
  for (const [label, value] of Object.entries({ unregistered: null, pending: { ...record, stage: "submitted" },
    wrongName: { ...record, name: "unowned" }, wrongOid: { ...record, oid: 42 } })) {
    it(`refuses ${label} ownership`, () => expect(() => verifyResolverRoleOwnership(value, role, [], 0)).toThrow());
  }
  for (const attribute of ["login", "inherit", "superuser", "bypassRls", "createDb", "createRole", "replication"]) {
    it(`refuses changed ${attribute}`, () => expect(() => verifyResolverRoleOwnership(record, { ...role, [attribute]: true }, [], 0)).toThrow());
  }
  it("refuses a replacement role or changed marker", () => {
    expect(() => verifyResolverRoleOwnership(record, { ...role, oid: 42 }, [], 0)).toThrow();
    expect(() => verifyResolverRoleOwnership(record, { ...role, marker: "other-run" }, [], 0)).toThrow();
  });
  it("refuses memberships and dependencies outside the removed owned database", () => {
    expect(() => verifyResolverRoleOwnership(record, role, [{ member: "authenticator" }], 0)).toThrow();
    expect(() => verifyResolverRoleOwnership(record, role, [], 1)).toThrow();
  });
  it("accepts only the trusted creator's non-inheriting ADMIN membership", () => {
    const membership = { role: resolverRoleName, member: "postgres", grantor: "supabase_admin", admin: true, inherit: false, set: false };
    expect(() => verifyResolverRoleOwnership(record, role, [membership], 0)).not.toThrow();
    expect(() => verifyResolverRoleOwnership(record, role, [{ ...membership, inherit: true }], 0)).toThrow();
    expect(() => verifyResolverRoleOwnership(record, role, [{ ...membership, grantor: "untrusted" }], 0)).toThrow();
  });
});
