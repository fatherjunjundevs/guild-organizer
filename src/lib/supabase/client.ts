"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env/client";

let browserClient:
  | ReturnType<typeof createBrowserClient>
  | undefined;

export function createClient() {
  browserClient ??= createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return browserClient;
}
