// src/app/(public)/auth/confirm/route.ts — BUILD §13 (#468)
//
// Where a sign-in or email-change link lands. The link carries Supabase's
// `token_hash` and its verification type on this product's own host; this
// route hands both to `redeemLink`, which asks Supabase (`verifyOtp`) and
// has the session written. A Route Handler, not a page, because redeeming
// sets a cookie and "HTTP does not allow setting cookies after streaming
// starts, so you must use `.set` in a Server Function or Route Handler"
// (`next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`). It
// renders nothing and speaks no sentence: every arm below is a redirect to
// a screen that does.
//
// **A thin adapter** (ARCHITECTURE rule 1). It reads two query values,
// calls `redeemLink`, and turns the answer into a location. It decides
// nothing about whether the link is good and holds no query of its own.
//
// **A dead link is one answer with one shape** (REQ-098 criterion 7):
// expired, used, unknown and malformed all land on the sign-in screen with
// the same marker. This file never reads `redeemed.reason`, which is what
// makes that structural rather than remembered.
//
// **Where a successful redemption goes** — REQ-024 criterion 4: "setup if it
// is unfinished, otherwise onward into the product". A founder who has
// never signed in goes to `/setup`, everyone else into the app; the two
// route names are `(account)/setup/gate.ts`'s.
//
// **The session cookies ride on the redirect's own response**, collected
// from `@supabase/ssr` as it writes them, so there is no version in which
// the browser follows the redirect without them.
import { NextResponse, type NextRequest } from "next/server";
import { APP_PATH, SETUP_PATH } from "@/app/(account)/setup/gate";
import {
  deadLinkPath,
  redeemLink,
  type ConfirmType,
  type CookieToSet,
} from "@/lib/account/identity";
import { TOKEN_HASH_QUERY_KEY, TYPE_QUERY_KEY } from "@/lib/account/identity/addresses";

function confirmTypeOf(value: string | null): ConfirmType | null {
  return value === "magiclink" || value === "email_change" ? value : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tokenHash = request.nextUrl.searchParams.get(TOKEN_HASH_QUERY_KEY) ?? "";
  const type = confirmTypeOf(request.nextUrl.searchParams.get(TYPE_QUERY_KEY));
  if (tokenHash.length === 0 || type === null) {
    return NextResponse.redirect(new URL(deadLinkPath(), request.url));
  }

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

  if (!redeemed.ok) {
    return NextResponse.redirect(new URL(deadLinkPath(), request.url));
  }

  const destination = redeemed.firstSignIn ? SETUP_PATH : APP_PATH;
  const response = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of written) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
