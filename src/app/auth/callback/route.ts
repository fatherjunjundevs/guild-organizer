import { NextResponse, type NextRequest } from "next/server";
import { getSafeNextPath } from "@/features/auth/redirects";
import { serverEnv } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(
    request.nextUrl.searchParams.get("next"),
  );

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=missing_code", serverEnv.APP_ORIGIN),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=callback_failed", serverEnv.APP_ORIGIN),
    );
  }

  return NextResponse.redirect(
    new URL(nextPath, serverEnv.APP_ORIGIN),
  );
}