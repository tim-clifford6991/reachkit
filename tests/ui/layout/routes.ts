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
const SEGMENT_FIXTURES: Readonly<Record<string, string>> = {
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
const HOST_FIXTURES: Readonly<Record<string, string>> = {};

/**
 * The `Cookie` header every `(account)` page is rendered with — the one
 * fixture that gets the sweep past `src/middleware.ts`'s default-deny
 * boundary. The middleware checks the cookie's *presence only* ("the check
 * is a cookie's presence, nothing about its contents"), so a fixture value
 * is enough and no session has to exist. The name is the one
 * `src/middleware.ts` reads; when BP-061's identity work sets it for real
 * (issue #35), that work order is where the two are made to agree.
 */
export const ACCOUNT_SESSION_COOKIE = `${SESSION_COOKIE_NAME}=layout-sweep-fixture`;

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
          cookie = ACCOUNT_SESSION_COOKIE;
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
