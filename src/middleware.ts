// src/middleware.ts — BP-001 `## NFR budget`, WO-003
//
// "Authorisation: default-deny. `src/app/(account)/**` requires a session;
// `src/app/(public)/**` explicitly declares itself public in one middleware
// allow-list, so a new account route cannot leak by omission." This file is
// the one allow-list. Every request is denied unless it matches
// `PUBLIC_PATHS` (BP-001 `## Public interface`, "Routes (public)"), one of
// the two transport-only adapters (`decision 1`: "every file under
// `src/app/api/**` is BP-001's ... a transport-only adapter"), the sign-in
// address prompt itself (below), or a Next.js internal.
//
// Reads no database (`## File plan`): the check is a cookie's presence,
// nothing about its contents. Session *identity* is BP-061's
// `currentSession()`; the account container is not reachable before that
// node ships (`## Interfaces`).
//
// **Deprecated file convention, flagged once (constitution rule 4.2).**
// Next.js 16 deprecates the `middleware.ts` / `export function middleware`
// convention in favour of `proxy.ts` / `export function proxy`
// (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// proxy.md`, "Migration to Proxy": "the term middleware ... is renamed to
// proxy"). "All functionality remains the same — only the file and export
// names have changed" (`middleware.md`), and `next/dist/build/index.js`
// still resolves `middleware.ts` and calls `middleware()` — it only
// `warnOnce`s at build time. WO-003's `## Interfaces` and BP-001's `code:`
// glob both name `src/middleware.ts` and `export function middleware`
// explicitly, and the glob is the architect's to change, not this
// implementer's — so this file follows the WO exactly, on the working half
// of a deprecated (not removed) convention, and the migration is left for
// a work order that touches BP-001's own `code:` list.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** One entry per BP-001 `## Public interface` "Routes (public)" row
 *  (`## Steps` step 1). A leading `:` marks a single dynamic path segment —
 *  matched against exactly one non-empty segment, never across a `/`. */
export const PUBLIC_PATHS: readonly string[] = [
  "/",
  "/scan/:domain",
  "/api/scan",
  "/api/scan/:scanId/progress",
  "/api/report/:domain/correct",
  "/api/lead",
  "/opt-out/:token",
  "/pricing",
  // Issue #19: the sign-in address prompt now exists as a route
  // (`src/app/(public)/signin/page.tsx`), so it takes a row on this list
  // like every other public surface. `SIGNIN_PATH` below stays: it is this
  // file's redirect *target*, and a target that is not itself public would
  // redirect a denied visitor to a denied page forever — a property worth
  // holding independently of any row on this list.
  "/signin",
];

/** The two transport-only adapters (`## File plan`): Stripe and the job
 *  platform hold no session of this product's, so an adapter denying them
 *  would be denying their own caller. `/api/jobs` matches its own
 *  `[[...slug]]` catch-all — the segment is optional. */
function isAdapterPath(pathname: string): boolean {
  if (pathname === "/api/stripe/webhook") return true;
  return pathname === "/api/jobs" || pathname.startsWith("/api/jobs/");
}

/** The sign-in address prompt this middleware redirects a denied request
 *  to (`## File plan`: "redirected to the sign-in address prompt"). No
 *  route on this list names it — BP-001's `## Public interface` does not
 *  either — because the page itself is out of scope here (`## Out of
 *  scope`: "The sign-in address prompt page itself ... (BP-061)").
 *
 *  **Parameter, chosen here (constitution rule 1.1).** An internal route
 *  name, not a customer-visible string (the decision-rights table: "Internal
 *  names, type members, module boundaries" is the system's to set) — chosen
 *  as `/signin` under `(public)`, the shortest form matching this product's
 *  own vocabulary ("sign-in link", `LinkPurpose = 'sign_in'`, BP-061).
 *  Reversal cost: one constant in this file; nothing outside this file
 *  reads it, and no page exists at this address yet (`## Provenance of this
 *  file plan`), so renaming it costs one line here and, once BP-061's own
 *  work order lands, one matching route file. It must stay on the allow
 *  list below or a signed-out visitor sent here would be redirected here
 *  again. */
const SIGNIN_PATH = "/signin";

/** The session cookie this middleware checks for presence only.
 *
 *  **Parameter, chosen here (constitution rule 1.1).** BP-061's own
 *  `SessionCookie` type names no wire name yet — that node has not shipped
 *  (`## Interfaces`: "the account container is not reachable before that
 *  node ships"). An internal name, not a customer-visible string. Chosen
 *  as `rk_session`, this product's own initials, matching no existing
 *  convention because none exists yet on disk (`grep -rn -i cookie src
 *  tests` returns nothing but this file and one unrelated comment).
 *  Reversal cost: one constant in this file, until BP-061 ships and sets
 *  it — at which point the two must agree, and that WO's file plan is
 *  where the agreement is enforced. */
const SESSION_COOKIE_NAME = "rk_session";

/** Every request whose path is not covered by `config.matcher`'s
 *  exclusion never reaches this function; these two are Next.js's own
 *  internals and are allowed again here so this function is correct even
 *  when called directly, independent of the matcher (`## File plan`:
 *  "... and Next.js internals"). */
function isNextInternal(pathname: string): boolean {
  return pathname.startsWith("/_next/") || pathname === "/favicon.ico";
}

function matchesPublicPath(pathname: string): boolean {
  const requestSegments = pathname.split("/");
  return PUBLIC_PATHS.some((pattern) => {
    const patternSegments = pattern.split("/");
    if (patternSegments.length !== requestSegments.length) return false;
    return patternSegments.every((segment, i) => {
      if (segment.startsWith(":")) return requestSegments[i]!.length > 0;
      return segment === requestSegments[i];
    });
  });
}

function isPublic(pathname: string): boolean {
  return (
    isNextInternal(pathname) ||
    pathname === SIGNIN_PATH ||
    isAdapterPath(pathname) ||
    matchesPublicPath(pathname)
  );
}

function hasSession(req: NextRequest): boolean {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  return cookie !== undefined && cookie.value.length > 0;
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname) || hasSession(req)) {
    return NextResponse.next();
  }

  // "asks for an address and says nothing about whether an account or a
  // payment exists" (BP-001 `## Error & edge behavior`, REQ-020 c5): one
  // fixed redirect, no query string, no distinguishing header, for every
  // denied path alike.
  return NextResponse.redirect(new URL(SIGNIN_PATH, req.url));
}

export const config = {
  // Next's own recommendation (`proxy.md`, "Negative matching"): exclude
  // static internals so this function is never invoked for them at all —
  // belt-and-braces with `isNextInternal` above, which covers the same
  // paths when this function is called directly, as the test suite does.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
