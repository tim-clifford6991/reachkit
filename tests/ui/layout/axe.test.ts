// WCAG 2.1 AA, audited by axe-core on every route at 1280 (issue #328).
// tests/ui/layout/axe.test.ts
//
// Two accessibility facts had been asserted before this file: toggles carry
// `aria-pressed` (#301) and the quiet on-accent ink was measured (#290/#292).
// Nothing had ever looked at focus order, labels, landmarks, roles or
// contrast on the remaining tones, and nothing could: those are properties
// of a *rendered* document, and the only suite that renders one is this one.
//
// So the audit lives here, beside the layout sweep, with the same enumerator
// (ADR-010: the route tree is the scope, so a screen added later is audited
// by construction) and the same browser (`browser.ts`'s `withPage`). One
// width — 1280, `BAND_MIN.wide` — because that is what the issue's Done-when
// names and because the sweep's five widths are for the layout law; an
// accessible name does not change with the viewport, and the one thing that
// does (a scrollable region that needs keyboard access) is a finding at the
// width where the content actually overflows, which check 1 already owns.
//
// WHAT FAILS. axe tags every rule with the standard it implements. This run
// asks only for WCAG 2.0/2.1 A and AA — `best-practice` rules and the AAA
// `color-contrast-enhanced` are not this issue's bar and a gate that failed
// on them would be failing on something nobody agreed to. Of what comes
// back, **serious and critical fail**; moderate and minor are printed with
// their node counts, because the point of running this is to know, and a
// number nobody prints is a number nobody reads.
//
// HOW AXE GETS INTO THE PAGE, and why it is not a `<script>` tag. `axe.source`
// is the whole library as a string, and the obvious way to run it —
// `page.addScriptTag({ content })` — appends an **inline** script to the
// document. Since #331 every response carries a nonce-based
// `script-src 'self' 'nonce-…'`, so the browser refuses it: "Executing inline
// script violates the following Content Security Policy directive", on all
// sixteen routes. That refusal is the policy working.
//
// `page.addInitScript` instead, before the navigation: Playwright installs it
// through the debugger (`Page.addScriptToEvaluateOnNewDocument`), which is not
// subject to the page's CSP, and it runs at document start — so `window.axe`
// exists by the time the page has loaded. `page.evaluate` below arrives the
// same way, which is why the keyboard walk beside this file never hit the
// policy at all. Neither reaches the network: `tests/setup.ts` refuses a real
// call and this makes none.
import path from "node:path";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import { enumerateRoutes, headersFor, urlFor as routeUrl, type EnumeratedRoute } from "./routes";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");

/** The seeded session (#193): an `(account)` route audited without one is the
 *  sign-in redirect, audited at 1280 and reported as the account screen. */
const routes = enumerateRoutes(APP_ROOT, { accountCookie: getAccountCookie() });

/** The issue's width. `BAND_MIN.wide` *is* 1280 (`src/ui/layout/bands.ts`),
 *  read rather than written so the two cannot drift. */
const WIDTH = BAND_MIN.wide;

/** WCAG 2.0 and 2.1, levels A and AA — the standard this issue names, and
 *  nothing else. */
const TAGS: readonly string[] = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** The impacts that fail. axe's four are minor · moderate · serious ·
 *  critical; the Done-when names the top two. */
const FAILING: readonly string[] = ["serious", "critical"];

/** Chromium starts per call (see `browser.ts`), then the page loads and axe
 *  walks the whole document — the report at 1280 is the densest one. Same
 *  bound, same reason, as `layout.test.ts`'s `PER_ROUTE_BROWSER_MS`. */
const PER_ROUTE_BROWSER_MS = 60_000;

/** `routes.ts` owns how a route becomes a URL; this wrapper adds only this
 *  file's own no-server message (issue #49's one-home rule). */
function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error("tests/ui/layout/axe.test.ts: a route was enumerated but no app server is running");
  }
  return routeUrl(baseURL, route);
}

interface Finding {
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  /** One line per offending node: its selector, and why axe failed it. */
  nodes: string[];
}

/**
 * The audit, run inside the page.
 *
 * Closure-free and one serialisable argument, like every other function this
 * directory hands to `page.evaluate` (`checks.ts`'s header). `window.axe` is
 * the bundle `addInitScript` defined before the document loaded.
 */
async function runAxe(options: { tags: readonly string[] }): Promise<Finding[]> {
  interface AxeNode {
    target: unknown[];
    failureSummary?: string;
  }
  interface AxeViolation {
    id: string;
    impact?: string | null;
    help: string;
    helpUrl: string;
    nodes: AxeNode[];
  }
  const runner = (window as unknown as {
    axe: {
      run: (
        context: Document,
        options: Record<string, unknown>
      ) => Promise<{ violations: AxeViolation[] }>;
    };
  }).axe;
  const result = await runner.run(document, {
    runOnly: { type: "tag", values: [...options.tags] },
    resultTypes: ["violations"],
  });
  return result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? "unknown",
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => {
      const where = node.target.map((part) => String(part)).join(" ");
      const why = (node.failureSummary ?? "").replace(/\s*\n\s*/g, " ").trim();
      return `${where} — ${why}`;
    }),
  }));
}

/** One route's findings, already split into the ones that fail and the ones
 *  that are only reported. */
async function audit(route: EnumeratedRoute): Promise<Finding[]> {
  return withPage(
    WIDTH,
    async (page) => {
      // Before the navigation, and through the debugger rather than as a
      // `<script>` tag — see this file's header on #331's nonce CSP.
      await page.addInitScript({ content: axe.source });
      await page.goto(urlFor(route));
      return page.evaluate(runAxe, { tags: TAGS });
    },
    headersFor(route)
  );
}

function report(route: EnumeratedRoute, findings: readonly Finding[]): string {
  if (findings.length === 0) return `${route.path}: no WCAG 2.1 AA violation`;
  const lines = findings.map(
    (finding) =>
      `  ${finding.impact.padEnd(8)} ${finding.id} (${finding.nodes.length} node(s)) — ${finding.help}\n` +
      finding.nodes.map((node) => `      ${node}`).join("\n")
  );
  return `${route.path}:\n${lines.join("\n")}`;
}

describe(`axe-core over the route tree at ${WIDTH}px — ${routes.length} route(s)`, () => {
  it("states the route count it audited, explicitly, even at zero (rule 5.5)", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  for (const route of routes) {
    it(
      `${route.path} has no serious or critical WCAG 2.1 AA violation at ${WIDTH}px`,
      async () => {
        const findings = await audit(route);
        // Everything axe found, printed — including the moderate and minor
        // rows this gate does not fail on. A finding nobody prints is a
        // finding nobody fixes.
        console.log(`tests/ui/layout/axe.test.ts: ${report(route, findings)}`);
        const failing = findings.filter((finding) => FAILING.includes(finding.impact));
        expect(
          failing.map((finding) => `${finding.impact} ${finding.id} ×${finding.nodes.length}`),
          `${route.path} at ${WIDTH}px:\n${report(route, failing)}`
        ).toEqual([]);
      },
      PER_ROUTE_BROWSER_MS
    );
  }
});
