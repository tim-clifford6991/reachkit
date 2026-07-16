/**
 * Captured-HTML link/CTA audit — guard for the "Scan my site does nothing"
 * class of bug (owner report 2026-07-16). The landing + pricing captured
 * sections are inert server-rendered HTML: an <a> only works if its href is a
 * real destination, and a <button> only works if LandingHydrate's CTA patterns
 * wire it. Nothing else can catch a dead CTA here — there is no compiler or
 * router involved in a template string.
 *
 * Pins:
 *   a. no href="#" / empty href anywhere in the captured HTML;
 *   b. every internal href (and every hydrate destination) resolves to an
 *      existing App Router page, and every #anchor has a matching id;
 *   c. every captured <button> matches a hydrate wiring pattern — including
 *      the three CTAs Tim found dead ("Scan my site", "Get my score card",
 *      bottom "Analyze my site");
 *   d. the bottom CTA is a REAL scan entry: <LandingFinalCta/> renders the
 *      shared ScanInput (form + input), and the hydrate's input selector
 *      matches ScanInput's actual accessible name (selector⇄component parity).
 *
 * Render-test idiom: renderToStaticMarkup + string assertions, same as
 * components/report/captured/results-screen.render.test.tsx.
 */

import { describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { LANDING_HTML } from "./landing-html";
import { PRICING_HTML } from "./pricing-html";
import {
  SCAN_CTA_PATTERN,
  UPGRADE_CTA_PATTERN,
  UPGRADE_CTA_HREF,
  SCAN_FALLBACK_HREF,
  SCAN_INPUT_SELECTOR,
} from "./landing-hydrate";

// LandingFinalCta → ScanInput is a client component (useRouter); static render
// only needs a mounted-router stub.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const ROOT = resolve(__dirname, "../../..");

/** An internal route exists when some App Router group carries its page.tsx. */
function pageExists(route: string): boolean {
  const path = route.replace(/[?#].*$/, "").replace(/\/$/, "");
  const groups = ["(marketing)", "(app)", "(funnel)", ""];
  return groups.some((g) => existsSync(resolve(ROOT, "app", g, path.replace(/^\//, ""), "page.tsx")));
}

const captured = [
  { name: "landing", html: LANDING_HTML },
  { name: "pricing", html: PRICING_HTML },
] as const;

const hrefsOf = (html: string) =>
  [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);

const buttonTextsOf = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );

describe("captured HTML — no dead links or CTAs", () => {
  for (const { name, html } of captured) {
    it(`${name}: no href="#" / empty href`, () => {
      for (const href of hrefsOf(html)) {
        expect(href, `dead href in ${name} captured HTML`).not.toBe("");
        expect(href, `dead href in ${name} captured HTML`).not.toBe("#");
      }
    });

    it(`${name}: every internal href resolves; every #anchor has a matching id`, () => {
      for (const href of hrefsOf(html)) {
        if (href.startsWith("#")) {
          expect(html, `anchor ${href} in ${name} has no id target`).toContain(`id="${href.slice(1)}"`);
        } else if (href.startsWith("/")) {
          expect(pageExists(href), `${name} links to non-existent route ${href}`).toBe(true);
        } else {
          expect(href, `${name} external href must be https or mailto`).toMatch(/^(https:|mailto:)/);
        }
      }
    });

    it(`${name}: every <button> matches a LandingHydrate wiring pattern`, () => {
      const texts = buttonTextsOf(html);
      expect(texts.length).toBeGreaterThan(0);
      for (const t of texts) {
        const wired = SCAN_CTA_PATTERN.test(t) || UPGRADE_CTA_PATTERN.test(t);
        expect(wired, `captured <button> "${t}" in ${name} matches NO hydrate pattern — it would ship dead`).toBe(true);
      }
    });
  }

  it("the three CTAs from the 2026-07-16 bug report are wired", () => {
    // Pricing-table "Scan my site" (landing + /pricing) and the score-card band.
    expect(SCAN_CTA_PATTERN.test("Scan my site")).toBe(true);
    expect(SCAN_CTA_PATTERN.test("Get my score card →")).toBe(true);
    expect(SCAN_CTA_PATTERN.test("Analyze my site")).toBe(true);
    // Upgrade CTAs keep their own destination and never fall through to a scan.
    expect(UPGRADE_CTA_PATTERN.test("Start Solo")).toBe(true);
    expect(UPGRADE_CTA_PATTERN.test("Start Growth")).toBe(true);
    expect(SCAN_CTA_PATTERN.test("Start Solo")).toBe(false);
  });

  it("hydrate destinations resolve to real routes", () => {
    expect(pageExists(SCAN_FALLBACK_HREF)).toBe(true); // /scan
    expect(pageExists(UPGRADE_CTA_HREF)).toBe(true); // /login (…?next=/app/billing)
    const next = /next=([^&]+)/.exec(UPGRADE_CTA_HREF)?.[1] ?? "";
    expect(pageExists(decodeURIComponent(next))).toBe(true); // /app/billing
  });

  it("ScanHero's #story scroll cue still has its target in the captured landing", () => {
    expect(LANDING_HTML).toContain('id="story"');
  });
});

describe("bottom CTA is a real scan entry (LandingFinalCta)", () => {
  it("renders the shared ScanInput and the hydrate selector matches its accessible name", async () => {
    const { LandingFinalCta } = await import("./landing-final-cta");
    const html = renderToStaticMarkup(<LandingFinalCta />);

    // The band keeps its captured copy…
    expect(html).toContain("Stop guessing where you stand.");
    // …but the CTA is the live shared input, not a decorative button.
    expect(html).toContain("<form");
    expect(html).toContain("Analyze my site");

    // Selector⇄component parity: the aria-label LandingHydrate targets must be
    // the one ScanInput actually renders — if scan-input.tsx renames it, every
    // captured scan CTA silently degrades to the /scan fallback. Fail here first.
    const ariaLabel = /aria-label="([^"]+)"/.exec(SCAN_INPUT_SELECTOR)?.[1];
    expect(ariaLabel).toBeTruthy();
    expect(html).toContain(`aria-label="${ariaLabel}"`);
  });

  it("the captured landing no longer carries its own (dead) closing CTA button", () => {
    expect(LANDING_HTML).not.toContain("Stop guessing where you stand.");
  });
});
