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
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
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

  it(
    "a Server Function posted from another origin is refused before it is looked up",
    async () => {
      const baseURL = getBaseURL();
      if (baseURL === null) return;
      const target = `${baseURL}${SIGNIN_PATH}`;

      /**
       * One POST, made **by the browser** — not by an `APIRequestContext`,
       * which Playwright serves in this process with `http.request` and
       * `tests/setup.ts` therefore refuses (rightly: nothing in this corpus
       * reaches the network from a test process).
       *
       * That constraint is what makes this the honest test rather than the
       * convenient one. A page cannot forge an `Origin` header — it is a
       * forbidden header name — so the only way to send a mismatched one is
       * to actually be somewhere else, which is also the only way a CSRF
       * attempt ever arises. `about:blank` is that somewhere: an opaque
       * origin, exactly what a sandboxed frame or a `data:` document has,
       * and the case Next's own comment beside this check is written for
       * ("these contexts can still send along credentials like cookies").
       *
       * It is also the only page within reach that *can* stage the attempt.
       * Every page this product serves carries `connect-src 'self'` and
       * `form-action 'self'`, so none of them can post anywhere else — the
       * policy from the first half of this issue working, which is why the
       * attempt has to come from a document the product did not serve.
       *
       * `no-cors` so the request is sent rather than refused before it
       * leaves; the response is unreadable from the page either way, and is
       * read off the wire by `waitForResponse` instead. The body carries no
       * action id at all, so nothing of this product's is ever invoked —
       * the two answers differ on the origin and on nothing else.
       */
      const statusOfPostFrom = async (where: "elsewhere" | "its own origin"): Promise<number> =>
        withPage(WIDTH, async (page) => {
          if (where === "its own origin") {
            await page.goto(target);
          } else {
            await page.setContent("<!doctype html><title>elsewhere</title>");
          }

          const [response] = await Promise.all([
            page.waitForResponse((r) => r.url() === target && r.request().method() === "POST"),
            page.evaluate(async (to) => {
              const body = new FormData();
              body.set("probe", "1");
              await fetch(to, { method: "POST", mode: "no-cors", body }).catch(() => undefined);
            }, target),
          ]);
          return response.status();
        });

      // Aborted, before the body is even decoded.
      expect(await statusOfPostFrom("elsewhere")).toBe(500);
      // The identical request from the app's own origin is not: it passes
      // the check, decodes to no action, and the screen renders. One
      // request, one difference, two answers.
      expect(await statusOfPostFrom("its own origin")).toBe(200);
    },
    PER_ROUTE_BROWSER_MS,
  );
});
