import { test as base, expect } from "@playwright/test";
import { basename } from "node:path";
import { createLocalBackend, LocalFixtureRun } from "./local-fixture-lifecycle";
let current: LocalFixtureRun | null = null;
export function fixtureRun() {
    if (!current)
        throw new Error("Fixture creation requires the guarded E2E test wrapper");
    return current;
}
// Teardown errors are reported by Playwright alongside the original test error.
// Database cleanup is deferred until all contexts (including extra contexts) close.
export const fixtureTest = base.extend<{
    fixtureLifecycle: void;
}>({
    fixtureLifecycle: [async ({ browser }, runTest, info) => {
            const backend = createLocalBackend();
            // Deliberate failure probe is confined to the explicit cleanup spec.
            if (process.env.GO_FIXTURE_CLEANUP_FAILURE_PROBE === "true") {
                if (basename(info.file) !== "fixture-cleanup.spec.ts")
                    throw new Error("Cleanup failure injection is confined to the guarded cleanup spec");
                backend.deleteGuild = async () => { throw new Error("Injected local cleanup rejection"); };
            }
            current = await LocalFixtureRun.start(backend);
            const run = current;
            // Cover contexts opened before a helper can register them (including
            // partial helper failures). Each worker owns its browser instance.
            run.resource(async () => {
                const closed = await Promise.allSettled(browser.contexts().map(context => context.close()));
                const errors = closed.filter(result => result.status === "rejected");
                if (errors.length) throw new AggregateError(errors, "Browser contexts could not be closed");
            });
            try {
                await runTest();
            }
            finally {
                current = null;
                await run.cleanup();
            }
        }, { auto: true, timeout: 120000 }],
});
export { expect };
