import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/auth/server";

/**
 * GET /auth/confirm — verify an admin-generated magic link (token_hash flow).
 *
 * The payment-first funnel emails a server-generated link (see
 * lib/billing/provision.ts) rather than the PKCE `?code` flow used by the
 * in-browser login form (/auth/callback). Admin-generated links carry a
 * `token_hash` and have no client-side code_verifier, so they're verified with
 * `verifyOtp` here — which works cross-device. Sets the session cookies and
 * forwards to `next`.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextParam = searchParams.get("next") ?? "/welcome";

  // Sanitize: only allow relative paths to prevent open-redirect attacks.
  const safeNext = nextParam.startsWith("/") ? nextParam : "/welcome";

  if (tokenHash && type) {
    const supa = await createServerSupabase();
    const { error } = await supa.auth.verifyOtp({
      type: type as "magiclink" | "email" | "signup" | "recovery" | "invite",
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(new URL("/?auth_error=1", req.url));
    }
  } else {
    return NextResponse.redirect(new URL("/?auth_error=1", req.url));
  }

  return NextResponse.redirect(new URL(safeNext, req.url));
}
