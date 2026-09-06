// tests/ui/design/emoji.test.ts — §2.3
//
// §2.3, last sentence, verbatim: "No emoji anywhere in the product."
//
// Two sweeps, because the product has two ways of holding a character:
// the source tree, and the copy registry the source tree renders. A key
// whose value is assembled from escapes (`"\u{1F389}"`) is invisible to a
// file scan and lands on the screen anyway, so `COPY` is swept as the
// runtime object it ships as, not as the text of `keys/*.ts`.
//
// The detector is the whole test: a rule that fires on everything is not
// a rule, so two fixtures beside this file — one emoji-bearing, one full
// of the punctuation the product does write (em dash, arrow, ×, §, ©, ™,
// accented characters) — decide whether it discriminates. Neither fixture
// is under `src/`, so neither is swept by the rule they check.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { SRC_DIR, read, walkFiles } from "./vocabulary";

const FIXTURES = "tests/ui/design/__fixtures__";

/** Unicode gives `Extended_Pictographic` to marks that are typography, not
 *  emoji: the copyright and trademark signs, the arrows this repo writes
 *  in prose (`↔`, `↩`), and the geometric shapes a bullet is drawn with.
 *  Each is text-presentation by default and each is something the product
 *  legitimately writes, so they are exempt — *unless* a variation
 *  selector-16 follows, which is a request for the emoji glyph and is
 *  never anything else.
 *
 *  Everything else `Extended_Pictographic` covers is a finding whether or
 *  not it has emoji presentation by default: `⚠`, `✂` and `☀` are emoji
 *  in every browser that matters, and "no emoji anywhere" is not a rule
 *  that should turn on a font's opinion. */
const TYPOGRAPHIC_EXEMPT: ReadonlyArray<readonly [number, number]> = [
  [0x00a9, 0x00a9], // ©
  [0x00ae, 0x00ae], // ®
  [0x2122, 0x2122], // ™
  [0x2190, 0x21ff], // Arrows
  [0x25a0, 0x25ff], // Geometric Shapes
];

function isTypographic(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return TYPOGRAPHIC_EXEMPT.some(([lo, hi]) => code >= lo && code <= hi);
}

const VARIATION_SELECTOR_16 = "️";

/** Every emoji character in a string, with the offset it sits at.
 *
 *  `Extended_Pictographic` is the property that means "an emoji, or a
 *  character that can be one"; `Regional_Indicator` covers flags, whose
 *  code points are not pictographic on their own; U+20E3 is the enclosing
 *  keycap; U+FE0F is the request for an emoji glyph, and is a finding
 *  wherever it appears — it is only ever written to make something render
 *  as emoji. */
function emojiIn(text: string): Array<{ char: string; index: number }> {
  const out: Array<{ char: string; index: number }> = [];
  const re = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣|️/gu;
  for (const match of text.matchAll(re)) {
    const char = match[0];
    const index = match.index;
    if (isTypographic(char) && text[index + char.length] !== VARIATION_SELECTOR_16) continue;
    out.push({ char, index });
  }
  return out;
}

/** `file:line — the offending character, as a code point`, for every hit.
 *  Named, not counted: a failure has to say which character and where. */
function findingsIn(rel: string): string[] {
  const text = read(rel);
  return emojiIn(text).map(({ char, index }) => {
    const line = text.slice(0, index).split("\n").length;
    const codePoint = (char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0");
    return `${rel}:${line} U+${codePoint}`;
  });
}

/* ── the fixtures decide whether the detector discriminates ───────────── */

describe("the no-emoji detector", () => {
  it("fires on every emoji form: pictographic, keycap, flag, and an explicit emoji glyph request", () => {
    const hits = emojiIn(read(`${FIXTURES}/emoji-present.txt`));
    // Five lines, five forms: a pictograph, a dingbat, a symbol asking for
    // the emoji glyph, a two-code-point flag, and a keycap.
    expect(hits.length).toBeGreaterThanOrEqual(7);
  });

  it("fires on nothing in the punctuation the product actually writes", () => {
    expect(emojiIn(read(`${FIXTURES}/emoji-absent.txt`))).toEqual([]);
  });

  it("counts a typographic mark only when it asks for the emoji glyph", () => {
    expect(emojiIn("ReachKit™")).toEqual([]);
    expect(emojiIn(`ReachKit™${VARIATION_SELECTOR_16}`)).toHaveLength(2);
  });

  it("the exemption is typography, not every text-presentation character", () => {
    // `src/lib/market/setup/state.ts` writes `↔` in prose about a module
    // cycle; nothing in the product writes a warning sign.
    expect(emojiIn("src/lib/market ↔ src/lib/scan")).toEqual([]);
    expect(emojiIn("Careful ⚠")).toHaveLength(1);
  });
});

/* ── the two sweeps ───────────────────────────────────────────────────── */

describe('§2.3 — "No emoji anywhere in the product"', () => {
  it("no file under src/ contains one", () => {
    const findings = walkFiles(SRC_DIR, () => true).flatMap(findingsIn);
    expect(findings).toEqual([]);
  });

  it("no copy key's value contains one", () => {
    const findings = Object.entries(COPY).flatMap(([key, value]) =>
      emojiIn(value).map(({ char }) => `${key}: ${char}`)
    );
    expect(findings).toEqual([]);
  });

  it("the sweep reads the registry as it ships, so an escaped emoji is caught too", () => {
    // The failure a file scan of `keys/*.ts` misses: the source holds
    // `"\u{1F389}"` and the screen holds the character.
    const escaped: Record<string, string> = { "offer.cta": "Get the report \u{1F389}" };
    const findings = Object.entries(escaped).flatMap(([key, value]) =>
      emojiIn(value).map(({ char }) => `${key}: ${char}`)
    );
    expect(findings).toHaveLength(1);
  });

  it("mutation: an emoji dropped into a source file is caught, and named with its line", () => {
    expect(findingsIn(`${FIXTURES}/emoji-present.txt`)).toContain(
      `${FIXTURES}/emoji-present.txt:4 U+1F389`
    );
  });

  it("the sweep is a whole-tree walk, not a list of files (ADR-010)", () => {
    const swept = walkFiles(SRC_DIR, () => true);
    // Every extension the tree holds is in scope — a stylesheet's
    // `content: "…"` speaks to the customer as loudly as a copy key.
    expect(swept.some((f) => f.endsWith(".css"))).toBe(true);
    expect(swept.some((f) => f.endsWith(".tsx"))).toBe(true);
    expect(swept).toContain(path.posix.join("src", "ui", "theme.css"));
  });
});
