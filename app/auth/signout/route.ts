import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/auth/server";

/**
 * POST /auth/signout — clear the Supabase session and return to the homepage.
 * A route handler (not a Server Component) so the auth cookies can be cleared.
 */
export async function POST(req: NextRequest) {
  const supa = await createServerSupabase();
  await supa.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
