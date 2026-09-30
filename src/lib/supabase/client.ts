"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database.types";

let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return browserClient;
}
