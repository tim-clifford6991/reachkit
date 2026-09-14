// src/app/(public)/auth/checkout/route.ts — SPEC.md §3 (2026-09-14)
//
// Stripe's success URL. The buyer has paid and has no session yet. This
// route opens the account (idempotent with the webhook), writes the
// session cookie, and sends a first-time payer to `/setup`.
//
// A Route Handler, not a page, for the same reason `/auth/confirm` is:
// the cookie has to ride on the redirect's own response.
//
// **A missing or unpaid session is the offer, not sign-in.** Sign-in would
// imply they have an account. They don't, or they never finished paying.
// Provisioned-but-unsigned-in is `/signin`, so they can ask for a link.
import { NextResponse, type NextRequest } from "next/server";
import { APP_PATH, SETUP_PATH } from "@/app/(account)/setup/gate";
import {
  CHECKOUT_SESSION_PLACEHOLDER,
  CHECKOUT_SESSION_QUERY_KEY,
  SIGNIN_PATH,
  type CookieToSet,
} from "@/lib/account/identity";
import { enterAfterPayment } from "@/lib/account/provisioning/enter";
import { PRICING_PATH } from "@/app/(public)/pricing/state";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.nextUrl.searchParams.get(CHECKOUT_SESSION_QUERY_KEY) ?? "";
  if (sessionId.length === 0 || sessionId.includes(CHECKOUT_SESSION_PLACEHOLDER)) {
    return NextResponse.redirect(new URL(PRICING_PATH, request.url));
  }

  const written: CookieToSet[] = [];
  const entered = await enterAfterPayment(sessionId, {
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => {
      written.push(...cookies);
    },
  });

  if (!entered.ok) {
    const path = entered.because === "no_session" ? SIGNIN_PATH : PRICING_PATH;
    return NextResponse.redirect(new URL(path, request.url));
  }

  const destination = entered.firstSignIn ? SETUP_PATH : APP_PATH;
  const response = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of written) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
