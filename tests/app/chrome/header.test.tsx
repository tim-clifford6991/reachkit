// BUILD §3 — the public header's rank and its links (issue #290).
// tests/app/chrome/header.test.tsx
//
// The header is applied by `(public)/layout.tsx`, and the cold-start and
// stopped-state sweeps render each route's own `page.tsx` **without** its
// group layout — which is what makes their counts a screen's own. So the
// header's own rank is asserted here, where it renders.
//
// What is being held: tokens.md §9.1's "one solid accent primary" is a
// *screen's* property, and a control that appears on every screen cannot
// be it. The master's screenshots of dev after #285 caught the first cut
// doing exactly that — a solid pill in the header beside `Send my link` on
// `/signin` and beside the report's Start on `/scan/{domain}`.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Header } from "@/app/(public)/_chrome/Header";

function markup(showCta: boolean): string {
  return renderToStaticMarkup(<Header showCta={showCta} />);
}

describe("§9.1 idiom — the public header carries no solid primary", () => {
  it("the scan control is the outline secondary, not `btn-primary`", () => {
    const html = markup(true);
    expect(html).not.toContain("btn-primary");
    expect(html).toContain("rk-btn-outline");
  });

  it("it is the pill radius the idiom gives every button", () => {
    expect(markup(true)).toContain("rk-pill");
  });

  it("on `/` the control is absent entirely — the hero's field is that action", () => {
    const html = markup(false);
    expect(html).not.toContain("rk-btn-outline");
    expect(html).not.toContain("btn-primary");
  });

  it("both arms carry the wordmark and the two links, so nothing else moved", () => {
    // The hrefs, not the keys: this renders against the real registry, so
    // every sentence resolves to its `TODO(copy)` marker and a key name
    // never reaches the markup. What is stable — and what the rule is
    // actually about — is that the two destinations are still there.
    for (const html of [markup(true), markup(false)]) {
      expect(html).toContain('href="/pricing"');
      expect(html).toContain('href="/signin"');
      expect(html).toContain("rk-wordmark");
    }
  });
});
