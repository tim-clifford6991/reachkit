// BUILD §3 — the public chrome: the header.
//
// Boards `PubLanding` / `PubLandingPhone` (v36, owner 2026-11-01): no strip
// above the bar, the three links with the current page marked, the one theme
// button, and *Free scan* solid with no arrow. The history that follows
// describes the shapes those rows replaced.
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
// The theme button is rendered twice, once per width arm, because
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

/** The landing's client leaf, as a Server Component receives it (issue
 *  1510). Next hands a server module each export of a `"use client"` module
 *  as a client reference: a component still renders, but anything else is a
 *  function that throws when read, and a jsdom-free `renderToStaticMarkup`
 *  never sees that boundary on its own. So every export that is not a
 *  function becomes one that throws, as on the server. */
vi.mock("@/app/(public)/_landing/FieldCta", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(
    Object.entries(real).map(([name, value]) => [
      name,
      typeof value === "function"
        ? value
        : function () {
            throw new Error(`Attempted to call ${name}() from the server but ${name} is on the client.`);
          },
    ]),
  );
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
// The button's own text node, so the nav's "Free scans" never counts as it.
const START = `>${COPY["chrome.cta.start"]}<`;

const LANDING_ACTION: HeaderAction = { kind: "landing" };
const ELSEWHERE_ACTION: HeaderAction = { kind: "cta" };

/** Each text link in a part of the header, read by attribute, so their order in the markup never matters. */
function links(part: string): { cls: string; href: string; current: boolean; text: string }[] {
  return [...part.matchAll(/<a ([^>]*)>([^<]*)<\/a>/g)].map((m) => {
    const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(m[1] ?? "")?.[1] ?? "";
    return { cls: attr("class"), href: attr("href"), current: attr("aria-current") === "page", text: m[2] ?? "" };
  });
}

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

describe("board PubLanding v36 — no top bar, and the nav", () => {
  it("no route draws a strip above the header", () => {
    for (const path of [LANDING, ELSEWHERE, REPORT, "/signin"]) {
      const html = markup(path);
      expect(html.startsWith("<header")).toBe(true);
      expect(html).not.toContain('data-testid="public-banner"');
      expect(html).not.toContain("Your first page, written for you");
    }
  });

  it("signed out, Free scan carries no arrow on any arm", () => {
    for (const path of [LANDING, ELSEWHERE, REPORT]) {
      const bar = withoutDrawer(markup(path));
      const cta = bar.slice(bar.lastIndexOf("<", bar.indexOf(START)), bar.indexOf(START) + START.length + 20);
      expect(bar).toContain(START);
      expect(bar).not.toContain("lucide-arrow-right");
      expect(cta).toContain("btn-primary");
    }
  });

  it("the nav is How it works · Pricing · Free scans, then Sign in and Free scan (owner 2026-10-20, Q1)", () => {
    const bar = withoutDrawer(markup(ELSEWHERE));
    const nav = links(bar)
      .filter((a) => a.cls.startsWith("btn btn-ghost btn-sm font-medium"))
      .map((a) => [a.href, a.text]);
    expect(nav).toEqual([
      ["/how-it-works", "How it works"],
      ["/pricing", "Pricing"],
      ["/scans", "Free scans"],
    ]);
    expect(bar.indexOf("Free scans")).toBeLessThan(bar.indexOf(COPY["chrome.nav.signin"]));
    expect(bar.indexOf(COPY["chrome.nav.signin"])).toBeLessThan(bar.indexOf(START));
  });

  it("Start free is the header's one solid primary, on every arm; Sign in is a ghost", () => {
    for (const path of [LANDING, ELSEWHERE, REPORT]) {
      const html = markup(path);
      const solid = primaries(html);
      expect(solid).toHaveLength(1);
      expect(solid[0]).not.toContain("btn-outline");
      expect(html).toContain('<a class="btn btn-ghost px-2" href="/signin">');
    }
  });

  it("on the landing Start free is a button that focuses the field, never a second submit; elsewhere it links to the field", () => {
    const landing = markup(LANDING);
    expect(landing).toMatch(/<button type="button" class="btn btn-primary px-3 sm:px-4">/);
    expect(landing).not.toContain('type="submit"');
    expect(markup(ELSEWHERE)).toContain('<a class="btn btn-primary px-3 sm:px-4" href="/#landing-field">');
  });

  it("the theme control is one button, Switch to dark theme, in the bar and in the drawer, with no Theme label", () => {
    const html = markup(ELSEWHERE);
    expect(html.match(/data-testid="theme-switch"/g)).toHaveLength(2);
    const bar = withoutDrawer(html);
    expect(bar.match(/data-theme-choice="(light|dark|system)"/g)).toEqual(['data-theme-choice="dark"']);
    expect(bar).toContain(`aria-label="${COPY["chrome.theme.to-dark"]}"`);
    expect(COPY["chrome.theme.to-dark"]).toBe("Switch to dark theme");
    expect(html).not.toContain(`>${COPY["chrome.theme.label"]}<`);
    expect(html).not.toContain('data-testid="theme-toggle"');
  });

  it("no link points at a landing section but the field", () => {
    const html = markup(ELSEWHERE);
    const hrefs = [...html.matchAll(/href="(\/#[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.filter((h) => h !== "/#landing-field")).toEqual([]);
  });

  it("the drawer holds the same three links, the switch and Sign in; its toggle is Open menu; Free scan stays in the bar", () => {
    const html = markup(ELSEWHERE);
    const menu = drawer(html);
    const menuLinks = links(menu.slice(0, menu.indexOf("</ul>"))).map((a) => a.href);
    expect(menuLinks).toEqual(["/how-it-works", "/pricing", "/scans"]);
    expect(menu).toContain('href="/signin"');
    expect(menu).toContain('data-testid="theme-switch"');
    expect(html).toContain(`aria-label="${COPY["chrome.nav.menu"]}"`);
    expect(COPY["chrome.nav.menu"]).toBe("Open menu");
    expect(menu).not.toContain(START);
    expect(withoutDrawer(html)).toContain(START);
  });
});

describe("board v36 — the link to the page you are on is marked", () => {
  /** Every header link marked current, as `[where, href, text]`, each in the primary ink. */
  function current(path: string): [string, string, string][] {
    const html = markup(path);
    const marked = (where: string, part: string) =>
      links(part)
        .filter((a) => a.current)
        .map((a): [string, string, string] => {
          expect(a.cls.split(" ")).toContain("text-primary");
          return [where, a.href, a.text];
        });
    return [...marked("bar", withoutDrawer(html)), ...marked("drawer", drawer(html))];
  }

  it.each([
    ["/how-it-works", COPY["chrome.nav.works"]],
    ["/pricing", COPY["chrome.nav.pricing"]],
    ["/scans", COPY["chrome.nav.scans"]],
    ["/signin", COPY["chrome.nav.signin"]],
  ])("on %s exactly its own link is current, in the bar and in the drawer", (path, text) => {
    expect(current(path)).toEqual([
      ["bar", path, text],
      ["drawer", path, text],
    ]);
  });

  it("Sign in stays current on the step its link lands on", () => {
    expect(current("/auth/confirm").map(([, href]) => href)).toEqual(["/signin", "/signin"]);
  });

  it.each([LANDING, REPORT, "/privacy", "/scans/kinds", "/pricing/extra"])("on %s no link is current", (path) => {
    expect(markup(path)).not.toContain("aria-current");
  });
});

describe("owner 2026-09-26 (#1125) — signed in, one button into the app", () => {
  function signedIn(path: string, entry: "/app" | "/setup"): string {
    pathname = path;
    return renderToStaticMarkup(<Header entry={entry} />);
  }

  it("the bar holds one solid button to /app, and neither Sign in nor Start free, anywhere in the header", () => {
    for (const path of [LANDING, ELSEWHERE, REPORT]) {
      const html = signedIn(path, "/app");
      expect(primaries(html)).toHaveLength(1);
      expect(withoutDrawer(html)).toContain(`href="/app"`);
      expect(withoutDrawer(html)).toContain(COPY["chrome.cta.app"]);
      expect(html).not.toContain(COPY["chrome.nav.signin"]);
      expect(html).not.toContain(START);
      expect(html).not.toContain('href="/signin"');
    }
  });

  it("the button into the app keeps its arrow", () => {
    expect(withoutDrawer(signedIn(ELSEWHERE, "/app"))).toContain("lucide-arrow-right");
  });

  it("an account still in setup is sent to /setup", () => {
    expect(withoutDrawer(signedIn(ELSEWHERE, "/setup"))).toContain('href="/setup"');
  });
});
