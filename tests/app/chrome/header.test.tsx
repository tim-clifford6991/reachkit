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
// **The right slot is a closed union since #357.** Four arms — the pair, the
// landing's field CTA, the report address's copy control, and (since #371) a
// token page's own address — decided by the layout and passed in, so this
// file renders each one directly.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Header, type HeaderAction } from "@/app/(public)/_chrome/Header";

function markup(action: HeaderAction): string {
  return renderToStaticMarkup(<Header action={action} />);
}

const LANDING: HeaderAction = { kind: "landing" };
const ELSEWHERE: HeaderAction = { kind: "cta" };
const REPORT: HeaderAction = {
  kind: "copy-link",
  canonicalUrl: "https://reachkit.app/scan/example.com",
};
const TOKEN_PAGE: HeaderAction = { kind: "address", address: "/veto/a-token" };

describe("S2 — on the report address the right slot is REQ-001 c7's control", () => {
  it("draws the copy control, and neither half of the pair", () => {
    const html = markup(REPORT);
    expect(html).toContain('href="/"');
    expect(html).toContain("btn-ghost");
    expect(html).not.toContain('href="/signin"');
    expect(html).not.toContain("btn-primary");
  });

  it("the address is the one it was handed: the header composes none", () => {
    // The URL reaches the clipboard through a handler, never the markup —
    // so what this holds is that the control took it and drew.
    expect(markup(REPORT)).not.toContain("https://reachkit.app");
  });
});

describe("S6 — on a token page the right slot is the address, quiet", () => {
  it("draws the address in the set's own `.prov`, and neither half of the pair", () => {
    const html = markup(TOKEN_PAGE);
    expect(html).toContain('href="/"');
    expect(html).toContain("/veto/a-token");
    // A reader of a stop link has no account to sign in to and did not come
    // to scan a domain: the set draws no control on that side of the bar.
    expect(html).not.toContain('href="/signin"');
    expect(html).not.toContain("btn-primary");
  });

  it("it is text, not a link: the reader is standing on the address", () => {
    expect(markup(TOKEN_PAGE)).not.toContain('href="/veto/a-token"');
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
      // Pricing is in the footer's Product column; the header is three
      // things and a fourth link is not one of them.
      expect(html).not.toContain('href="/pricing"');
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
    expect(html).toContain('href="/"');
    // No `<button>`: a navigation with no client runtime, which is what an
    // anchor is for.
    expect(html).not.toContain("<button");
  });

  it("on the landing the CTA is a button that focuses the field, never a second submit (REQ-099 c3, REQ-001 c1)", () => {
    const html = markup(LANDING);
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });
});
