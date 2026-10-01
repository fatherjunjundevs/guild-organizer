"use server";

import { redirect } from "next/navigation";
import { getSafeNextPath } from "@/features/auth/redirects";
import { serverEnv } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export async function signInWithDiscord(formData: FormData) {
  const rawNext = formData.get("next");
  const nextPath = getSafeNextPath(
    typeof rawNext === "string" ? rawNext : null,
  );

  const callbackUrl = new URL("/auth/callback", serverEnv.APP_ORIGIN);
  callbackUrl.searchParams.set("next", nextPath);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: "identify email",
    },
  });

  if (error || !data.url) {
    redirect("/auth/error?reason=oauth_start_failed");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  redirect(new URL("/", serverEnv.APP_ORIGIN).toString());
}
