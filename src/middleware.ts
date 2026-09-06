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
// The authorisation check reads no database (`## File plan`): it is a
// cookie's presence, nothing about its contents. Session *identity* is
// BP-061's `currentSession()`; the account container is not reachable
// before that node ships (`## Interfaces`).
//
// **One database read was added here for one path (#104), and it is not
// the authorisation check.** A removed domain's report address must answer
// `410 Gone` (owner ruling 2026-09-05, #28) and a Next `page.tsx` cannot
// set a status, so `GET /scan/{domain}` — that path, that method, and
// nothing else — is rewritten to the route handler that can. See
// `removedRewrite` below for why it is here rather than in the page, and
// what it costs.
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
import { isDomainRemoved } from "@/lib/scan/removal";
import { isFixtureDomain } from "@/app/(public)/scan/[domain]/_fixture/states";
import { readSetupGateState, setupRedirectFor } from "@/app/(account)/setup/gate";
// Three names, one home (issue #35). `src/lib/account/identity/addresses.ts`
// imports nothing at all — precisely so this file can share the cookie's
// wire name and the two routes with the module that mints them, instead of
// holding a second copy of each. The two "parameter, chosen here" notes
// this replaces both said the same thing: "at which point the two must
// agree".
import {
  SESSION_COOKIE_NAME,
  SIGNIN_LINK_PATH_PATTERN,
  SIGNIN_PATH,
} from "@/lib/account/identity/addresses";

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
  // like every other public surface. `SIGNIN_PATH` stays used below: it is
  // this file's redirect *target*, and a target that is not itself public
  // would redirect a denied visitor to a denied page forever — a property
  // worth holding independently of any row on this list.
  SIGNIN_PATH,
  // Issue #35: the route that redeems a sign-in link. Unauthenticated by
  // necessity — the whole point of the link is that its holder has no
  // session yet, so a denial here would send a working link to the screen
  // that says links do not work.
  SIGNIN_LINK_PATH_PATTERN,
];

/** The two transport-only adapters (`## File plan`): Stripe and the job
 *  platform hold no session of this product's, so an adapter denying them
 *  would be denying their own caller. `/api/jobs` matches its own
 *  `[[...slug]]` catch-all — the segment is optional. */
function isAdapterPath(pathname: string): boolean {
  if (pathname === "/api/stripe/webhook") return true;
  return pathname === "/api/jobs" || pathname.startsWith("/api/jobs/");
}

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

/** Presence only, still (`## File plan`: "Reads no database: the check is a
 *  cookie's presence, nothing about its contents"). That stays safe because
 *  the value is a real signed session rather than a marker: a forged cookie
 *  gets past this function and past nothing else. `currentSession()`
 *  verifies the MAC, the signed expiry, the account's own session stamp and
 *  its tombstone, and every surface that reads who the customer *is* reads
 *  it from there. */
function hasSession(req: NextRequest): boolean {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  return cookie !== undefined && cookie.value.length > 0;
}

// How long the removal read may take before the report renders anyway.
// Chosen here rather than pinned in `constants.ts` (rule: a number in two
// files is wrong; this one is in exactly one): it is a property of this
// one request-path read, not a product bound anything else reads. Generous
// against a healthy indexed lookup on a tiny table, short against a
// visitor waiting for a page.
const REMOVAL_READ_DEADLINE_MS = 800;

/** Rejects when `work` has not settled inside the deadline, so the caller's
 *  own `catch` covers a hang the same way it covers a failure. */
function withDeadline<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error("removal read timed out")), REMOVAL_READ_DEADLINE_MS)
    ),
  ]);
}

/** `/scan/{domain}` and nothing else, with the segment as written. The one
 *  path this function looks inside, because it is the one path whose
 *  response status can depend on a stored fact (#104). */
const REPORT_PATH = /^\/scan\/([^/]+)\/?$/;

export function reportSegmentOf(pathname: string): string | null {
  const match = REPORT_PATH.exec(pathname);
  return match?.[1] ?? null;
}

/**
 * A removed domain's report address answers `410 Gone` (owner ruling
 * 2026-09-05, #28), and a Next `page.tsx` cannot set a status — so the
 * report address is rewritten to the route handler that can, and the
 * visitor stays at the address REQ-001 c2 promises them.
 *
 * **This is the one database read in this file, and it is narrow on
 * purpose.** It happens for `GET /scan/{domain}` and for no other path,
 * method or internal request; every other request is decided from the
 * allow-list and the cookie exactly as before, with no await on the way.
 * The read is one indexed lookup behind `isDomainRemoved`, over the table
 * that holds one row per written removal request. A read that cannot be
 * answered rewrites nothing — the report renders, which is this file's own
 * fail-open convention and the same one admission uses.
 *
 * `isDomainRemoved` is `src/lib/scan/removal.ts`', the product's one
 * reader of that table. It is imported from there and not through
 * `admission.ts`, which pulls `node:crypto` for its network-key HMAC — a
 * module the Edge runtime this file is built for does not have. This file
 * names neither the table nor a query:
 * the status a removed address serves and the refusal a removed domain's
 * scan gets can never disagree, because they are the same read.
 */
async function removedRewrite(req: NextRequest): Promise<NextResponse | null> {
  if (req.method !== "GET") return null;
  const segment = reportSegmentOf(req.nextUrl.pathname);
  if (segment === null) return null;

  // The *canonical* form of the segment, and only that. `parseDomain` is
  // not called here on purpose: it needs `node:net`, which the Edge
  // runtime this file is built for does not have. It does not need to be
  // called either — a non-canonical written form never gets a response
  // from this path. `page.tsx` issues its 308 to the canonical address
  // before it resolves anything, so `/scan/WWW.Gone.example` renders
  // nothing, lands on `/scan/gone.example`, and comes back through this
  // function, which matches. One extra hop, no leak, and the whole domain
  // parser stays out of the Edge bundle.
  const domain = decodeURIComponent(segment).toLowerCase();

  // A reserved name is never removed: `example.com` and its subdomains are
  // the dev preview's own fixture arms, and one of them *is* the removed
  // arm, rendered by the page. Asking the database about them would put a
  // round trip in front of every preview render for an answer that is
  // fixed.
  if (isFixtureDomain(domain)) return null;

  // **Bounded, and fails open.** This read is in front of every report
  // render, so a database that is slow or unreachable must cost the
  // visitor a report that renders, not a page that hangs — a `catch`
  // alone does not do that, because a request that never settles never
  // rejects. Past the deadline the report renders: the wrong answer for a
  // removed domain, and the only one that does not take every live report
  // down with the database.
  try {
    if (!(await withDeadline(isDomainRemoved(domain)))) return null;
  } catch {
    return null;
  }

  const destination = req.nextUrl.clone();
  destination.pathname = `/api/report/${domain}/removed`;
  return NextResponse.rewrite(destination);
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  const removed = await removedRewrite(req);
  if (removed !== null) return removed;

  if (isPublic(pathname)) return NextResponse.next();

  if (hasSession(req)) {
    // BUILD §4.3's incomplete-setup gate. The allow-list and the three
    // arms are `src/app/(account)/setup/gate.ts`'s — this file contributes
    // the enforcement point and no setup knowledge of its own, which is
    // why there is no per-route branch here to keep in step with one
    // there. `readSetupGateState` answers `null` until issue #35 can say
    // which account a session cookie belongs to, and `setupRedirectFor`
    // lets an unknown account through rather than guessing at one.
    const destination = setupRedirectFor({
      setup: await readSetupGateState(req),
      path: pathname,
    });
    if (destination !== null && destination !== pathname) {
      return NextResponse.redirect(new URL(destination, req.url));
    }
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
