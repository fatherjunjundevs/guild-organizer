import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
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

type GuildRole = "officer" | "member";

type RoleFixture = {
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
    values.get("SERVICE_ROLE_KEY") ?? values.get("SECRET_KEY");

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

async function createConfirmedSession(
  env: LocalSupabaseEnv,
  email: string,
  displayName: string,
) {
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

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

  if (createUserError || !createdUser.user) {
    throw new Error("Unable to create the E2E account.");
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData.properties.hashed_token) {
    await admin.auth.admin.deleteUser(createdUser.user.id);
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
    await admin.auth.admin.deleteUser(createdUser.user.id);
    throw new Error(
      `Unable to authenticate E2E account: ${
        signInError?.message ?? "missing session"
      }`,
    );
  }

  return {
    admin,
    userClient,
    userId: createdUser.user.id,
    session: signInData.session,
  };
}

export async function createAuthenticatedOwnerFixture(
  context: BrowserContext,
): Promise<OwnerFixture> {
  const env = getLocalSupabaseEnv();
  const marker = randomUUID();
  const email = `owner-e2e-${marker}@example.test`;

  let userId: string | null = null;
  let guildId: string | null = null;
  const cleanupAdmin = createClient(env.apiUrl, env.adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  async function cleanupPartial() {
    if (guildId) {
      await cleanupAdmin.from("guilds").delete().eq("id", guildId);
    }

    if (userId) {
      await cleanupAdmin.auth.admin.deleteUser(userId);
    }
  }

  try {
    const account = await createConfirmedSession(
      env,
      email,
      "Roster E2E Owner",
    );
    userId = account.userId;

    const { data: createdGuildId, error: createGuildError } =
      await account.userClient.rpc("create_guild", {
        p_name: `Roster E2E ${marker.slice(0, 8)}`,
      });

    if (createGuildError || !createdGuildId) {
      throw new Error("Unable to create the E2E Guild.");
    }

    guildId = createdGuildId;

    await addSupabaseSessionCookies(
      context,
      env,
      account.session.access_token,
      account.session.refresh_token,
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

export async function createAuthenticatedRoleFixture(
  context: BrowserContext,
  options: {
    role: GuildRole;
    capabilities?: string[];
  },
): Promise<RoleFixture> {
  const env = getLocalSupabaseEnv();
  const marker = randomUUID();

  let ownerId: string | null = null;
  let actorId: string | null = null;
  let guildId: string | null = null;
  const cleanupAdmin = createClient(env.apiUrl, env.adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  async function cleanupPartial() {
    if (guildId) {
      await cleanupAdmin.from("guilds").delete().eq("id", guildId);
    }

    if (actorId) {
      await cleanupAdmin.auth.admin.deleteUser(actorId);
    }

    if (ownerId) {
      await cleanupAdmin.auth.admin.deleteUser(ownerId);
    }
  }

  try {
    const owner = await createConfirmedSession(
      env,
      `role-owner-${marker}@example.test`,
      "Role Fixture Owner",
    );
    ownerId = owner.userId;

    const { data: createdGuildId, error: createGuildError } =
      await owner.userClient.rpc("create_guild", {
        p_name: `Role E2E ${marker.slice(0, 8)}`,
      });

    if (createGuildError || !createdGuildId) {
      throw new Error("Unable to create the role-fixture Guild.");
    }

    guildId = createdGuildId;

    const actor = await createConfirmedSession(
      env,
      `role-actor-${marker}@example.test`,
      `Role Fixture ${options.role}`,
    );
    actorId = actor.userId;

    const tokenDigest = createHash("sha256")
      .update(`role-fixture-${marker}`)
      .digest("hex");

    const { error: inviteError } = await owner.userClient.rpc(
      "create_guild_invite",
      {
        p_guild_id: guildId,
        p_invite_kind:
          options.role === "member" ? "join_link" : "elevated",
        p_role: options.role,
        p_token_digest: tokenDigest,
        p_expires_at: new Date(
          Date.now() + 60 * 60 * 1000,
        ).toISOString(),
      },
    );

    if (inviteError) {
      throw new Error(
        `Unable to create the role-fixture invite: ${inviteError.message}`,
      );
    }

    const { data: membershipId, error: acceptError } =
      await actor.userClient.rpc("accept_guild_invite", {
        p_token_digest: tokenDigest,
        p_generation: 1,
      });

    if (acceptError || !membershipId) {
      throw new Error(
        `Unable to accept the role-fixture invite: ${
          acceptError?.message ?? "missing membership id"
        }`,
      );
    }

    for (const capabilityKey of options.capabilities ?? []) {
      const { error: capabilityError } = await owner.userClient.rpc(
        "grant_officer_capability",
        {
          p_membership_id: membershipId,
          p_capability_key: capabilityKey,
        },
      );

      if (capabilityError) {
        throw new Error(
          `Unable to grant role-fixture capability "${capabilityKey}": ${capabilityError.message}`,
        );
      }
    }

    await addSupabaseSessionCookies(
      context,
      env,
      actor.session.access_token,
      actor.session.refresh_token,
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
