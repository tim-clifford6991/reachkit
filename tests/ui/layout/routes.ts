// tests/ui/layout/routes.ts
//
// ADR-010's idiom (ADR-093 decision 6: "The enforcement idiom is ADR-010's,
// unchanged: a path-glob suite whose enumerator is the route tree, so a
// surface added later is in scope by construction"). Walks
// `src/app/**/page.tsx`, strips route groups from the URL it derives, and
// fills a dynamic segment or a `(hosted)` page's `Host` header from the
// fixture maps below — a segment or host with no row here fails, naming the
// route, rather than being silently skipped (rule 5.5).
import { readdirSync } from "node:fs";
import path from "node:path";

export interface EnumeratedRoute {
  /** The URL path, route groups stripped and every dynamic segment filled. */
  path: string;
  /** The `Host` header to send — only present for a `(hosted)` page. */
  host?: string;
  /** The `Cookie` header to send — only present for an `(account)` page.
   *  `src/middleware.ts` is the product's default-deny boundary: every path
   *  under `(account)` is redirected to the sign-in prompt unless the
   *  request carries a session cookie. A sweep that did not send one would
   *  be measuring the redirect target at five widths and reporting it as
   *  the account screen (issue #9). */
  cookie?: string;
}

/**
 * One row per dynamic segment this suite knows how to fill, keyed by the
 * segment's own bracket text (e.g. `"[domain]"`). A segment with no row
 * here fails, naming the route, rather than being silently skipped. The
 * work that adds a dynamic route adds its row here.
 */
export const SEGMENT_FIXTURES: Readonly<Record<string, string>> = {
  /**
   * `GET /opt-out/{token}` (issue #31, `BUILD.md` §4.2). Deliberately a
   * value that does not verify: the page then renders its invalid-link
   * arm, which is a written line inside the same one card as the
   * confirmation, so the sweep measures the layout it is here to measure
   * — and it reaches no store, writes nothing, and suppresses no address.
   * A real token would have the sweep opt an address out at five widths
   * on every run.
   */
  "[token]": "layout-sweep-fixture",
  /**
   * The free report address (issue #13). The value is the one domain that
   * resolves to the *complete* report — every module present, every count
   * measured — because that is the widest, densest page this route can
   * produce, and the layout law is about content fitting its box. The
   * narrower arms (degraded, scanning, cooldown, removed, refused) are
   * strictly less content in the same boxes.
   */
  "[domain]": "example.com",
  /**
   * The hosted edge's catch-all (issue #49). One segment, because one
   * segment is the only shape that names a page: `content.{domain}/a/b` is
   * not a deeper page, it is not a page at all.
   */
  "[...slug]": "best-onboarding-tools",
  /**
   * The draft view's address (issue #17, `BUILD.md` §4.6). The value is the
   * one draft the fixture holds in `in_review` — the stage §4.6 gives this
   * view a way in from, and the densest arm it can render: the whole body,
   * the grounded block with its source line, the claim badge, all three
   * controls and the do-nothing box. The other arms (an edited draft, a
   * dropped highlight, a not-found id) are strictly less content in the
   * same boxes.
   */
  "[draftId]": "draft-2026-09-15",
};

/**
 * The approved screen every route is built against (issue #358).
 *
 * One row per enumerated route, keyed by the URL the enumerator produces —
 * dynamic segments already filled from `SEGMENT_FIXTURES`, so a row here is
 * the same string the sweep navigates to and the same string that names the
 * route's baseline images.
 *
 * **This is the layout suite's half of `docs/design-reference.md`.** That
 * file is the index a person reads: route → screen → UI-SPEC section → REQ
 * criteria → tests. This map is what a machine can check it against, and
 * `reference.test.ts` holds the two equal — a route with no row here, a row
 * for a route the tree no longer serves, or an S-id that disagrees with the
 * index fails there. The point is not the string: it is that a screen
 * cannot be rebuilt against nothing, and that "which screen is this?" has
 * one answer rather than one per reader.
 *
 * The `REFERENCE:` line beside each row is written out so the answer is
 * legible in a diff, in the same words a UI issue and a PR body use.
 */
export const ROUTE_REFERENCE: Readonly<Record<string, `S${number}`>> = {
  /** REFERENCE: S1 — Landing (UI-SPEC §S1; REQ-099, REQ-001) */
  "/": "S1",
  /** REFERENCE: S2 — Free report, states S3 (§S2, §S3; REQ-004…010) */
  "/scan/example.com": "S2",
  /** REFERENCE: S4 — Pricing (§S4; REQ-021 c4, REQ-022) */
  "/pricing": "S4",
  /** REFERENCE: S5 — Legal, one renderer for the three routes (§S5) */
  "/privacy": "S5",
  /** REFERENCE: S5 — Legal (§S5) */
  "/terms": "S5",
  /** REFERENCE: S5 — Legal (§S5) */
  "/imprint": "S5",
  /** REFERENCE: S6 — Veto page (§S6; REQ-057, REQ-075) */
  "/veto/layout-sweep-fixture": "S6",
  /** REFERENCE: S7 — Opt-out (§S7; REQ-010 c11) */
  "/opt-out/layout-sweep-fixture": "S7",
  /** REFERENCE: S9 — Sign in (§S9; REQ-098) */
  "/signin": "S9",
  /** REFERENCE: S10 — Setup (§S10; REQ-025…028, REQ-021 c7) */
  "/setup": "S10",
  /** REFERENCE: S11 — Waiting (§S11; REQ-029) */
  "/setup/waiting": "S11",
  /** REFERENCE: S12 — Overview, week 0 is S13 (§S12, §S13; REQ-040…042, 092) */
  "/app": "S12",
  /** REFERENCE: S14 — Calendar, panel states S15 (§S14, §S15; REQ-043, REQ-044) */
  "/app/calendar": "S14",
  /** REFERENCE: S16 — Draft, edit is S17 (§S16, §S17; REQ-045, REQ-093) */
  "/app/draft/draft-2026-09-15": "S16",
  /** REFERENCE: S18 — Settings (§S18; REQ-070…079) */
  "/app/settings": "S18",
  /**
   * REFERENCE: S19 — Hosted page (§S19; REQ-059).
   *
   * The route is swept through **two** hosts (issue #418): the default
   * below, whose site has published no page at this address, renders the
   * 404 — S8's screen, which `visual.test.ts` pairs it with — and
   * `PUBLISHED_HOST_FIXTURES` renders the page itself, which is S19. The
   * reference here is S19 because it names what the route *is for*, not
   * which arm a given host reaches.
   */
  "/hosted-page/best-onboarding-tools": "S19",
};

/** The one `(hosted)` page in the tree, keyed as the maps below key it:
 *  the file's own path relative to the repo root, POSIX separators. Named
 *  once so the two host maps cannot key it differently. */
export const HOSTED_PAGE_FILE = "src/app/(hosted)/hosted-page/[...slug]/page.tsx";

/**
 * One row per `(hosted)` page, keyed by `HOSTED_PAGE_FILE`'s spelling,
 * naming the `Host` header the suite sends when rendering it.
 *
 * **This map is the route's 404 arm, deliberately** (issue #418). Its host
 * is the reserved account's domain, and that account publishes nothing —
 * so the host resolves to a real site, the site has no page at this
 * address, and the route answers `(hosted)/not-found.tsx`. That is a real
 * surface of this product and the layout law applies to it exactly as to
 * any other, so it keeps its baselines and its side-by-side (against S8,
 * which is the screen it actually draws).
 *
 * Note what this comment used to say — that the sweep ran "against a
 * fixture environment with no database behind it". It has had a seeded
 * database since #193, and the 404 was coming from `visitorPath`'s
 * rewrite instead. A reason that has stopped being true is worse than
 * none: it is why the blank capture went eleven issues unexamined.
 *
 * It is **not** the whole of what this route is for, which is what #418
 * found: swept through this host alone, S19 was the one approved screen
 * the CI render path had no picture of. `PUBLISHED_HOST_FIXTURES` below is
 * the other arm.
 */
const HOST_FIXTURES: Readonly<Record<string, string>> = {
  /**
   * The hosted edge's page (issue #49, `BUILD.md` §9). `content.` plus the
   * fixture domain is the shape `resolveHost` matches, so the request
   * reaches the hosted group rather than the sign-in redirect.
   */
  [HOSTED_PAGE_FILE]: "content.example.com",
};

/**
 * The same page, asked of the customer who has actually published one
 * (issue #418).
 *
 * `seed.ts`'s `seedHostedPublisher()` writes that customer: a site on
 * `publisher.test` whose one live publication is at this route's
 * `[...slug]` fixture. Sweeping the route through this host renders S19
 * itself — the customer's bar, their eyebrow and byline, the body with
 * §8's passage marked, the source line and their footer — which is the arm
 * the approved set draws and the arm a fidelity review needs a picture of.
 *
 * A second map rather than a changed row, because both arms are wanted:
 * `HOST_FIXTURES` is what the property sweep and the signed-out captures
 * enumerate with, and this is what `visual.test.ts` adds one capture for.
 */
export const PUBLISHED_HOST_FIXTURES: Readonly<Record<string, string>> = {
  [HOSTED_PAGE_FILE]: "content.publisher.test",
};

/**
 * The default `Cookie` header an `(account)` page is enumerated with.
 *
 * **It is not enough on its own** (issues #193, #468). It is shaped like a
 * Supabase Auth session cookie, but its value is no session: since #468
 * `src/middleware.ts` asks Supabase (`getUser()`) about any such cookie,
 * and this one names nobody, so a real app answers `/signin`. The browser
 * sweep passes `accountCookie` instead — a session for the seeded account
 * that `./auth-stub.ts` verifies (`seed.ts`). This stays the default
 * because `routes.test.ts` enumerates a fixture tree with no server behind
 * it and is asserting the *shape* of what enumeration produces, not what a
 * screen answers.
 */
export const ACCOUNT_SESSION_COOKIE = "sb-layout-sweep-auth-token=layout-sweep-fixture";

/**
 * The URL a route is fetched at, and the headers it is fetched with.
 *
 * **One home for both, because a second copy is what broke** (issue #49 →
 * #110): `layout.test.ts` and `heading-scale.test.ts` each grew their own
 * pair, and the second was written from the first's older shape — sending
 * a `(hosted)` route's Host as a header, which Chromium refuses outright
 * (`net::ERR_INVALID_ARGUMENT`, because `Host` is a forbidden header
 * name). Every browser suite over the route tree now calls these, so a
 * third suite cannot inherit a stale copy.
 *
 * A `(hosted)` route's Host rides in the **URL**, never in a header:
 * `browser.ts` launches Chromium with `--host-resolver-rules` mapping
 * every name to loopback, so navigating to
 * `http://content.example.com:{port}` reaches the local server and the
 * browser sends that Host itself — the real header on the real request.
 *
 * **And its path is the visitor's, not the router's** (issue #418): see
 * `visitorPath` below.
 */
export function urlFor(baseURL: string, route: EnumeratedRoute): string {
  if (route.host === undefined) return baseURL + route.path;
  const url = new URL(baseURL + visitorPath(route.path));
  url.hostname = route.host;
  return url.toString();
}

/** The prefix `src/middleware.ts` rewrites a `content.` host's request
 *  *into* — a destination, never an address.
 *
 *  Restated here rather than imported: the middleware's own constant is
 *  module-private and that file is Edge-bundled, so importing it into a
 *  test module is not free. `routes.test.ts` holds the two equal. */
const HOSTED_REWRITE_PREFIX = "/hosted-page";

/**
 * A `(hosted)` route's address **as a visitor types it**, which is the
 * only address it can be reached at (issue #418).
 *
 * On a `content.` Host the middleware rewrites every path into
 * `/hosted-page{path}` — that is the authorisation boundary, not a
 * convenience, and it applies to *every* path including this one. So the
 * sweep driving the enumerator's own `/hosted-page/{slug}` had it
 * prefixed a second time: `/hosted-page/hosted-page/{slug}`, a two-segment
 * catch-all, which `oneSegment` refuses because
 * `content.{domain}/a/b` is not a deeper page — it is not a page at all.
 * Every capture of this route was therefore the 404, whichever Host was
 * sent and whatever the database held, which is why S19 was the one
 * approved screen the CI render path (#404) could not review, and why the
 * blank frame survived a seeded publication (#418, first attempt).
 *
 * Navigating to the customer's own address instead lets the rewrite
 * happen exactly once, which is what a visitor's request does.
 *
 * The route's *name* is unchanged — baselines, `ROUTE_REFERENCE` and the
 * design index all key off `route.path`, which is still the router's
 * address. Only the URL the browser is pointed at moves.
 */
export function visitorPath(routePath: string): string {
  return routePath.startsWith(`${HOSTED_REWRITE_PREFIX}/`)
    ? routePath.slice(HOSTED_REWRITE_PREFIX.length)
    : routePath;
}

/** An `(account)` page's session `Cookie` — `src/middleware.ts` is
 *  default-deny and would otherwise redirect the sweep to the sign-in
 *  prompt — or, for any other route, none. A `(hosted)` route's `Host` is
 *  deliberately absent: see `urlFor` above. */
export function headersFor(route: EnumeratedRoute): { extraHTTPHeaders?: Record<string, string> } {
  const headers: Record<string, string> = {};
  if (route.cookie) headers.Cookie = route.cookie;
  return Object.keys(headers).length > 0 ? { extraHTTPHeaders: headers } : {};
}

export class MissingRouteFixtureError extends Error {
  constructor(
    public readonly route: string,
    reason: string
  ) {
    super(`tests/ui/layout/routes.ts: ${route} — ${reason}`);
    this.name = "MissingRouteFixtureError";
  }
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function isDynamicSegment(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name === "page.tsx") {
      out.push(full);
    }
  }
}

export interface EnumerateOptions {
  segmentFixtures?: Readonly<Record<string, string>>;
  hostFixtures?: Readonly<Record<string, string>>;
  /** The `Cookie` header to give every `(account)` route. The browser
   *  sweep passes the seeded session; everything else takes the fixture. */
  accountCookie?: string;
}

/**
 * Enumerates every `page.tsx` under `appRoot`, in App Router terms. `appRoot`
 * is a parameter (rather than a hardcoded `src/app`) so `routes.test.ts` can
 * point this function at a fixture tree; the production sweep
 * (`layout.test.ts`) calls it with the real `src/app`.
 */
export function enumerateRoutes(appRoot: string, options: EnumerateOptions = {}): EnumeratedRoute[] {
  const segmentFixtures = options.segmentFixtures ?? SEGMENT_FIXTURES;
  const hostFixtures = options.hostFixtures ?? HOST_FIXTURES;
  const accountCookie = options.accountCookie ?? ACCOUNT_SESSION_COOKIE;

  const pageFiles: string[] = [];
  walk(appRoot, pageFiles);

  const routes = pageFiles.map((file): EnumeratedRoute => {
    const rel = path.relative(appRoot, path.dirname(file));
    const segments = rel === "" ? [] : rel.split(path.sep);
    const fsRoute = path.relative(process.cwd(), file).split(path.sep).join("/");

    const urlSegments: string[] = [];
    let host: string | undefined;
    let cookie: string | undefined;

    for (const segment of segments) {
      if (isRouteGroup(segment)) {
        if (segment === "(account)") {
          cookie = accountCookie;
        }
        if (segment === "(hosted)") {
          const h = hostFixtures[fsRoute];
          if (h === undefined) {
            throw new MissingRouteFixtureError(
              fsRoute,
              "a (hosted) page has no Host fixture row in routes.ts's HOST_FIXTURES"
            );
          }
          host = h;
        }
        continue; // route groups are stripped from the URL (Next.js semantics).
      }
      if (isDynamicSegment(segment)) {
        const value = segmentFixtures[segment];
        if (value === undefined) {
          throw new MissingRouteFixtureError(
            fsRoute,
            `dynamic segment ${segment} has no fixture row in routes.ts's SEGMENT_FIXTURES`
          );
        }
        urlSegments.push(value);
      } else {
        urlSegments.push(segment);
      }
    }

    const urlPath = "/" + urlSegments.join("/");
    const route: EnumeratedRoute = { path: urlPath };
    if (host !== undefined) route.host = host;
    if (cookie !== undefined) route.cookie = cookie;
    return route;
  });

  // Rule 5.5: the count this function enumerated is reported, not left to
  // read as nothing-to-report when it is zero.
  console.log(`tests/ui/layout/routes.ts: enumerated ${routes.length} route(s) under ${appRoot}`);

  return routes;
}
