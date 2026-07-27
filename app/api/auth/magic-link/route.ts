import { NextRequest, NextResponse } from "next/server";

import { hashIp, ipFromRequest } from "@/lib/scan/abuse";
import { rateLimitAllow, MAGIC_LINK_PER_IP, MAGIC_LINK_PER_EMAIL } from "@/lib/auth/rate-limit";
import { safeRelativePath } from "@/lib/auth/safe-redirect";
import { sendLoginLink } from "@/lib/auth/login-link";

/**
 * POST /api/auth/magic-link — send a passwordless sign-in link.
 *
 * Uses the ONE branded sender (`sendLoginLink`): admin token_hash link via Resend,
 * NOT Supabase's SMTP/`signInWithOtp`. So this "/welcome resend" email is identical
 * to the post-checkout onboarding link — consistent branding, cross-device safe
 * (token_hash, no PKCE code_verifier), and no Supabase-native auth email to theme.
 * Login-only: an unknown email sends nothing but still returns ok (no enumeration).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  // A real same-origin relative path only — `startsWith("/")` alone lets
  // `//evil.com` through (open redirect embedded in the magic-link email).
  const next = safeRelativePath(body.next);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  // Rate-limit BOTH the sender IP (enumeration / spraying many addresses) and
  // the target email (bombing one inbox). Deny if either ceiling is hit — a
  // magic link is the sole login path, so its abuse surface is real.
  const ipHash = hashIp(ipFromRequest(req));
  const emailKey = email.toLowerCase();
  if (
    !rateLimitAllow(`magic-link:ip:${ipHash}`, MAGIC_LINK_PER_IP) ||
    !rateLimitAllow(`magic-link:email:${emailKey}`, MAGIC_LINK_PER_EMAIL)
  ) {
    return NextResponse.json({ message: "Too many requests — please wait a bit and try again." }, { status: 429 });
  }

  // Branded Resend link (best-effort). Login-only: an unknown email quietly sends
  // nothing. Always return ok so a caller can't enumerate which emails have
  // accounts (the send failure is logged server-side, never surfaced).
  await sendLoginLink(email, next);
  return NextResponse.json({ ok: true });
}
