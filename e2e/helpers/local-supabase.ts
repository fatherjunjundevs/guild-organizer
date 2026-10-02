import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://127.0.0.1:3000";

type LocalSupabaseEnv = {
  apiUrl: string;
  publishableKey: string;
  adminKey: string;
};

type OwnerFixture = {
  guildId: string;
  cleanup: () => Promise<void>;
};

let cachedLocalEnv: LocalSupabaseEnv | null = null;

function stripQuotes(value: string) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getLocalSupabaseEnv(): LocalSupabaseEnv {
  if (cachedLocalEnv) return cachedLocalEnv;

  let output: string;

  try {
    output = execSync("pnpm exec supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Authenticated E2E requires the local Supabase stack. Run pnpm db:start first.",
    );
  }

  const values = new Map<string, string>();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    values.set(match[1], stripQuotes(match[2].trim()));
  }

  const apiUrl = values.get("API_URL");
  const publishableKey =
    values.get("PUBLISHABLE_KEY") ?? values.get("ANON_KEY");
  const adminKey =
    values.get("SECRET_KEY") ?? values.get("SERVICE_ROLE_KEY");

  if (!apiUrl || !publishableKey || !adminKey) {
    throw new Error(
      "Local Supabase status did not provide the API URL and required local keys.",
    );
  }

  cachedLocalEnv = { apiUrl, publishableKey, adminKey };
  return cachedLocalEnv;
}

async function addSupabaseSessionCookies(
  context: BrowserContext,
  env: LocalSupabaseEnv,
  accessToken: string,
  refreshToken: string,
) {
  const cookieWrites: Array<{ name: string; value: string }> = [];
  const supabase = createServerClient(env.apiUrl, env.publishableKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          cookieWrites.push({ name, value });
        }
      },
    },
  });

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || cookieWrites.length === 0) {
    throw new Error("Unable to create the browser session for E2E.");
  }

  await context.addCookies(
    cookieWrites.map(({ name, value }) => ({
      name,
      value,
      url: APP_ORIGIN,
    })),
  );
}

export async function createAuthenticatedOwnerFixture(
  context: BrowserContext,
): Promise<OwnerFixture> {
  const env = getLocalSupabaseEnv();
  const admin = createClient(env.apiUrl, env.adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const userClient = createClient(env.apiUrl, env.publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const marker = randomUUID();
  const email = `spreadsheet-e2e-${marker}@example.test`;
  let userId: string | null = null;
  let guildId: string | null = null;

  async function cleanupPartial() {
    if (guildId) {
      await admin.from("guilds").delete().eq("id", guildId);
    }

    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  }

  try {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: "Spreadsheet E2E Owner",
        },
      });

    if (createUserError || !createdUser.user) {
      throw new Error("Unable to create the E2E owner account.");
    }

    userId = createdUser.user.id;

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (linkError || !linkData.properties.hashed_token) {
      throw new Error(
        `Unable to generate E2E auth token: ${
          linkError?.message ?? "missing token"
        }`,
      );
    }

    const { data: signInData, error: signInError } =
      await userClient.auth.verifyOtp({
        type: "email",
        token_hash: linkData.properties.hashed_token,
      });

    if (signInError || !signInData.session) {
      throw new Error(
        `Unable to authenticate E2E owner: ${
          signInError?.message ?? "missing session"
        }`,
      );
    }
    const { data: createdGuildId, error: createGuildError } =
      await userClient.rpc("create_guild", {
        p_name: `Spreadsheet E2E ${marker.slice(0, 8)}`,
      });

    if (createGuildError || !createdGuildId) {
      throw new Error("Unable to create the E2E Guild.");
    }

    guildId = createdGuildId;

    await addSupabaseSessionCookies(
      context,
      env,
      signInData.session.access_token,
      signInData.session.refresh_token,
    );

   return {
      guildId: createdGuildId,
      cleanup: cleanupPartial,
    };
  } catch (error) {
    await cleanupPartial();
    throw error;
  }
}
