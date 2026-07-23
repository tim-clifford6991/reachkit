import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/auth/server";
import { safeRelativePath } from "@/lib/auth/safe-redirect";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");

  // Sanitize: a real same-origin relative path only. `startsWith("/")` alone
  // lets `//evil.com` through (open redirect) — safeRelativePath rejects it.
  const safeNext = safeRelativePath(searchParams.get("next"));

  if (code) {
    const supa = await createServerSupabase();
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/?auth_error=1", req.url));
    }
  }

  return NextResponse.redirect(new URL(safeNext, req.url));
}
