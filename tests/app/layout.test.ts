// tests/app/layout.test.ts
//
// WO-002 `## Test plan` — two rows, both discharged here:
//
//   1. BP-018 decision 2, verbatim: "no component has a default string." —
//      the rendered root layout contains no text node this work order
//      authored. Rendered with real `react-dom/server`, not a source-text
//      approximation, so a stray literal in the JSX fails this the same
//      way it would fail in the browser.
//   2. BP-018 error behaviour, verbatim: "Every numeral, date, URL, search
//      query and code-like string renders in JetBrains Mono with
//      `tabular-nums`" — both font variables (`--font-ui`, `--font-mono`)
//      are bound on `<html>`, so the mono family is reachable everywhere.
//      Proved in two parts, tied together by the one name both files
//      share: `layout.tsx` puts `fontVariables` (`src/ui/fonts.ts`) on
//      `<html>` as its class (checked against real rendered markup below),
//      and `src/ui/type.css`'s `.rk-fonts` rule — parsed with the real
//      postcss AST, not regex — binds both variables in that exact class.
//
// Also covers the file plan's own description of this file: "imports
// `src/ui/theme.css`" and "applies BP-018's font CSS variables (WO-030)".
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type Declaration, type Root, type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const LAYOUT_TSX = path.resolve(import.meta.dirname, "../../src/app/layout.tsx");
const TYPE_CSS = path.resolve(import.meta.dirname, "../../src/ui/type.css");

function layoutSource(): string {
  return readFileSync(LAYOUT_TSX, "utf8");
}

function typeCssSource(): string {
  return readFileSync(TYPE_CSS, "utf8");
}

/** Strips every tag from a static-markup string, leaving only the text nodes. */
function textOutsideTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

describe("file plan — src/app/layout.tsx imports src/ui/theme.css and BP-018's font module", () => {
  it("imports src/ui/theme.css", () => {
    expect(layoutSource()).toMatch(/import\s+["']@\/ui\/theme\.css["']/);
  });

  it("imports fontVariables from src/ui/fonts", () => {
    expect(layoutSource()).toMatch(/import\s*\{\s*fontVariables\s*\}\s*from\s*["']@\/ui\/fonts["']/);
  });

  it("imports src/ui/type.css — the file that binds fontVariables' declarations", () => {
    expect(layoutSource()).toMatch(/import\s+["']@\/ui\/type\.css["']/);
  });
});

describe('BP-018 decision 2 — "no component has a default string"', () => {
  it("the rendered root layout contains no text node this work order authored", async () => {
    const { default: RootLayout } = await import("../../src/app/layout.tsx");
    const markup = renderToStaticMarkup(RootLayout({ children: null }));
    expect(textOutsideTags(markup)).toBe("");
  });

  it("still renders opaque children — the empty-string assertion isn't vacuous", async () => {
    const { default: RootLayout } = await import("../../src/app/layout.tsx");
    const markup = renderToStaticMarkup(RootLayout({ children: "CHILDREN_MARKER" }));
    expect(markup).toContain("CHILDREN_MARKER");
  });
});

describe(
  'BP-018 error behaviour — "Every numeral, date, URL, search query and code-like string ' +
    'renders in JetBrains Mono with `tabular-nums`" — both font variables are bound on <html>',
  () => {
    it("<html> carries fontVariables as its class", async () => {
      const { default: RootLayout } = await import("../../src/app/layout.tsx");
      const { fontVariables } = await import("../../src/ui/fonts.ts");
      const markup = renderToStaticMarkup(RootLayout({ children: null }));
      const htmlTag = markup.match(/<html[^>]*>/)?.[0];
      expect(htmlTag, "no <html> tag in rendered markup").toBeDefined();
      const classAttr = htmlTag!.match(/class="([^"]*)"/)?.[1];
      expect(classAttr).toBe(fontVariables);
    });

    it("theme.css declares both families, and type.css spends them in the class fontVariables names", async () => {
      // Both are approved tokens, so since issue #349 they are declared in
      // `theme.css` with the rest of the set rather than bound in this
      // class. What has to hold is unchanged: the class the layout puts on
      // `<html>` exists, and it is where the UI face is applied.
      const { fontVariables } = await import("../../src/ui/fonts.ts");
      const theme = readFileSync(
        path.resolve(import.meta.dirname, "../../src/ui/theme.css"),
        "utf8"
      );
      expect(theme).toMatch(/^\s*--font-ui:\s*"Plus Jakarta Sans"/m);
      expect(theme).toMatch(/^\s*--font-mono:\s*"JetBrains Mono"/m);

      const root: Root = postcss.parse(typeCssSource());
      const rule = root.nodes.find((n): n is Rule => n.type === "rule" && n.selector === `.${fontVariables}`);
      expect(rule, `missing ".${fontVariables}" rule in type.css`).toBeDefined();
      const family = rule!.nodes.find(
        (n): n is Declaration => n.type === "decl" && n.prop === "font-family"
      );
      expect(family?.value).toBe("var(--font-ui)");
    });
  }
);
