// tests/ui/design/tokens-audit.test.ts — §2.1
//
// §2.1, verbatim: "daisyUI 5 theme, expressed as CSS variables. These
// exact values" … and, of the dark block, "Never define a color only
// inside a dark block."
//
// `tests/ui/tokens.test.ts` already checks the theme against §2.1's own
// code fence — that the tokens exist, hold the stated values and are
// declared in all three states. What it cannot see is the rest of the
// tree: a component that writes `#5b4be0` instead of `var(--accent)`
// renders the right colour today, drifts silently on the next theme edit,
// and is invisible in dark mode. This file is the other direction — every
// colour anywhere under `src/**` resolves to a §2.1 token, asserted by
// walking the tree (ADR-010) rather than by a list of files to check.
//
// Four files may write a colour literally, each for a reason no token can
// serve; they are named in `ALLOWED_LITERALS` below with that reason, and
// the values they write are checked back against §2.1's own.
import { describe, expect, it } from "vitest";
import postcss, { type Declaration } from "postcss";
import ts from "typescript";
import { SRC_DIR, read, walkFiles } from "./vocabulary";

/* ── where a colour may be written down ───────────────────────────────── */

const ALLOWED_LITERALS: ReadonlyArray<{ readonly path: string; readonly why: string }> = [
  { path: "src/ui/theme.css", why: "§2.1 itself — the one place the values live" },
  {
    path: "src/ui/tailwind.css",
    why: "the Tailwind 4 entry point: it maps §2.1's tokens onto daisyUI's theme slots (2026-09-05 ruling, #93)",
  },
  {
    path: "src/ui/layout/layout.css",
    why: "ADR-093's layout tokens (2026-09-05 ruling, #65) — a second `:root`, kept out of theme.css so §2.1's stays verbatim",
  },
  {
    path: "src/ui/idiom/idiom.css",
    why:
      "the owner-approved card idiom's four tokens (2026-09-02, issue 266). " +
      "A third `:root`, on the same footing as layout.css's: every value is " +
      "derived from a token §2.1 already states — `--shadow-lift` is §2.1's " +
      "own dark-shadow construction re-inked, `--grad-accent` and the glass " +
      "pair are `--on-accent` at the 12%/28% alphas §2.1 states verbatim, " +
      "and `--on-accent-quiet` is `--on-accent` mixed toward `--accent`. No " +
      "colour is minted and no second accent stop exists",
  },
  {
    path: "src/lib/mail/shell/tokens.ts",
    why: "a mail client resolves no custom property, so the mail shell carries §2.1's values inline (BUILD §12)",
  },
];

const ALLOWED = new Set(ALLOWED_LITERALS.map((entry) => entry.path));

/* ── what counts as a colour written down ─────────────────────────────── */

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_FUNCTION = /\b(color-mix|rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/g;

/** The CSS named colours. Whole list, because a partial one is a rule that
 *  holds until somebody reaches for `rebeccapurple`. `transparent`,
 *  `currentColor` and `inherit` are deliberately absent: they name no
 *  colour of their own and are how a token-driven system says "none". */
const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
   blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
   crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
   darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
   darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
   dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
   gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
   lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
   lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
   lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
   magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
   mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
   mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
   palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
   powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
   seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
   steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
   yellowgreen`
    .trim()
    .split(/\s+/)
);

/** Every colour literal in one blob of CSS-or-string text. */
function colorLiteralsIn(text: string, namedColoursCount: boolean): string[] {
  const out = [...text.matchAll(HEX)].map((m) => m[0]);
  for (const match of text.matchAll(COLOR_FUNCTION)) out.push(`${match[1] ?? ""}(`);
  if (namedColoursCount) {
    for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
      if (NAMED_COLORS.has(word)) out.push(word);
    }
  }
  return out;
}

/** CSS properties whose value is (or contains) a colour. */
const COLOR_PROPERTY =
  /^(?:color|fill|stroke|background|border|outline|box-shadow|text-shadow|caret-color|accent-color|column-rule|text-decoration|text-emphasis)(?:-|$)/;

function declarationsOf(css: string): Declaration[] {
  const out: Declaration[] = [];
  postcss.parse(css).walkDecls((decl) => {
    out.push(decl);
  });
  return out;
}

/** Every string the TypeScript AST holds — literals, template chunks and
 *  JSX text. Comments are not among them, which is the point: a header
 *  comment quoting §2.1's own hex values is not a colour the product
 *  writes, and a regex over the file cannot tell the difference. */
function stringsOf(rel: string): string[] {
  const source = read(rel);
  const sf = ts.createSourceFile(
    rel,
    source,
    ts.ScriptTarget.Latest,
    true,
    rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) out.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      out.push(node.text);
    } else if (ts.isJsxText(node)) out.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/* ── §2.1's own tokens, read from the theme ───────────────────────────── */

const THEME_ROOT: ReadonlyMap<string, string> = (() => {
  const out = new Map<string, string>();
  postcss.parse(read("src/ui/theme.css")).walkRules(":root", (rule) => {
    for (const node of rule.nodes) {
      if (node.type === "decl" && node.prop.startsWith("--")) out.set(node.prop, node.value.trim());
    }
  });
  return out;
})();

const SRC_FILES = walkFiles(SRC_DIR, () => true);
const CSS_FILES = SRC_FILES.filter((f) => f.endsWith(".css"));

/* ── the sweeps ───────────────────────────────────────────────────────── */

/** Every colour written down outside the four files allowed to hold one.
 *  Named colours count in stylesheets and in the design system's own
 *  modules; elsewhere under `src/lib/**` a string is as likely to be the
 *  word "orange" in a sentence as a colour, and the sentence is the copy
 *  registry's problem, not this rule's. */
function literalColoursOutsideTheAllowlist(files: readonly string[]): string[] {
  const out: string[] = [];
  for (const file of files) {
    if (ALLOWED.has(file)) continue;
    if (file.endsWith(".css")) {
      for (const decl of declarationsOf(read(file))) {
        for (const hit of colorLiteralsIn(decl.value, COLOR_PROPERTY.test(decl.prop))) {
          out.push(`${file}: ${decl.prop}: ${decl.value} (${hit})`);
        }
      }
    } else if (/\.tsx?$/.test(file)) {
      const named = file.startsWith("src/ui/");
      for (const text of stringsOf(file)) {
        for (const hit of colorLiteralsIn(text, named && NAMED_COLORS.has(text.toLowerCase()))) {
          out.push(`${file}: ${JSON.stringify(text)} (${hit})`);
        }
      }
    }
  }
  return out.sort();
}

describe('§2.1 — every colour in src/** resolves to a token, "these exact values"', () => {
  it("no file outside the five writes a colour down", () => {
    expect(literalColoursOutsideTheAllowlist(SRC_FILES)).toEqual([]);
  });

  it("mutation: a hex in a component is caught", () => {
    const decls = declarationsOf("a { color: #5b4be0; }");
    expect(decls.flatMap((d) => colorLiteralsIn(d.value, true))).toEqual(["#5b4be0"]);
  });

  it("mutation: an rgb() in a component is caught", () => {
    expect(colorLiteralsIn("rgb(91 75 224 / .18)", true)).toEqual(["rgb("]);
  });

  it("mutation: a named colour in a stylesheet is caught", () => {
    expect(colorLiteralsIn("1px solid rebeccapurple", true)).toEqual(["rebeccapurple"]);
  });

  it("`transparent` and `currentColor` are not colours a token could replace", () => {
    expect(colorLiteralsIn("1px solid transparent", true)).toEqual([]);
    expect(colorLiteralsIn("currentColor", true)).toEqual([]);
  });

  it("each allowed file states why no token can serve it, and still exists", () => {
    for (const entry of ALLOWED_LITERALS) {
      expect(entry.why.length, entry.path).toBeGreaterThan(20);
      expect(SRC_FILES, entry.path).toContain(entry.path);
    }
    expect(ALLOWED_LITERALS).toHaveLength(5);
  });

  it("the three allowed files that are not theme.css write only values theme.css declares", () => {
    const themeValues = new Set([...THEME_ROOT.values()].map((v) => v.toLowerCase()));
    const stray: string[] = [];
    for (const entry of ALLOWED_LITERALS) {
      if (entry.path === "src/ui/theme.css") continue;
      const text = entry.path.endsWith(".css")
        ? declarationsOf(read(entry.path))
            .map((d) => d.value)
            .join(" ")
        : stringsOf(entry.path).join(" ");
      for (const hex of text.match(HEX) ?? []) {
        if (!themeValues.has(hex.toLowerCase())) stray.push(`${entry.path}: ${hex}`);
      }
    }
    expect(stray).toEqual([]);
  });
});

/* ── every colour-valued declaration names a §2.1 token ───────────────── */

/** The card idiom's own colour tokens (issue 266), and the only ones a
 *  declaration may name that §2.1 does not state.
 *
 *  They are listed here by name rather than read from the file, so that a
 *  *sixth* one cannot appear by being written: adding to this list is a
 *  decision someone makes on purpose, which is exactly the property the
 *  rule below is for. Each is derived from a token §2.1 already states —
 *  `design/tokens.md` §9.3 carries the derivations, and `idiom.css`'s own
 *  `:root` block repeats them where the values are. */
const IDIOM_ROOT: ReadonlySet<string> = new Set([
  "--shadow-lift",
  "--grad-accent",
  "--on-accent-quiet",
]);

function nonThemeColourTokens(files: readonly string[]): string[] {
  const out: string[] = [];
  for (const file of files) {
    for (const decl of declarationsOf(read(file))) {
      if (!COLOR_PROPERTY.test(decl.prop)) continue;
      for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
        const token = match[1];
        if (token !== undefined && !THEME_ROOT.has(token) && !IDIOM_ROOT.has(token)) {
          out.push(`${file}: ${decl.prop}: ${token}`);
        }
      }
    }
  }
  return out.sort();
}

describe("§2.1 — a colour-valued declaration names a §2.1 token and nothing else", () => {
  it("every stylesheet under src/ paints only from :root", () => {
    expect(nonThemeColourTokens(CSS_FILES)).toEqual([]);
  });

  it("the idiom's three colour tokens are declared on :root, and are only three", () => {
    // Rule 5.5, and the reason `IDIOM_ROOT` is a written list: the set is
    // closed until someone opens it. Each must actually be declared where
    // it says it is, so the allowance cannot outlive the declaration.
    const root = declarationsOf(read("src/ui/idiom/idiom.css"));
    const declared = new Set(root.filter((d) => d.prop.startsWith("--")).map((d) => d.prop));
    for (const token of IDIOM_ROOT) {
      expect(declared, `${token} is allowed but not declared`).toContain(token);
    }
    expect([...IDIOM_ROOT].sort()).toEqual(["--grad-accent", "--on-accent-quiet", "--shadow-lift"]);
  });

  it("theme.css's :root is the authority, and holds §2.1's colour tokens", () => {
    for (const token of ["--bg", "--surface", "--ink", "--accent", "--chart-you", "--chart-rival"]) {
      expect(THEME_ROOT.has(token), token).toBe(true);
    }
  });

  it("mutation: a component-local colour token that :root does not declare is caught", () => {
    const decls = declarationsOf(".rk-cal-cell { background: var(--cell-bg); }");
    const found = decls
      .filter((d) => COLOR_PROPERTY.test(d.prop))
      .flatMap((d) => [...d.value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]))
      .filter((token) => token !== undefined && !THEME_ROOT.has(token));
    expect(found).toEqual(["--cell-bg"]);
  });
});

/* ── nothing references a token that does not exist ───────────────────── */

describe("§2.1 — no reference to a token nothing declares", () => {
  const declared = new Set<string>();
  for (const file of SRC_FILES) {
    if (!/\.(css|tsx?)$/.test(file)) continue;
    for (const match of read(file).matchAll(/(?:^|[;{\s"'])(--[\w-]+)\s*:/gm)) {
      if (match[1] !== undefined) declared.add(match[1]);
    }
  }

  /** What the product actually paints with, comments excluded: CSS
   *  declaration values, and the strings the TypeScript AST holds. A
   *  screen's comment explaining that daisyUI's badge is `height:
   *  var(--size)` is not a reference to a token this repo owes. */
  function tokenReferences(file: string): string[] {
    const blobs = file.endsWith(".css")
      ? declarationsOf(read(file)).map((decl) => decl.value)
      : stringsOf(file);
    return blobs.flatMap((blob) =>
      [...blob.matchAll(/var\(\s*(--[\w-]+)/g)]
        .map((match) => match[1])
        .filter((token): token is string => token !== undefined)
    );
  }

  it("every var(--token) under src/ resolves to a declaration under src/", () => {
    const dangling: string[] = [];
    for (const file of SRC_FILES) {
      if (!/\.(css|tsx?)$/.test(file)) continue;
      for (const token of tokenReferences(file)) {
        if (!declared.has(token)) dangling.push(`${file}: ${token}`);
      }
    }
    expect([...new Set(dangling)].sort()).toEqual([]);
  });

  it("a var() a comment merely quotes is not a reference", () => {
    // The case this reads through declarations rather than raw text for:
    // a screen explaining in a comment that daisyUI's badge is
    // `height: var(--size)` owes this repo no `--size` token.
    expect(tokenReferences("src/ui/layout/shell.css").length).toBeGreaterThan(0);
    const decls = declarationsOf("/* height: var(--size) */ .x { color: var(--ink); }");
    const seen = decls.flatMap((decl) =>
      [...decl.value.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1])
    );
    expect(seen).toEqual(["--ink"]);
  });

  it("mutation: a renamed token leaves its references dangling, and that is caught", () => {
    expect(declared.has("--accent")).toBe(true);
    expect(declared.has("--accent-renamed")).toBe(false);
  });
});
