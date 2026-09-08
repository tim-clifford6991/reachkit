// tests/ui/fonts.test.ts
//
// WO-030 `## Test plan` — four rows, each quoted verbatim from its source:
//
//   1. `BUILD.md` §1: "**Plus Jakarta Sans** (UI) + **JetBrains Mono** (all
//      numerals/data) | `@fontsource`, self-hosted" — both families load
//      from `@fontsource` and no `@font-face` src / stylesheet import
//      points at a third-party origin.
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
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FONTS_TS = path.resolve(import.meta.dirname, "../../src/ui/fonts.ts");
const TYPE_CSS = path.resolve(import.meta.dirname, "../../src/ui/type.css");

const THIRD_PARTY_PATTERNS = [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i, /https?:\/\//i];

function fontsSource(): string {
  return readFileSync(FONTS_TS, "utf8");
}

function typeCssSource(): string {
  return readFileSync(TYPE_CSS, "utf8");
}

/** Every `@fontsource/...` import specifier `fonts.ts` declares. */
function fontImportSpecifiers(src: string): string[] {
  const specifiers: string[] = [];
  const re = /import\s+["']([^"']+)["']\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) specifiers.push(m[1]!);
  return specifiers;
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
function themeRootTokens(): Map<string, string> {
  const source = readFileSync(
    path.resolve(import.meta.dirname, "../../src/ui/theme.css"),
    "utf8"
  );
  const root = source.slice(source.indexOf(":root {"), source.indexOf("\n}\n"));
  const out = new Map<string, string>();
  for (const [, name, value] of root.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(name!, value!.trim());
  }
  return out;
}

describe("BUILD.md §1 / BP-018 NFR — self-hosted, no third-party font request", () => {
  it("fonts.ts imports both families from @fontsource, not a hosted CDN", () => {
    const specifiers = fontImportSpecifiers(fontsSource());
    expect(specifiers.length).toBeGreaterThan(0);

    const jakarta = specifiers.filter((s) => s.startsWith("@fontsource/plus-jakarta-sans/"));
    const mono = specifiers.filter((s) => s.startsWith("@fontsource/jetbrains-mono/"));
    expect(jakarta.length).toBeGreaterThan(0);
    expect(mono.length).toBeGreaterThan(0);

    for (const specifier of specifiers) {
      expect(specifier.startsWith("@fontsource/")).toBe(true);
      for (const pattern of THIRD_PARTY_PATTERNS) {
        expect(specifier).not.toMatch(pattern);
      }
    }
  });

  it("every @font-face src the imported stylesheets ship is a local relative path, never a third-party origin", () => {
    const specifiers = fontImportSpecifiers(fontsSource());
    expect(specifiers.length).toBeGreaterThan(0);

    for (const specifier of specifiers) {
      const resolved = require.resolve(specifier, { paths: [path.dirname(FONTS_TS)] });
      const css = readFileSync(resolved, "utf8");
      expect(css).toMatch(/@font-face/);
      for (const pattern of THIRD_PARTY_PATTERNS) {
        expect(css).not.toMatch(pattern);
      }
      // Every url() in a @fontsource stylesheet is a relative ./files/... path.
      const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]!);
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url.replace(/["']/g, "")).toMatch(/^\.\/files\//);
      }
    }
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

  it("body: 15px / 1.55", () => {
    const rules = Array.from(parseCss(typeCssSource())) as CSSStyleRule[];
    const body = rules.find((r) => r.selectorText === "body");
    expect(body).toBeTruthy();
    expect(body!.style.getPropertyValue("font-family")).toBe("var(--font-ui)");
    expect(body!.style.getPropertyValue("font-size")).toBe("15px");
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
    // narrow-first, so the *declared* default is `--t-h2`'s size —
    // `design/tokens.md` §4's third absolute, "`--t-h1` takes `--t-h2`'s
    // size ... below `--breakpoint-sm`" — and the `min-width` block below
    // restores the full step. No new size is minted either way, which is
    // what this pin is for: both rules name a token from the same four.
    expect(sizeOf("h1")).toBe("var(--t-h2)");
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
    expect(wideH1!.style.getPropertyValue("font-size")).toBe("var(--t-h1)");

    expect(sizeOf("h2")).toBe("var(--t-h2)");
    expect(sizeOf("h3")).toBe("var(--t-h3)");
    expect(sizeOf("h4")).toBe("var(--t-h4)");
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
    expect(themeRoot.get("--t-h1")).toBe("31px");
    expect(themeRoot.get("--t-h2")).toBe("25px");
    expect(themeRoot.get("--t-h3")).toBe("20px");
    expect(themeRoot.get("--t-h4")).toBe("16px");
  });

  it("every heading step is above the 15px body — a head never steps under it", () => {
    const themeRoot = themeRootTokens();
    for (const token of ["--t-h1", "--t-h2", "--t-h3", "--t-h4"]) {
      const px = Number.parseFloat(themeRoot.get(token) ?? "");
      expect(px, `${token} must be above the 15px body`).toBeGreaterThan(15);
    }
  });

  it("eyebrow: uppercase, 10.5-11px", () => {
    const rules = Array.from(parseCss(typeCssSource())) as CSSStyleRule[];
    const eyebrow = rules.find((r) => r.selectorText === ".eyebrow");
    expect(eyebrow).toBeTruthy();
    expect(eyebrow!.style.getPropertyValue("text-transform")).toBe("uppercase");
    const size = Number.parseFloat(eyebrow!.style.getPropertyValue("font-size"));
    expect(size).toBeGreaterThanOrEqual(10.5);
    expect(size).toBeLessThanOrEqual(11);
  });
});
