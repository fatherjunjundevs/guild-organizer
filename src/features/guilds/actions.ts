"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createGuildAction(formData: FormData) {
  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (name.length < 2 || name.length > 80) {
    redirect("/app?error=invalid-name");
  }

  const supabase = await createClient();
  const { data: guildId, error } = await supabase.rpc(
    "create_guild",
    {
      p_name: name,
    },
  );

  if (error || !guildId) {
    redirect("/app?error=create-failed");
  }

  redirect(`/app/guild/${guildId}/dashboard`);
}
