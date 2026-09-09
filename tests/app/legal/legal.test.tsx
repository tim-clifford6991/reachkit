// tests/app/legal/legal.test.tsx — issue #370
//
// UI-SPEC S5's own suite: "Header · eyebrow Legal · title (owed) · 'updated
// [date]' · one card with the Markdown body (owed) · footer. One renderer
// for the three routes."
//
// **Rendering convention** is `tests/app/pricing/pricing.test.tsx`'s, which
// is the landing suite's: `tests/app/**` runs under Vitest's "node" project,
// so pages render through `react-dom/server`'s `renderToStaticMarkup`, and
// what a static render cannot show is asserted against the module's own
// source.
//
// The header and footer are the group layout's (ruling 3a) and have their
// own suite in `tests/app/chrome/`; nothing here re-tests them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { copy } from "@/lib/presentation/copy";
import PrivacyPage from "@/app/(public)/privacy/page.tsx";
import TermsPage from "@/app/(public)/terms/page.tsx";
import ImprintPage from "@/app/(public)/imprint/page.tsx";

const APP = path.resolve(import.meta.dirname, "../../../src/app/(public)");
const source = (file: string): string => readFileSync(path.join(APP, file), "utf8");

/** A module's source with every comment removed — block, line and JSX. The
 *  assertions below are about what a module *does*, and the headers quote
 *  the very words some of them forbid in code. */
const body = (file: string): string =>
  source(file)
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const RENDERER = "_legal/LegalPage.tsx";

/** The three routes, each with the document it reads. */
const ROUTES = [
  { file: "privacy/page.tsx", Page: PrivacyPage, title: "legal.privacy.title", updated: "legal.privacy.updated", document: "legal.privacy.body" },
  { file: "terms/page.tsx", Page: TermsPage, title: "legal.terms.title", updated: "legal.terms.updated", document: "legal.terms.body" },
  { file: "imprint/page.tsx", Page: ImprintPage, title: "legal.imprint.title", updated: "legal.imprint.updated", document: "legal.imprint.body" },
] as const;

describe('UI-SPEC S5 — "One renderer for the three routes"', () => {
  it("every route renders `LegalPage` and states no sentence of its own", () => {
    for (const route of ROUTES) {
      const src = body(route.file);
      expect(src, `${route.file} does not render the one legal screen`).toContain("LegalPage");
      // The discriminating assertion: a route resolves no copy key, so
      // there is nowhere for a second legal screen to grow. Everything the
      // page says comes from the renderer, and the only thing the route
      // decides is which document.
      expect(src, `${route.file} speaks for itself instead of through the renderer`).not.toContain("copy(");
      expect(src).not.toContain("<main");
      expect(src).not.toContain("Card");
    }
  });

  it("the three routes differ only in the document they name", () => {
    // Each file with its own document constant and page name blanked reads
    // exactly the same as the others: that is what "one renderer" means
    // stated as an assertion rather than as a comment.
    const shapes = ROUTES.map((route) =>
      body(route.file)
        .replace(/PRIVACY|TERMS|IMPRINT/g, "<document>")
        .replace(/Privacy|Terms|Imprint|privacy|terms|imprint/g, "<name>")
        .trim()
    );
    expect(new Set(shapes).size).toBe(1);
  });
});

describe("UI-SPEC S5 — the screen: eyebrow, title, updated line, one card", () => {
  for (const route of ROUTES) {
    describe(route.file, () => {
      const html = renderToStaticMarkup(<route.Page />);

      it("speaks the eyebrow, the title, the updated line and the body — every one a key", () => {
        expect(html).toContain(copy("legal.eyebrow"));
        expect(html).toContain(copy(route.title));
        expect(html).toContain(copy("legal.updated", { date: copy(route.updated) }));
        expect(html).toContain(copy(route.document));
      });

      it("the eyebrow is the eyebrow role, and the title is the page's one h1", () => {
        expect(html).toContain("eyebrow");
        expect(html.match(/<h1/g)).toHaveLength(1);
      });

      it("one card, and the document is inside it", () => {
        expect(html.match(/class="card[ "]/g)).toHaveLength(1);
        expect(html).toContain('class="rk-doc"');
      });

      it("no control, no field: a legal page asks for nothing", () => {
        expect(html).not.toContain("<button");
        expect(html).not.toContain("<input");
        expect(html).not.toContain("<form");
      });
    });
  }
});

describe("UI-SPEC S5 — the Markdown body goes through the product's one renderer", () => {
  it("the screen calls `renderMarkdownHtml` and defines no second renderer", () => {
    const src = body(RENDERER);
    expect(src).toContain("renderMarkdownHtml");
    expect(src).toContain("@/lib/publish/render/markdown");
    // No parsing of its own: the one renderer is the whole rule (DECISIONS
    // 2026-09-06, #119), and a screen that split a body on newlines would
    // be the second one.
    expect(src).not.toMatch(/\.split\(|\bmarked\b|remark|micromark/);
  });

  it("the body is rendered as Markdown, not printed as a string", () => {
    // The marker is one paragraph of Markdown, so the renderer's own
    // paragraph tag around it is the observable difference between a body
    // that went through the renderer and a body that was printed.
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain(`<p>${copy("legal.privacy.body")}</p>`);
  });

  it("the card carries no head — the page's h1 already names the document", () => {
    expect(body(RENDERER)).toContain("title={null}");
  });
});

describe("UI-SPEC S5 — the three routes read nothing", () => {
  it("no session, no cookie, no store, on the renderer or on any route", () => {
    for (const file of [RENDERER, ...ROUTES.map((route) => route.file)]) {
      const src = body(file);
      expect(src, file).not.toMatch(/\bcookies\b|\bheaders\(\)/);
      expect(src, file).not.toMatch(/currentSession|hasActiveAccess/);
      expect(src, file).not.toMatch(/db\b|supabase/i);
    }
  });
});
