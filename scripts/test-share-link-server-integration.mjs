// Invoked only inside the guarded, ownership-verified disposable DB workflow.
// Runs production TypeScript crypto against the actual authenticated/anon SQL roles.
import { randomBytes } from "node:crypto";

export function testShareLinkServerIntegration({ modules, key, sql, database }) {
  const { config, crypto } = modules;
  const id = (prefix, n = 1) => `6e${prefix}0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const guildId = id("10"), eventId = id("50");
  const env = { APP_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000", SHARE_LINK_RECOVERY_KEY_ID: "test_integration_aes",
    SHARE_LINK_RECOVERY_KEYS_JSON: JSON.stringify({ test_integration_aes: randomBytes(32).toString("base64") }),
    SHARE_LINK_PROVISIONING_KEY_ID: "concurrency_test", SHARE_LINK_PROVISIONING_KEY_BASE64: key.toString("base64") };
  const recovery = config.loadShareLinkRecoveryConfig(env);
  const provisioning = config.loadShareLinkProvisioningConfig(recovery, env);
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  function request(operation, actorId, n, previousLinkId = null, now = Date.now()) {
    const identity = { guildId, eventId, linkId: id("80", n) };
    const envelope = crypto.createShareLinkEnvelope(identity, recovery);
    const proof = crypto.signShareLinkProvisioning({ ...identity, operation, actorId, previousLinkId, envelope }, provisioning, now);
    return { operation, actorId, identity, envelope, proof, previousLinkId, token: crypto.recoverShareToken(identity, envelope, recovery) };
  }
  function call(record, changes = {}) {
    const values = { guildId, eventId, linkId: record.identity.linkId, previousLinkId: record.previousLinkId,
      digest: record.envelope.digest, cipher: crypto.toShareBytea(record.envelope.ciphertext), nonce: crypto.toShareBytea(record.envelope.nonce),
      tag: crypto.toShareBytea(record.envelope.authTag), aesId: record.envelope.encryptionKeyId, keyId: record.proof.keyId,
      expiry: record.proof.expiresAt, mac: crypto.toShareBytea(record.proof.mac), ...changes };
    const args = [values.guildId, values.eventId];
    if (record.operation === "rotate") args.push(values.previousLinkId);
    args.push(values.linkId, values.digest, values.cipher, values.nonce, values.tag, values.aesId, values.keyId, values.expiry, values.mac);
    return `select public.${record.operation}_event_share_link(${args.map(literal).join(",")})`;
  }
  const first = request("create", id("00"), 1);
  const second = request("rotate", id("00", 2), 2, first.identity.linkId);
  const third = request("rotate", id("00", 3), 3, second.identity.linkId);
  const statements = ["set log_statement='none'; set log_min_error_statement='panic'; set log_parameter_max_length=0; set log_parameter_max_length_on_error=0; set role postgres; begin; select no_plan();"];
  statements.push(`insert into auth.users(id,email) values ${[1,2,3,4,5,6].map((n) => `('${id("00",n)}','server-share-${n}@test.local')`).join(",")};
insert into public.guilds(id,name,created_by) values('${guildId}','Crypto integration','${id("00")}'),('${id("20")}','Other Guild','${id("00",6)}');
insert into public.guild_memberships(id,guild_id,user_id,role) values ${["owner","admin","officer","member","officer"].map((role,i) => `('${id("11",i+1)}','${guildId}','${id("00",i+1)}','${role}')`).join(",")},('${id("21")}','${id("20")}','${id("00",6)}','owner');
insert into public.guild_officer_capabilities(guild_id,membership_id,capability_key,granted_by) values('${guildId}','${id("11",3)}','publish.manage','${id("00")}'),('${guildId}','${id("11",5)}','events.manage','${id("00")}');
insert into public.event_types(id,guild_id,name,status) values('${id("30")}','${guildId}','League','active');
insert into public.event_templates(id,guild_id,event_type_id,name,status) values('${id("40")}','${guildId}','${id("30")}','Template','active');
insert into public.events(id,guild_id,event_type_id,source_template_id,name) values('${eventId}','${guildId}','${id("30")}','${id("40")}','Published integration');
insert into public.event_sections(id,guild_id,event_id,name,sort_order) values('${id("51")}','${guildId}','${eventId}','Team',0);
insert into public.event_parties(id,guild_id,event_id,section_id,name,sort_order) values('${id("52")}','${guildId}','${eventId}','${id("51")}','Party',0);
insert into public.event_slots(id,guild_id,event_id,party_id,name,sort_order) values('${id("53")}','${guildId}','${eventId}','${id("52")}','Seat',0);`);
  const actor = (n) => statements.push(`set local role authenticated; set local request.jwt.claim.sub='${id("00",n)}';`);
  const deny = (query, label) => statements.push(`select throws_ok(${literal(query)},'42501',null,${literal(label)});`);
  actor(1);
  for (const [field, value] of Object.entries({ guildId: id("20"), eventId: id("50",2), linkId: id("80",99), digest: "f".repeat(64),
    cipher: crypto.toShareBytea(Buffer.alloc(32)), nonce: crypto.toShareBytea(Buffer.alloc(12)), tag: crypto.toShareBytea(Buffer.alloc(16)),
    aesId: "test_other_aes", keyId: "unknown_key", expiry: first.proof.expiresAt - 1, mac: crypto.toShareBytea(Buffer.alloc(32)) })) {
    deny(call(first, { [field]: value }), `TypeScript proof rejects modified ${field}`);
  }
  deny(call(request("create", id("00"), 99, null, Date.now()-180000)), "TypeScript expired proof rejected");
  deny(call(request("create", id("00"), 99, null, Date.now()+240000)), "TypeScript future proof rejected");
  actor(2); deny(call(first), "TypeScript proof binds actual authenticated actor");
  for (const n of [4,5,6]) { actor(n); deny(call(request("create",id("00",n),99)), `valid attestation cannot authorize role ${n}`); }
  actor(1);
  statements.push(`select lives_ok(${literal(`select public.publish_event('${eventId}')`)},'publish integration fixture');`);
  statements.push(`select is((${call(first)})::text,'${first.identity.linkId}','Owner creates production TypeScript AES/HMAC payload');`);
  statements.push(`select is((select link_id::text from public.get_event_share_link_state('${guildId}','${eventId}')),'${first.identity.linkId}','state retrieves generated identity');`);
  statements.push(`select 'INTEGRATION_COPY:'||row_to_json(p)::text from public.get_event_share_link_copy_payload('${guildId}','${eventId}','${first.identity.linkId}') p;`);
  statements.push(`select lives_ok(${literal(call(first))},'exact production proof replay is idempotent while active');`);
  statements.push(`set local role anon; select is((select count(*) from public.resolve_event_share_link('${first.token}')),1::bigint,'anonymous resolver accepts real canonical AES token');`);
  actor(2);
  deny(call(second,{ previousLinkId: id("80",99) }), "rotation proof binds previous identity");
  deny(call({ ...second, proof: first.proof }), "create proof cannot authorize rotate");
  statements.push(`select is((${call(second)})::text,'${second.identity.linkId}','Admin rotates production payload');`);
  actor(1);
  statements.push(`select throws_ok(${literal(call(first))},'55000',null,'replayed production create cannot resurrect rotated link');`);
  actor(3);
  statements.push(`select is((${call(third)})::text,'${third.identity.linkId}','publish.manage Officer rotates production payload');`);
  statements.push(`select lives_ok(${literal(`select public.revoke_event_share_link('${guildId}','${eventId}','${first.identity.linkId}')`)},'stale revoke targets old identity only');`);
  statements.push(`select is((select link_id::text from public.get_event_share_link_state('${guildId}','${eventId}')),'${third.identity.linkId}','stale revoke preserves current identity');`);
  statements.push(`select lives_ok(${literal(`select public.revoke_event_share_link('${guildId}','${eventId}','${third.identity.linkId}')`)},'authorized Officer permanently revokes current link');`);
  statements.push(`set local role anon; select is((select count(*) from public.resolve_event_share_link('${third.token}')),0::bigint,'revoked real token unavailable'); select * from finish(); rollback;`);
  const output = sql(database, statements.join("\n"), "supabase_admin", true);
  if (output === null) throw new Error("Server integration SQL execution failed (sensitive details suppressed)");
  const copy = output.split(/\r?\n/).find((line) => line.startsWith("INTEGRATION_COPY:"));
  if (!copy) throw new Error("Integration encrypted copy payload unavailable");
  const row = JSON.parse(copy.slice("INTEGRATION_COPY:".length));
  const recovered = crypto.recoverShareToken(first.identity, { digest: row.token_digest,
    ciphertext: crypto.fromShareBytea(row.token_ciphertext,32), nonce: crypto.fromShareBytea(row.token_nonce,12),
    authTag: crypto.fromShareBytea(row.token_auth_tag,16), encryptionKeyId: row.encryption_key_id }, recovery);
  if (recovered !== first.token) throw new Error("Integration AES copy recovery failed");
  const results = output.split(/\r?\n/).filter((line) => /^(not )?ok \d+/.test(line));
  if (results.length !== 31 || results.some((line) => line.startsWith("not ok")) || !/^1\.\.31$/m.test(output)) {
    // Never echo raw SQL/error output containing ephemeral tokens or envelopes.
    throw new Error("Production TypeScript/PostgreSQL integration assertions failed");
  }
  console.log("Server integration: 31 SQL assertions passed; encrypted RPC copy recovered with production TypeScript.");
}
