// tests/ui/layout/routes.ts
//
// ADR-010's idiom (ADR-093 decision 6: "The enforcement idiom is ADR-010's,
// unchanged: a path-glob suite whose enumerator is the route tree, so a
// surface added later is in scope by construction"). Walks
// `src/app/**/page.tsx`, strips route groups from the URL it derives, and
// fills a dynamic segment or a `(hosted)` page's `Host` header from the one
// fixture map below — a segment or host with no row here fails, naming the
// route, rather than being silently skipped (rule 5.5).
import { readdirSync } from "node:fs";
import path from "node:path";
// The cookie's wire name has one home since issue #35
// (`src/lib/account/identity/addresses.ts`, a module that imports nothing so
// `src/middleware.ts` can read it on the Edge runtime). Taking the name from
// there rather than repeating it is what makes a rename impossible to get
// half-done: the sweep, the middleware and the mint all move together.
import { SESSION_COOKIE_NAME } from "@/lib/account/identity/addresses";

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
 * One row per `(hosted)` page, keyed by the file's own path relative to the
 * repo root (POSIX separators), naming the `Host` header the suite sends
 * when rendering it. Empty today for the same reason as `SEGMENT_FIXTURES`.
 */
const HOST_FIXTURES: Readonly<Record<string, string>> = {
  /**
   * The hosted edge's page (issue #49, `BUILD.md` §9). `content.` plus the
   * fixture domain is the shape `resolveHost` matches, so the request
   * reaches the hosted group rather than the sign-in redirect.
   *
   * **The sweep measures this route's 404 arm, and that is the honest
   * scope.** The layout suite runs `next build` against a fixture
   * environment with no database behind it, so the Host resolves to no
   * site and the route renders `(hosted)/not-found.tsx` — a real surface
   * of this product, and one the layout law applies to exactly as it does
   * to any other. The published template's own layout is asserted where it
   * can be rendered with a page in hand, in `tests/hosted/`.
   */
  "src/app/(hosted)/hosted-page/[...slug]/page.tsx": "content.example.com",
};

/**
 * The default `Cookie` header an `(account)` page is enumerated with.
 *
 * **It is no longer enough on its own** (issue #193). `src/middleware.ts`
 * checks a cookie's *presence only*, so this fixture gets a request past
 * the default-deny boundary — but since #192 the four `/app` screens
 * verify the session against the `users` row, and this value names no
 * account, so they answer `/signin`. The browser sweep passes
 * `accountCookie` instead: a cookie minted through identity's own path
 * against the seeded account (`seed.ts`). This stays the default because
 * `routes.test.ts` enumerates a fixture tree with no database behind it
 * and is asserting the *shape* of what enumeration produces, not what a
 * screen answers.
 */
export const ACCOUNT_SESSION_COOKIE = `${SESSION_COOKIE_NAME}=layout-sweep-fixture`;

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
 */
export function urlFor(baseURL: string, route: EnumeratedRoute): string {
  if (route.host === undefined) return baseURL + route.path;
  const url = new URL(baseURL + route.path);
  url.hostname = route.host;
  return url.toString();
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
