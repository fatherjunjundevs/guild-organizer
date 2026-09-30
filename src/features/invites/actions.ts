"use server";

import { redirect } from "next/navigation";
import { buildInvitePath } from "@/features/invites/token";
import { acceptGuildInviteLink } from "@/features/invites/server";

export async function acceptGuildInviteAction(formData: FormData) {
  const tokenValue = formData.get("token");
  const generationValue = formData.get("generation");

  if (
    typeof tokenValue !== "string" ||
    typeof generationValue !== "string"
  ) {
    redirect("/");
  }

  const generation = Number(generationValue);

  if (!Number.isSafeInteger(generation) || generation <= 0) {
    redirect("/");
  }

  const path = buildInvitePath(generation, tokenValue);
  const result = await acceptGuildInviteLink(
    tokenValue,
    generation,
  );

  if (!result.ok) {
    redirect(`${path}?error=${result.reason}`);
  }

  redirect(`/join/success?guild=${encodeURIComponent(result.guildId)}`);
}
