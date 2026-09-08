// BUILD §3, UI-SPEC 3a — the public header's three parts (issue #351).
// tests/app/chrome/header.test.tsx
//
// The header is applied by `(public)/layout.tsx`, and the cold-start and
// stopped-state sweeps render each route's own `page.tsx` **without** its
// group layout — which is what makes their counts a screen's own. So the
// header's own shape is asserted here, where it renders.
//
// **What #351 changed, and why the old assertions are gone.** This file
// used to hold #290's reading — "the header carries no solid primary, and
// on `/` it carries no CTA at all" — which came from applying tokens.md
// §9.1's one-solid-primary rule to a control that appears on every screen.
// The owner's ruling 2b of 2026-09-08 supersedes it: "two solid primaries
// per screen are allowed where the artifact draws them (landing: header CTA
// + hero CTA)", and 3a fixes the header as "brand · Sign in (quiet) · one
// solid CTA" on every public route. Both are asserted below, along with the
// property that keeps REQ-001 c1 true on the landing: the CTA there is not
// a submit control, it is the control that focuses the one field.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Header } from "@/app/(public)/_chrome/Header";

function markup(onLanding: boolean): string {
  return renderToStaticMarkup(<Header onLanding={onLanding} />);
}

describe("UI-SPEC 3a — brand · Sign in (quiet) · one solid CTA", () => {
  it("both arms carry the wordmark and the quiet Sign in, and nothing else links out", () => {
    // The hrefs, not the keys: this renders against the real registry, so
    // an owed sentence resolves to its `TODO(copy)` marker and a key name
    // never reaches the markup. What is stable is the destination.
    for (const html of [markup(true), markup(false)]) {
      expect(html).toContain("rk-wordmark");
      expect(html).toContain('href="/signin"');
      expect(html).toContain("rk-btn-outline");
      // 3a moves Pricing to the footer's Product column; the header is
      // three things and a fourth link is not one of them.
      expect(html).not.toContain('href="/pricing"');
    }
  });

  it("every arm carries exactly one solid CTA, at the pill radius (2b)", () => {
    for (const html of [markup(true), markup(false)]) {
      expect(html.split("btn-primary").length - 1).toBe(1);
      expect(html).toContain("rk-pill");
    }
  });

  it("off the landing the CTA is a link to the field's own page", () => {
    const html = markup(false);
    expect(html).toContain('href="/"');
    // No `<button>`: a navigation with no client runtime, which is what an
    // anchor is for.
    expect(html).not.toContain("<button");
  });

  it("on the landing the CTA is a button that focuses the field, never a second submit (REQ-099 c3, REQ-001 c1)", () => {
    const html = markup(true);
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });
});
