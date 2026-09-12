// docs/DESIGN.md's eyebrow rung, rendered (issue #548).
//
// DESIGN.md states the rung as one value — "eyebrow 11 uppercase 700 `.1em`
// ink-3" — and `src/ui/type.css`'s `.eyebrow` declared only the face, the
// case and the size, so the weight, the tracking and the ink were short on
// every screen and one surface re-added them for itself. The rung is central
// now, and this is the half a parsed stylesheet cannot prove: what a browser
// computes after preflight, the theme, daisyUI's layer and `type.css` have
// all applied, on a screen that actually draws one.
//
// Two routes, one public and one account, because the two load different
// stylesheets in different orders and the account shell is the one that
// carries a signed-in session.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import { enumerateRoutes, headersFor, urlFor as routeUrl, type EnumeratedRoute } from "./routes";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
const routes = enumerateRoutes(APP_ROOT, { accountCookie: getAccountCookie() });

/** One public screen and one account screen that draw the rung: S4's "start"
 *  label, and S18's nine card heads. */
const PUBLIC_ROUTE = "/pricing";
const ACCOUNT_ROUTE = "/app/settings";

/** Chromium starts per call (`browser.ts`); same bound as the sweep's. */
const PER_ROUTE_BROWSER_MS = 60_000;

/** DESIGN.md's rung. The size and the ink are read back off `:root` in the
 *  same page, so these are not a second copy of the token file. */
const WEIGHT = "700";
const TRACKING_EM = 0.1;
const SIZE_TOKEN = "--t-eyebrow";
const INK_TOKEN = "--ink-3";

/** The two grounds that deliberately re-ink an eyebrow: the accent ground
 *  draws it in the quiet on-accent, and S18's danger card in `--bad`. Their
 *  eyebrows are measured for everything except the ink. */
const RE_INKED = ".rk-accent-ground, .rk-danger";

interface MeasuredEyebrow {
  readonly text: string;
  readonly px: number;
  readonly transform: string;
  readonly weight: string;
  readonly trackingPx: number;
  readonly color: string;
  readonly reInked: boolean;
}

interface Measurement {
  readonly eyebrows: readonly MeasuredEyebrow[];
  readonly expectedPx: number;
  readonly expectedInk: string;
}

/** Every `.eyebrow` on the page, with what the browser computed for it, plus
 *  the two expectations resolved from `:root` in the same document. */
function measureEyebrows(reInkedSelector: string): Measurement {
  const probe = document.createElement("span");
  probe.style.color = "var(--ink-3)";
  probe.style.fontSize = "var(--t-eyebrow)";
  document.body.appendChild(probe);
  const probeStyle = getComputedStyle(probe);
  const expectedInk = probeStyle.color;
  const expectedPx = Number.parseFloat(probeStyle.fontSize);
  probe.remove();

  const eyebrows = [...document.querySelectorAll(".eyebrow")].map((el) => {
    const style = getComputedStyle(el);
    const tracking = style.letterSpacing;
    return {
      text: (el.textContent ?? "").slice(0, 40),
      px: Number.parseFloat(style.fontSize),
      transform: style.textTransform,
      weight: style.fontWeight,
      // `letter-spacing` computes to px; `.1em` of the rung's own size.
      trackingPx: tracking === "normal" ? 0 : Number.parseFloat(tracking),
      color: style.color,
      reInked: el.closest(reInkedSelector) !== null,
    };
  });
  return { eyebrows, expectedPx, expectedInk };
}

function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/eyebrow-rung.test.ts: a route was enumerated but no app server is running"
    );
  }
  return routeUrl(baseURL, route);
}

function routeFor(urlPath: string): EnumeratedRoute {
  const route = routes.find((r) => r.path === urlPath && r.host === undefined);
  if (!route) {
    throw new Error(`tests/ui/layout/eyebrow-rung.test.ts: ${urlPath} is not in the route tree`);
  }
  return route;
}

async function measure(urlPath: string): Promise<Measurement> {
  const route = routeFor(urlPath);
  return withPage(
    BAND_MIN.medium,
    async (page) => {
      await page.goto(urlFor(route));
      return page.evaluate(measureEyebrows, RE_INKED);
    },
    headersFor(route)
  );
}

describe("the eyebrow rung computes as DESIGN.md states it, on a public and an account screen", () => {
  for (const urlPath of [PUBLIC_ROUTE, ACCOUNT_ROUTE]) {
    it(
      `${urlPath}: 11px, uppercase, .1em, 700, --ink-3`,
      async () => {
        const { eyebrows, expectedPx, expectedInk } = await measure(urlPath);
        // Rule 5.5: an assertion that ran over nothing is a pass that means
        // nothing, so the screen having an eyebrow at all is asserted first.
        expect(eyebrows.length, `${urlPath} rendered no .eyebrow`).toBeGreaterThan(0);
        // The token's own value, read off `:root` in the same document — so
        // the rung is not a second copy of the ladder written down here.
        expect(expectedPx, `${SIZE_TOKEN} must be the ladder's floor`).toBe(11);

        for (const eyebrow of eyebrows) {
          const where = `${urlPath}: "${eyebrow.text}"`;
          expect(eyebrow.px, `${where} size`).toBe(expectedPx);
          expect(eyebrow.transform, `${where} case`).toBe("uppercase");
          expect(eyebrow.weight, `${where} weight`).toBe(WEIGHT);
          expect(eyebrow.trackingPx, `${where} tracking`).toBeCloseTo(
            expectedPx * TRACKING_EM,
            1
          );
        }

        // The ink, on every eyebrow but the two grounds that deliberately
        // re-ink one. Those are measured above for everything else.
        const inked = eyebrows.filter((eyebrow) => !eyebrow.reInked);
        expect(inked.length, `${urlPath} draws only re-inked eyebrows`).toBeGreaterThan(0);
        for (const eyebrow of inked) {
          expect(eyebrow.color, `${urlPath}: "${eyebrow.text}" ink (${INK_TOKEN})`).toBe(
            expectedInk
          );
        }

        console.log(
          `tests/ui/layout/eyebrow-rung.test.ts: ${urlPath} — ${eyebrows.length} eyebrow(s), ${inked.length} at ${INK_TOKEN}`
        );
      },
      PER_ROUTE_BROWSER_MS
    );
  }
});
