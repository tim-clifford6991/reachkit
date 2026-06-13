import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/auth/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/app";

  // Sanitize: only allow relative paths to prevent open-redirect attacks.
  const safeNext = nextParam.startsWith("/") ? nextParam : "/app";

  if (code) {
    const supa = await createServerSupabase();
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/?auth_error=1", req.url));
    }
  }

  return NextResponse.redirect(new URL(safeNext, req.url));
}
