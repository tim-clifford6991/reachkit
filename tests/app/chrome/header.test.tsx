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
// **The right slot is a closed union.** Three arms — the pair, the landing's
// field CTA, and the report address's copy control beside the pair — chosen
// by `headerActionFor`, which this file asserts per route (issue 714).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Header, headerActionFor, type HeaderAction } from "@/app/(public)/_chrome/Header";

function markup(action: HeaderAction): string {
  return renderToStaticMarkup(<Header action={action} />);
}

function withoutThemeToggle(html: string): string {
  return html.replace(/<div[^>]*data-testid="theme-toggle"[\s\S]*?<\/ul><\/div>/, "");
}

const LANDING: HeaderAction = { kind: "landing" };
const ELSEWHERE: HeaderAction = { kind: "cta" };
const REPORT: HeaderAction = {
  kind: "copy-link",
  canonicalUrl: "https://reachkit.app/scan/example.com",
};

describe("SPEC §1, owner 2026-09-15 (issue 714) — the same bar on the report, token pages and sign-in", () => {
  it("the veto, opt-out and sign-in routes take the plain pair; the landing takes its field CTA", () => {
    for (const path of ["/veto/a-token", "/opt-out/a-token", "/signin", "/pricing"]) {
      expect(headerActionFor(path)).toEqual(ELSEWHERE);
    }
    expect(headerActionFor("/")).toEqual(LANDING);
    expect(["copy-link", "cta"]).toContain(headerActionFor("/scan/example.com").kind);
  });

  it("the report keeps its copy control beside Sign in and the one outline CTA", () => {
    const html = withoutThemeToggle(markup(REPORT));
    expect(html).toContain('href="/signin"');
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
    // No `<button>` in the CTA slot: a navigation with no client runtime,
    // which is what an anchor is for. The theme control (#681) is the
    // header's own and is lifted out first.
    expect(withoutThemeToggle(html)).not.toContain("<button");
  });

  it("#681 — every arm carries the Light / Dark / System control", () => {
    for (const action of [LANDING, ELSEWHERE, REPORT]) {
      expect(markup(action)).toContain('data-testid="theme-toggle"');
    }
    expect(markup(ELSEWHERE).match(/data-theme-choice="(light|dark|system)"/g)).toHaveLength(3);
  });

  it("on the landing the CTA is a button that focuses the field, never a second submit (REQ-099 c3, REQ-001 c1)", () => {
    const html = markup(LANDING);
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });
});
