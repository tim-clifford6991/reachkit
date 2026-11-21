// Every class a hosted page carries has a rule in the built `/style.css`, so a class the sheet's
// scoped scan misses fails here and not on a customer's live page.
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { HOSTED_BODY_CLASSES, HOSTED_GUIDES_CLASSES } from "@/app/(hosted)/hosted-page/body-classes";
import { toHtml, type Block, type Inline } from "@/lib/publish/render/markdown";
import { BAND_MIN } from "@/ui/layout/bands";
import { getBaseURL, withPage } from "./browser";
import { PUBLISHED_HOST_FIXTURES } from "./routes";
import { PUBLISHER_PAGE } from "./seed-rows";

const HOST = Object.values(PUBLISHED_HOST_FIXTURES)[0] as string;

/** Lucide's own hooks on every icon: it draws by attributes, and no sheet styles them. */
const NO_RULE = /^lucide(-[\w-]+)?$/;

const text = (t: string): Inline[] => [{ kind: "text", text: t }];
const phrase: Inline[] = [
  { kind: "code", text: "x" },
  { kind: "strong", children: text("s") },
  { kind: "em", children: text("e") },
  { kind: "link", href: "https://example.org/", children: text("l") },
  { kind: "mark", children: text("m") },
];

/** One of every block the renderer draws, every alignment a table column can declare. */
const EVERY_BLOCK: Block[] = [
  { kind: "heading", level: 2, children: text("h") },
  { kind: "paragraph", children: phrase },
  { kind: "quote", children: text("q") },
  { kind: "list", ordered: false, items: [text("a")] },
  { kind: "list", ordered: false, leadIn: true, items: [text("a")] },
  { kind: "list", ordered: true, items: [text("a")] },
  { kind: "code", text: "x" },
  { kind: "rule" },
  { kind: "table", label: "t", head: [text("a"), text("b"), text("c"), text("d")], rows: [[text("1"), text("2"), text("3"), text("4")]], align: ["left", "center", "right", null] },
  { kind: "answer", label: "a", children: [{ kind: "paragraph", children: text("p") }] },
  { kind: "takeaways", label: "k", children: [{ kind: "list", ordered: false, items: [text("a")] }] },
];
const GUIDES: Block[] = [{ kind: "guides", label: "g", items: [{ href: "https://example.org/", label: "g" }] }];

function addressOf(path: string): string {
  const url = new URL(`${getBaseURL()}${path}`);
  url.hostname = HOST;
  return url.toString();
}

function classesIn(html: string): string[] {
  const decoded = (value: string) =>
    value.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return [...html.matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => decoded(m[1] ?? "").split(/\s+/)).filter((t) => t !== "");
}

function classesStyledBy(css: string): Set<string> {
  const styled = new Set<string>();
  postcss.parse(css).walkRules((rule) => {
    for (const m of rule.selector.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-]|[^\x00-\x7f])+)/g)) {
      styled.add(
        (m[1] ?? "").replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16))).replace(/\\(.)/g, "$1")
      );
    }
    // `prose` styles its opt-out by attribute (`[class~="not-prose"]`), never as a class selector.
    for (const m of rule.selector.matchAll(/\[class~="([^"]+)"\]/g)) styled.add(m[1] ?? "");
  });
  return styled;
}

describe("the hosted stylesheet styles every class a hosted page carries", () => {
  it(
    "the article, the listing, the not-found page and every rendered block",
    async () => {
      const { css, pages } = await withPage(BAND_MIN.compact, async (page) => {
        const sheet = await page.goto(addressOf("/style.css"));
        if (sheet === null) throw new Error("tests/ui/layout/hosted-classes.test.ts: /style.css produced no response");
        const css = await sheet.text();
        const pages: string[] = [];
        for (const path of [`/${PUBLISHER_PAGE.slug}`, "/", "/no-such-page"]) {
          await page.goto(addressOf(path));
          pages.push(await page.content());
        }
        return { css, pages };
      });
      const rendered = [toHtml(EVERY_BLOCK, HOSTED_BODY_CLASSES), toHtml(GUIDES, HOSTED_GUIDES_CLASSES)];
      const styled = classesStyledBy(css);
      const carried = new Set([...pages, ...rendered].flatMap(classesIn));
      expect(carried).toContain("text-right");
      expect([...carried].filter((token) => !styled.has(token) && !NO_RULE.test(token))).toEqual([]);
    },
    120_000
  );
});
