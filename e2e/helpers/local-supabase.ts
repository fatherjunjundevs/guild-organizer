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

export type EventBuilderE2EFixture = {
  userClient: Awaited<ReturnType<typeof createConfirmedSession>>["userClient"];
  anonymousClient: Awaited<ReturnType<typeof createConfirmedSession>>["userClient"];
  guildId: string;
  eventId: string;
  slotIds: {
    alphaPrimary: string;
    alphaDuplicate: string;
    healerRequired: string;
    betaAssigned: string;
    open: string;
  };
  characterIds: {
    alpha: string;
    healer: string;
    beta: string;
  };
  cleanup: () => Promise<void>;
};

export async function createAuthenticatedEventBuilderFixture(
  context: BrowserContext,
): Promise<EventBuilderE2EFixture> {
  const env = getLocalSupabaseEnv();
  const marker = randomUUID();
  const email = `event-builder-e2e-${marker}@example.test`;

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

  function requireId(
    value: string | null,
    error: { message: string } | null,
    label: string,
  ) {
    if (error || !value) {
      throw new Error(
        `Unable to seed ${label}: ${error?.message ?? "missing id"}`,
      );
    }

    return value;
  }

  try {
    const account = await createConfirmedSession(
      env,
      email,
      "Event Builder E2E Owner",
    );
    userId = account.userId;

    const { data: createdGuildId, error: createGuildError } =
      await account.userClient.rpc("create_guild", {
        p_name: `Event Builder E2E ${marker.slice(0, 8)}`,
      });

    guildId = requireId(
      createdGuildId,
      createGuildError,
      "Guild",
    );

    await addSupabaseSessionCookies(
      context,
      env,
      account.session.access_token,
      account.session.refresh_token,
    );

    const { data: eventTypeIdData, error: eventTypeError } =
      await account.userClient.rpc("create_event_type", {
        p_guild_id: guildId,
        p_name: "E2E Siege",
        p_description: "Event Builder E2E Event Type",
      });

    const eventTypeId = requireId(
      eventTypeIdData,
      eventTypeError,
      "Event Type",
    );

    const { data: templateIdData, error: templateError } =
      await account.userClient.rpc("create_event_template", {
        p_guild_id: guildId,
        p_event_type_id: eventTypeId,
        p_name: "E2E Siege Template",
        p_description: "Event Builder E2E Template",
        p_uses_areas: false,
      });

    const templateId = requireId(
      templateIdData,
      templateError,
      "Event Template",
    );

    const { data: sectionIdData, error: sectionError } =
      await account.userClient.rpc("create_event_template_section", {
        p_template_id: templateId,
        p_name: "MAIN TEAM",
        p_sort_order: 0,
      });

    const sectionId = requireId(
      sectionIdData,
      sectionError,
      "Template Team",
    );

    const partyIds: string[] = [];

    for (const [index, name] of ["Party 1", "Party 2"].entries()) {
      const { data, error } = await account.userClient.rpc(
        "create_event_template_party",
        {
          p_section_id: sectionId,
          p_name: name,
          p_sort_order: index,
        },
      );

      partyIds.push(
        requireId(data, error, `Template ${name}`),
      );
    }

    const templateSlots: Array<{
      id: string;
      partyIndex: number;
      seatIndex: number;
    }> = [];

    for (let partyIndex = 0; partyIndex < partyIds.length; partyIndex += 1) {
      for (let seatIndex = 0; seatIndex < 3; seatIndex += 1) {
        const seatNumber = seatIndex + 1;
        const requiredRole =
          partyIndex === 0 && seatNumber === 3 ? "Healer" : undefined;

        const args: {
          p_party_id: string;
          p_name: string;
          p_sort_order: number;
          p_role_label?: string;
        } = {
          p_party_id: partyIds[partyIndex]!,
          p_name: `Seat ${seatNumber}`,
          p_sort_order: seatIndex,
        };

        if (requiredRole) {
          args.p_role_label = requiredRole;
        }

        const { data, error } = await account.userClient.rpc(
          "create_event_template_slot",
          args,
        );

        templateSlots.push({
          id: requireId(
            data,
            error,
            `Template Party ${partyIndex + 1} Seat ${seatNumber}`,
          ),
          partyIndex,
          seatIndex,
        });
      }
    }

    const { error: activateError } = await account.userClient.rpc(
      "activate_event_template",
      {
        p_template_id: templateId,
      },
    );

    if (activateError) {
      throw new Error(
        `Unable to activate Event Template: ${activateError.message}`,
      );
    }

    const { data: eventIdData, error: eventError } =
      await account.userClient.rpc("create_event_from_template", {
        p_template_id: templateId,
        p_name: "E2E Saturday Siege",
        p_description: "Critical Event Builder workflow fixture.",
      });

    const eventId = requireId(
      eventIdData,
      eventError,
      "Event",
    );

    const { data: eventParties, error: eventPartiesError } =
      await account.userClient
        .from("event_parties")
        .select("id,name")
        .eq("guild_id", guildId)
        .eq("event_id", eventId);

    if (eventPartiesError || !eventParties) {
      throw new Error(
        `Unable to read Event Parties: ${
          eventPartiesError?.message ?? "missing rows"
        }`,
      );
    }

    const partyOne = eventParties.find(
      (party) => party.name === "Party 1",
    );
    const partyTwo = eventParties.find(
      (party) => party.name === "Party 2",
    );

    if (!partyOne || !partyTwo) {
      throw new Error("Event copy did not contain the expected Parties.");
    }

    const { data: eventSlots, error: eventSlotsError } =
      await account.userClient
        .from("event_slots")
        .select("id,party_id,name,role_label")
        .eq("guild_id", guildId)
        .eq("event_id", eventId);

    if (eventSlotsError || !eventSlots) {
      throw new Error(
        `Unable to read Event Slots: ${
          eventSlotsError?.message ?? "missing rows"
        }`,
      );
    }

    const copiedEventSlots = eventSlots;

    function findSlot(
      partyId: string,
      name: string,
    ) {
      const found = copiedEventSlots.find(
        (slot) => slot.party_id === partyId && slot.name === name,
      );

      if (!found) {
        throw new Error(
          `Event copy did not contain ${name} in the expected Party.`,
        );
      }

      return found.id;
    }

    const slotIds = {
      alphaPrimary: findSlot(partyOne.id, "Seat 1"),
      alphaDuplicate: findSlot(partyOne.id, "Seat 2"),
      healerRequired: findSlot(partyOne.id, "Seat 3"),
      betaAssigned: findSlot(partyTwo.id, "Seat 1"),
      open: findSlot(partyTwo.id, "Seat 2"),
    };

    const characterDefinitions = [
      {
        key: "alpha",
        ign: "E2EAlphaTank",
        className: "Knight",
        gearScore: 120000,
        roleLabel: "Tank",
      },
      {
        key: "healer",
        ign: "E2EHealer",
        className: "Priest",
        gearScore: 118000,
        roleLabel: "Healer",
      },
      {
        key: "beta",
        ign: "E2EBetaDps",
        className: "Ranger",
        gearScore: 116000,
        roleLabel: "DPS",
      },
    ] as const;

    const characterIds: {
      alpha: string;
      healer: string;
      beta: string;
    } = {
      alpha: "",
      healer: "",
      beta: "",
    };

    for (const character of characterDefinitions) {
      const { data, error } = await account.userClient.rpc(
        "create_roster_character",
        {
          p_guild_id: guildId,
          p_ign: character.ign,
          p_level: 90,
          p_class_name: character.className,
          p_guild_position: "Member",
          p_gear_score: character.gearScore,
          p_online_status: "Online",
          p_designation: "main",
          p_role_label: character.roleLabel,
        },
      );

      characterIds[character.key] = requireId(
        data,
        error,
        `Character ${character.ign}`,
      );
    }

    const initialAssignments = [
      [slotIds.alphaPrimary, characterIds.alpha],
      [slotIds.alphaDuplicate, characterIds.alpha],
      [slotIds.betaAssigned, characterIds.beta],
    ] as const;

    for (const [slotId, characterId] of initialAssignments) {
      const { error } = await account.userClient.rpc(
        "assign_event_slot",
        {
          p_slot_id: slotId,
          p_character_id: characterId,
        },
      );

      if (error) {
        throw new Error(
          `Unable to seed Event assignment: ${error.message}`,
        );
      }
    }

    return {
      guildId,
      eventId,
      slotIds,
      characterIds,
      userClient: account.userClient,
      anonymousClient: createClient(env.apiUrl, env.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      cleanup: cleanupPartial,
    };
  } catch (error) {
    await cleanupPartial();
    throw error;
  }
}
