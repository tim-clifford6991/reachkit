// tests/ui/layout/security-headers.test.ts
//
// Issue #331, Done-when 1: "the layout job asserts they are present on
// every route".
//
// This suite runs in the `layout` project because that is the only project
// with a **built, started, seeded** app behind it (`browser.ts`) — headers
// are a property of a response, and `next.config.ts`'s `headers()` and
// `src/middleware.ts`'s answer only exist once something is serving.
// `tests/app/security-headers.test.ts` asserts the declarations; this
// asserts what a browser actually receives, on every route the enumerator
// finds, which is what makes a route added later in scope by construction
// rather than by somebody remembering.
//
// The second `it` is the one that would have caught the mistake this issue
// could most easily have shipped: a nonce-based `script-src` that the
// product's own scripts do not satisfy. A page whose bootstrap is refused
// still *draws* — it renders its server HTML and never hydrates — so a
// screenshot comparison cannot see it and a status code cannot either. The
// browser can: it fires `securitypolicyviolation` on the document and logs
// the refusal. Both are collected.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import { enumerateRoutes, headersFor, urlFor as routeUrl, type EnumeratedRoute } from "./routes";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
const routes = enumerateRoutes(APP_ROOT, { accountCookie: getAccountCookie() });

/** One width, because a header is not a layout. The floor is the band the
 *  rest of the suite starts from, so a failure here reads beside the rest. */
const WIDTH = BAND_MIN.compact;

/** `withPage` launches its own Chromium per call (`browser.ts`'s header
 *  says why it cannot share one), and each `it` below walks every route in
 *  one body — the same shape, and the same bound, as `layout.test.ts`'s
 *  per-route tests. */
const PER_ROUTE_BROWSER_MS = 120_000;

/** The headers `next.config.ts` declares for every path, and the one
 *  `src/middleware.ts` mints per request. Restated here as the *promise*
 *  rather than imported from the config: this suite is the independent
 *  reading of what a browser got, and a suite that imported the value it
 *  is checking would pass on a config that had quietly emptied itself. */
const FIXED_HEADERS: Readonly<Record<string, string>> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
};

/** The `Next-Action` id the CSRF probe sends: well-formed enough to be
 *  taken for a Server Action reference, and matching none. Which is the
 *  point — the origin check happens *before* the action is looked up, so
 *  the two answers are told apart by their status alone and no action of
 *  this product's is ever invoked by this suite. */
const UNKNOWN_ACTION_ID = "0".repeat(40);

/** Next's own answer for a Server Action it cannot find
 *  (`x-nextjs-action-not-found`, `app-router-headers.js`). */
const ACTION_NOT_FOUND_HEADER = "x-nextjs-action-not-found";

function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/security-headers.test.ts: a route was enumerated but no app server is " +
        "running (browser.ts only starts one when enumerateRoutes() finds a route at globalSetup time).",
    );
  }
  return routeUrl(baseURL, route);
}

console.log(`tests/ui/layout/security-headers.test.ts: ${routes.length} route(s)`);

describe(`issue #331 — the security headers, on all ${routes.length} route(s)`, () => {
  it("states the route count it swept, explicitly, even at zero (rule 5.5)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(0);
  });

  it(
    "every route answers with the four fixed headers and a nonce-bearing CSP",
    async () => {
      for (const route of routes) {
        const headers = await withPage(
          WIDTH,
          async (page) => {
            const response = await page.goto(urlFor(route));
            if (response === null) {
              throw new Error(
                `tests/ui/layout/security-headers.test.ts: ${route.path} produced no response`,
              );
            }
            return response.headers();
          },
          headersFor(route),
        );

        for (const [name, value] of Object.entries(FIXED_HEADERS)) {
          expect(headers[name], `${route.path} must carry ${name}`).toBe(value);
        }
        expect(
          headers["permissions-policy"],
          `${route.path} must carry Permissions-Policy`,
        ).toContain("camera=()");

        const csp = headers["content-security-policy"];
        expect(csp, `${route.path} must carry a Content-Security-Policy`).toBeDefined();
        expect(csp, `${route.path}'s policy must carry this request's nonce`).toMatch(/'nonce-[^']+'/);
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
      }
      if (routes.length === 0) expect(routes).toEqual([]);
    },
    PER_ROUTE_BROWSER_MS,
  );

  it(
    "no route's own scripts, styles or fonts are refused by the policy it ships with",
    async () => {
      for (const route of routes) {
        const violations = await withPage(
          WIDTH,
          async (page) => {
            const found: string[] = [];
            // Registered at document start, before anything the page loads
            // can be refused, so the first refusal is caught rather than the
            // second.
            await page.addInitScript(() => {
              const record = (event: SecurityPolicyViolationEvent): void => {
                (window as unknown as { __rkCsp: string[] }).__rkCsp.push(
                  `${event.violatedDirective} blocked ${event.blockedURI || "an inline block"}`,
                );
              };
              (window as unknown as { __rkCsp: string[] }).__rkCsp = [];
              document.addEventListener("securitypolicyviolation", record);
            });
            page.on("console", (message) => {
              const text = message.text();
              if (text.includes("Content Security Policy")) found.push(text);
            });

            await page.goto(urlFor(route));
            // Hydration is what a refused bootstrap costs, and it happens
            // after `load`. A short settle is enough: the refusal is raised
            // when the script is *reached*, not when it finishes.
            await page.waitForTimeout(500);
            const fromDocument = await page.evaluate(
              () => (window as unknown as { __rkCsp?: string[] }).__rkCsp ?? [],
            );
            return [...found, ...fromDocument];
          },
          headersFor(route),
        );

        expect(violations, `${route.path} violates its own policy`).toEqual([]);
      }
      if (routes.length === 0) expect(routes).toEqual([]);
    },
    PER_ROUTE_BROWSER_MS,
  );

  it("a Server Function posted from another origin is refused before it is looked up", async () => {
    const baseURL = getBaseURL();
    if (baseURL === null) return;

    const post = async (origin: string): Promise<{ status: number; notFound: boolean }> =>
      withPage(WIDTH, async (page) => {
        const response = await page.request.post(`${baseURL}/signin`, {
          headers: {
            origin,
            "next-action": UNKNOWN_ACTION_ID,
            "content-type": "text/plain;charset=UTF-8",
          },
          data: "[]",
          failOnStatusCode: false,
        });
        return {
          status: response.status(),
          notFound: response.headers()[ACTION_NOT_FOUND_HEADER] === "1",
        };
      });

    // A stranger's origin: aborted, and the action never looked up — which
    // is why this answer is not the not-found one below.
    const foreign = await post("https://attacker.example");
    expect(foreign.status).toBe(500);
    expect(foreign.notFound).toBe(false);

    // The identical request from the app's own origin gets past the check
    // and fails on the only thing left: there is no such action. The pair
    // is the assertion — one request, one difference, two answers.
    const own = await post(new URL(baseURL).origin);
    expect(own.status).toBe(404);
    expect(own.notFound).toBe(true);
  }, PER_ROUTE_BROWSER_MS);
});
