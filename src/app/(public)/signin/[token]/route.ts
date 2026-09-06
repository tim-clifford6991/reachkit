// src/app/(public)/signin/[token]/route.ts — BUILD §13
//
// Where a sign-in link lands. A Route Handler, not a page, because
// redeeming sets a cookie and "HTTP does not allow setting cookies after
// streaming starts, so you must use `.set` in a Server Function or Route
// Handler" (`next/dist/docs/01-app/03-api-reference/04-functions/
// cookies.md`). It renders nothing and speaks no sentence: every arm below
// is a redirect to a screen that does.
//
// **A thin adapter** (ARCHITECTURE rule 1). It reads one path segment,
// calls `redeemLink`, and turns the answer into a location. It decides
// nothing about whether the link is good, applies no policy of its own, and
// holds no query.
//
// **A dead link is one answer with one shape** (REQ-098 criterion 7):
// expired, spent and never-issued all land on the sign-in screen with the
// same marker, "so someone holding a link that is not theirs learns nothing
// about whether the address it was issued for has an account". This file
// never reads `redeemed.reason`, which is what makes that structural rather
// than remembered.
//
// **Where a successful redemption goes** — REQ-024 criterion 4: "returned
// to where they left off — setup if it is unfinished, otherwise onward into
// the product — never to a dead end or a second checkout". The fact that
// decides it is `users.first_signed_in_at`, read from the stamp's own
// write: a founder who has never signed in goes to `/setup` (§13's "send
// magic link → `/setup`"), and everyone else goes into the app. The two
// route names are `(account)/setup/gate.ts`'s, not this file's — that
// module owns which of the two a founder belongs on, and once its
// `readSetupGateState` can name an account (issue #36's own note: "the
// missing half is identity, not storage") this branch becomes the
// belt-and-braces half of a decision the gate makes on every request.
//
// **The cookie rides on the redirect's own response**, not on
// `cookies().set()`, so there is no version in which the browser follows
// the redirect without it and the customer signs in to a signed-out screen.
import { NextResponse } from "next/server";
import { APP_PATH, SETUP_PATH } from "@/app/(account)/setup/gate";
import { deadLinkPath, redeemLink, sessionCookie } from "@/lib/account/identity";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await context.params;
  const redeemed = await redeemLink(token);

  if (!redeemed.ok) {
    return NextResponse.redirect(new URL(deadLinkPath(), request.url));
  }

  const destination = redeemed.firstSignIn ? SETUP_PATH : APP_PATH;
  const response = NextResponse.redirect(new URL(destination, request.url));
  const cookie = sessionCookie(redeemed.session);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
