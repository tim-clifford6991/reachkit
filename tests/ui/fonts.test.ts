// tests/ui/fonts.test.ts
//
// WO-030 `## Test plan` — four rows, each quoted verbatim from its source:
//
//   1. `BUILD.md` §1: "**Plus Jakarta Sans** (UI) + **JetBrains Mono** (all
//      numerals/data) | `@fontsource`, self-hosted" — both families load
//      from `@fontsource` and no face `fonts.ts` declares points at a
//      third-party origin. Since issue #332 the faces are declared to
//      `next/font/local` rather than imported as stylesheets, so what is
//      read is the `src` paths and the `declarations` of each call; the
//      bytes behind them are still @fontsource's, and this file is what
//      holds that true.
//   2. BP-018 NFR budget: "Fonts self-hosted via `@fontsource`; no
//      third-party font request from a customer's own domain (BP-004
//      renders with the same fonts)." `fonts.ts` is BP-018's one font
//      module (`BP-018.md` `## Module / boundary`) and the module BP-004
//      will import when it renders — there is no second font-loading file
//      for a "hosted-edge render path" to diverge from, so the row is
//      discharged by the same assertion as row 1, against the same file.
//   3. BP-018 error behaviour: "Every numeral, date, URL, search query and
//      code-like string renders in JetBrains Mono with `tabular-nums`; a
//      numeral in the UI font is a defect." — `.num` is the *only* rule in
//      `type.css` that sets `font-variant-numeric`, and that rule also sets
//      `font-family: var(--font-mono)`; a component cannot apply one half.
//   4. `BUILD.md` §2.3, full clause (`tokens.md` §4 quotes the same text
//      with the same values — no disagreement to report): "Headings:
//      Jakarta 700–800, tight letter-spacing (−0.02em), `text-wrap:balance`.
//      Body 15px/1.55. ... Uppercase 10.5–11px eyebrows for section
//      labels." — every value asserted against the clause.
//
// This file runs under the jsdom `ui` project (vitest.config.ts). CSS rules
// are parsed by jsdom's own CSSOM (a `<style>` element holding `type.css`'s
// real file content), not by regex — the same parser a browser tab uses to
// read the file this WO ships.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { normalise, THEME_CSS, tokenSet } from "./design/tokens-doc";

const FONTS_TS = path.resolve(import.meta.dirname, "../../src/ui/fonts.ts");
const TYPE_CSS = path.resolve(import.meta.dirname, "../../src/ui/type.css");

const THIRD_PARTY_PATTERNS = [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i, /https?:\/\//i];

function fontsSource(): string {
  return readFileSync(FONTS_TS, "utf8");
}

function typeCssSource(): string {
  return readFileSync(TYPE_CSS, "utf8");
}

/** One `localFont({ … })` call as `fonts.ts` writes it: the faces it loads,
 *  the family it declares them under, the range it declares them for, and
 *  whether it preloads. */
interface FontCall {
  /** The `const` the call is assigned to — `next/font` requires one, and it
   *  is what a failure message can name. */
  name: string;
  preload: boolean;
  family: string;
  unicodeRange: string;
  faces: { path: string; weight: string; style: string }[];
}

/** Reads every `localFont` call out of `fonts.ts` with the TypeScript
 *  compiler API — the same parser the build reads it with, rather than a
 *  regex approximation of one. */
function localFontCalls(src: string): FontCall[] {
  const sf = ts.createSourceFile(FONTS_TS, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const calls: FontCall[] = [];

  const text = (node: ts.Node | undefined): string =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : "";

  const prop = (obj: ts.ObjectLiteralExpression, key: string): ts.Expression | undefined =>
    obj.properties.find(
      (p): p is ts.PropertyAssignment =>
        ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key
    )?.initializer;

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "localFont"
    ) {
      const arg = node.initializer.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        const srcProp = prop(arg, "src");
        const faces: FontCall["faces"] = [];
        if (srcProp && ts.isArrayLiteralExpression(srcProp)) {
          for (const entry of srcProp.elements) {
            if (!ts.isObjectLiteralExpression(entry)) continue;
            faces.push({
              path: text(prop(entry, "path")),
              weight: text(prop(entry, "weight")),
              style: text(prop(entry, "style")),
            });
          }
        }
        const declarations = new Map<string, string>();
        const declProp = prop(arg, "declarations");
        if (declProp && ts.isArrayLiteralExpression(declProp)) {
          for (const entry of declProp.elements) {
            if (!ts.isObjectLiteralExpression(entry)) continue;
            declarations.set(text(prop(entry, "prop")), text(prop(entry, "value")));
          }
        }
        calls.push({
          name: node.name.text,
          preload: prop(arg, "preload")?.kind === ts.SyntaxKind.TrueKeyword,
          family: declarations.get("font-family") ?? "",
          unicodeRange: declarations.get("unicode-range") ?? "",
          faces,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return calls;
}

/** The four `@fontsource` stylesheets whose faces `fonts.ts` re-declares:
 *  one per weight of each family. They are what "the same faces as before"
 *  means, so they are read rather than restated. */
const VENDOR_STYLESHEETS = [
  "@fontsource/plus-jakarta-sans/400.css",
  "@fontsource/plus-jakarta-sans/700.css",
  "@fontsource/plus-jakarta-sans/800.css",
  "@fontsource/jetbrains-mono/400.css",
] as const;

/** One `@font-face` block of a vendor stylesheet, keyed by the `.woff2` it
 *  names. Parsed off the block text rather than through jsdom's CSSOM,
 *  which exposes no `@font-face` rule to read `unicode-range` from; these
 *  files are generated and uniform, so the block is unambiguous. */
interface VendorFace {
  file: string;
  family: string;
  weight: string;
  style: string;
  unicodeRange: string;
}

function vendorFaces(): Map<string, VendorFace> {
  const byFile = new Map<string, VendorFace>();
  for (const specifier of VENDOR_STYLESHEETS) {
    const resolved = require.resolve(specifier, { paths: [path.dirname(FONTS_TS)] });
    const css = readFileSync(resolved, "utf8");
    for (const block of css.split("@font-face").slice(1)) {
      const body = block.slice(0, block.indexOf("}"));
      const value = (prop: string): string =>
        (body.match(new RegExp(`${prop}:\\s*([^;]+);`)) ?? [])[1]?.trim() ?? "";
      const file = (body.match(/files\/([\w-]+\.woff2)/) ?? [])[1] ?? "";
      byFile.set(file, {
        file,
        family: value("font-family").replace(/'/g, '"'),
        weight: value("font-weight"),
        style: value("font-style"),
        unicodeRange: value("unicode-range"),
      });
    }
  }
  return byFile;
}

/**
 * Load a CSS source string into this file's own jsdom environment's real
 * CSSOM (the `ui` vitest project runs under jsdom) and return its rule
 * list — the same parser a browser tab uses to read `type.css`, not a
 * regex approximation of one.
 */
function parseCss(css: string): CSSRuleList {
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  const rules = styleEl.sheet!.cssRules;
  document.head.removeChild(styleEl);
  return rules;
}

/** The bare `:root` block of `src/ui/theme.css`, where every approved token
 *  lives since issue #349. Read here rather than restated, so a drift fails
 *  in both this file and `tests/ui/design/token-set.test.ts`. */
function themeRootTokens(): ReadonlyMap<string, string> {
  // Every bare `:root` in the file, not the first one: the approved token
  // file declares the 10a additions in a second block and `theme.css`
  // carries it exactly, so a reader that stops at the first `}` misses six
  // tokens (issue #349).
  return tokenSet(THEME_CSS).light;
}

describe("BUILD.md §1 / BP-018 NFR — self-hosted, no third-party font request", () => {
  it("every face fonts.ts loads is a file inside node_modules/@fontsource, never a hosted CDN", () => {
    const calls = localFontCalls(fontsSource());
    expect(calls.length).toBeGreaterThan(0);

    const families = new Set(calls.map((c) => c.family));
    expect(families).toEqual(new Set(['"Plus Jakarta Sans"', '"JetBrains Mono"']));

    for (const call of calls) {
      expect(call.faces.length, `${call.name} loads no face`).toBeGreaterThan(0);
      for (const face of call.faces) {
        expect(face.path, `${call.name}: ${face.path}`).toMatch(
          /^\.\.\/\.\.\/node_modules\/@fontsource\/(plus-jakarta-sans|jetbrains-mono)\/files\/[\w-]+\.woff2$/
        );
        for (const pattern of THIRD_PARTY_PATTERNS) {
          expect(face.path, `${call.name}: ${face.path}`).not.toMatch(pattern);
        }
        // The path is resolved rather than pattern-matched: a face that
        // does not exist is a `@font-face` pointing at nothing, which the
        // build reports and no reader ever sees.
        expect(
          existsSync(path.resolve(path.dirname(FONTS_TS), face.path)),
          `${call.name}: ${face.path} resolves to no file`
        ).toBe(true);
      }
    }
  });

  it("declares exactly the faces @fontsource's own stylesheets ship — same weights, same ranges, nothing dropped", () => {
    // The promise `src/ui/fonts.ts` makes when it stops importing those
    // four stylesheets: the loader changed and the *coverage* did not, so
    // no codepoint that rendered in one of these families falls through to
    // the system stack. Held as set equality in both directions, so a
    // subset silently dropped fails here and so does one invented.
    const vendor = vendorFaces();
    expect(vendor.size).toBeGreaterThan(0);

    const declared = new Map<string, { family: string; weight: string; style: string; unicodeRange: string }>();
    for (const call of localFontCalls(fontsSource())) {
      for (const face of call.faces) {
        const file = face.path.slice(face.path.lastIndexOf("/") + 1);
        expect(declared.has(file), `${file} is declared twice`).toBe(false);
        declared.set(file, {
          family: call.family,
          weight: face.weight,
          style: face.style,
          unicodeRange: call.unicodeRange,
        });
      }
    }

    expect([...declared.keys()].sort()).toEqual([...vendor.keys()].sort());
    for (const [file, face] of declared) {
      const ships = vendor.get(file)!;
      expect(face.family, `${file}: font-family`).toBe(ships.family);
      expect(face.weight, `${file}: font-weight`).toBe(ships.weight);
      expect(face.style, `${file}: font-style`).toBe(ships.style);
      expect(face.unicodeRange, `${file}: unicode-range`).toBe(ships.unicodeRange);
    }
  });

  it("declares the two families under the names the approved tokens spend, so no rule has to change", () => {
    // `next/font` would otherwise mint a hashed family name reachable only
    // through the class it hands back. `--font-ui` and `--font-mono` are
    // approved tokens (issue #349) and they name the families in words, so
    // every call declares its own `font-family` instead.
    const tokens = themeRootTokens();
    const named = new Set(localFontCalls(fontsSource()).map((c) => c.family));
    for (const [token, family] of [
      ["--font-ui", '"Plus Jakarta Sans"'],
      ["--font-mono", '"JetBrains Mono"'],
    ] as const) {
      expect(named.has(family), `no face is declared as ${family}`).toBe(true);
      // `tokenSet` returns every value normalised (whitespace stripped,
      // lower-cased), so the family is put through the same function
      // rather than compared against a second spelling of it.
      expect(
        tokens.get(token)?.startsWith(normalise(family)),
        `${token} no longer leads with ${family}`
      ).toBe(true);
    }
  });

  it("preloads the latin faces the product renders on every screen, and nothing else", () => {
    // A preload is a promise the byte is needed now. Jakarta 400 is the
    // body and 700 is `type.css`'s one heading weight; JetBrains Mono 400
    // is every numeral. Jakarta 800 is loaded for §2.3's heading range and
    // no rule spends it, and no non-latin subset is on any screen's
    // critical path — so neither preloads.
    const preloaded = localFontCalls(fontsSource())
      .filter((call) => call.preload)
      .flatMap((call) => call.faces.map((f) => f.path.slice(f.path.lastIndexOf("/") + 1)))
      .sort();
    expect(preloaded).toEqual([
      "jetbrains-mono-latin-400-normal.woff2",
      "plus-jakarta-sans-latin-400-normal.woff2",
      "plus-jakarta-sans-latin-700-normal.woff2",
    ]);
  });

  it("exports the class name the root layout puts on <html>", async () => {
    const mod = await import("@/ui/fonts");
    expect(typeof mod.fontVariables).toBe("string");
    expect(mod.fontVariables.length).toBeGreaterThan(0);
  });
});

describe("BP-018 error behaviour — `.num` is the sole enforcement point of the numeral rule", () => {
  it("the only rule that sets font-variant-numeric also sets font-family: var(--font-mono)", () => {
    const rules = parseCss(typeCssSource());
    const withVariant: { selector: string; style: CSSStyleDeclaration }[] = [];
    for (const rule of Array.from(rules) as CSSStyleRule[]) {
      if (rule.style?.getPropertyValue("font-variant-numeric")) {
        withVariant.push({ selector: rule.selectorText, style: rule.style });
      }
    }
    expect(withVariant).toHaveLength(1);
    expect(withVariant[0]!.selector).toBe(".num");
    expect(withVariant[0]!.style.getPropertyValue("font-variant-numeric")).toBe("tabular-nums");
    expect(withVariant[0]!.style.getPropertyValue("font-family")).toBe("var(--font-mono)");
  });

  it("no other rule references var(--font-mono) — a component cannot half-apply the mono family", () => {
    const rules = parseCss(typeCssSource());
    const monoFamilyRules = (Array.from(rules) as CSSStyleRule[]).filter(
      (rule) => rule.style?.getPropertyValue("font-family") === "var(--font-mono)"
    );
    expect(monoFamilyRules).toHaveLength(1);
    expect(monoFamilyRules[0]!.selectorText).toBe(".num");
  });
});

describe("BUILD.md §2.3 — the type scale, asserted against the clause", () => {
  it("headings: Jakarta weight in 700-800, letter-spacing -0.02em, text-wrap: balance", () => {
    const rules = Array.from(parseCss(typeCssSource())) as CSSStyleRule[];
    const heading = rules.find((r) => /(^|,\s*)h1(,|\s|$)/.test(r.selectorText ?? ""));
    expect(heading).toBeTruthy();
    const style = heading!.style;

    expect(style.getPropertyValue("font-family")).toBe("var(--font-ui)");
    const weight = Number(style.getPropertyValue("font-weight"));
    expect(weight).toBeGreaterThanOrEqual(700);
    expect(weight).toBeLessThanOrEqual(800);
    expect(style.getPropertyValue("letter-spacing")).toBe("-0.02em");
    expect(style.getPropertyValue("text-wrap")).toBe("balance");
  });

  it("body: --t-body, which is §2.3's 15px, / 1.55", () => {
    // Since issue #349 the sheet names the rung instead of writing the
    // number: ruling 10a's ladder is 15 / 13 / 12 / 11.5 / 11 and `--t-body`
    // is its top. The 15 is still asserted — off `theme.css`, where it is
    // now declared once — so nothing about §2.3's clause is given up.
    const rules = Array.from(parseCss(typeCssSource())) as CSSStyleRule[];
    const body = rules.find((r) => r.selectorText === "body");
    expect(body).toBeTruthy();
    expect(body!.style.getPropertyValue("font-family")).toBe("var(--font-ui)");
    expect(body!.style.getPropertyValue("font-size")).toBe("var(--t-body)");
    expect(themeRootTokens().get("--t-body")).toBe("15px");
    expect(body!.style.getPropertyValue("line-height")).toBe("1.55");
  });

  it("the heading scale: h1..h4 each declare their own step, and h5/h6 state that they take the body size", () => {
    // Issue #110. §2.3 names no heading size, so the four values are the
    // owner's 2026-09-02 ruling, transcribed from `design/tokens.md` §4
    // ("Ratio 1.25 from the 15px body") in the frozen corpus. A frozen
    // document cannot drift, so they are pinned by quotation here — the
    // `tests/pins.test.ts` convention — and the *rendered* sizes, which is
    // the half preflight broke, are asserted by
    // `tests/ui/layout/heading-scale.test.ts` in a real browser.
    const rules = Array.from(parseCss(typeCssSource())) as CSSStyleRule[];
    const sizeOf = (selector: string): string => {
      const rule = rules.find((r) => r.selectorText === selector);
      expect(rule, `type.css declares no rule for ${selector}`).toBeTruthy();
      return rule!.style.getPropertyValue("font-size");
    };

    // `h1` is the one step that is conditional (issue #258). Written
    // narrow-first, so the *declared* default is `--h2`'s size —
    // `design/tokens.md` §4's third absolute, "`--h1` takes `--h2`'s
    // size ... below `--breakpoint-sm`" — and the `min-width` block below
    // restores the full step. No new size is minted either way, which is
    // what this pin is for: both rules name a token from the same four.
    expect(sizeOf("h1")).toBe("var(--h2)");
    // `rules` is read as `CSSStyleRule[]` above, which every rule in this
    // file was until #258 added the one media block; widened here rather
    // than re-parsing the source a second time.
    const wide = (rules as readonly CSSRule[]).find(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule && r.conditionText.includes("640px")
    );
    expect(wide, "type.css declares no --breakpoint-sm media block").toBeTruthy();
    const wideH1 = Array.from(wide!.cssRules).find(
      (r): r is CSSStyleRule => (r as CSSStyleRule).selectorText === "h1"
    );
    expect(wideH1, "the --breakpoint-sm block declares no h1 rule").toBeTruthy();
    expect(wideH1!.style.getPropertyValue("font-size")).toBe("var(--h1)");

    expect(sizeOf("h2")).toBe("var(--h2)");
    expect(sizeOf("h3")).toBe("var(--h3)");
    expect(sizeOf("h4")).toBe("var(--h4)");
    // Four roles, four steps. `h5`/`h6` take the body size rather than mint
    // a fifth and sixth nobody ruled — stated, so it reads as a decision.
    expect(sizeOf("h5, h6")).toBe("inherit");

    // The four values moved to `src/ui/theme.css` (issue #349), which is
    // where every approved token now lives and where
    // `tests/ui/design/token-set.test.ts` holds them equal to the
    // document. What this file still owns is the half it was written for:
    // that each heading *rule* names its own step. The values are read from
    // their new home so this assertion still fails if one drifts.
    const themeRoot = themeRootTokens();
    expect(themeRoot.get("--h1")).toBe("31px");
    expect(themeRoot.get("--h2")).toBe("25px");
    expect(themeRoot.get("--h3")).toBe("20px");
    expect(themeRoot.get("--h4")).toBe("16px");
  });

  it("every heading step is above the 15px body — a head never steps under it", () => {
    const themeRoot = themeRootTokens();
    for (const token of ["--h1", "--h2", "--h3", "--h4"]) {
      const px = Number.parseFloat(themeRoot.get(token) ?? "");
      expect(px, `${token} must be above the 15px body`).toBeGreaterThan(15);
    }
  });

  it("eyebrow: uppercase, --t-eyebrow — the 11 at the bottom of 10a's ladder", () => {
    // §2.3 states the eyebrow as a range, 10.5–11px. A range is the one
    // thing a token cannot express, and ruling 10a closed it: "nothing under
    // 11px". The rule reads the rung; the value is asserted off `theme.css`,
    // and it is the top of §2.3's range, so the clause still holds.
    const rules = Array.from(parseCss(typeCssSource())) as CSSStyleRule[];
    const eyebrow = rules.find((r) => r.selectorText === ".eyebrow");
    expect(eyebrow).toBeTruthy();
    expect(eyebrow!.style.getPropertyValue("text-transform")).toBe("uppercase");
    expect(eyebrow!.style.getPropertyValue("font-size")).toBe("var(--t-eyebrow)");
    const size = Number.parseFloat(themeRootTokens().get("--t-eyebrow") ?? "");
    expect(size).toBeGreaterThanOrEqual(10.5);
    expect(size).toBeLessThanOrEqual(11);
  });
});
