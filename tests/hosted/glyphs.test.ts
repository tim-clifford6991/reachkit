// Hosted pages draw lucide's icons through their own map, because the 410
// route cannot call lucide's client `Icon`; each drawing must still be lucide's own.
import { icons } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLYPHS, Glyph } from "@/app/(hosted)/hosted-page/[[...slug]]/chrome";

function pascal(name: string): string {
  return name.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase());
}

/** What an `<svg>` holds, without the element itself. */
function inner(html: string): string {
  return html.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

describe("hosted glyphs", () => {
  it.each(["file-x", "list", "search", "book-open"])("the map carries %s", (name) => {
    expect(Object.keys(GLYPHS)).toContain(name);
  });

  it.each(Object.keys(GLYPHS) as (keyof typeof GLYPHS)[])("every hosted glyph is lucide's path data: %s", (name) => {
    const icon = icons[pascal(name) as keyof typeof icons];
    expect(icon, `lucide has no ${name}`).toBeDefined();
    const lucide = inner(renderToStaticMarkup(createElement(icon)));
    const ours = renderToStaticMarkup(createElement(Glyph, { name }));
    expect(inner(ours)).toBe(lucide);
    expect(ours).toContain(`class="lucide lucide-${name} `);
  });
});
