// tests/config/constants.test.ts
//
// WO-006 test plan — structural tests only, criteria quoted from BP-005 (its
// `## Test plan` header note: BP-005 carries `satisfies: []`, so this work
// order claims no `implements:` edge to a requirement and cites BP-005's
// stated behaviour rather than inheriting a requirement's criteria). The
// value-against-quoted-source assertions WO-007 held were deleted (#561);
// nothing here replaces them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as constants from "../../src/lib/config/constants.ts";

const CONSTANTS_PATH = path.resolve(__dirname, "../../src/lib/config/constants.ts");
const SOURCE = readFileSync(CONSTANTS_PATH, "utf8");

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

describe('BP-005 module boundary — "Imported by every other module; imports nothing."', () => {
  it("declares no import statement", () => {
    expect(SOURCE).not.toMatch(/^\s*import\s/m);
  });
});

describe('BP-005 decision 3 — "Not declared, deliberately: the removal address REQ-002 criterion 1 requires the report to name"', () => {
  it("exports no key naming a removal address", () => {
    const names = Object.keys(constants as Record<string, unknown>);
    expect(names.some((n) => /removal/i.test(n))).toBe(false);
  });

  it("carries no email-address-shaped literal anywhere in the file", () => {
    expect(SOURCE).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
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

describe("BP-005 `SCORE_BAND_BOUNDS` (added 2026-08-31) — boundaries only", () => {
  it("has exactly the four keys invisible, hard-to-find, findable, dominant", () => {
    expect(Object.keys(constants.SCORE_BAND_BOUNDS).sort()).toEqual(
      ["dominant", "findable", "hard-to-find", "invisible"].sort()
    );
  });

  it("every value is a number, and none is a string", () => {
    for (const value of Object.values(constants.SCORE_BAND_BOUNDS)) {
      expect(typeof value).toBe("number");
      expect(typeof value).not.toBe("string");
    }
  });
});

describe("BP-005 `GOAL_VALUES` — \"It is no longer optional, and BP-038 renders that tile's goal like the other three.\"", () => {
  it("pages_published === 30", () => {
    expect(constants.GOAL_VALUES.pages_published).toBe(30);
  });

  it("the field is present, not optional", () => {
    expect(Object.prototype.hasOwnProperty.call(constants.GOAL_VALUES, "pages_published")).toBe(true);
    expect(constants.GOAL_VALUES.pages_published).not.toBeUndefined();
  });
});

describe('BP-005 `GOAL_VALUES` note — "this file stays free of `CopyKey` and keeps importing nothing"', () => {
  it("declares no identifier named CopyKey (comments may discuss it in prose; code may not use it)", () => {
    // BP-005's own source comment says, verbatim, "this file stays free of
    // `CopyKey`" — a mention *in prose* of the type this file must not use.
    // Stripping comments before the check is what makes the criterion ("no
    // identifier named CopyKey appears") distinct from "the word CopyKey
    // never appears", which BP-005's own transcribed comment would fail.
    const withoutComments = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(withoutComments).not.toMatch(/\bCopyKey\b/);
  });
});

describe('BP-005 `AI_READER_AGENTS` — "An empty list fails the pins test."', () => {
  it("is non-empty", () => {
    expect(constants.AI_READER_AGENTS.length).toBeGreaterThan(0);
  });
});

// WO-251 — BP-005 `SCORING` (added 2026-09-04): "`directAnswerCharsMin: 40
// // inclusive` · `directAnswerCharsMax: 320 // inclusive` ·
// `answerabilityFloor: 1`" — transcribed, frozen, three members.
describe("BP-005 `SCORING` (added 2026-09-04) — transcribed, frozen, three members", () => {
  it("has exactly the three keys directAnswerCharsMin, directAnswerCharsMax, answerabilityFloor", () => {
    expect(Object.keys(constants.SCORING).sort()).toEqual(
      ["answerabilityFloor", "directAnswerCharsMax", "directAnswerCharsMin"].sort()
    );
  });

  it("directAnswerCharsMin === 40", () => {
    expect(constants.SCORING.directAnswerCharsMin).toBe(40);
  });

  it("directAnswerCharsMax === 320", () => {
    expect(constants.SCORING.directAnswerCharsMax).toBe(320);
  });

  it("answerabilityFloor === 1", () => {
    expect(constants.SCORING.answerabilityFloor).toBe(1);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(constants.SCORING)).toBe(true);
  });
});

// BP-005's `SCORING` comment, verbatim: "`PRESENCE_FLOOR` is deliberately
// not a fourth member, and unifying it with `answerabilityFloor` would be
// a defect wearing a cleanup's clothes." The key-set assertion above is
// exact (three keys), so a fourth member named for Presence already fails
// it; this row names that guard explicitly so the intent is not silent.
describe("SCORING carries no presence floor", () => {
  it("has no key naming presence", () => {
    const names = Object.keys(constants.SCORING);
    expect(names.some((n) => /presence/i.test(n))).toBe(false);
  });

  it("has exactly three keys, not four", () => {
    expect(Object.keys(constants.SCORING)).toHaveLength(3);
  });
});

// BUILD §6.4 — `DNS_TIMEOUT_MS` (added 2026-09-05, issue #22): the one bound
// on `resolvesInDns()`'s lookup, pinned here so `src/lib/egress/dns.ts`
// carries no number of its own.
describe("BUILD §6.4 `DNS_TIMEOUT_MS` — resolvesInDns bound", () => {
  it("is 5000 ms", () => {
    expect(constants.DNS_TIMEOUT_MS).toBe(5000);
  });

  it("is a positive finite number", () => {
    expect(Number.isFinite(constants.DNS_TIMEOUT_MS)).toBe(true);
    expect(constants.DNS_TIMEOUT_MS).toBeGreaterThan(0);
  });
});

// REQ-002 c3, and the owner's 2026-09-05 ruling on #28: a removed domain's
// report address serves `410 Gone` — not `404`, which would say the address
// never existed, and not `200`, which the archived plan (WO-282) specced
// before the ruling.
describe("REPORT_REMOVED_STATUS — the removed report address's status", () => {
  it("=== 410", () => {
    expect(constants.REPORT_REMOVED_STATUS).toBe(410);
  });

  it("is not 404 and not 200", () => {
    expect(constants.REPORT_REMOVED_STATUS).not.toBe(404);
    expect(constants.REPORT_REMOVED_STATUS).not.toBe(200);
  });
});

// BUILD §9 / REQ-076 c10 (issue #49) — the hosted edge's own 410.
describe("HOSTED_GONE_STATUS — a hosted address that has stopped serving", () => {
  it("=== 410", () => {
    expect(constants.HOSTED_GONE_STATUS).toBe(410);
  });

  it("is not 404, not 200 and not a redirect", () => {
    expect(constants.HOSTED_GONE_STATUS).not.toBe(404);
    expect(constants.HOSTED_GONE_STATUS).not.toBe(200);
    // 4xx, so it is a statement about the request and never a redirect.
    expect(Math.floor(constants.HOSTED_GONE_STATUS / 100)).toBe(4);
  });
});

// BUILD §9 (issue #49) — the preview host's parent.
describe("PREVIEW_HOST_SUFFIX — the parent of every {slug}.reachkit.app preview", () => {
  it("is a bare hostname: no scheme, no path, no leading dot", () => {
    expect(constants.PREVIEW_HOST_SUFFIX).not.toContain("/");
    expect(constants.PREVIEW_HOST_SUFFIX.startsWith(".")).toBe(false);
    expect(constants.PREVIEW_HOST_SUFFIX.endsWith(".")).toBe(false);
  });

  it("is not the subdomain label — the two are different things and never merge", () => {
    expect(constants.PREVIEW_HOST_SUFFIX).not.toBe(constants.HOSTED_SUBDOMAIN_LABEL);
  });
});

// BUILD §13 / ADR-052 — the three price pins (issues #33, #91). Structural
// rows only: no row asserts the values against their quoted clauses.
// The last two rows are the ones that keep the *sentence* out of this file —
// BP-005 decision 5, "no customer-visible string enters this file; the
// sentence a founder reads stays in the registry under `PRICE_COPY_KEYS`".
describe("BUILD §13 price pins — three exports, and no sentence about the price", () => {
  it("PRICE_EUR_CENTS is an integer number of minor units", () => {
    expect(typeof constants.PRICE_EUR_CENTS).toBe("number");
    expect(Number.isInteger(constants.PRICE_EUR_CENTS)).toBe(true);
    expect(constants.PRICE_EUR_CENTS).toBeGreaterThan(0);
  });

  it("PRICE_CURRENCY and PRICE_INTERVAL are lowercase strings, as the vendor's Price object carries them", () => {
    expect(typeof constants.PRICE_CURRENCY).toBe("string");
    expect(constants.PRICE_CURRENCY).toBe(constants.PRICE_CURRENCY.toLowerCase());
    expect(typeof constants.PRICE_INTERVAL).toBe("string");
    expect(constants.PRICE_INTERVAL).toBe(constants.PRICE_INTERVAL.toLowerCase());
  });

  it("the file carries no currency sign and no tax word — the sentence is the registry's", () => {
    expect(SOURCE).not.toMatch(/[€$£]/);
    expect(SOURCE).not.toMatch(/\bVAT\b/);
    expect(SOURCE).not.toMatch(/per month/);
  });

  it("the file names no copy key — no `price.` literal reaches it", () => {
    expect(SOURCE).not.toMatch(/["'`]price\.[a-z_]/);
  });
});

// BUILD §13 / REQ-024 c5, c6 — the two payment backstop clocks (issue #33).
describe("BUILD §13 payment backstops — two clocks, in different units, each its own pin", () => {
  it("PAYMENT_CHASE_MINUTES and PAYMENT_BACKSTOP_H are both positive integers", () => {
    expect(Number.isInteger(constants.PAYMENT_CHASE_MINUTES)).toBe(true);
    expect(constants.PAYMENT_CHASE_MINUTES).toBeGreaterThan(0);
    expect(Number.isInteger(constants.PAYMENT_BACKSTOP_H)).toBe(true);
    expect(constants.PAYMENT_BACKSTOP_H).toBeGreaterThan(0);
  });

  it("neither is an alias of the pin that happens to share its number", () => {
    // A cleanup that unified either pair would make a change to the tick's
    // cadence silently change when a founder is chased, and a change to
    // the publication check silently change when the backstop fires.
    expect(constants.PAYMENT_CHASE_MINUTES).not.toBe(constants.MAINTENANCE_TICK_MINUTES * 2);
    expect(constants.PAYMENT_BACKSTOP_H).not.toBe(constants.PUBLISH_VERIFY_DELAY_H * 2);
  });
});
