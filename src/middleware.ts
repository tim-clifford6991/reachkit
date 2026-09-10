// src/middleware.ts — BP-001 `## NFR budget`, WO-003
//
// "Authorisation: default-deny. `src/app/(account)/**` requires a session;
// `src/app/(public)/**` explicitly declares itself public in one middleware
// allow-list, so a new account route cannot leak by omission." This file is
// the one allow-list. Every request under a segment this product serves is
// denied unless it matches `PUBLIC_PATHS` (BP-001 `## Public interface`,
// "Routes (public)"), one of the two transport-only adapters (`decision 1`:
// "every file under `src/app/api/**` is BP-001's ... a transport-only
// adapter"), the sign-in address prompt itself (below), or a Next.js
// internal.
//
// **A path under no segment this product serves is not denied — it does not
// exist** (#405). Denying it too meant a stranger who mistyped a ReachKit
// address was asked to sign in rather than told there is no page there,
// which is neither UI-SPEC S8 nor ruling 3a. `GUARDED_SEGMENTS` below is
// where that line is drawn, and why the default-deny property survives it.
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
import { HOSTED_SUBDOMAIN_LABEL } from "@/lib/config/constants";
import { isDomainRemoved } from "@/lib/scan/removal";
import { isFixtureDomain } from "@/app/(public)/scan/[domain]/_fixture/states";
import { GATE_PATH_HEADER } from "@/app/(account)/setup/gate";
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

// ── Issue #331: the Content-Security-Policy, and the nonce it turns on ──
//
// **Why this file and not `next.config.ts`.** A nonce is worth having only
// if it is unpredictable and fresh per request; `headers()` in
// `next.config.ts` is evaluated once, for every request alike, so a nonce
// written there would be a published constant. Next's own guide mints it in
// the proxy for exactly that reason, and the renderer reads it back off the
// *request* header the proxy set — `parseRequestHeaders` in
// `next/dist/server/app-render/app-render.js` looks for
// `content-security-policy` among the incoming headers and extracts
// `'nonce-…'` from it. So this file sets the policy twice on each request:
// once onto the headers forwarded to the render (which is what makes Next
// stamp `nonce` on every script tag it emits) and once onto the response
// (which is what makes the browser enforce it). `next.config.ts` keeps the
// four headers that are the same on every request and reach the static
// bundles this file's `matcher` never sees.
//
// **Every response, including the ones that are not renders.** The sign-in
// redirect, the `410 Gone` rewrite and the hosted rewrite all leave through
// `sealed()` below, so there is no path out of this function that answers
// without the policy — which is what "present on every route" has to mean
// if it is to be worth asserting.
//
// Every string here is internal (rule 1.1): directive names and the origins
// they name. None is a sentence anybody reads.

/** The header the browser enforces and the renderer reads the nonce from. */
const CSP_HEADER = "content-security-policy";

/** Vercel's preview toolbar, which the platform injects into a preview
 *  deployment's HTML rather than this repository doing it. These are the
 *  origins it needs; on production it is not injected and they are simply
 *  never reached. */
const VERCEL_LIVE = "https://vercel.live";
const VERCEL_LIVE_IMG = "https://vercel.com";
const VERCEL_LIVE_FONTS = "https://assets.vercel.com";
const VERCEL_LIVE_SOCKET = "wss://ws-us3.pusher.com";

/** The two Stripe addresses a **form submission** can end up at.
 *  `form-action` is enforced across the redirect that *follows* a POST, and
 *  `/pricing`'s one control is a Server Function reached from a `<form>`
 *  that answers with `redirect(session.url)` — so a policy of `'self'`
 *  alone would block checkout for any customer whose browser had
 *  JavaScript off, and block it silently. The billing portal hands its
 *  address back to the client instead of redirecting, which `form-action`
 *  does not govern; it is named here so that stays a free choice rather
 *  than a load-bearing one. */
const STRIPE_CHECKOUT = "https://checkout.stripe.com";
const STRIPE_BILLING = "https://billing.stripe.com";

/** 16 CSPRNG bytes, base64 — inside the character class Next's own
 *  extractor accepts (`/^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/`). Web Crypto
 *  rather than `node:crypto` so this file keeps building on either runtime,
 *  as it did before its `runtime` was pinned to Node. */
const NONCE_BYTES = 16;

function mintNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The policy this request is answered under.
 *
 * `script-src` carries the nonce and **no `'unsafe-inline'`**, which is the
 * whole point of the exercise: the inline bootstrap Next emits runs because
 * this server stamped it, and an injected one does not run at all.
 * `'strict-dynamic'` is deliberately absent — it would make the `'self'`
 * beside it inert, and with it the platform's own preview script, for no
 * gain over a same-origin allowance on a host this product controls.
 *
 * `style-src` keeps `'unsafe-inline'`. A nonce cannot cover a `style="…"`
 * attribute (those answer to `style-src-attr`, which no nonce reaches), and
 * `src/ui/charts/**` sets six of them to place a mark against a token. The
 * asymmetry is deliberate and is where the real risk is: injected CSS can
 * restyle a page, injected script can act as the customer.
 *
 * `upgrade-insecure-requests` is deliberately absent. Its job here is done
 * by `Strict-Transport-Security`, and its presence would break every
 * `http://` render the layout sweep makes on a non-loopback hostname —
 * a check that cannot run is worse than a header that is not set.
 */
export function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `form-action 'self' ${STRIPE_CHECKOUT} ${STRIPE_BILLING}`,
    // React reconstructs server stacks with `eval` in development and
    // nowhere else, which is the one thing that differs between the two.
    `script-src 'self' 'nonce-${nonce}' ${VERCEL_LIVE}${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' ${VERCEL_LIVE}`,
    `img-src 'self' data: blob: ${VERCEL_LIVE} ${VERCEL_LIVE_IMG}`,
    `font-src 'self' ${VERCEL_LIVE} ${VERCEL_LIVE_FONTS}`,
    // The dev server's hot-reload socket, and nothing else new.
    `connect-src 'self' ${VERCEL_LIVE} ${VERCEL_LIVE_SOCKET}${isDev ? " ws:" : ""}`,
    `frame-src 'self' ${VERCEL_LIVE}`,
  ].join("; ");
}

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
  // Issue #144: the address the one veto link in the `draft-ready` mail
  // lands on. Unauthenticated by necessity, like `/opt-out/:token` above
  // it — a mail's reader has no session, and the token is the whole of the
  // credential the stop link carries.
  "/veto/:token",
  // BUILD §9, issue #49. The two documents the hosted edge serves. They
  // are public by their own nature — a robots policy nobody may read is
  // not a policy — and each route resolves the Host itself and answers 404
  // on one it does not serve, so a row here grants no read of anything.
  // They are deliberately *not* rewritten into the hosted group with the
  // rest of a `content.` host's paths: `/robots.txt` must be able to
  // answer the *preview* policy on a `{slug}.reachkit.app` host, which is
  // not a `content.` host at all (ADR-002).
  "/robots.txt",
  "/sitemap.xml",
  // Issue #350: the three legal pages the public footer links to. They
  // were on disk under `(public)` and absent from this list, so every one
  // of them answered a 307 to `/signin` — a footer link that asks a
  // stranger to sign in to read an imprint, which is the one audience an
  // imprint has. Public by their own nature, like the two documents above
  // them: a privacy notice nobody may read is not a notice, and §14's
  // compliance guardrails are built as features precisely so they are
  // readable without an account.
  //
  // They read nothing: each page renders its own copy keys and reaches no
  // store, so a row here grants access to no customer's data.
  "/privacy",
  "/terms",
  "/imprint",
];

/** BUILD §9's hosted edge: `content.{customer-domain}`, by CNAME.
 *
 *  **Every other request on such a host is rewritten into
 *  `src/app/(hosted)/`, and that is an authorisation boundary rather than a
 *  convenience.** Next routes by path alone, so without the rewrite a
 *  request to `content.example.com/setup` would render the account
 *  container's setup screen on a customer's own domain. With it, no path on
 *  a customer's domain can reach a ReachKit screen: every one of them lands
 *  on the hosted catch-all, which serves that site's published page or
 *  404s.
 *
 *  A rewrite, never a redirect (§9): the visitor stays at
 *  `content.{their domain}/{slug}`, which is the address the canonical
 *  link, the sitemap entry and `publications.live_url` all name. */
const HOSTED_HOST_PREFIX = `${HOSTED_SUBDOMAIN_LABEL}.`;

/** The two destinations a hosted request is rewritten to, and no third: the
 *  page (200 or 404) and the `410 Gone` document. */
const HOSTED_PAGE_PREFIX = "/hosted-page";
const HOSTED_GONE_PATH = "/hosted-gone";

/** The paths on a `content.` host that resolve the Host themselves and are
 *  therefore served where they stand, not rewritten. */
const HOSTED_DOCUMENT_PATHS: readonly string[] = ["/robots.txt", "/sitemap.xml"];

function isHostedEdgeHost(req: NextRequest): boolean {
  return (req.headers.get("host") ?? "").trim().toLowerCase().startsWith(HOSTED_HOST_PREFIX);
}

/**
 * The hosted edge's own rewrite, on a `content.` host and nowhere else.
 *
 * **The second database read in this file, and narrow for the same reason
 * the first one is** (`removedRewrite` above): a Next `page.tsx` cannot set
 * a status, so whether this address answers `410 Gone` has to be settled
 * before routing. It happens only on a `content.` host — every ReachKit
 * address is decided from the allow-list and the cookie with no await on
 * the way, exactly as before.
 *
 * **Bounded, and fails towards rendering.** A read that is slow or that
 * throws rewrites to the page, which answers 404 when it finds none. A 410
 * asserts that a page was taken down; it is never something to say because
 * a query was slow. The failure direction is safe in the one case that
 * matters: the page route resolves the Host again for itself, so a
 * departed customer's address that missed this deadline answers 404 —
 * never their page.
 */
async function hostedRewrite(req: NextRequest, forwarded: Headers): Promise<NextResponse | null> {
  if (!isHostedEdgeHost(req)) return null;
  const { pathname } = req.nextUrl;
  if (isNextInternal(pathname)) return null;
  if (HOSTED_DOCUMENT_PATHS.includes(pathname)) return null;

  let answer: "gone" | "page" = "page";
  try {
    const { hostedAnswer } = await import("@/app/(hosted)/edge");
    answer = await withDeadline(hostedAnswer(req.headers.get("host") ?? "", pathname));
  } catch {
    answer = "page";
  }

  const destination = req.nextUrl.clone();
  destination.pathname = answer === "gone" ? HOSTED_GONE_PATH : `${HOSTED_PAGE_PREFIX}${pathname}`;
  // `forwarded` carries this request's CSP and nonce (issue #331). A
  // rewrite is still a render, and a render that never saw the nonce emits
  // script tags the policy on the way out refuses.
  return NextResponse.rewrite(destination, { request: { headers: forwarded } });
}


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

/** One row per top-level path segment `src/app/` serves that is **not** a
 *  public route of its own — the account container's two, the hosted edge's
 *  two internal rewrite targets, and the whole API surface.
 *
 *  **This list is what keeps default-deny meaning what it says, now that an
 *  address this product does not have falls through** (#405). Before it,
 *  every unmatched path was denied alongside every guarded one: `/nonsense`
 *  answered `307 /signin`, and the S8 screen issue #372 built was
 *  unreachable. After it, a request is denied when it stands under a
 *  segment this product actually serves and is not public; anything else is
 *  no address at all, and Next answers it from `src/app/not-found.tsx` with
 *  the status a missing page carries.
 *
 *  **What the difference discloses, and why it is nothing.** BP-001's
 *  promise (`## Error & edge behavior`, REQ-020 c5) is that a denial "says
 *  nothing about whether an account or a payment exists", and it still says
 *  nothing: every request to a guarded segment gets the same 307 to the
 *  same address with no query string and no distinguishing header, whoever
 *  is asking and whatever they typed. What a stranger can read off a 404
 *  for `/nonsense` beside a 307 for `/app` is that this product has an
 *  address called `/app` — the same fact for every visitor, nobody's
 *  account, and already written on the sign-in screen, the footer and the
 *  pricing page. No response varies with a customer, a domain or a payment.
 *
 *  **`api` is on the list for the opposite reason.** Nothing under it is a
 *  screen, so a 404 there would buy a reader nothing but a map of which
 *  endpoints exist; the API surface answers exactly as it did before this
 *  list, and an unmatched `/api/...` is denied like any other.
 *
 *  **Nothing may leak by omission.** BP-001's own property — "a new account
 *  route cannot leak by omission" — is now a checked invariant rather than
 *  a side effect of the default: `tests/app/middleware.test.ts` walks
 *  `src/app/**` and fails, naming the route, if any non-`(public)` route
 *  stands under a segment named neither here nor in `PUBLIC_PATHS`. A new
 *  account route whose row is missing fails CI; it does not ship open. */
export const GUARDED_SEGMENTS: readonly string[] = [
  // `src/app/api/**` — transport-only adapters (`decision 1`).
  "api",
  // `src/app/(account)/**` — the two segments §4.3 and §4.4 serve.
  "app",
  "setup",
  // `src/app/(hosted)/**` — the two destinations `hostedRewrite` writes.
  // Guarded rather than left to fall through: they are reachable by path on
  // a ReachKit host as well as by rewrite on a `content.` one, and an
  // address on `reachkit.app` that answered a customer's published page
  // would be this product serving someone else's site.
  "hosted-gone",
  "hosted-page",
];

/** Whether this product serves anything at all under the path's own
 *  top-level segment. `/` has none, and is public. */
function isGuarded(pathname: string): boolean {
  return GUARDED_SEGMENTS.includes(pathname.split("/")[1] ?? "");
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
      setTimeout(() => reject(new Error("middleware read timed out")), REMOVAL_READ_DEADLINE_MS)
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
async function removedRewrite(req: NextRequest, forwarded: Headers): Promise<NextResponse | null> {
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
  return NextResponse.rewrite(destination, { request: { headers: forwarded } });
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Issue #331. Minted before anything is decided, because every answer
  // this function can give is a response a browser will enforce a policy
  // against — the rewrites and the redirect included.
  //
  // `forwarded` is the header set the render sees: Next reads the nonce
  // back out of `content-security-policy` there and stamps it on every
  // script tag it emits. It is `set`, never appended, so a caller's claim
  // about it is overwritten exactly as `GATE_PATH_HEADER`'s is below.
  //
  // Next's guide also suggests forwarding the bare value as `x-nonce`, for
  // a page that writes an inline `<script>` of its own and has to stamp it
  // by hand. This product writes exactly one — the hosted page's JSON-LD —
  // and a JSON-LD block is a data block a browser never executes and
  // `script-src` therefore never checks. So the header is not set: an
  // unread header is a claim nothing holds true.
  const nonce = mintNonce();
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const forwarded = new Headers(req.headers);
  forwarded.set(CSP_HEADER, policy);

  /** The one way out of this function: the policy on the response, whatever
   *  the response turned out to be. */
  const sealed = (res: NextResponse): NextResponse => {
    res.headers.set(CSP_HEADER, policy);
    return res;
  };

  // BUILD §9's hosted edge comes first: a customer's own domain is not a
  // ReachKit surface, and its authorisation is the rewrite rather than this
  // file's allow-list and session check.
  const hosted = await hostedRewrite(req, forwarded);
  if (hosted !== null) return sealed(hosted);

  const removed = await removedRewrite(req, forwarded);
  if (removed !== null) return sealed(removed);

  if (isPublic(pathname)) return sealed(NextResponse.next({ request: { headers: forwarded } }));

  // An address this product does not have (#405): not public, and under no
  // segment `src/app/` serves. There is nothing here to guard, so the
  // request falls through to Next, which matches no route and renders
  // `src/app/not-found.tsx` — S8's screen, inside ruling 3a's header and
  // footer, with the status a 404 carries. Decided **before** the session
  // check rather than after it, so a stranger and a signed-in customer are
  // told the same thing at the same address. Sealed like every other
  // answer (#331): a 404 is a rendered screen and carries the same policy.
  if (!isGuarded(pathname)) return sealed(NextResponse.next({ request: { headers: forwarded } }));

  if (hasSession(req)) {
    // BUILD §4.3's incomplete-setup gate is **not decided here** (#133).
    // Deciding it means naming the asking account, and `currentSession()`
    // needs `next/headers`, a `node:crypto` HMAC and a database read —
    // none of them reachable from this file, which is bundled for the Edge
    // runtime. The gate is enforced in `src/app/(account)/layout.tsx`
    // instead, on Node, where all three work as written;
    // `src/app/(account)/setup/gate.ts`'s header records the three
    // candidate answers and why that is the one.
    //
    // What this file contributes is the one thing a layout cannot get for
    // itself: the request's own path. It is `set` onto a clone of the
    // incoming headers, which **overwrites** any value the caller sent, so
    // the path the gate sees is always the path being served and never a
    // client's claim about it.
    forwarded.set(GATE_PATH_HEADER, pathname);
    return sealed(NextResponse.next({ request: { headers: forwarded } }));
  }

  // "asks for an address and says nothing about whether an account or a
  // payment exists" (BP-001 `## Error & edge behavior`, REQ-020 c5): one
  // fixed redirect, no query string, no distinguishing header, for every
  // denied path alike.
  return sealed(NextResponse.redirect(new URL(SIGNIN_PATH, req.url)));
}

export const config = {
  // Next's own recommendation (`proxy.md`, "Negative matching"): exclude
  // static internals so this function is never invoked for them at all —
  // belt-and-braces with `isNextInternal` above, which covers the same
  // paths when this function is called directly, as the test suite does.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  // **Node.js, and not the Edge runtime** (issue #49). The legacy
  // `middleware.ts` convention still builds for Edge; its successor
  // `proxy.ts` "defaults to using the Node.js runtime" and refuses this
  // option altogether (`proxy.md`, "Runtime"; the runtime became stable
  // for middleware in 15.5). Setting it here puts this file where the
  // convention it is being renamed to already is, without renaming it —
  // the rename is BP-001's own `code:` list to change (see this file's
  // header), not a feature PR's.
  //
  // What forces it: BUILD §9's hosted edge asks `hostedServingState`
  // whether a customer's pages are still served, which reaches
  // `@/lib/account/billing` — the only way past that module's import
  // fence — and the barrel's graph carries the mail vendor's `node:https`
  // and `node:crypto`. On Edge those do not exist and the build says so.
  // The alternatives were worse: duplicating BP-060's two-condition rule
  // inside the hosted store (a second access arbiter, which ADR-050 exists
  // to prevent), or answering a departed customer's address 404 instead of
  // the 410 REQ-076 c10 requires.
  runtime: "nodejs",
};
