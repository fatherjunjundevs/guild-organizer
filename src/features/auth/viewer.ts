import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AuthViewer = {
  id: string;
  displayName: string;
};

export async function getAuthViewer(): Promise<AuthViewer | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    return null;
  }

  const userId = claimsData?.claims?.sub;

  if (typeof userId !== "string" || userId.length === 0) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return {
    id: userId,
    displayName: profile?.display_name ?? "Discord member",
  };
}
