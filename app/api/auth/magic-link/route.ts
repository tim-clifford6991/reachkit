import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/auth/server";

/**
 * POST /api/auth/magic-link — send a passwordless sign-in link.
 *
 * Runs the Supabase OTP send SERVER-side so the browser SDK never enters the
 * marketing client bundle. The link points at /auth/callback (code exchange).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  // Only allow relative paths (prevent open-redirect via the magic link).
  const next = typeof body.next === "string" && body.next.startsWith("/") ? body.next : "/app";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  const supa = await createServerSupabase();
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${req.nextUrl.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
