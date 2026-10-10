import { expect as baseExpect, fixtureTest as test } from "./helpers/test";
import { createAuthenticatedEventBuilderFixture, createEventSharingActorFixture } from "./helpers/local-supabase";

const enabled = process.env.SHARE_LINK_INTERFACE_ENABLED === "true" && process.env.APP_ENV === "local";
const keys = process.env.SHARE_LINK_E2E_KEYS === "true";
const expect = baseExpect.configure({ timeout: 15000 });
// Never save traces/screenshots containing recovered bearer response data.
test.use({ trace: "off", screenshot: "off", video: "off" });

test("default-disabled sharing is absent in Builder and navigation", async ({ page, context }) => {
  test.skip(enabled, "Run with the default-disabled environment");
  const fixture = await createAuthenticatedEventBuilderFixture(context);
  try {
    await page.goto(`/app/guild/${fixture.guildId}/events/${fixture.eventId}`);
    await expect(page.getByRole("button", { name: "Preview & publish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share Link" })).toHaveCount(0);
    await page.goto(`/app/guild/${fixture.guildId}/events`);
    await expect(page.getByRole("link", { name: "Sharing", exact: true })).toHaveCount(0);
    const response = await page.goto(`/app/guild/${fixture.guildId}/sharing`);
    expect(response?.status()).toBe(404);
  } finally { await fixture.cleanup(); }
});

test("Create configuration rejection preserves verified status and permits explicit reload", async ({ page, context }) => {
  test.skip(!enabled || keys, "Requires locally enabled sharing without cryptographic test configuration");
  const fixture = await createAuthenticatedEventBuilderFixture(context);
  try {
    await page.goto(`/app/guild/${fixture.guildId}/events/${fixture.eventId}`);
    await page.getByRole("button", { name: "Share Link", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Event share link", exact: true });
    await expect(dialog.getByText("No link created", { exact: true })).toBeVisible();
    let requests = 0;
    page.on("request", (request) => { if (request.headers()["next-action"]) requests++; });
    const response = page.waitForResponse((response) => !!response.request().headers()["next-action"]);
    await dialog.getByRole("button", { name: "Create Link", exact: true }).click();
    const body = await (await response).text();
    expect(body.includes('"code":"configuration"')).toBe(true);
    expect(/token_digest|ciphertext|provisioning_mac|#token=/.test(body)).toBe(false);
    await expect(dialog.getByRole("alert")).toHaveText(/configuration is unavailable/);
    await expect(dialog.getByText("No link created", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Status unknown", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Create Link", exact: true })).toBeEnabled();
    expect(requests).toBe(1);
    const state = await fixture.userClient.rpc("get_event_share_link_management_state", { p_guild_id: fixture.guildId, p_event_id: fixture.eventId });
    expect(state.error).toBeNull(); expect(state.data?.[0].state).toBe("absent");
    await dialog.getByRole("button", { name: "Reload Status", exact: true }).click();
    await expect(dialog.getByText("Share-link status loaded.", { exact: true })).toBeVisible();
    await expect(dialog.getByText("No link created", { exact: true })).toBeVisible();
    expect(requests).toBe(2);
  } finally { await fixture.cleanup(); }
});

test("Owner manages authenticated link lifecycle with manual copy and responsive keyboard dialog", async ({ page, context }) => {
  test.skip(!keys, "Use pnpm test:e2e:sharing for ephemeral local keys");
  const fixture = await createAuthenticatedEventBuilderFixture(context);
  let bearer = "";
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true,
      value: { writeText: () => Promise.reject(new Error("clipboard unavailable")) } }));
    await page.goto(`/app/guild/${fixture.guildId}/events/${fixture.eventId}`);
    await page.getByRole("button", { name: "Share Link", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Event share link", exact: true });
    await expect(dialog.getByText("No link created", { exact: true })).toBeVisible();
    expect((await fixture.userClient.rpc("get_event_share_link_management_state", { p_guild_id: fixture.guildId, p_event_id: fixture.eventId })).data?.[0].state).toBe("absent");
    await dialog.getByRole("button", { name: "Create Link", exact: true }).click();
    await expect(dialog.getByText("Active · unavailable", { exact: true })).toBeVisible();
    const originalLink = (await fixture.userClient.rpc("get_event_share_link_management_state", {
      p_guild_id: fixture.guildId, p_event_id: fixture.eventId,
    })).data?.[0].link_id;
    expect(typeof originalLink).toBe("string");
    await dialog.getByRole("button", { name: "Copy Link", exact: true }).click();
    const manual = dialog.getByLabel("Temporary development link");
    await expect(manual).toBeVisible(); await expect(manual).toBeFocused();
    bearer = new URL(await manual.inputValue()).hash.slice("#token=".length);
    expect(/^v1\.[A-Za-z0-9_-]{43}$/.test(bearer)).toBe(true);
    await dialog.getByRole("button", { name: "Clear link field" }).click();
    await dialog.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog[open]"))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await dialog.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
    await dialog.screenshot({ path: "test-results/share-link-mobile.png" });
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Share Link", exact: true })).toBeFocused();

    const { error: publishError } = await fixture.userClient.rpc("publish_event", { p_event_id: fixture.eventId });
    expect(publishError).toBeNull();
    await page.getByRole("button", { name: "Share Link", exact: true }).click();
    await expect(dialog.getByText("Active · published", { exact: true })).toBeVisible();
    expect((await fixture.anonymousClient.rpc("resolve_event_share_link", { p_token: bearer })).error?.code).toBe("42501");
    await dialog.getByRole("button", { name: "Rotate Link", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Rotate share link?" });
    await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Rotate Link", exact: true })).toBeFocused();
    expect((await fixture.userClient.rpc("resolve_event_share_link", { p_token: bearer })).error?.code).toBe("42501");
    expect((await fixture.userClient.rpc("get_event_share_link_management_state", {
      p_guild_id: fixture.guildId, p_event_id: fixture.eventId,
    })).data?.[0].link_id).toBe(originalLink);
    await dialog.getByRole("button", { name: "Rotate Link", exact: true }).click();
    await confirm.getByRole("button", { name: "Rotate Link now" }).click();
    await expect(dialog.getByText("Link rotated. Older links are invalid.")).toBeVisible();
    // Positive/rotated token resolution is covered with the internal role in SQL and crypto integration.
    expect((await fixture.anonymousClient.rpc("resolve_event_share_link", { p_token: bearer })).error?.code).toBe("42501");
    const obsoleteCopy = await fixture.userClient.rpc("get_event_share_link_copy_payload", {
      p_guild_id: fixture.guildId, p_event_id: fixture.eventId, p_link_id: originalLink!,
    });
    expect(obsoleteCopy.error).toBeNull();
    expect(obsoleteCopy.data?.length).toBe(0);
    await dialog.getByRole("button", { name: "Revoke Link", exact: true }).click();
    await page.getByRole("dialog", { name: "Revoke share link?" }).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Revoke Link", exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "Revoke Link", exact: true }).click();
    await page.getByRole("dialog", { name: "Revoke share link?" }).getByRole("button", { name: "Revoke Link now" }).click();
    await expect(dialog.getByText("Link revoked", { exact: true })).toBeVisible();
    const revoked = await fixture.userClient.rpc("get_event_share_link_management_state", { p_guild_id: fixture.guildId, p_event_id: fixture.eventId });
    expect(revoked.data?.[0].state).toBe("revoked"); expect(revoked.data?.[0].link_id).toBeNull();
    expect((await fixture.userClient.from("event_publications").select("status").eq("event_id", fixture.eventId).single()).data?.status).toBe("published");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Share Link", exact: true }).click(); await expect(dialog.getByText("Link revoked", { exact: true })).toBeVisible();
  } finally { bearer = ""; await page.close(); await fixture.cleanup(); }
});

for (const actor of ["admin", "publisher", "events-only", "member"] as const) {
  test(`authenticated sharing boundaries: ${actor}`, async ({ page, context, browser }) => {
    test.skip(!enabled, "Requires local sharing gate");
    const fixture = await createAuthenticatedEventBuilderFixture(context);
    const actorContext = await browser.newContext();
    let cleanupActor: (() => Promise<void>) | null = null;
    try {
      await page.goto(`/app/guild/${fixture.guildId}/events/${fixture.eventId}`);
      const actionRequest = page.waitForRequest((request) => !!request.headers()["next-action"]);
      await page.getByRole("button", { name: "Share Link", exact: true }).click();
      const original = await actionRequest;
      await expect(page.getByText("No link created", { exact: true })).toBeVisible();
      const role = actor === "admin" ? "admin" : actor === "member" ? "member" : "officer";
      const created = await createEventSharingActorFixture(actorContext, fixture, role,
        actor === "publisher" ? ["publish.manage"] : actor === "events-only" ? ["events.manage"] : []);
      cleanupActor = created.cleanup;
      await actorContext.grantPermissions(["clipboard-read", "clipboard-write"]);
      const allowed = actor === "admin" || actor === "publisher";
      const resolver = await created.userClient.rpc("resolve_event_share_link", { p_token: "malformed" });
      expect(resolver.error?.code).toBe("42501");
      const postgrest = await created.userClient.rpc("get_event_share_link_management_state", { p_guild_id: fixture.guildId, p_event_id: fixture.eventId });
      expect(postgrest.error?.code ?? null).toBe(allowed ? null : "42501");
      const replay = await actorContext.request.post(original.url(), { data: original.postData()!, headers: {
        "next-action": original.headers()["next-action"], "content-type": original.headers()["content-type"], "origin": "http://127.0.0.1:3000",
      } });
      const body = await replay.text();
      expect(body.includes(allowed ? '"state":"absent"' : '"code":"forbidden"')).toBe(true);
      expect(/token_digest|ciphertext|provisioning_mac|#token=/.test(body)).toBe(false);
      const actorPage = await actorContext.newPage();
      await actorPage.goto(`/app/guild/${fixture.guildId}/sharing`);
      if (allowed) {
        await expect(actorPage.getByRole("heading", { name: "Event sharing", exact: true })).toBeVisible();
        await expect(actorPage.getByRole("link", { name: "Sharing", exact: true })).toBeVisible();
        await expect(actorPage.getByText("E2EAlphaTank", { exact: true })).toHaveCount(0);
        await actorPage.getByRole("button", { name: "Share Link", exact: true }).click();
        await expect(actorPage.getByText("No link created", { exact: true })).toBeVisible();
        if (keys) {
          const manager = actorPage.getByRole("dialog", { name: "Event share link", exact: true });
          await manager.getByRole("button", { name: "Create Link", exact: true }).click();
          await expect(manager.getByText("Active · unavailable", { exact: true })).toBeVisible();
          await manager.getByRole("button", { name: "Copy Link", exact: true }).click();
          await expect(manager.getByText(/Development link copied/)).toBeVisible();
          await expect(manager.getByLabel("Temporary development link")).toHaveCount(0);
          await manager.getByRole("button", { name: "Rotate Link", exact: true }).click();
          await actorPage.getByRole("button", { name: "Rotate Link now" }).click();
          await expect(manager.getByText("Link rotated. Older links are invalid.")).toBeVisible();
          await manager.getByRole("button", { name: "Revoke Link", exact: true }).click();
          await actorPage.getByRole("button", { name: "Revoke Link now" }).click();
          await expect(manager.getByText("Link revoked", { exact: true })).toBeVisible();
        }
      } else await expect(actorPage.getByRole("heading", { name: "Event sharing", exact: true })).toHaveCount(0);
      if (actor === "publisher") {
        await actorPage.goto(`/app/guild/${fixture.guildId}/events/${fixture.eventId}`);
        await expect(actorPage.getByText("Event management is not enabled", { exact: true })).toBeVisible();
        await expect(actorPage.getByText("E2EAlphaTank", { exact: true })).toHaveCount(0);
      }
      const mismatched = await created.userClient.rpc("get_event_share_link_management_state", { p_guild_id: "11111111-1111-4111-8111-111111111111", p_event_id: fixture.eventId });
      expect(mismatched.error !== null).toBe(true);
    } finally { if (cleanupActor) await cleanupActor(); await actorContext.close(); await fixture.cleanup(); }
  });
}

test("cross-Guild Event/action selectors and anonymous management are denied over HTTP", async ({ page, context, browser }) => {
  test.skip(!enabled, "Requires local sharing gate");
  const fixture = await createAuthenticatedEventBuilderFixture(context);
  const otherContext = await browser.newContext();
  let other: Awaited<ReturnType<typeof createAuthenticatedEventBuilderFixture>> | null = null;
  try {
    other = await createAuthenticatedEventBuilderFixture(otherContext);
    await page.goto(`/app/guild/${fixture.guildId}/events/${fixture.eventId}`);
    const request = page.waitForRequest((r) => !!r.headers()["next-action"]);
    await page.getByRole("button", { name: "Share Link", exact: true }).click();
    const original = await request;
    await expect(page.getByText("No link created", { exact: true })).toBeVisible();
    const wrongEvent = await fixture.userClient.rpc("get_event_share_link_management_state", { p_guild_id: fixture.guildId, p_event_id: other.eventId });
    expect(wrongEvent.error?.code).toBe("P0002");
    const wrongGuild = await fixture.userClient.rpc("get_event_share_link_management_state", { p_guild_id: other.guildId, p_event_id: other.eventId });
    expect(wrongGuild.error?.code).toBe("42501");
    const anonymous = await fixture.anonymousClient.rpc("get_event_share_link_management_state", { p_guild_id: fixture.guildId, p_event_id: fixture.eventId });
    expect(anonymous.error?.code).toBe("42501");
    const rows = await fixture.userClient.from("events").select("id,name,status").eq("guild_id", other.guildId);
    expect(rows.data?.length).toBe(0);
    const response = await context.request.post(original.url(), { data: original.postData()!.replaceAll(fixture.eventId, other.eventId), headers: {
      "next-action": original.headers()["next-action"], "content-type": original.headers()["content-type"], "origin": "http://127.0.0.1:3000",
    } });
    const body = await response.text();
    expect(body.includes('"code":"unavailable"')).toBe(true);
    expect(body.includes(other.eventId)).toBe(false);
  } finally { if (other) await other.cleanup(); await otherContext.close(); await fixture.cleanup(); }
});
