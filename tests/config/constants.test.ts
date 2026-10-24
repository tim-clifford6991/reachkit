// tests/config/constants.test.ts
//
// BP-005: every constant is frozen, and no exported value carries a word the
// registry owns. What the file's text may hold (no import, no email, no
// currency sign, no copy key, no CopyKey) is `local/constants-hold-no-copy`
// in eslint.config.mjs.
import { describe, expect, it } from "vitest";
import * as constants from "../../src/lib/config/constants.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every string reachable from an exported value, walked recursively through
 * plain objects and arrays (both keys and values). A JSDoc/line comment does
 * not survive `import()` — this only ever sees runtime values, never prose,
 * so a source quotation kept in a comment (BP-005's own `SCORE_BAND_BOUNDS`
 * block, transcribed verbatim per WO-006 step 5) cannot trip it.
 */
function collectStrings(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, v] of Object.entries(value)) {
      out.add(key);
      collectStrings(v, out);
    }
  }
}

const allExports = Object.entries(constants as Record<string, unknown>);

describe('BP-005 error behaviour — "Every constant is `as const` and frozen; nothing mutates a pin at runtime"', () => {
  it("the module exports at least one group", () => {
    expect(allExports.length).toBeGreaterThan(0);
  });

  it.each(allExports)("%s is frozen (Object.isFrozen)", (_name, value) => {
    expect(Object.isFrozen(value)).toBe(true);
  });

  const objectExports = allExports.filter(([, v]) => typeof v === "object" && v !== null);

  it.each(objectExports)("writing to %s throws in strict mode", (_name, value) => {
    const target = value as Record<string, unknown>;
    const key = Array.isArray(target) ? "0" : (Object.keys(target)[0] ?? "__probe__");
    expect(() => {
      (target as Record<string, unknown>)[key] = "mutated";
    }).toThrow();
  });
});

describe('BP-005 decision 3 — "Not declared, deliberately: the removal address REQ-002 criterion 1 requires the report to name"', () => {
  it("exports no key naming a removal address", () => {
    const names = Object.keys(constants as Record<string, unknown>);
    expect(names.some((n) => /removal/i.test(n))).toBe(false);
  });
});

describe("BP-005 decision 2, and decision 3's discharge — no band, rival-size, severity or score-band word", () => {
  const strings = new Set<string>();
  for (const value of Object.values(constants as Record<string, unknown>)) {
    collectStrings(value, strings);
  }

  // BP-019 BAND_LABELS.winnability (REQ-047 c10), transcribed as the words
  // ruled 2026-08-31, never as the lowercase keys this file itself uses.
  const winnability = ["Winnable", "Reach", "Not yet"];
  // BP-019 BAND_LABELS.rivalSize (REQ-096 c2, c9).
  const rivalSize = ["Similar size", "Larger", "Much larger"];
  // BP-019 SEVERITY (REQ-009 c8).
  const severity = ["Minor", "Worth fixing", "Critical"];
  // BP-019 SCORE_BANDS (REQ-004 c1) — the four words `SCORE_BAND_BOUNDS`
  // deliberately holds no copy of (BP-005 decision 1 / this file's header).
  const scoreBands = ["Invisible", "Hard to find", "Findable", "Dominant"];

  it.each([...winnability, ...rivalSize, ...severity, ...scoreBands])(
    'no exported value or key equals the word "%s"',
    (word) => {
      expect(strings.has(word)).toBe(false);
    }
  );
});

describe('BP-005 `AI_READER_AGENTS` — "An empty list fails the pins test."', () => {
  it("is non-empty", () => {
    expect(constants.AI_READER_AGENTS.length).toBeGreaterThan(0);
  });
});
