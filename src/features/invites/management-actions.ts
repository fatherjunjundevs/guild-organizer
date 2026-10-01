"use server";

import { revalidatePath } from "next/cache";
import {
  createGuildInviteLink,
  regenerateGuildInviteLink,
  revokeGuildInvite,
} from "@/features/invites/server";

const MEMBER_INVITE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InviteMutationState = {
  status: "idle" | "success" | "error";
  message: string;
  url?: string;
  inviteId?: string;
  generation?: number;
};

function getUuid(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return null;
  }

  return value;
}

function nextMemberInviteExpiration() {
  return new Date(Date.now() + MEMBER_INVITE_LIFETIME_MS);
}

function dashboardPath(guildId: string) {
  return `/app/guild/${guildId}/dashboard`;
}

export async function createMemberInviteAction(
  _previousState: InviteMutationState,
  formData: FormData,
): Promise<InviteMutationState> {
  const guildId = getUuid(formData, "guildId");

  if (!guildId) {
    return {
      status: "error",
      message: "The Guild identifier is invalid.",
    };
  }

  try {
    const invite = await createGuildInviteLink({
      guildId,
      role: "member",
      expiresAt: nextMemberInviteExpiration(),
    });

    revalidatePath(dashboardPath(guildId));

    return {
      status: "success",
      message:
        "Member invite created. Copy this link now; the raw link is not stored.",
      url: invite.url,
      inviteId: invite.inviteId,
      generation: invite.generation,
    };
  } catch {
    return {
      status: "error",
      message: "Unable to create a Member invite.",
    };
  }
}

export async function regenerateInviteAction(
  _previousState: InviteMutationState,
  formData: FormData,
): Promise<InviteMutationState> {
  const guildId = getUuid(formData, "guildId");
  const inviteId = getUuid(formData, "inviteId");

  if (!guildId || !inviteId) {
    return {
      status: "error",
      message: "The invitation identifiers are invalid.",
    };
  }

  try {
    const invite = await regenerateGuildInviteLink({
      inviteId,
      expiresAt: nextMemberInviteExpiration(),
    });

    revalidatePath(dashboardPath(guildId));

    return {
      status: "success",
      message:
        "Invite regenerated. Older copies are invalid. Copy the new link now.",
      url: invite.url,
      inviteId: invite.inviteId,
      generation: invite.generation,
    };
  } catch {
    return {
      status: "error",
      message: "Unable to regenerate this invitation.",
    };
  }
}

export async function revokeInviteAction(
  _previousState: InviteMutationState,
  formData: FormData,
): Promise<InviteMutationState> {
  const guildId = getUuid(formData, "guildId");
  const inviteId = getUuid(formData, "inviteId");

  if (!guildId || !inviteId) {
    return {
      status: "error",
      message: "The invitation identifiers are invalid.",
    };
  }

  try {
    await revokeGuildInvite(inviteId);
    revalidatePath(dashboardPath(guildId));

    return {
      status: "success",
      message: "Invitation revoked. Existing copies can no longer be used.",
      inviteId,
    };
  } catch {
    return {
      status: "error",
      message: "Unable to revoke this invitation.",
    };
  }
}
