// BUILD §3 — the public header's three parts.
// tests/app/chrome/header.test.tsx
//
// The header is applied by `(public)/layout.tsx`, and the cold-start and
// stopped-state sweeps render each route's own `page.tsx` **without** its
// group layout — which is what makes their counts a screen's own. So the
// header's own shape is asserted here, where it renders.
//
// SPEC §1, 2026-09-14: brand · Sign in · the header CTA, and the CTA is
// outline on every public page, so each screen's own action is its only
// solid button. On the landing the CTA is not a submit control: it focuses
// the one field, which keeps REQ-001 c1 true.
//
// **2026-09-21, issue #936 — the bar gained Pricing and a phone menu.**
// Two rows below asserted the shape that came before it and now assert the
// shape that replaced it, rather than being deleted or loosened:
//
//   · `Pricing` is in the bar. #936's own Build line spells the header
//     "brand · Pricing · Sign in · outline Scan my site", and the row that
//     said a fourth link was not one of the header's things now says which
//     four there are.
//   · There is a `<button>` off the landing: the phone menu's trigger.
//     What that row was protecting — that the **CTA** is an anchor and not
//     a script-driven control — is asserted directly instead.
//
// The theme control (#681) is rendered twice, once per width arm, because
// CSS cannot move one element between two containers. Only one is ever
// displayed; the bar's is wrapped in `public-header-theme` and the menu's
// is inside `public-header-menu`, so the rows below count per arm rather
// than over the document.
//
// **The right slot is a closed union.** Three arms — the pair, the landing's
// field CTA, and the report address's copy control beside the pair — chosen
// by `headerActionFor`, which this file asserts per route (issue 714).
//
// **2026-09-22, issue #988 — the bar reads the address rather than being
// handed an arm.** `(public)/layout.tsx` used to be a Client Component for
// one `usePathname()` call and passed the result down, which made the whole
// public chrome — and `copy()`'s merged registry with it — part of every
// public route's client bundle. The bar is a Server Component now and the
// two parts that follow the address are client leaves that read the path
// themselves (`_chrome/HeaderArm.tsx`). So these rows render the header *at
// a path* instead of *with an action*: the same three arms, named by the
// address that chooses them, which is what issue 714 is about anyway.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/app/(public)/_chrome/Header";
import { headerActionFor, type HeaderAction } from "@/app/(public)/_chrome/action";

/** The address the header believes it is at. `usePathname()` is the one
 *  thing a bar rendered outside a router cannot have, and it is exactly
 *  what these rows vary. */
let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

/** The origin a deployment binds. `_chrome/canonical.ts` reads
 *  `NEXT_PUBLIC_APP_URL` once at module load — Next inlines it at build —
 *  and a vitest run binds nothing, so without this the report would take
 *  the plain arm ("no origin bound is no address to copy") and the row
 *  about its copy control would assert nothing at all. */
vi.mock("@/app/(public)/_chrome/canonical", () => {
  // Inside the factory, because `vi.mock` is hoisted above every top-level
  // binding in this file.
  const origin = "https://reachkit.app";
  return {
    PUBLIC_ORIGIN: origin,
    canonicalUrl: (path: string) => new URL(path, origin).toString(),
  };
});

function markup(path: string): string {
  pathname = path;
  return renderToStaticMarkup(<Header />);
}

function withoutThemeToggle(html: string): string {
  return html.replace(/<div[^>]*data-testid="theme-toggle"[\s\S]*?<\/ul><\/div>/g, "");
}

/** The bar without the phone menu — what a reader sees from `sm`. */
function withoutPhoneMenu(html: string): string {
  return html.replace(/<div[^>]*data-testid="public-header-menu"[\s\S]*?<\/ul><\/div>/, "");
}

/** The three arms, as the addresses that choose them. */
const LANDING = "/";
const ELSEWHERE = "/pricing";
const REPORT = "/scan/example.com";

const LANDING_ACTION: HeaderAction = { kind: "landing" };
const ELSEWHERE_ACTION: HeaderAction = { kind: "cta" };

describe("SPEC §1, owner 2026-09-15 (issue 714) — the same bar on the report, token pages and sign-in", () => {
  it("the veto, opt-out and sign-in routes take the plain pair; the landing takes its field CTA", () => {
    for (const path of ["/veto/a-token", "/opt-out/a-token", "/signin", "/pricing"]) {
      expect(headerActionFor(path)).toEqual(ELSEWHERE_ACTION);
    }
    expect(headerActionFor("/")).toEqual(LANDING_ACTION);
    expect(["copy-link", "cta"]).toContain(headerActionFor("/scan/example.com").kind);
  });

  it("the report keeps its copy control beside Sign in and the one outline CTA", () => {
    const html = withoutThemeToggle(markup(REPORT));
    expect(html).toContain('href="/signin"');
    // The copy control itself, by the glyph only it draws — the bar's arm
    // and the phone menu's, which is why there are two.
    expect(html.match(/lucide-copy\b/g)).toHaveLength(2);
    expect(html).toContain('<button');
    const primaries = [...html.matchAll(/class="([^"]*\bbtn-primary\b[^"]*)"/g)].map((m) => m[1] ?? "");
    expect(primaries).toHaveLength(1);
    expect(primaries[0]).toContain("btn-outline");
    // The URL reaches the clipboard through a handler, never the markup.
    expect(html).not.toContain("https://reachkit.app");
  });
});

describe("SPEC §1 — brand · Sign in · the header CTA, outline", () => {
  it("both arms carry the wordmark and the quiet Sign in, and nothing else links out", () => {
    // The hrefs, not the keys: this renders against the real registry, so
    // an owed sentence resolves to its `TODO(copy)` marker and a key name
    // never reaches the markup. What is stable is the destination.
    for (const html of [markup(LANDING), markup(ELSEWHERE)]) {
      expect(html).toContain('href="/signin"');
      expect(html).toContain("btn-ghost");
      // #936: the bar is brand · Pricing · Sign in · the CTA. Those four
      // and no fifth — a link to anywhere else belongs in the footer.
      expect(html).toContain('href="/pricing"');
      const hrefs = new Set([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]));
      expect([...hrefs].sort()).toEqual(["/", "/pricing", "/signin"]);
    }
  });

  it("every arm carries one CTA, outline, so the header adds no solid button to any screen (2026-09-14)", () => {
    for (const html of [markup(LANDING), markup(ELSEWHERE)]) {
      const primaries = [...html.matchAll(/class="([^"]*\bbtn-primary\b[^"]*)"/g)].map((m) => m[1] ?? "");
      expect(primaries).toHaveLength(1);
      expect(primaries[0]).toContain("btn-outline");
    }
  });

  it("off the landing the CTA is a link to the field's own page", () => {
    const html = markup(ELSEWHERE);
    // The CTA itself is an anchor: a navigation with no client runtime,
    // which is what an anchor is for. Asserted on the element rather than
    // by counting `<button>`s over the document, because since #936 the
    // document also holds the phone menu's trigger and the theme
    // control's — neither of which is the CTA.
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*class="[^"]*btn-outline[^"]*"|<a[^>]*class="[^"]*btn-outline[^"]*"[^>]*href="\/"/);
    expect(html).not.toMatch(/<button[^>]*class="[^"]*btn-outline/);
  });

  it("the phone menu holds what the bar drops, and the bar keeps the brand and the CTA (#936)", () => {
    const html = markup(ELSEWHERE);
    // The bar at 390 is three things: brand, the outline CTA, the menu.
    const bar = withoutPhoneMenu(html);
    expect(bar).toContain('data-testid="public-brand"');
    expect(bar).toMatch(/btn-outline/);
    expect(html).toContain('data-testid="public-header-menu"');
    // Nothing is dropped: every link in the bar is also in the menu, so a
    // phone reader can reach all of them.
    const menu = html.slice(html.indexOf('data-testid="public-header-menu"'));
    for (const href of ["/pricing", "/signin"]) expect(menu).toContain(`href="${href}"`);
  });

  it("#681 — every arm carries the Light / Dark / System control, at both widths", () => {
    for (const action of [LANDING, ELSEWHERE, REPORT]) {
      expect(markup(action)).toContain('data-testid="theme-toggle"');
    }
    // Three choices in each width arm, and exactly two arms: the bar's,
    // shown from `sm`, and the phone menu's. Counted per arm so that a
    // third copy arriving somewhere would fail this rather than passing
    // as "six".
    const html = markup(ELSEWHERE);
    const inBar = withoutPhoneMenu(html);
    expect(inBar.match(/data-theme-choice="(light|dark|system)"/g)).toHaveLength(3);
    expect(html.match(/data-theme-choice="(light|dark|system)"/g)).toHaveLength(6);
    expect(html.match(/data-testid="theme-toggle"/g)).toHaveLength(2);
  });

  it("on the landing the CTA is a button that focuses the field, never a second submit (REQ-099 c3, REQ-001 c1)", () => {
    const html = markup(LANDING);
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });
});
