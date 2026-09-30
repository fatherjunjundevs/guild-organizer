import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env/server";
import type { Database } from "@/types/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie writes are not available in every Server Component.
            // Auth refresh handling will be added with auth middleware.
          }
        },
      },
    },
  );
}
