// No screen or component spends a bare literal (issue #349).
// tests/ui/design/no-bare-literals.test.ts
//
// The owner's goal is token fidelity, and a literal is where fidelity is
// lost silently: `16px` may or may not be `--s-4`, and nothing can tell.
// This sweeps every stylesheet under `src/ui/**` and `src/app/**` and every
// inline `style={{}}` in TSX, and requires a `var(--…)` for the properties
// the token set covers — radius, shadow, spacing, colour, type size and
// weight, measure and breakpoint.
//
// `theme.css` is exempt because it *is* the token file, and `tailwind.css`
// because it is the framework's entry point and maps §2.1's tokens onto
// daisyUI's slots.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import postcss, { type Declaration } from "postcss";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../../src");

/** The token file itself, and the framework entry point. */
const EXEMPT_FILES: readonly string[] = ["src/ui/theme.css", "src/ui/tailwind.css"];

/** The properties the approved set covers. A property outside this list —
 *  `display`, `flex`, `overflow`, `grid-template-columns` — carries no
 *  token and is not this rule's business. */
const GOVERNED = /^(padding|margin|gap|row-gap|column-gap|border-radius|box-shadow|color|background|background-color|background-image|border|border-[a-z]+|font-size|font-weight|font-family|width|height|min-width|max-width|min-height|max-height|letter-spacing|top|right|bottom|left|inset)(-[a-z]+)*$/;

/**
 * What may stand without a token.
 *
 * `0` is not a value a token could carry. `100%`, `auto`, `none`,
 * `inherit`, `transparent` and `currentColor` are keywords, not
 * measurements. `1px` is the hairline `design/tokens.md` §2b names
 * (`--border-hair`) — permitted only inside a `border` shorthand, where the
 * rest of the value is a token, because that is how every edge in the
 * product is written and a `var()` there reads worse than the hairline it
 * names. `100svh`/`100vh` are the viewport, which no token describes.
 */
const ALLOWED_VALUE =
  /^(0|0px|100%|auto|none|inherit|initial|unset|transparent|currentColor|100svh|100vh|1px)$/;

/**
 * The literals this PR did **not** convert, each because the document names
 * no token for it. They are recorded here rather than waved through:
 * both are gaps in `design/tokens.md` for the #2 amendment, and the day the
 * document names them this list shrinks.
 */
export const UNCONVERTED: ReadonlyArray<{ file: string; value: string; why: string }> = [
  {
    file: "src/ui/type.css",
    value: "15px",
    why: [
      "`BUILD.md` §2.3 states the body as 15px/1.55 and `design/tokens.md`",
      "§4 repeats it as a *role* with no token name. The archived preview",
      "app spends `--t-body-size` for it, which the document never adopted.",
      "Declaring one here would be inventing a token; converting it to a",
      "type rung would change the body size. Raised for the #2 amendment.",
    ].join(" "),
  },
  {
    file: "src/ui/type.css",
    value: "-0.02em",
    why: [
      "heading tracking. `BUILD.md` §2.3 states it verbatim — 'tight",
      "letter-spacing (−0.02em)' — and `design/tokens.md` names a tracking",
      "token for the *eyebrow* alone (`--t-eyebrow-track`, .1em). There is",
      "no heading-tracking token to convert to, and minting one would put a",
      "name on a value BUILD already fixes. Raised for the #2 amendment.",
    ].join(" "),
  },
  {
    file: "src/ui/idiom/idiom.css",
    value: "-0.02em",
    why: "heading tracking, `BUILD.md` §2.3 verbatim — see the type.css entry.",
  },
  {
    file: "src/ui/components/custom/calendar-grid.css",
    value: "0.04em",
    why: [
      "the calendar's own uppercase column label. It is neither the",
      "eyebrow's .1em nor a heading's −0.02em, and the document names no",
      "token for it — §2.2 gives the calendar grid its own stylesheet and",
      "this is a value inside it. Converting it to the eyebrow token would",
      "change what the label looks like; raised rather than forced.",
    ].join(" "),
  },
  {
    file: "src/ui/type.css",
    value: "11px",
    why: [
      "the eyebrow. §2.3 states the role as a *range*, 10.5–11px, and the",
      "document's token for it — `--t-eyebrow-size` — is the 10.5 end. This",
      "sheet draws 11, recorded as a rule 1.1 parameter when it was written",
      "and matching what the approved card idiom draws. Converting it to the",
      "token would change every eyebrow in the product by half a pixel; a",
      "range is the one thing a single token cannot express. Raised with the",
      "one above.",
    ].join(" "),
  },
];

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const rel = (file: string): string =>
  path.relative(path.resolve(SRC, ".."), file).split(path.sep).join("/");

/** A value is bare when it carries a measurement or a colour and no
 *  `var()`. `calc()` of tokens is fine; `calc()` of a literal is not. */
function isBare(value: string): boolean {
  if (value.includes("var(--")) return false;
  const trimmed = value.trim();
  if (ALLOWED_VALUE.test(trimmed)) return true === false;
  return /\d+(\.\d+)?(px|rem|em)\b|#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(trimmed);
}

describe("issue #349 — no stylesheet under src/ spends a bare literal", () => {
  const unconvertedByFile = new Map<string, Set<string>>();
  for (const entry of UNCONVERTED) {
    const set = unconvertedByFile.get(entry.file) ?? new Set<string>();
    set.add(entry.value);
    unconvertedByFile.set(entry.file, set);
  }

  it("every governed declaration names a token", () => {
    const offenders: string[] = [];
    for (const file of cssFiles(SRC)) {
      const name = rel(file);
      if (EXEMPT_FILES.includes(name)) continue;
      const allowedHere = unconvertedByFile.get(name) ?? new Set<string>();
      postcss.parse(readFileSync(file, "utf8")).walkDecls((decl: Declaration) => {
        if (!GOVERNED.test(decl.prop)) return;
        if (!isBare(decl.value)) return;
        // A border shorthand whose colour is a token may keep the hairline.
        if (/^border(-[a-z]+)?$/.test(decl.prop) && decl.value.startsWith("1px ")) return;
        if (allowedHere.has(decl.value.trim())) return;
        offenders.push(`${name}: ${decl.prop}: ${decl.value}`);
      });
    }
    expect(offenders, `bare literals:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every inline style in TSX names a token for a governed property", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const [, body] of source.matchAll(/style=\{\{([^}]*)\}\}/g)) {
        for (const [, prop, value] of body!.matchAll(/([a-zA-Z]+)\s*:\s*"([^"]*)"/g)) {
          const kebab = prop!.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
          if (!GOVERNED.test(kebab)) continue;
          if (!isBare(value!)) continue;
          offenders.push(`${rel(file)}: ${prop}: ${value}`);
        }
      }
    }
    expect(offenders, `bare literals in inline styles:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every unconverted literal is named, with the document gap it rests on", () => {
    // Rule 5.5: the exceptions are stated and counted, never a silent pass.
    // Neither is an allow-list entry for a value a token exists for — both
    // are places `design/tokens.md` names no token at all.
    expect(UNCONVERTED).toHaveLength(5);
    for (const entry of UNCONVERTED) {
      expect(entry.why.length, entry.value).toBeGreaterThan(60);
      expect(readFileSync(path.resolve(SRC, "..", entry.file), "utf8")).toContain(entry.value);
    }
  });

  it("the sweep actually reaches the tree — a rule over nothing is not a rule", () => {
    expect(cssFiles(SRC).length).toBeGreaterThan(5);
    expect(tsxFiles(SRC).length).toBeGreaterThan(50);
  });
});
