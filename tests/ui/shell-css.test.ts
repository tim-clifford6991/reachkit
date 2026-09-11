// tests/ui/shell-css.test.ts — BUILD §4.4, §2.2; ADR-093
//
// `src/ui/layout/shell.css` is the sidebar's stylesheet — one of the five
// surfaces `SPEC.md` §2.2 admits custom CSS for. Two numbers in it are the
// spec's, not the author's, and a media query prelude cannot read a `var()`
// (see `layout.css`'s own header), so both are written literally there and
// pinned back here — the `tests/pins.test.ts` shape `layout-tokens.test.ts`
// already uses for `layout.css`.
//
// Runs under the jsdom `ui` project: nothing here needs a layout engine, it
// parses CSS with postcss and reads two source files.
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Root, type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";

/** `SPEC.md` §4.4, verbatim: "Left sidebar (222px, sticky)". */
const SIDEBAR_WIDTH_PX = 222;

const SHELL_CSS_PATH = path.resolve(import.meta.dirname, "../../src/ui/layout/shell.css");
const SHELL_CSS = readFileSync(SHELL_CSS_PATH, "utf8");
const APP_LAYOUT_PATH = path.resolve(
  import.meta.dirname,
  "../../src/app/(account)/app/layout.tsx"
);

const root: Root = postcss.parse(SHELL_CSS);

function declsOf(selector: string, within?: AtRule): Map<string, string> {
  const container = within ?? root;
  const rule = (container.nodes ?? []).find(
    (n): n is Rule => n.type === "rule" && n.selector === selector
  );
  if (!rule) throw new Error(`src/ui/layout/shell.css: missing rule "${selector}"`);
  const out = new Map<string, string>();
  for (const node of rule.nodes) {
    if (node.type === "decl") out.set(node.prop, node.value.trim());
  }
  return out;
}

function mediaRules(): AtRule[] {
  return root.nodes.filter((n): n is AtRule => n.type === "atrule" && n.name === "media");
}

describe('BUILD §4.4 — "Left sidebar (222px, sticky)"', () => {
  it("--w-sidebar is 222px, declared once, and this sheet declares no token of its own", () => {
    // Until issue #349 the token was scoped to `.rk-shell`, because §2.1's
    // `:root` refused anything it did not state. `design/tokens.md` §2b
    // names `--w-sidebar`, so it now lives in `src/ui/theme.css` with the
    // rest of the approved set and this sheet reads it. What the assertion
    // still holds is the property that mattered: **one** declaration, and
    // not a second home here.
    const theme = readFileSync(
      path.resolve(import.meta.dirname, "../../src/ui/theme.css"),
      "utf8"
    );
    expect(theme).toMatch(new RegExp(`--w-sidebar:\\s*${SIDEBAR_WIDTH_PX}px;`));
    expect(SHELL_CSS).not.toMatch(/^\s*:root\s*\{/m);
    expect(SHELL_CSS, "the shell declares no token of its own").not.toMatch(
      /^\s*--[a-z0-9-]+\s*:/m
    );
  });

  it("the sidebar's width and flex basis both come from the token, never a second 222", () => {
    const [media] = mediaRules();
    expect(media).toBeDefined();
    const sidebar = declsOf(".rk-sidebar", media);
    expect(sidebar.get("width")).toBe("var(--w-sidebar)");
    expect(sidebar.get("flex")).toBe("0 0 var(--w-sidebar)");
    // **No** literal 222 among the declarations now (issue #349): the one
    // that was here was the token's own, and the token moved to
    // `theme.css`. The assertion is the same property one step stronger —
    // this sheet spends the width only by name.
    // (Comments are excluded — they quote §4.4's sentence, which contains it.)
    const values: string[] = [];
    root.walkDecls((decl) => {
      values.push(decl.value);
    });
    expect(values.filter((v) => v.includes(String(SIDEBAR_WIDTH_PX)))).toEqual([]);
  });

  it("the column stretches and its contents stick — never the other way round", () => {
    // A sticky element that is itself a stretched flex item has no free
    // space to stick within, so it never sticks. The split is what makes
    // §4.4's "sticky" true once a screen is long enough for it to matter.
    const [media] = mediaRules();
    const sidebar = declsOf(".rk-sidebar", media!);
    const inner = declsOf(".rk-sidebar-inner", media!);
    expect(sidebar.get("position")).toBeUndefined();
    expect(inner.get("position")).toBe("sticky");
    expect(inner.get("top")).toBe("0");
    expect(declsOf(".rk-shell-body", media!).get("align-items")).toBe("stretch");
  });
});

describe('BUILD §4.4 — "Mobile: sidebar hidden, top tabs", at --breakpoint-lg', () => {
  it("there is exactly one media query, and its boundary is BAND_MIN.medium", () => {
    const media = mediaRules();
    expect(media).toHaveLength(1);
    expect(media[0]?.params).toBe(`(min-width: ${BAND_MIN.medium}px)`);
  });

  it("below it the sidebar is hidden and the top header shows; above, the reverse", () => {
    expect(declsOf(".rk-sidebar").get("display")).toBe("none");
    expect(declsOf(".rk-shell-top").get("display")).toBe("flex");

    const [media] = mediaRules();
    expect(declsOf(".rk-sidebar", media!).get("display")).toBe("block");
    expect(declsOf(".rk-shell-top", media!).get("display")).toBe("none");
  });

  it("mutation: a drifted breakpoint is caught", () => {
    const mutated = postcss.parse(SHELL_CSS.replace("(min-width: 1024px)", "(min-width: 900px)"));
    const media = mutated.nodes.filter(
      (n): n is AtRule => n.type === "atrule" && n.name === "media"
    );
    expect(media[0]?.params).not.toBe(`(min-width: ${BAND_MIN.medium}px)`);
  });
});

// ── Issue #267 ──────────────────────────────────────────────────────────
describe("the content column's inner gutter — the one edge surface.css cannot reach", () => {
  it("`.rk-main` takes the band's gutter on its start edge, above the sidebar breakpoint", () => {
    const [media] = mediaRules();
    const main = declsOf(".rk-main", media);
    expect(main.get("padding-inline-start")).toBe("var(--rk-gutter)");
  });

  it("**it is `surface.css`'s variable, not a second step**", () => {
    // `--rk-gutter` is declared on `[data-surface]` and rises 16 → 24 → 32
    // with the band. A literal here would be a second spacing vocabulary
    // that stops rising when the container's does.
    const [media] = mediaRules();
    const value = declsOf(".rk-main", media).get("padding-inline-start") ?? "";
    expect(value).toContain("--rk-gutter");
    expect(value).not.toMatch(/\d/);
    expect(SHELL_CSS).not.toMatch(/--rk-gutter\s*:/);
  });

  it("start only — the end edge is the container's, and two would be worse than none", () => {
    const [media] = mediaRules();
    const main = declsOf(".rk-main", media);
    expect(main.has("padding-inline-end")).toBe(false);
    expect(main.has("padding-inline")).toBe(false);
    expect(main.has("padding")).toBe(false);
  });

  it("below the breakpoint it has none: there is no sidebar to be clear of", () => {
    // The sidebar collapses into the header band, `.rk-main` is the only
    // column, and the container's own gutter is the page's air. A gutter
    // here would inset the content twice on one side and once on the other.
    expect(declsOf(".rk-main").has("padding-inline-start")).toBe(false);
  });
});

describe("the sheet reaches every app route, and no other", () => {
  it("the (account)/app layout imports it, so every screen under /app carries it", () => {
    expect(readFileSync(APP_LAYOUT_PATH, "utf8")).toMatch(
      /import\s+["']@\/ui\/layout\/shell\.css["']/
    );
  });

  it("no text is styled below the type floor (ADR-093 decision 3)", () => {
    // The one font-size in the sheet is `--t-eyebrow` itself; a literal px
    // font-size here would be a step below the floor waiting to happen.
    expect(SHELL_CSS).toMatch(/font-size:\s*var\(--t-eyebrow\)/);
    expect(SHELL_CSS).not.toMatch(/font-size:\s*\d/);
  });
});
