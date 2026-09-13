// tests/ui/layout-tokens.test.ts
//
// ADR-093 (DECISIONS 2026-09-02), BP-018 `## Error & edge behavior`: "a
// token missing from `:root` fails a test." Issue #62: `:root` declared no
// `--t-floor`, so check 4 of the conformance suite could not run on any
// route. `src/ui/layout/layout.css` is now the one home of the three
// layout tokens; this file pins its declarations against `BAND_MIN`
// (`src/ui/layout/bands.ts`) in-process — the pinned-value shape —
// so the transcription and the CSS cannot silently diverge without a
// browser run, and asserts the root layout imports the sheet, so every
// route's document carries them (the browser-side twin is
// `tests/ui/layout/layout.test.ts`'s `:root` assertion).
//
// Runs under the jsdom `ui` project — nothing here needs a layout engine;
// it parses CSS with postcss and reads one source file.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Root, type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { CONTENT_MEASURE_PX, SURFACE_GUTTER_PX } from "./layout/checks";

// Issue #349: ADR-093's three tokens are gone. `--t-floor` was the older
// document's name for the 11px bottom of the ladder and is now `--t-eyebrow`,
// the approved set's own name for it; the four `--breakpoint-*` tokens are
// not in the approved set at all, and nothing ever read them — a media query
// cannot read a `var()`. What replaced them is the rule ruling 10a states:
// "breakpoints 640 / 768 / 1024 / 1280", swept below over every stylesheet
// in the product rather than pinned on four declarations nothing consumed.
const THEME_CSS = path.resolve(import.meta.dirname, "../../src/ui/theme.css");
const TYPE_CSS = path.resolve(import.meta.dirname, "../../src/ui/type.css");
const THEME_CSS_PATH = THEME_CSS;
const UI_DIR = path.resolve(import.meta.dirname, "../../src/ui");
const SURFACE_CSS = path.resolve(
  import.meta.dirname,
  "../../src/ui/layout/surface.css",
);
const APP_DIR = path.resolve(import.meta.dirname, "../../src/app");
const ROOT_LAYOUT_TSX = path.resolve(
  import.meta.dirname,
  "../../src/app/layout.tsx",
);

/** Ruling 10a (UI-SPEC §1): "type 15 / 13 / 12 / 11.5 / 11 … nothing under
 *  11px". `--t-eyebrow` is the 11, and it is the floor ADR-093 decision 3
 *  named `--t-floor` before the owner approved a set with its own name for
 *  the same rung. */
const T_FLOOR_PX = 11;

/** Ruling 10a's four, and the only four: "breakpoints 640 / 768 / 1024 /
 *  1280". 1024 and 1280 are also `BAND_MIN.medium` and `BAND_MIN.wide`,
 *  asserted below so the ladder and the layout law cannot drift apart. */
const BREAKPOINTS = [640, 768, 1024, 1280] as const;
const BREAKPOINT_SM_PX = 640;

/** Every `.css` file under a directory. */
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

function rootDecls(source: string): Map<string, string> {
  const root: Root = postcss.parse(source);
  const out = new Map<string, string>();
  for (const node of root.nodes) {
    if (node.type !== "rule" || (node as Rule).selector !== ":root") continue;
    for (const decl of (node as Rule).nodes) {
      if (decl.type === "decl" && decl.prop.startsWith("--"))
        out.set(decl.prop, decl.value.trim());
    }
  }
  if (out.size === 0) throw new Error('src/ui/theme.css: missing bare ":root" rule');
  return out;
}

describe("ruling 10a — every media query in the product is one of the four ruled breakpoints", () => {
  const decls = rootDecls(readFileSync(THEME_CSS, "utf8"));

  it("the four are 640 / 768 / 1024 / 1280, and two of them are BAND_MIN", () => {
    expect([...BREAKPOINTS]).toEqual([640, 768, 1024, 1280]);
    expect(BAND_MIN.medium).toBe(1024);
    expect(BAND_MIN.wide).toBe(1280);
  });

  it("no stylesheet names a fifth", () => {
    // The sweep is the enumerator, so a sheet added later is in scope by
    // construction — the failure names the file and the value, because the
    // fix is always one of the four, never a new one.
    const offenders: string[] = [];
    for (const file of cssFiles(UI_DIR)) {
      postcss.parse(readFileSync(file, "utf8")).walkAtRules("media", (at: AtRule) => {
        for (const m of at.params.matchAll(/(\d+(?:\.\d+)?)px/g)) {
          const px = Number(m[1]);
          if (!(BREAKPOINTS as readonly number[]).includes(px)) {
            offenders.push(
              `${path.relative(path.resolve(UI_DIR, "../.."), file)}: @media ${at.params}`
            );
          }
        }
      });
    }
    expect(offenders, `media queries outside the ruled four:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every media query is written narrow-first, as a min-width", () => {
    // A `max-width` prelude is the same breakpoint minus a pixel, which is
    // how a fifth value gets in: 1023px is not 1024. Narrow-first keeps the
    // four literal.
    const offenders: string[] = [];
    for (const file of cssFiles(UI_DIR)) {
      postcss.parse(readFileSync(file, "utf8")).walkAtRules("media", (at: AtRule) => {
        if (/\d+px/.test(at.params) && !/min-width/.test(at.params)) {
          offenders.push(`${path.basename(file)}: @media ${at.params}`);
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("--t-eyebrow is 11px — the floor of ruling 10a's ladder, never lower", () => {
    expect(decls.get("--t-eyebrow")).toBe(`${T_FLOOR_PX}px`);
  });

  it("layout.css declares no token of its own — theme.css is the one home", () => {
    // Until issue #349 this asserted that `layout.css` declared exactly its
    // four and no fifth. Every approved token lives in `src/ui/theme.css`
    // now, and `tests/ui/design/token-set.test.ts` holds that file equal to
    // the approved file in both directions — the same guarantee over the
    // whole set rather than over four of it. What is left to say here is
    // that this sheet does not start a second home.
    const layout = readFileSync(
      path.resolve(import.meta.dirname, "../../src/ui/layout/layout.css"),
      "utf8"
    );
    expect(layout).not.toMatch(/^\s*--[a-z0-9-]+\s*:/m);
  });

  it("mutation: a fifth breakpoint is caught", () => {
    const mutated = "@media (min-width: 900px) { .x { color: red; } }";
    const found: number[] = [];
    postcss.parse(mutated).walkAtRules("media", (at: AtRule) => {
      for (const m of at.params.matchAll(/(\d+)px/g)) found.push(Number(m[1]));
    });
    expect(found.some((px) => !(BREAKPOINTS as readonly number[]).includes(px))).toBe(true);
  });
});

describe("src/app/layout.tsx imports src/ui/layout/layout.css, so every route's :root carries the tokens", () => {
  it("imports @/ui/layout/layout.css", () => {
    expect(readFileSync(ROOT_LAYOUT_TSX, "utf8")).toMatch(
      /import\s+["']@\/ui\/layout\/layout\.css["']/,
    );
  });
});

/* ── src/ui/layout/surface.css — the rendering half (issue #241) ──────── */

/** Every `:root` declaration in a stylesheet, merged in source order. */
function rootTokens(source: string): Map<string, string> {
  const root: Root = postcss.parse(source);
  const out = new Map<string, string>();
  root.walkRules(":root", (rule) => {
    for (const node of rule.nodes) {
      if (node.type === "decl" && node.prop.startsWith("--"))
        out.set(node.prop, node.value.trim());
    }
  });
  return out;
}

/** The `min-width` prelude of every media query in a stylesheet, in px. */
function minWidths(source: string): number[] {
  const root: Root = postcss.parse(source);
  const out: number[] = [];
  root.walkAtRules("media", (at: AtRule) => {
    const m = /min-width:\s*(\d+)px/.exec(at.params);
    if (m) out.push(Number(m[1]));
  });
  return [...new Set(out)].sort((a, b) => a - b);
}

/** `--rk-gutter` as declared for `[data-surface]` at the top level and
 *  inside each media query: band → the `--s-N` token name it reads. */
function gutterSteps(source: string): {
  top?: string;
  byQuery: Map<number, string>;
} {
  const root: Root = postcss.parse(source);
  let top: string | undefined;
  const byQuery = new Map<number, string>();
  root.walkDecls("--rk-gutter", (decl) => {
    const step = /var\((--s-\d)\)/.exec(decl.value.trim())?.[1];
    if (!step) return;
    const at = decl.parent?.parent;
    if (at && at.type === "atrule" && (at as AtRule).name === "media") {
      const px = /min-width:\s*(\d+)px/.exec((at as AtRule).params)?.[1];
      if (px) byQuery.set(Number(px), step);
    } else {
      top = step;
    }
  });
  return { top, byQuery };
}

const SURFACE_SOURCE = readFileSync(SURFACE_CSS, "utf8");

describe("issue #241 — surface.css declares the ruled spacing steps and measures on :root", () => {
  const tokens = rootTokens(readFileSync(THEME_CSS_PATH, "utf8"));

  it("the three spacing steps are design/tokens.md §2's, and are the gutters check 5 asserts", () => {
    expect(tokens.get("--s-4")).toBe(`${SURFACE_GUTTER_PX.compact}px`);
    expect(tokens.get("--s-5")).toBe(`${SURFACE_GUTTER_PX.medium}px`);
    expect(tokens.get("--s-6")).toBe(`${SURFACE_GUTTER_PX.wide}px`);
  });

  it("the two content measures are §2b's own values", () => {
    expect(tokens.get("--w-read")).toBe(`${CONTENT_MEASURE_PX.read}px`);
    expect(tokens.get("--w-wide")).toBe(`${CONTENT_MEASURE_PX.wide}px`);
  });

  it("§2b's construction holds: each measure is its breakpoint less 2 × --s-6", () => {
    // "One construction, so a third does not get minted: the breakpoint
    // above the content, less 2 × `--s-6` of air." --breakpoint-md (768) is
    // not a band boundary and has no home in `bands.ts`; --breakpoint-xl is
    // `BAND_MIN.wide`, and that half is checked against it here.
    expect(CONTENT_MEASURE_PX.wide + 2 * SURFACE_GUTTER_PX.wide).toBe(
      BAND_MIN.wide,
    );
    expect(CONTENT_MEASURE_PX.read + 2 * SURFACE_GUTTER_PX.wide).toBe(768);
  });

  it("mutation: a drifted measure is caught", () => {
    const mutated = SURFACE_SOURCE.replace(
      "--w-read: 704px;",
      "--w-read: 720px;",
    );
    expect(rootTokens(mutated).get("--w-read")).not.toBe(
      `${CONTENT_MEASURE_PX.read}px`,
    );
  });
});

describe("issue #241 — surface.css's media queries are BAND_MIN, and each band its own step", () => {
  it("the only two min-widths are BAND_MIN.medium and BAND_MIN.wide", () => {
    expect(minWidths(SURFACE_SOURCE)).toEqual([BAND_MIN.medium, BAND_MIN.wide]);
  });

  it("the gutter rises --s-4 → --s-5 → --s-6 at those two boundaries", () => {
    const { top, byQuery } = gutterSteps(SURFACE_SOURCE);
    expect(top).toBe("--s-4");
    expect(byQuery.get(BAND_MIN.medium)).toBe("--s-5");
    expect(byQuery.get(BAND_MIN.wide)).toBe("--s-6");
  });
});

describe("issue #241 — every arm the route tree declares has a rule in surface.css", () => {
  /** Every `count: N` a `{ kind: "columns" }` arm names under `src/app`. */
  function declaredCounts(
    dir: string,
    out: Set<number> = new Set(),
  ): Set<number> {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        declaredCounts(full, out);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      const source = readFileSync(full, "utf8");
      for (const m of source.matchAll(/kind:\s*"columns",\s*count:\s*(\d+)/g)) {
        out.add(Number(m[1]));
      }
    }
    return out;
  }

  it("a count with no `grid-template-columns` rule fails here, not on the screen", () => {
    // Rule 5.5's shape: the enumerator is the route tree, so an arm added
    // later is in scope by construction. Today the tree declares 1 and 2;
    // a screen that declares three columns adds three rows to `surface.css`
    // — one per band — and this test is where it learns that.
    const counts = [...declaredCounts(APP_DIR)].sort((a, b) => a - b);
    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) {
      for (const band of ["compact", "medium", "wide"] as const) {
        const selector = `[data-surface][data-arm-${band}="columns:${n}"]`;
        expect(SURFACE_SOURCE, `${selector} has no rule`).toContain(selector);
      }
    }
  });
});

describe("src/app/layout.tsx imports src/ui/layout/surface.css, so every route renders the law", () => {
  it("imports @/ui/layout/surface.css", () => {
    expect(readFileSync(ROOT_LAYOUT_TSX, "utf8")).toMatch(
      /import\s+["']@\/ui\/layout\/surface\.css["']/,
    );
  });
});

/* ── src/ui/type.css — §4's narrow-viewport heading step (issue #258) ──── */

describe("issue #258 — the h1 step below 640px is written narrow-first", () => {
  const TYPE_SOURCE = readFileSync(TYPE_CSS, "utf8");

  it("the only media literal in type.css is 640px, as a min-width", () => {
    // A media query cannot read a `var()`, so the literal inside an
    // `@media` prelude is the one raw value a stylesheet still admits, and
    // it must be one of ruling 10a's four. Narrow-first, so it is never a
    // breakpoint minus one pixel.
    const preludes: string[] = [];
    postcss.parse(TYPE_SOURCE).walkAtRules("media", (at: AtRule) => {
      preludes.push(at.params.trim());
    });
    expect(preludes).toEqual([`(min-width: ${BREAKPOINT_SM_PX}px)`]);
  });

  it("that literal is one of the ruled four — one ladder, one set of steps", () => {
    expect((BREAKPOINTS as readonly number[]).includes(BREAKPOINT_SM_PX)).toBe(true);
  });

  it("below it h1 takes --h2, above it --h1 — BUILD §2.3's own words, no new size", () => {
    // §2.3, as amended 2026-09-08: "Below 640 px the h1 takes the h2 size."
    // So the narrow rule reads the h2 token by name and mints nothing.
    const narrow = /^h1 \{ font-size: var\(--h2\); \}$/m;
    expect(TYPE_SOURCE, "the default h1 rule must read --h2").toMatch(narrow);
    expect(
      TYPE_SOURCE.slice(TYPE_SOURCE.indexOf("@media (min-width: 640px)")),
      "the min-width rule must restore --h1",
    ).toMatch(/h1 \{\s*font-size: var\(--h1\);\s*\}/);
  });

  it("no size below the floor is minted on the way (ADR-093 d3, ruling 10a)", () => {
    const minted = [...TYPE_SOURCE.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) =>
      Number(m[1]),
    );
    for (const px of minted) expect(px, `${px}px is under the floor`).toBeGreaterThanOrEqual(T_FLOOR_PX);
  });
});
