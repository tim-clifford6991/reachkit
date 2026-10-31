// src/app/(public)/auth/confirm/redeem/route.ts — BUILD §13 (#468)
//
// The only address that spends a sign-in or email-change link. The confirm
// page posts the link's `token_hash`, type and landing here; this route
// hands them to `redeemLink`, which asks Supabase (`verifyOtp`) and has the
// session written. A Route Handler, because redeeming sets a cookie and
// "HTTP does not allow setting cookies after streaming starts, so you must
// use `.set` in a Server Function or Route Handler"
// (`next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`).
//
// **A POST, and only from our own page.** A mail scanner that opens the
// link only GETs, so it never reaches this file. A form on another site
// that posts here is refused before Supabase is asked, so it spends nothing
// and signs nobody in.
//
// **A dead link is one answer with one shape** (REQ-098 criterion 7):
// expired, used, unknown, malformed and refused all land on the sign-in
// screen with the same marker. This file never reads `redeemed.reason`.
//
// **Where a successful redemption goes** — REQ-024 criterion 4: setup for a
// founder who has never signed in, otherwise the app, or the one landing a
// link may ask for. Every answer is a 303, so the browser follows it with a
// GET and the token is left behind in the form body.
//
// **The session cookies ride on the redirect's own response**, collected
// from `@supabase/ssr` as it writes them.
import { NextResponse, type NextRequest } from "next/server";
import { APP_PATH, SETUP_PATH } from "@/app/(account)/setup/gate";
import { deadLinkPath, redeemLink, type CookieToSet } from "@/lib/account/identity";
import {
  LANDING_QUERY_KEY,
  TOKEN_HASH_QUERY_KEY,
  TYPE_QUERY_KEY,
  confirmTypeOf,
  linkLandingOf,
} from "@/lib/account/identity/addresses";
import { env } from "@/lib/config/env";

const SEE_OTHER = 303;

/** Our own page's post. The page sends no referrer, and under that policy a
 *  browser sends `Origin: null` with `Sec-Fetch-Site: same-origin`, so that
 *  pair counts as ours too. Anything else, including no `Origin`, is not. */
function isOwnPost(headers: Pick<Headers, "get">, appOrigin: string): boolean {
  const origin = headers.get("origin");
  if (origin === appOrigin) return true;
  return origin === "null" && headers.get("sec-fetch-site") === "same-origin";
}

function field(form: FormData | null, key: string): string | null {
  const value = form?.get(key);
  return typeof value === "string" ? value : null;
}

function seeOther(path: string, request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), SEE_OTHER);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isOwnPost(request.headers, new URL(env.NEXT_PUBLIC_APP_URL).origin)) {
    return seeOther(deadLinkPath(), request);
  }
  const form = await request.formData().catch(() => null);
  const tokenHash = field(form, TOKEN_HASH_QUERY_KEY) ?? "";
  const type = confirmTypeOf(field(form, TYPE_QUERY_KEY));
  if (tokenHash.length === 0 || type === null) return seeOther(deadLinkPath(), request);

  const written: CookieToSet[] = [];
  const redeemed = await redeemLink(
    {
      getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookies) => {
        written.push(...cookies);
      },
    },
    { tokenHash, type }
  );
  if (!redeemed.ok) return seeOther(deadLinkPath(), request);

  const landing = linkLandingOf(field(form, LANDING_QUERY_KEY));
  const response = seeOther(landing ?? (redeemed.firstSignIn ? SETUP_PATH : APP_PATH), request);
  for (const cookie of written) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
