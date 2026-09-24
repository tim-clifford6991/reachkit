// BUILD §3 — the public chrome: the banner and the header.
//
// 2026-09-24, #1066: the rows below assert the calm-layer chrome (SPEC §1,
// boards R12-1 / R12-8 / R12-10) — the banner, the nav's links, the two-state
// theme switch, and *Start free* solid. The history that follows describes
// the shapes those rows replaced.
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
import { COPY } from "@/lib/presentation/copy";

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

/** The bar without the drawer — what a reader sees from `lg`. */
function withoutDrawer(html: string): string {
  const start = html.indexOf('<div class="drawer ');
  const end = html.indexOf("</nav>", start);
  return html.slice(0, start) + html.slice(end);
}

/** The drawer alone. */
function drawer(html: string): string {
  return html.slice(html.indexOf('data-testid="public-header-menu"'));
}

/** The three arms, as the addresses that choose them. */
const LANDING = "/";
const ELSEWHERE = "/pricing";
const REPORT = "/scan/example.com";

const LANDING_ACTION: HeaderAction = { kind: "landing" };
const ELSEWHERE_ACTION: HeaderAction = { kind: "cta" };

function primaries(html: string): string[] {
  return [...html.matchAll(/class="([^"]*\bbtn-primary\b[^"]*)"/g)].map((m) => m[1] ?? "").filter((c) => !c.includes("btn-soft"));
}

describe("SPEC §1, owner 2026-09-15 (issue 714) — the same chrome on the report, token pages and sign-in", () => {
  it("the veto, opt-out and sign-in routes take the plain arm; the landing takes its field CTA", () => {
    for (const path of ["/veto/a-token", "/opt-out/a-token", "/signin", "/pricing"]) {
      expect(headerActionFor(path)).toEqual(ELSEWHERE_ACTION);
    }
    expect(headerActionFor("/")).toEqual(LANDING_ACTION);
    expect(["copy-link", "cta"]).toContain(headerActionFor("/scan/example.com").kind);
  });

  it("the report keeps its copy control, in the bar and in the drawer, and the URL stays out of the markup", () => {
    const html = markup(REPORT);
    expect(html.match(/lucide-copy\b/g)).toHaveLength(2);
    expect(html).not.toContain("https://reachkit.app");
  });
});

describe("SPEC §1, 2026-09-24 (#1066) — the banner and the nav", () => {
  it("the banner sits above the header, with its one line, its tag, a way to the field and a dismiss button", () => {
    const html = markup(ELSEWHERE);
    expect(html.indexOf('data-testid="public-banner"')).toBeLessThan(html.indexOf('data-testid="public-header"'));
    const banner = html.slice(html.indexOf('data-testid="public-banner"'), html.indexOf('data-testid="public-header"'));
    expect(banner).toContain(COPY["chrome.banner"]);
    expect(banner).toContain(COPY["chrome.banner.tag"]);
    expect(banner).toContain('href="/#landing-field"');
    expect(banner).toContain(`aria-label="${COPY["chrome.banner.dismiss"]}"`);
  });

  it("the nav is Why it matters · How to start · Pricing, then Sign in and Start free — no Free scans yet (#1069)", () => {
    const bar = withoutDrawer(markup(ELSEWHERE));
    const words = [COPY["chrome.nav.why"], COPY["chrome.nav.how"], COPY["chrome.nav.pricing"], COPY["chrome.nav.signin"], COPY["chrome.cta.start"]];
    const at = words.map((w) => bar.indexOf(w));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(bar).not.toContain('href="/scans"');
  });

  it("Start free is the header's one solid primary, on every arm; Sign in is a ghost", () => {
    for (const path of [LANDING, ELSEWHERE, REPORT]) {
      const html = markup(path);
      const solid = primaries(html);
      expect(solid).toHaveLength(1);
      expect(solid[0]).not.toContain("btn-outline");
      expect(html).toContain('<a class="btn btn-ghost btn-sm hidden sm:inline-flex" href="/signin">');
    }
  });

  it("on the landing Start free is a button that focuses the field, never a second submit; elsewhere it links to the field", () => {
    const landing = markup(LANDING);
    expect(landing).toMatch(/<button type="button" class="btn btn-primary btn-sm">/);
    expect(landing).not.toContain('type="submit"');
    expect(markup(ELSEWHERE)).toContain('<a class="btn btn-primary btn-sm" href="/#landing-field">');
  });

  it("the theme control is two states, light and dark, in the bar and in the drawer", () => {
    const html = markup(ELSEWHERE);
    expect(html.match(/data-testid="theme-switch"/g)).toHaveLength(2);
    expect(withoutDrawer(html).match(/data-theme-choice="(light|dark|system)"/g)).toEqual([
      'data-theme-choice="light"',
      'data-theme-choice="dark"',
    ]);
    expect(html).not.toContain('data-testid="theme-toggle"');
  });

  it("the drawer holds every link, the switch and Sign in, and Start free stays in the bar", () => {
    const html = markup(ELSEWHERE);
    const menu = drawer(html);
    for (const href of ["/#why", "/#how", "/pricing", "/signin"]) expect(menu).toContain(`href="${href}"`);
    expect(menu).toContain('data-testid="theme-switch"');
    expect(menu).not.toContain(COPY["chrome.cta.start"]);
    expect(withoutDrawer(html)).toContain(COPY["chrome.cta.start"]);
  });
});
