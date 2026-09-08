// tests/ui/tokens.test.ts
//
// WO-029 `## Test plan` — criteria quoted from BP-018 and `BUILD.md` §2.1;
// see that section's header note: BP-018 has no requirement ancestor at
// all, so nothing here is inherited from a REQ.
//
// `BUILD.md` §2.1's own colour block is embedded verbatim below (rule 5.3:
// path + verbatim quote, never a line number) and parsed with the same
// custom-property regex used against the built `theme.css`, so a value that
// drifts from the source fails structurally rather than by a second,
// hand-copied expectation the two can silently disagree with.
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type Root, type Rule, type AtRule } from "postcss";
import { describe, expect, it } from "vitest";
import { approvedTokens } from "./design/tokens-doc";

const THEME_CSS_PATH = path.resolve(__dirname, "../../src/ui/theme.css");
const TAILWIND_CONFIG_PATH = path.resolve(__dirname, "../../tailwind.config.ts");

const THEME_CSS = readFileSync(THEME_CSS_PATH, "utf8");
const TAILWIND_CONFIG_SOURCE = readFileSync(TAILWIND_CONFIG_PATH, "utf8");

// `BUILD.md` §2.1's code fence, verbatim (path: BUILD.md).
const BUILD_MD_LIGHT_BLOCK = `
  --bg:#f6f6f9; --surface:#ffffff; --sunk:#efeff4; --line:#eaeaf1;
  --ink:#191925; --ink-2:#5e5e73; --ink-3:#9695a8;
  --accent:#5b4be0; --on-accent:#ffffff; --accent-bg:#eeecfd; --accent-line:#ddd8fa;
  --ok:#1f8a6b;  --ok-bg:#e7f6f0;  --ok-line:#d2ede3;
  --warn:#b8722a; --warn-bg:#fff3e6; --warn-line:#fbe1c6;
  --bad:#c0432b;  --bad-bg:#fdece8;  --bad-line:#f8d5cd;
  --chart-you:#5b4be0; --chart-rival:#787790; --chart-goal:#b8722a;
  --r-box:14px; --r-field:9px; --r-pill:999px;
  --shadow-card:0 1px 3px rgb(24 24 48/.045);
  --ring-accent:0 0 0 3px rgb(91 75 224/.18);
`;

// `BUILD.md` §2.1's dark code fence, verbatim (path: BUILD.md). The three
// hues plus the clause the six derived `-bg`/`-line` values cite are on one
// line, exactly as printed there.
const BUILD_MD_DARK_BLOCK = `
  --bg:#0e1116; --surface:#161a21; --sunk:#11151b; --line:#242a34;
  --ink:#dde3eb; --ink-2:#8e99aa; --ink-3:#69738a;
  --accent:#9bb4ff; --on-accent:#0e1116;
  --accent-bg:rgb(155 180 255/.12); --accent-line:rgb(155 180 255/.28);
  --ok:#7bd8b0; --warn:#e6b45a; --bad:#f0907a;   /* + matching -bg/-line at 12%/28% alpha */
  --chart-you:#5f7ff2; --chart-rival:#5c6579; --chart-goal:#e6b45a;
`;

// The six dark `-bg`/`-line` values `BUILD.md` §2.1 does not state and this
// work order's `rests-on` row 3 derives at 12%/28% alpha from the three
// stated hues above (`--ok`/`--warn`/`--bad`), per the clause quoted in
// `BUILD_MD_DARK_BLOCK`.
const DERIVED_DARK_BG_LINE: Record<string, string> = {
  "ok-bg": "rgb(123 216 176/.12)",
  "ok-line": "rgb(123 216 176/.28)",
  "warn-bg": "rgb(230 180 90/.12)",
  "warn-line": "rgb(230 180 90/.28)",
  "bad-bg": "rgb(240 144 122/.12)",
  "bad-line": "rgb(240 144 122/.28)",
};

/** Every `--custom-property: value;` pair in a plain declarations blob,
 * keyed without the leading `--`. Used identically against the embedded
 * `BUILD.md` quotes and against parsed `theme.css` rule bodies, so the two
 * are compared through one code path. */
function extractCustomProps(blob: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    const [, name, value] = m;
    if (name === undefined || value === undefined) continue;
    out.set(name, value.trim());
  }
  return out;
}

function declsOf(rule: Rule): Map<string, string> {
  const out = new Map<string, string>();
  for (const node of rule.nodes) {
    if (node.type === "decl" && node.prop.startsWith("--")) {
      out.set(node.prop.slice(2), node.value.trim());
    }
  }
  return out;
}

/** Parses the three-state theming BP-018 requires out of a CSS source
 * string: bare `:root`, `@media (prefers-color-scheme: dark)` guarded with
 * `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`. Throws
 * naming whichever piece is missing — the shape the "unguarded media query
 * fails" and "watch it fail first" rows need. */
function parseThemeStates(source: string): {
  light: Map<string, string>;
  darkMedia: Map<string, string>;
  darkExplicit: Map<string, string>;
} {
  const root: Root = postcss.parse(source);

  const lightRule = root.nodes.find(
    (n): n is Rule => n.type === "rule" && n.selector === ":root"
  );
  if (!lightRule) throw new Error('missing bare ":root" rule');

  const mediaAtRule = root.nodes.find(
    (n): n is AtRule =>
      n.type === "atrule" &&
      n.name === "media" &&
      n.params.replace(/\s+/g, " ").trim() === "(prefers-color-scheme: dark)"
  );
  if (!mediaAtRule) throw new Error('missing "@media (prefers-color-scheme: dark)"');

  const darkMediaRule = (mediaAtRule.nodes ?? []).find(
    (n): n is Rule => n.type === "rule" && n.selector === ':root:not([data-theme="light"])'
  );
  if (!darkMediaRule) {
    throw new Error(
      'the dark media query is not guarded with \':root:not([data-theme="light"])\''
    );
  }

  const darkExplicitRule = root.nodes.find(
    (n): n is Rule => n.type === "rule" && n.selector === ':root[data-theme="dark"]'
  );
  if (!darkExplicitRule) throw new Error('missing ":root[data-theme=\\"dark\\"]"');

  return {
    light: declsOf(lightRule),
    darkMedia: declsOf(darkMediaRule),
    darkExplicit: declsOf(darkExplicitRule),
  };
}

const BUILD_LIGHT = extractCustomProps(BUILD_MD_LIGHT_BLOCK);
const BUILD_DARK_STATED = extractCustomProps(BUILD_MD_DARK_BLOCK);

describe(
  'BP-018 error behaviour: "Three-state theming: bare `:root` is light, the dark media query ' +
    'is guarded with `:root:not([data-theme=\\"light\\"])`, and `:root[data-theme=\\"dark\\"]` ' +
    'is the explicit toggle."',
  () => {
    it("src/ui/theme.css declares all three selectors in that exact form", () => {
      expect(() => parseThemeStates(THEME_CSS)).not.toThrow();
    });

    it("an unguarded media query is rejected (mutation check on the parser itself)", () => {
      const unguarded = `
        :root { --bg: #fff; }
        @media (prefers-color-scheme: dark) {
          :root { --bg: #000; }
        }
        :root[data-theme="dark"] { --bg: #000; }
      `;
      expect(() => parseThemeStates(unguarded)).toThrow(/guarded/);
    });

    it("a missing explicit [data-theme=dark] toggle is rejected", () => {
      const noExplicit = `
        :root { --bg: #fff; }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) { --bg: #000; }
        }
      `;
      expect(() => parseThemeStates(noExplicit)).toThrow(/data-theme.*dark/);
    });
  }
);

describe(
  'BP-018 error behaviour: "**No colour is ever defined only inside a dark block** — ' +
    'a token missing from `:root` fails a test."',
  () => {
    it("every token declared anywhere in theme.css is present in bare :root", () => {
      const { light, darkMedia, darkExplicit } = parseThemeStates(THEME_CSS);
      const allNames = new Set([...darkMedia.keys(), ...darkExplicit.keys(), ...light.keys()]);
      const missing = [...allNames].filter((name) => !light.has(name));
      expect(missing).toEqual([]);
    });

    it("mutation: a token moved out of :root into the dark block only is caught", () => {
      // The real fail-first case (WO-029 `## Steps` step 4): move --accent
      // out of :root, defining it only in the guarded dark block.
      const mutated = THEME_CSS.replace(/^\s*--accent:\s*#5b4be0;\n/m, "");
      const { light, darkMedia, darkExplicit } = parseThemeStates(mutated);
      const allNames = new Set([...darkMedia.keys(), ...darkExplicit.keys(), ...light.keys()]);
      const missing = [...allNames].filter((name) => !light.has(name));
      expect(missing).toContain("accent");
    });
  }
);

describe(
  'BUILD.md §2.1: "These exact values — they are lifted from timclifford.dev so the ' +
    'products share a visual family."',
  () => {
    const { light, darkMedia, darkExplicit } = parseThemeStates(THEME_CSS);

    it("every light token in theme.css:root matches BUILD.md §2.1's stated value", () => {
      for (const [name, value] of BUILD_LIGHT) {
        expect(light.get(name), `--${name} in :root`).toBe(value);
      }
    });

    it("theme.css:root carries no light token BUILD.md §2.1 or tokens.md names", () => {
      // Until issue #349 this read "no token §2.1 does not state", and that
      // is what kept the spacing ladder, the type rungs, the measures and
      // the breakpoints out of this file — scattered across four other
      // stylesheets and spent as bare literals instead, where nothing could
      // compare them against the document.
      //
      // §2.1's colour block is still held verbatim by the assertions above
      // and below; what this one now says is the honest rule: a token in
      // this file is either one §2.1 states or one `design/tokens.md`
      // approves, and anything else is a value nobody named.
      // `tests/ui/design/token-set.test.ts` holds the second half exactly,
      // in both directions — this is the guard against a *third* source.
      const approved = approvedTokens();
      const extra = [...light.keys()].filter(
        // `extractCustomProps` keys without the leading `--`; the document
        // reader keys with it.
        (name) => !BUILD_LIGHT.has(name) && !approved.has(`--${name}`)
      );
      expect(extra, `named by neither BUILD.md §2.1 nor tokens.md: ${extra.join(" ")}`).toEqual([]);
    });

    it("every BUILD.md-stated dark token matches in both the media block and the explicit toggle", () => {
      for (const [name, value] of BUILD_DARK_STATED) {
        expect(darkMedia.get(name), `--${name} in the dark media block`).toBe(value);
        expect(darkExplicit.get(name), `--${name} in :root[data-theme="dark"]`).toBe(value);
      }
    });

    it("the six derived dark -bg/-line values are exactly 12%/28% alpha of the stated hues, in both dark blocks", () => {
      for (const [name, value] of Object.entries(DERIVED_DARK_BG_LINE)) {
        expect(darkMedia.get(name), `--${name} in the dark media block`).toBe(value);
        expect(darkExplicit.get(name), `--${name} in :root[data-theme="dark"]`).toBe(value);
      }
    });

    it("mutation: a drifted light value is caught", () => {
      const mutated = THEME_CSS.replace("--accent: #5b4be0;", "--accent: #123456;");
      const { light: mutatedLight } = parseThemeStates(mutated);
      expect(mutatedLight.get("accent")).not.toBe(BUILD_LIGHT.get("accent"));
    });

    it("every derived dark -bg/-line value carries a comment quoting BUILD.md §2.1's derivation clause", () => {
      const CLAUSE = "+ matching -bg/-line at 12%/28% alpha";
      for (const name of Object.keys(DERIVED_DARK_BG_LINE)) {
        // The declaration for --<name> must be preceded, within a short
        // window, by a comment containing the verbatim clause.
        const declRe = new RegExp(`--${name}:\\s*rgb\\([^;]+\\);`, "g");
        const matches = [...THEME_CSS.matchAll(declRe)];
        expect(matches.length, `--${name} declared`).toBeGreaterThan(0);
        for (const match of matches) {
          const start = match.index ?? 0;
          const preceding = THEME_CSS.slice(Math.max(0, start - 400), start);
          expect(preceding, `comment preceding --${name}`).toContain(CLAUSE);
        }
      }
    });
  }
);

describe(
  "BUILD.md §2.1: \"Map these onto daisyUI's theme slots (`base-100`←surface, " +
    "`base-200`←sunk, `base-300`←line, `base-content`←ink, `primary`←accent, " +
    '`success/warning/error`←ok/warn/bad)"',
  () => {
    const EXPECTED_MAPPING: Record<string, string> = {
      "--color-base-100": "var(--surface)",
      "--color-base-200": "var(--sunk)",
      "--color-base-300": "var(--line)",
      "--color-base-content": "var(--ink)",
      "--color-primary": "var(--accent)",
      "--color-success": "var(--ok)",
      "--color-warning": "var(--warn)",
      "--color-error": "var(--bad)",
    };

    it("tailwind.config.ts asserts all six mappings, each as a variable reference", () => {
      for (const [slot, value] of Object.entries(EXPECTED_MAPPING)) {
        const re = new RegExp(`"${slot}"\\s*:\\s*"([^"]+)"`);
        const match = TAILWIND_CONFIG_SOURCE.match(re);
        expect(match, `${slot} present in tailwind.config.ts`).not.toBeNull();
        expect(match?.[1]).toBe(value);
      }
    });

    it("no mapped slot carries a literal colour instead of a variable reference", () => {
      for (const slot of Object.keys(EXPECTED_MAPPING)) {
        const re = new RegExp(`"${slot}"\\s*:\\s*"([^"]+)"`);
        const match = TAILWIND_CONFIG_SOURCE.match(re);
        expect(match?.[1]).toMatch(/^var\(--[a-z0-9-]+\)$/);
      }
    });

    it("mutation: a slot rewritten as a literal hex is caught", () => {
      const mutated = TAILWIND_CONFIG_SOURCE.replace(
        '"--color-primary": "var(--accent)"',
        '"--color-primary": "#5b4be0"'
      );
      const match = mutated.match(/"--color-primary"\s*:\s*"([^"]+)"/);
      expect(match?.[1]).not.toMatch(/^var\(--[a-z0-9-]+\)$/);
    });
  }
);

describe(
  'BP-018 NFR budget: "the token pairs are the CVD-checked ones from `BUILD.md` §2.4 ' +
    'and are not re-derived"',
  () => {
    it("--chart-you and --chart-rival are exactly BUILD.md §2.1's stated values", () => {
      const { light } = parseThemeStates(THEME_CSS);
      expect(light.get("chart-you")).toBe(BUILD_LIGHT.get("chart-you"));
      expect(light.get("chart-rival")).toBe(BUILD_LIGHT.get("chart-rival"));
    });

    it("no third series colour is defined beyond chart-you/chart-rival/chart-goal", () => {
      const { light } = parseThemeStates(THEME_CSS);
      const chartNames = [...light.keys()].filter((name) => name.startsWith("chart-"));
      expect(chartNames.sort()).toEqual(["chart-goal", "chart-rival", "chart-you"]);
    });
  }
);
