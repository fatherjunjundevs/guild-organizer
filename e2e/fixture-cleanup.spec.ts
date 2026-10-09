import { fixtureTest as test, expect, fixtureRun } from "./helpers/test";
import { createAuthenticatedOwnerFixture, createAuthenticatedEventBuilderFixture } from "./helpers/local-supabase";
import { localSql } from "./helpers/local-fixture-lifecycle";
test("cleanup: complete owner/Guild creation", async ({ context, browser }) => {
    test.skip(process.env.GO_FIXTURE_CLEANUP_FAILURE_PROBE === "true", "Positive cases run separately from the intentional failure probe");
    const fixture = await createAuthenticatedOwnerFixture(context);
    expect(fixture.guildId).toMatch(/^[a-f0-9-]{36}$/);
    await browser.newContext(); // Intentionally not registered by a helper.
    fixtureRun().resource(async () => { expect(browser.contexts()).toHaveLength(0); });
});
test("cleanup: sealed publications, assignments and private share links", async ({ context }) => {
    test.skip(process.env.GO_FIXTURE_CLEANUP_FAILURE_PROBE === "true", "Positive cases run separately from the intentional failure probe");
    const fixture = await createAuthenticatedEventBuilderFixture(context);
    const { error } = await fixture.userClient.rpc("publish_event", { p_event_id: fixture.eventId });
    expect(error).toBeNull();
    // No recovery/provisioning secret needed: a synthetic private child proves
    // cascades only, and never exercises an anonymous/bearer access path.
    const run = fixtureRun();
    const columns = localSql(run.record.target, "select column_name from information_schema.columns where table_schema='private' and table_name='event_share_links' order by ordinal_position;");
    expect(columns).toContain("guild_id");
    localSql(run.record.target, `insert into private.event_share_links(id,guild_id,event_id,token_digest,created_by,token_ciphertext,token_nonce,token_auth_tag,encryption_key_id) values(gen_random_uuid(),'${fixture.guildId}','${fixture.eventId}',encode(extensions.digest('${fixture.eventId}','sha256'),'hex'),'${run.record.users[0].id}',decode(repeat('ab',32),'hex'),decode(repeat('cd',12),'hex'),decode(repeat('ef',16),'hex'),'synthetic_cleanup');`);
});
test("cleanup: failure preserves original test error and fails teardown", async ({ context }) => {
    test.skip(process.env.GO_FIXTURE_CLEANUP_FAILURE_PROBE !== "true", "Intentional failure is run only by the guarded cleanup runner");
    await createAuthenticatedOwnerFixture(context);
    throw new Error("ORIGINAL_CLEANUP_PROBE_FAILURE");
});
