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
import { headingsUnderTitle, parseMarkdown, toHtml } from "@/lib/publish/render/markdown";
import { LEGAL_BODY_CLASSES, legalBodyHtml } from "@/app/(public)/_legal/LegalPage.tsx";
import { legalSections } from "@/app/(public)/_legal/sections";
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
/** The screen's other half since #936: the anchors the *On this page* list
 *  links to are put on block by block there, which is the one place
 *  `toHtml` is now called from. Both files are held to the rule below. */
const SECTIONS = "_legal/sections.ts";

/** The three routes, each with the document it reads. */
const ROUTES = [
  { file: "privacy/page.tsx", Page: PrivacyPage, title: "legal.privacy.title", updated: "legal.privacy.updated", document: "legal.privacy.body" },
  { file: "terms/page.tsx", Page: TermsPage, title: "legal.terms.title", updated: "legal.terms.updated", document: "legal.terms.body" },
  { file: "imprint/page.tsx", Page: ImprintPage, title: "legal.imprint.title", updated: "legal.imprint.updated", document: "legal.imprint.body" },
] as const;

describe('S5 — "One renderer for the three routes"', () => {
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

describe("S5 — the screen: eyebrow, title, updated line, one card", () => {
  for (const route of ROUTES) {
    describe(route.file, () => {
      const html = renderToStaticMarkup(<route.Page />);

      it("speaks the eyebrow, the title, the updated line and the body — every one a key", () => {
        expect(html).toContain(copy("legal.eyebrow"));
        expect(html).toContain(copy(route.title));
        expect(html).toContain(copy("legal.updated", { date: copy(route.updated) }));
        // Every heading and every block of the body, through the one renderer; a list the
        // board draws as a table is the provider test's.
        const sections = legalSections(headingsUnderTitle(parseMarkdown(copy(route.document))), LEGAL_BODY_CLASSES);
        for (const section of sections) {
          if (section.headingHtml !== "") expect(html).toContain(section.headingHtml);
          for (const block of section.blocks) {
            if (section.heading?.id === "service-providers" && block.kind === "list") continue;
            expect(html).toContain(toHtml([block], LEGAL_BODY_CLASSES));
          }
        }
      });

      it("the eyebrow stands above the title, and the title is the page's one h1", () => {
        expect(html.indexOf(copy("legal.eyebrow"))).toBeLessThan(html.indexOf("<h1"));
        expect(html.match(/<h1/g)).toHaveLength(1);
      });

      it("one card, and the document is inside it", () => {
        expect(html.match(/class="card[ "]/g)).toHaveLength(1);
        expect(html).toContain('data-testid="legal-document"');
        expect(html).not.toContain("rk-doc");
      });

      it("no control, no field: a legal page asks for nothing", () => {
        expect(html).not.toContain("<button");
        expect(html).not.toContain("<input");
        expect(html).not.toContain("<form");
      });
    });
  }
});

describe("S5 — the Markdown body goes through the product's one renderer", () => {
  it("the screen spends the one renderer's parse and serialiser and defines no second renderer", () => {
    // Both halves of the screen, together. #936 moved the serialiser call
    // into `sections.ts` so each section heading can carry the `id` the
    // contents list links to; the rule is unchanged and is about the pair
    // — the screen parses with the one renderer and serialises with the
    // one renderer, and neither file grows a second one.
    const screen = body(RENDERER);
    const sections = body(SECTIONS);
    const both = `${screen}\n${sections}`;
    expect(both).toContain("parseMarkdown");
    expect(both).toContain("toHtml");
    expect(screen).toContain("@/lib/publish/render/markdown");
    expect(sections).toContain("@/lib/publish/render/markdown");
    // No parsing of its own: the one renderer is the whole rule (DECISIONS
    // 2026-09-06, #119), and a screen that split a body on newlines would
    // be the second one. `sections.ts` may only *cut* the parsed blocks.
    expect(screen).not.toMatch(/\.split\(|\bmarked\b|remark|micromark/);
    expect(sections).not.toMatch(/\bmarked\b|remark|micromark/);
  });

  it("the body is rendered as Markdown, not printed as a string", () => {
    // The owner's notice (approved 2026-09-10, #459) opens with a `##`
    // heading: a body that went through the renderer carries a heading for
    // it and no hash marks; a body that was printed carries the hash marks.
    //
    // **It is an `<h2>` since the owner's 2026-09-23 ruling on #328.** This
    // body's shallowest heading is its `##`, so it is the one that sits
    // directly under the page's `<h1>` — and it used to arrive as an `<h3>`,
    // skipping `h2` on a page whose only other heading is that `<h1>`.
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(copy("legal.privacy.body")).toMatch(/^## 1\. Who we are\n/);
    expect(html).toMatch(/<h2 id="who-we-are"[^>]*>1\. Who we are<\/h2>/);
    expect(html).not.toMatch(/<h3[^>]*>1\. Who we are<\/h3>/);
    expect(html).not.toContain("## 1. Who we are");
  });

  it("the card carries no head — the page's h1 already names the document", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    const card = html.slice(html.indexOf('class="card '));
    expect(html.match(/<h1/g)).toHaveLength(1);
    // No head **of the card's own**, and never a second `<h1>`. `<h2>` is
    // not in this list any more (#328, 2026-09-23): the body's own section
    // headings are `<h2>` now, which is the point of that ruling — they are
    // the level under the page's title. What this row is about is that the
    // card does not *add* a head above them.
    expect(card).not.toMatch(/card-title|<h1/);
    expect(card).not.toMatch(/<h2[^>]*class="[^"]*card-title/);
  });
});

describe("S5 — the body's headings take the ladder (issue #493)", () => {
  // The page's title is its one `<h1>`, so a body heading sits one level
  // under it: a `##` renders as an `<h3>`, which is the `--h3` the set's
  // `.doc h2` draws, reached by the ladder's own step rather than by an
  // `<h2>` restyled to 20px (which the heading-scale sweep refuses).
  const md = "# Heading one\n\nText.\n\n## Heading two\n\nText.\n\n### Heading three";

  it("every heading the renderer emits is one level under the page's h1", () => {
    const html = legalBodyHtml(md);
    // `[^>]*` and not `class="[^"]*"`: since #936 a section heading also
    // carries the `id` the contents list links to, which sits before the
    // class. The level is what this row is about, and the level is
    // unchanged.
    expect(html).toMatch(/<h2[^>]*>Heading one<\/h2>/);
    expect(html).toMatch(/<h3[^>]*>Heading two<\/h3>/);
    expect(html).toMatch(/<h4[^>]*>Heading three<\/h4>/);
    // Never a second h1, and no `##` left at the level it would have to be
    // restyled off.
    expect(html).not.toContain("<h1");
    expect(html.match(/<h2/g)).toHaveLength(1);
    // Each heading still carries the renderer's own class map.
    for (const level of [2, 3, 4]) expect(html).toMatch(new RegExp(`<h${level}[^>]*class="[^"]+"`));
  });

  it("only the section headings get an anchor, and it is their own words (#936)", () => {
    const html = legalBodyHtml(md);
    // The shallowest level is the section level — here `#`, which demotes
    // to `<h2>`. A deeper heading is a subsection and is not in the list,
    // so it takes no anchor.
    expect(html).toMatch(/<h2 id="heading-one"/);
    expect(html).not.toMatch(/<h3 id=/);
    expect(html).not.toMatch(/<h4 id=/);
  });

  it("a body that opens at `##` starts at h2 too — no level is skipped under the page's h1", () => {
    // Owner ruling 2026-09-23 (#328). The shift is computed from the body,
    // not assumed: whatever depth the shallowest heading was written at, it
    // becomes the `<h2>` under the page's `<h1>`, and the rest keep their
    // distance from it. This is the shape every legal body the owner has
    // written actually has — the fixture above opens at `#` and is the
    // other one.
    const html = legalBodyHtml("## Section\n\nText.\n\n### Under it\n\nText.");
    expect(html).toMatch(/<h2[^>]*>Section<\/h2>/);
    expect(html).toMatch(/<h3[^>]*>Under it<\/h3>/);
    expect(html).not.toContain("<h1");
    // And the anchor the contents list links to is still on the section.
    expect(html).toMatch(/<h2 id="section"/);
  });

  it("a body heading carries no size of its own — the type ladder's element step decides it", () => {
    const html = legalBodyHtml(md);
    expect(html).not.toMatch(/<h[2-6] class="(?:[^"]* )?text-(?:xs|sm|base|lg|xl|\dxl)[ "]/);
  });
});

describe("S5 — the three routes read nothing", () => {
  it("no session, no cookie, no store, on the renderer or on any route", () => {
    for (const file of [RENDERER, ...ROUTES.map((route) => route.file)]) {
      const src = body(file);
      expect(src, file).not.toMatch(/\bcookies\b|\bheaders\(\)/);
      expect(src, file).not.toMatch(/currentSession|hasActiveAccess/);
      expect(src, file).not.toMatch(/db\b|supabase/i);
    }
  });
});
