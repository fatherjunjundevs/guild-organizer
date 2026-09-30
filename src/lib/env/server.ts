import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]),
  APP_ORIGIN: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export const serverEnv = serverEnvSchema.parse({
  APP_ENV: process.env.APP_ENV,
  APP_ORIGIN: process.env.APP_ORIGIN,
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
