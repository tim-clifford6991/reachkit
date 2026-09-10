// UI-SPEC S8 — the not-found and error screens, five mounts of one shape.
//
// "Eyebrow 404 · 'There is no page at this address.' · 'Reports live at
// reachkit.app/scan/yourdomain.com' · scan field + solid 'Scan it' ·
// footer. The error page is the same shape with one written line."
//
// Each of the five components is **rendered**, not inspected as a tree of
// unevaluated elements: this shape hands its line and its control over as
// props, so a walker over the returned element would only ever see
// `<Fallback>` and never a word of what it draws.
// `renderToStaticMarkup` is the same renderer `tests/presentation/sweeps/`
// uses, and it runs in the `node` project with no DOM.
//
// **Six mounts since #405.** `src/app/not-found.tsx` is the one Next
// actually reaches for an unmatched URL — a route group's `not-found.tsx`
// is a `notFound()` boundary and nothing else — so it is the root file that
// decides what a mistyped ReachKit address answers. It belongs to no group,
// so it draws ruling 3a's header and footer itself, and it renders the
// `(public)` arm rather than composing S8's three keys a second time.
//
// What is asserted is what the set fixes and what the issue's own Done-when
// adds: the eyebrow, the heading and the line each screen shows, the one
// control each carries, that `404` is set in the mono face (§2 — "a numeral
// in the UI font is a defect"), that every screen is its own `Surface` root
// (ADR-093 decision 6), that `global-error` carries the document the root
// layout would otherwise have carried, and that the root 404 carries the
// public chrome.
import { describe, expect, it } from "vitest";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY, copy, TODO_COPY_MARKER } from "../../../src/lib/presentation/copy";
import { codeOf } from "../../mail/leads/source";
import PublicNotFound from "../../../src/app/(public)/not-found";
import PublicError from "../../../src/app/(public)/error";
import AccountNotFound from "../../../src/app/(account)/not-found";
import AccountError from "../../../src/app/(account)/error";
import GlobalError from "../../../src/app/global-error";
import RootNotFound from "../../../src/app/not-found";

function html(screen: () => React.JSX.Element): string {
  return renderToStaticMarkup(screen());
}

/** React mints a fresh `useId` per render, so two renders of the same tree
 *  differ in exactly those attributes and nowhere else. Blanking them is
 *  what lets one screen's markup be compared with another's. */
function stableIds(markup: string): string {
  return markup.replace(/_R_[^"]*_/g, "_R_");
}

/** How many times a fragment occurs — used where "exactly one" is the
 *  assertion (one surface, one field, one control). */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const NOT_FOUND_SCREENS = [
  { name: "(public)/not-found.tsx", markup: html(PublicNotFound) },
  { name: "(account)/not-found.tsx", markup: html(AccountNotFound) },
  { name: "not-found.tsx", markup: html(RootNotFound) },
];

const ERROR_SCREENS = [
  { name: "(public)/error.tsx", markup: html(PublicError) },
  { name: "(account)/error.tsx", markup: html(AccountError) },
  { name: "global-error.tsx", markup: html(GlobalError) },
];

const EVERY_SCREEN = [...NOT_FOUND_SCREENS, ...ERROR_SCREENS];

describe("S8 — one shape, and every mount wears it", () => {
  it.each(EVERY_SCREEN)("$name is its own Surface root, with one main", ({ markup }) => {
    // ADR-093 decision 6: exactly one `[data-surface]` per document.
    // `(public)`'s group layout draws chrome and no surface, `(account)`'s
    // is the setup gate, and `global-error` replaces the root layout — so
    // on all five the screen is the root.
    expect(occurrences(markup, "data-surface")).toBe(1);
    expect(occurrences(markup, '<main class="rk-fallback"')).toBe(1);
  });

  it.each(NOT_FOUND_SCREENS)("$name shows the set's 404 eyebrow and heading", ({ markup }) => {
    expect(markup).toContain(`>${COPY["chrome.notfound.eyebrow"]}</p>`);
    expect(markup).toContain(
      `<h1 class="rk-hero-h">${COPY["chrome.notfound.heading"]}</h1>`
    );
    expect(COPY["chrome.notfound.heading"]).toBe("There is no page at this address.");
  });

  it.each(NOT_FOUND_SCREENS)("$name sets the 404 in the mono face", ({ markup }) => {
    // §2: "every numeral in mono with tabular-nums"; `.num` is the one rule
    // in `src/ui/type.css` that binds the family, and `.eyebrow` above it
    // in the same file would otherwise win the family back.
    expect(markup).toContain('<p class="eyebrow num">404</p>');
  });

  it.each(ERROR_SCREENS)("$name keeps its shape, and all three of its strings are owed", ({ markup }) => {
    // S8 draws nothing of the error page but its shape — "the same shape
    // with one written line" — so its eyebrow, its heading and its line are
    // all three the owner's, and all three render the marker (12a, and the
    // standing screen rule: a screen shows which line is waiting and keeps
    // working). The eyebrow was written from issue #372's own Done-when
    // until the master's review of #407 owed it back: a Done-when is a
    // brief, not the owner's pen, and no BUILD or REQ line writes it.
    expect(COPY["chrome.error.eyebrow"]).toBe(TODO_COPY_MARKER);
    expect(markup).toContain(`<p class="eyebrow">${TODO_COPY_MARKER}</p>`);
    expect(markup).toContain(`<h1 class="rk-hero-h">${TODO_COPY_MARKER}</h1>`);
    expect(markup).toContain(`<p>${TODO_COPY_MARKER}</p>`);
  });
});

describe("S8 — the line each screen writes", () => {
  it("the public 404 names the shape of a report address, in the mono face", () => {
    const markup = html(PublicNotFound);

    expect(COPY["chrome.notfound.address"]).toBe("reachkit.app/scan/yourdomain.com");
    // The line is a declared scroll container since #327 — the address is
    // 297px at the body rung and the compact reading column is 288, and
    // `.num` bans every break inside a value, so ADR-093's rule applies and
    // the *box* changes. The classes are asserted here rather than only in
    // the stylesheet: the layout sweep's own allow-list is keyed on
    // `.overflow-x-auto`, so a line that lost the class would stop being a
    // declared scroll container and start being a check-2 offender.
    const LINE_BOX = '<p class="min-w-0 max-w-full overflow-x-auto text-start">';
    expect(markup).toContain(
      `${LINE_BOX}Reports live at <span class="num">${COPY["chrome.notfound.address"]}</span>.</p>`
    );
    // The whole sentence is still the owner's, in one piece and in order:
    // the only thing between its two halves is the one span.
    const address = COPY["chrome.notfound.address"];
    const [before, after] = copy("chrome.notfound.line", { address }).split(address);
    expect(markup).toContain(`${LINE_BOX}${before}<span class="num">${address}</span>${after}</p>`);
  });

  it("the account 404 does not send a signed-in customer to a report address", () => {
    const markup = html(AccountNotFound);

    // Its own line, owner-owed (12a) — and never the set's, which names
    // where a stranger's report lives.
    expect(markup).toContain(`<p>${TODO_COPY_MARKER}</p>`);
    expect(markup).not.toContain(COPY["chrome.notfound.address"]);
    expect(markup).not.toContain("Reports live at");
  });
});

describe("S8 — one control per screen, and it is the route group's own", () => {
  it.each([
    { name: "(public)/not-found.tsx", markup: html(PublicNotFound) },
    { name: "(public)/error.tsx", markup: html(PublicError) },
    // The root 404 is the public one with the chrome around it, so it
    // carries the same one field and the same one submit — the header's and
    // the footer's controls are links, and none of them is a `<button>`.
    { name: "not-found.tsx", markup: html(RootNotFound) },
  ])("$name carries the scan field with the set's solid 'Scan it'", ({ markup }) => {
    expect(COPY["chrome.notfound.cta"]).toBe("Scan it");
    // The field is the landing's own form — the same POST, the same one
    // named field — under S8's word.
    expect(occurrences(markup, 'action="/api/scan"')).toBe(1);
    expect(occurrences(markup, "<input")).toBe(1);
    expect(occurrences(markup, "<button")).toBe(1);
    expect(markup).toContain(COPY["chrome.notfound.cta"]);
    expect(markup).toContain(COPY["landing.field.placeholder"]);
  });

  it.each([
    { name: "(account)/not-found.tsx", markup: html(AccountNotFound) },
    { name: "(account)/error.tsx", markup: html(AccountError) },
  ])("$name carries the quiet way back to the Overview and no scan field", ({ markup }) => {
    expect(occurrences(markup, '<a href="/app"')).toBe(1);
    expect(markup).toContain(COPY["chrome.back-to-overview"]);
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("<input");
  });

  it("global-error's way out is the front door — it belongs to no group", () => {
    const markup = html(GlobalError);

    expect(occurrences(markup, '<a href="/"')).toBe(1);
    expect(markup).toContain(COPY["chrome.back-to-reachkit"]);
    expect(COPY["chrome.back-to-reachkit"]).toBe("Back to ReachKit");
  });

  it.each([
    { name: "(account)/error.tsx", markup: html(AccountError) },
    { name: "global-error.tsx", markup: html(GlobalError) },
  ])("$name draws no retry control", ({ markup }) => {
    // Next hands an error boundary a `retry`; S8 draws no such control and
    // no approved string names one, so none is rendered rather than one
    // being invented. The two public arms carry the scan field's own
    // submit, which is the field's and is counted above.
    expect(markup).not.toContain("<button");
  });
});

describe("S8 — the root 404, the one an unmatched address reaches (#405)", () => {
  const markup = html(RootNotFound);

  it("wears ruling 3a's header and footer, which no group layout gives it", () => {
    // It renders inside `src/app/layout.tsx` alone — above all three route
    // groups — so the shell every other public screen inherits from
    // `(public)/layout.tsx` is drawn here or nowhere.
    expect(occurrences(markup, 'data-testid="public-header"')).toBe(1);
    expect(occurrences(markup, 'data-testid="public-footer"')).toBe(1);
    expect(occurrences(markup, 'class="rk-public-shell"')).toBe(1);
  });

  it("takes 3a's own right slot — quiet Sign in, one solid CTA — and no route's", () => {
    // Not the landing's field CTA, not the report's copy control and not a
    // token page's address: an address that matches no route is none of
    // those three.
    expect(markup).toContain(COPY["chrome.nav.signin"]);
    expect(markup).toContain(COPY["chrome.cta.scan"]);
    expect(markup).not.toContain("rk-prov-line");
  });

  it("is the (public) 404 itself, not a second composition of S8's keys", () => {
    // The strongest form of "these two cannot drift": the public arm's
    // whole markup stands inside the root one, unchanged.
    expect(stableIds(markup)).toContain(stableIds(html(PublicNotFound)));
  });

  it("still has exactly one Surface, with the chrome outside it", () => {
    // ADR-093 decision 6 counts documents, not screens: the header and the
    // footer are siblings of the surface, as they are on every other public
    // route.
    expect(occurrences(markup, "data-surface")).toBe(1);
    expect(markup.indexOf('data-testid="public-header"')).toBeLessThan(
      markup.indexOf("data-surface")
    );
    expect(markup.indexOf('data-testid="public-footer"')).toBeGreaterThan(
      markup.indexOf("data-surface")
    );
  });
});

describe("S8 — what each file is, on disk", () => {
  it.each([
    "src/app/(public)/error.tsx",
    "src/app/(account)/error.tsx",
    "src/app/global-error.tsx",
  ])("%s is a Client Component, as an error boundary must be", (file) => {
    expect(codeOf(file)).toMatch(/^"use client";$/m);
  });

  it.each([
    "src/app/(public)/not-found.tsx",
    "src/app/(account)/not-found.tsx",
    "src/app/not-found.tsx",
  ])(
    "%s is a Server Component that reads no session, cookie or store",
    (file) => {
      const code = codeOf(file);
      expect(code).not.toMatch(/"use client"/);
      expect(code).not.toMatch(/cookies\(|headers\(|currentSession|hasActiveAccess/);
    }
  );

  it("global-error carries the root layout's own document, stylesheets and font class", () => {
    const code = codeOf("src/app/global-error.tsx");
    // It replaces the root layout when active, so everything that layout
    // supplies has to be here: the two tags, the six stylesheets and the
    // class `type.css` binds `--font-ui`/`--font-mono` on.
    expect(code).toContain('<html lang="en" className={fontVariables}>');
    expect(code).toContain("<body>");
    for (const sheet of [
      "@/ui/theme.css",
      "@/ui/tailwind.css",
      "@/ui/type.css",
      "@/ui/layout/layout.css",
      "@/ui/layout/surface.css",
      "@/ui/idiom/idiom.css",
    ]) {
      expect(code, sheet).toContain(sheet);
    }
  });

  it("no fallback screen writes a sentence of its own", () => {
    for (const file of [
      "src/app/(public)/not-found.tsx",
      "src/app/(public)/error.tsx",
      "src/app/(account)/not-found.tsx",
      "src/app/(account)/error.tsx",
      "src/app/global-error.tsx",
      "src/app/not-found.tsx",
      "src/app/_fallback/Fallback.tsx",
      "src/app/_fallback/AddressLine.tsx",
    ]) {
      const code = codeOf(file);
      expect(code, file).not.toMatch(/label="|children="/);
    }
  });
});
