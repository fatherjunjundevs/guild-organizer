import "server-only";

import { serverEnv } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildInvitePath,
  createSignedInviteToken,
  digestInviteToken,
  verifySignedInviteToken,
} from "@/features/invites/token";

export type GuildInviteRole = "member" | "officer" | "admin";

export type ResolvedGuildInvite = {
  inviteId: string;
  guildId: string;
  guildName: string;
  inviteKind: string;
  role: GuildInviteRole;
  generation: number;
  expiresAt: string;
};

export type ManagedGuildInvite = {
  inviteId: string;
  inviteKind: string;
  role: GuildInviteRole;
  generation: number;
  status: string;
  useCount: number;
  maxUses: number | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
};

function buildInviteUrl(generation: number, token: string) {
  return new URL(
    buildInvitePath(generation, token),
    serverEnv.APP_ORIGIN,
  ).toString();
}

export async function createGuildInviteLink(input: {
  guildId: string;
  role: GuildInviteRole;
  expiresAt: Date;
}) {
  const token = createSignedInviteToken(
    serverEnv.INVITE_SIGNING_SECRET,
  );
  const tokenDigest = digestInviteToken(token);
  const inviteKind =
    input.role === "member" ? "join_link" : "elevated";

  const supabase = await createClient();
  const { data: inviteId, error } = await supabase.rpc(
    "create_guild_invite",
    {
      p_guild_id: input.guildId,
      p_invite_kind: inviteKind,
      p_role: input.role,
      p_token_digest: tokenDigest,
      p_expires_at: input.expiresAt.toISOString(),
    },
  );

  if (error || !inviteId) {
    throw new Error("Unable to create guild invitation.");
  }

  return {
    inviteId,
    generation: 1,
    url: buildInviteUrl(1, token),
    expiresAt: input.expiresAt.toISOString(),
  };
}

export async function regenerateGuildInviteLink(input: {
  inviteId: string;
  expiresAt: Date;
}) {
  const token = createSignedInviteToken(
    serverEnv.INVITE_SIGNING_SECRET,
  );
  const tokenDigest = digestInviteToken(token);

  const supabase = await createClient();
  const { data: generation, error } = await supabase.rpc(
    "regenerate_guild_invite",
    {
      p_invite_id: input.inviteId,
      p_token_digest: tokenDigest,
      p_expires_at: input.expiresAt.toISOString(),
    },
  );

  if (
    error ||
    !Number.isSafeInteger(generation) ||
    generation <= 0
  ) {
    throw new Error("Unable to regenerate guild invitation.");
  }

  return {
    inviteId: input.inviteId,
    generation,
    url: buildInviteUrl(generation, token),
    expiresAt: input.expiresAt.toISOString(),
  };
}

export async function revokeGuildInvite(inviteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_guild_invite", {
    p_invite_id: inviteId,
  });

  if (error) {
    throw new Error("Unable to revoke guild invitation.");
  }
}

export async function listManageableGuildInvites(
  guildId: string,
): Promise<ManagedGuildInvite[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_manageable_guild_invites",
    {
      p_guild_id: guildId,
    },
  );

  if (error) {
    return null;
  }

  const referenceNow = Date.now();

  return (data ?? []).flatMap((invite) => {
    if (
      invite.invite_role !== "member" &&
      invite.invite_role !== "officer" &&
      invite.invite_role !== "admin"
    ) {
      return [];
    }

    return [
      {
        inviteId: invite.invite_id,
        inviteKind: invite.invite_kind,
        role: invite.invite_role,
        generation: invite.generation,
        status: invite.status,
        useCount: invite.use_count,
        maxUses: invite.max_uses,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
        updatedAt: invite.updated_at,
        isExpired:
          new Date(invite.expires_at).getTime() <= referenceNow,
      },
    ];
  });
}

export async function resolveGuildInviteLink(
  token: string,
  generation: number,
): Promise<ResolvedGuildInvite | null> {
  if (
    !Number.isSafeInteger(generation) ||
    generation <= 0 ||
    !verifySignedInviteToken(
      token,
      serverEnv.INVITE_SIGNING_SECRET,
    )
  ) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "resolve_guild_invite",
    {
      p_token_digest: digestInviteToken(token),
      p_generation: generation,
    },
  );

  const invite = data?.[0];

  if (error || !invite) {
    return null;
  }

  if (
    invite.invite_role !== "member" &&
    invite.invite_role !== "officer" &&
    invite.invite_role !== "admin"
  ) {
    return null;
  }

  return {
    inviteId: invite.invite_id,
    guildId: invite.guild_id,
    guildName: invite.guild_name,
    inviteKind: invite.invite_kind,
    role: invite.invite_role,
    generation: invite.generation,
    expiresAt: invite.expires_at,
  };
}

export async function acceptGuildInviteLink(
  token: string,
  generation: number,
) {
  const invite = await resolveGuildInviteLink(token, generation);

  if (!invite) {
    return {
      ok: false as const,
      reason: "unavailable" as const,
    };
  }

  const supabase = await createClient();
  const { data: membershipId, error } = await supabase.rpc(
    "accept_guild_invite",
    {
      p_token_digest: digestInviteToken(token),
      p_generation: generation,
    },
  );

  if (error) {
    return {
      ok: false as const,
      reason:
        error.code === "23505"
          ? ("already-member" as const)
          : ("unavailable" as const),
    };
  }

  return {
    ok: true as const,
    membershipId,
    guildId: invite.guildId,
    guildName: invite.guildName,
  };
}
