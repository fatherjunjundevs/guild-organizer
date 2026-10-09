import { createHash, randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { fixtureRun } from "./test";
import { ownershipTag, verifiedLocalEnvironment } from "./local-fixture-lifecycle";

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

function getLocalSupabaseEnv(): LocalSupabaseEnv {
  const env = verifiedLocalEnvironment();
  if (env.target.fingerprint !== fixtureRun().record.target.fingerprint) throw new Error("Fixture target changed");
  return env;
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
  displayName: string,
) {
  const run = fixtureRun();
  const intent = run.userIntent();
  const email = intent.email;
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

  run.submitted(intent);
  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { go_e2e_fixture: ownershipTag(run.record, intent) },
      user_metadata: {
        display_name: displayName,
      },
    });

  if (createUserError || !createdUser.user) {
    if (createUserError?.status && [400, 401, 403, 404, 422].includes(createUserError.status)) run.rejected(intent);
    throw new Error("Unable to create the E2E account.");
  }

  await run.registeredUser(intent, createdUser.user.id);
  run.resource(async () => { await userClient.removeAllChannels(); userClient.auth.stopAutoRefresh(); });

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData.properties.hashed_token) {
    throw new Error("Unable to generate the E2E auth session.");
  }

  const { data: signInData, error: signInError } =
    await userClient.auth.verifyOtp({
      type: "email",
      token_hash: linkData.properties.hashed_token,
    });

  if (signInError || !signInData.session) {
    throw new Error("Unable to authenticate the E2E account.");
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

  fixtureRun().resource(() => context.close());
  async function cleanupPartial() { /* Checked database cleanup runs in automatic teardown. */ }

  try {
    const account = await createConfirmedSession(
      env,
      "Roster E2E Owner",
    );

    const guildIntent = fixtureRun().guildIntent(account.userId);
    fixtureRun().submitted(guildIntent);
    const { data: createdGuildId, error: createGuildError } =
      await account.userClient.rpc("create_guild", {
        p_name: guildIntent.name,
      });

    if (createGuildError || !createdGuildId) {
      if (createGuildError && /^[0-9A-Z]{5}$/.test(createGuildError.code)) fixtureRun().rejected(guildIntent);
      throw new Error("Unable to create the E2E Guild.");
    }

    await fixtureRun().registeredGuild(guildIntent, createdGuildId);

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

  let guildId: string | null = null;
  fixtureRun().resource(() => context.close());
  async function cleanupPartial() { /* Checked database cleanup runs in automatic teardown. */ }

  try {
    const owner = await createConfirmedSession(
      env,
      "Role Fixture Owner",
    );

    const guildIntent = fixtureRun().guildIntent(owner.userId);
    fixtureRun().submitted(guildIntent);
    const { data: createdGuildId, error: createGuildError } =
      await owner.userClient.rpc("create_guild", {
        p_name: guildIntent.name,
      });

    if (createGuildError || !createdGuildId) {
      if (createGuildError && /^[0-9A-Z]{5}$/.test(createGuildError.code)) fixtureRun().rejected(guildIntent);
      throw new Error("Unable to create the role-fixture Guild.");
    }

    await fixtureRun().registeredGuild(guildIntent, createdGuildId);
    guildId = createdGuildId;

    const actor = await createConfirmedSession(
      env,
      `Role Fixture ${options.role}`,
    );

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

export async function createEventSharingActorFixture(context: BrowserContext, owner: EventBuilderE2EFixture,
  role: "admin" | "officer" | "member", capabilities: string[] = []) {
  const env = getLocalSupabaseEnv();
  const marker = randomUUID();
  const actor = await createConfirmedSession(env, "Sharing E2E actor");
  fixtureRun().resource(() => context.close());
  async function cleanup() { /* Deferred to automatic teardown. */ }
  try {
    const digest = createHash("sha256").update(`sharing-invite-${marker}`).digest("hex");
    const { error: inviteError } = await owner.userClient.rpc("create_guild_invite", {
      p_guild_id: owner.guildId, p_invite_kind: role === "member" ? "join_link" : "elevated", p_role: role,
      p_token_digest: digest, p_expires_at: new Date(Date.now()+3600000).toISOString(),
    });
    if (inviteError) throw new Error("Sharing actor invitation failed");
    const { data: membership, error } = await actor.userClient.rpc("accept_guild_invite", { p_token_digest: digest, p_generation: 1 });
    if (error || !membership) throw new Error("Sharing actor membership failed");
    for (const capability of capabilities) {
      const { error: grantError } = await owner.userClient.rpc("grant_officer_capability", { p_membership_id: membership, p_capability_key: capability });
      if (grantError) throw new Error("Sharing actor capability failed");
    }
    await addSupabaseSessionCookies(context, env, actor.session.access_token, actor.session.refresh_token);
    return { userClient: actor.userClient, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

export async function createAuthenticatedEventBuilderFixture(
  context: BrowserContext,
): Promise<EventBuilderE2EFixture> {
  const env = getLocalSupabaseEnv();

  let guildId: string | null = null;

  fixtureRun().resource(() => context.close());
  async function cleanupPartial() { /* Checked database cleanup runs in automatic teardown. */ }

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
      "Event Builder E2E Owner",
    );

    const guildIntent = fixtureRun().guildIntent(account.userId);
    fixtureRun().submitted(guildIntent);
    const { data: createdGuildId, error: createGuildError } =
      await account.userClient.rpc("create_guild", {
        p_name: guildIntent.name,
      });

    if (createGuildError && /^[0-9A-Z]{5}$/.test(createGuildError.code)) fixtureRun().rejected(guildIntent);
    guildId = requireId(
      createdGuildId,
      createGuildError,
      "Guild",
    );

    await fixtureRun().registeredGuild(guildIntent, guildId);
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
