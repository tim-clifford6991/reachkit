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
// What is asserted is what the set fixes and what the issue's own Done-when
// adds: the eyebrow, the heading and the line each screen shows, the one
// control each carries, that `404` is set in the mono face (§2 — "a numeral
// in the UI font is a defect"), that every screen is its own `Surface` root
// (ADR-093 decision 6), and that `global-error` carries the document the
// root layout would otherwise have carried.
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

function html(screen: () => React.JSX.Element): string {
  return renderToStaticMarkup(screen());
}

/** How many times a fragment occurs — used where "exactly one" is the
 *  assertion (one surface, one field, one control). */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const NOT_FOUND_SCREENS = [
  { name: "(public)/not-found.tsx", markup: html(PublicNotFound) },
  { name: "(account)/not-found.tsx", markup: html(AccountNotFound) },
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

  it.each(ERROR_SCREENS)("$name shows the error eyebrow, and its line is owed", ({ markup }) => {
    expect(markup).toContain(`<p class="eyebrow">${COPY["chrome.error.eyebrow"]}</p>`);
    expect(COPY["chrome.error.eyebrow"]).toBe("Something went wrong");
    // S8 draws no heading and no line for the error page, so both render
    // the marker until the owner writes them (12a, and the standing screen
    // rule: a screen shows which line is waiting and keeps working).
    expect(markup).toContain(`<h1 class="rk-hero-h">${TODO_COPY_MARKER}</h1>`);
    expect(markup).toContain(`<p>${TODO_COPY_MARKER}</p>`);
  });
});

describe("S8 — the line each screen writes", () => {
  it("the public 404 names the shape of a report address, in the mono face", () => {
    const markup = html(PublicNotFound);

    expect(COPY["chrome.notfound.address"]).toBe("reachkit.app/scan/yourdomain.com");
    expect(markup).toContain(
      `<p>Reports live at <span class="num">${COPY["chrome.notfound.address"]}</span>.</p>`
    );
    // The whole sentence is still the owner's, in one piece and in order:
    // the only thing between its two halves is the one span.
    const address = COPY["chrome.notfound.address"];
    const [before, after] = copy("chrome.notfound.line", { address }).split(address);
    expect(markup).toContain(`<p>${before}<span class="num">${address}</span>${after}</p>`);
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

describe("S8 — what each file is, on disk", () => {
  it.each([
    "src/app/(public)/error.tsx",
    "src/app/(account)/error.tsx",
    "src/app/global-error.tsx",
  ])("%s is a Client Component, as an error boundary must be", (file) => {
    expect(codeOf(file)).toMatch(/^"use client";$/m);
  });

  it.each(["src/app/(public)/not-found.tsx", "src/app/(account)/not-found.tsx"])(
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
      "src/app/_fallback/Fallback.tsx",
      "src/app/_fallback/AddressLine.tsx",
    ]) {
      const code = codeOf(file);
      expect(code, file).not.toMatch(/label="|children="/);
    }
  });
});
