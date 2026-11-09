// Where a sign-in or email-change link lands. A Route Handler, because
// redeeming sets the session cookie on the redirect itself.
//
// A link is spent only by a request that shows it is a person's page load
// (`openSignal`). Mail scanners and prefetchers open links before the
// customer does, so every other request gets one answer that neither looks
// the token up nor spends it, whatever the token is (REQ-098 c7).
//
// A dead link is one answer with one shape: expired, used, unknown and
// malformed all land on the sign-in screen with the same marker.
import { NextResponse, type NextRequest } from "next/server";
import { APP_PATH, SETUP_PATH } from "@/app/(account)/setup/gate";
import { deadLinkPath, redeemLink, type CookieToSet } from "@/lib/account/identity";
import {
  LANDING_QUERY_KEY,
  TOKEN_HASH_QUERY_KEY,
  TYPE_QUERY_KEY,
  confirmTypeOf,
  linkLandingOf,
  linkOpenPath,
} from "@/lib/account/identity/addresses";
import { logLink } from "@/lib/account/identity/outcomes";
import { PENDING_CLEARED, PENDING_COOKIE, openSignal } from "@/lib/account/signin-pending";

const SEE_OTHER = 303;
const NO_CONTENT = 204;

/** The token rides in the address, so nothing may keep it or pass it on. */
function sealed<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function seeOther(path: string, request: NextRequest): NextResponse {
  return sealed(NextResponse.redirect(new URL(path, request.url), SEE_OTHER));
}

/** Explicit, because without it Next answers HEAD by running GET, which would spend the link. */
export function HEAD(): NextResponse {
  return sealed(new NextResponse(null, { status: NO_CONTENT }));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const query = request.nextUrl.searchParams;
  const type = confirmTypeOf(query.get(TYPE_QUERY_KEY));
  const purpose = type === "email_change" ? "email_change" : "sign_in";
  const signal = openSignal(request.headers, request.cookies.get(PENDING_COOKIE)?.value, type);
  if (signal === "none") {
    logLink({ event: "auth_link_opened", userId: undefined, purpose, outcome: "not_person", signal });
    return seeOther(linkOpenPath(), request);
  }

  const tokenHash = query.get(TOKEN_HASH_QUERY_KEY) ?? "";
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
  // A dead link opened with `signal: pending` was asked for in this browser, so a scanner spent it first.
  logLink({ event: "auth_link_opened", userId: redeemed.ok ? redeemed.userId : undefined, purpose, outcome: redeemed.ok ? "signed_in" : "dead", signal });
  if (!redeemed.ok) return seeOther(deadLinkPath(), request);

  const landing = linkLandingOf(query.get(LANDING_QUERY_KEY));
  const response = seeOther(landing ?? (redeemed.firstSignIn ? SETUP_PATH : APP_PATH), request);
  for (const cookie of written) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  response.cookies.set(PENDING_CLEARED.name, PENDING_CLEARED.value, PENDING_CLEARED.options);
  return response;
}
