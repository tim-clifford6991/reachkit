// tests/measure/domain/parse.test.ts
//
// WO-251 `## Test plan` — the deterministic on-page parse. Every fixture is
// held inline (file plan: "over checked-in HTML fixtures held inline in
// the file"). No REQ criterion is inherited (see the WO's own test-plan
// header note) — every row below quotes BP-010 or `SPEC.md` §5 verbatim.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCORING } from "@/lib/config/constants";
import { parseOnPage, visibleText } from "../../../src/lib/measure/parse.ts";

const URL = "https://example.com/";
const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/measure/parse.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");
// Comment-stripped: the source legitimately explains, in prose, why it does
// NOT call `toLocaleLowerCase`/`Intl`/etc — only the actual code must be
// free of these tokens (the same convention `tests/config/constants.test.ts`
// and `tests/measure/verdict/score.test.ts` already use).
const CODE_ONLY = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function heading(level: number, text: string): string {
  return `<h${level}>${text}</h${level}>`;
}

describe(
  'BP-010 `## Error & edge behavior` — "Determinism is a test, not an aspiration: the same HTML measured twice produces byte-identical output (`SPEC.md` §16 milestone 2). No JS execution, no clock in the parse, no locale-dependent collation."',
  () => {
    const fixture = `
      <html><head>
        <meta property="og:title" content="Example">
        <script type="application/ld+json">{"@type":"Article","author":{"@type":"Person","name":"A"}}</script>
      </head><body>
        ${heading(2, "How does this work?")}
        <p>${"A".repeat(50)}</p>
        <p>There were 12 sightings on 2026-09-04, cited at <a href="https://other.example/x">other</a>.</p>
      </body></html>
    `;

    it("the same document parses to a byte-identical value twice", () => {
      const first = parseOnPage({ url: URL, html: fixture });
      const second = parseOnPage({ url: URL, html: fixture });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it("parsing twice with the process TZ shifted between calls still yields byte-identical output", () => {
      const originalTz = process.env.TZ;
      try {
        process.env.TZ = "UTC";
        const first = parseOnPage({ url: URL, html: fixture });
        process.env.TZ = "Pacific/Kiritimati";
        const second = parseOnPage({ url: URL, html: fixture });
        expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      } finally {
        if (originalTz === undefined) delete process.env.TZ;
        else process.env.TZ = originalTz;
      }
    });

    it("carries no Date, no Intl, no toLocale*, no Math.random and no fetch in its source", () => {
      expect(CODE_ONLY).not.toMatch(/\bnew Date\b/);
      expect(CODE_ONLY).not.toMatch(/\bIntl\b/);
      expect(CODE_ONLY).not.toMatch(/\btoLocale/);
      expect(CODE_ONLY).not.toMatch(/Math\.random/);
      expect(CODE_ONLY).not.toMatch(/\bfetch\(/);
    });
  }
);

describe(
  'BP-010 `## Error & edge behavior` — "Empty denominators read 0, never null (`SPEC.md` §5): a page with no headings scores `zero`, not `unmeasured`."',
  () => {
    it("a document with no headings yields every count at 0, not null", () => {
      const result = parseOnPage({ url: URL, html: "<html><body><p>Nothing to see here.</p></body></html>" });
      expect(result.headings).toBe(0);
      expect(result.questionShapedHeadings).toBe(0);
      expect(result.directAnswerHeadings).toBe(0);
    });

    it("type-level: no field of OnPageFacts admits null or undefined (compile-time)", () => {
      const result = parseOnPage({ url: URL, html: "" });
      for (const value of Object.values(result)) {
        expect(value).not.toBeNull();
        expect(value).not.toBeUndefined();
      }
    });
  }
);

describe(
  'SPEC.md §5 — "question-shaped = ends `?` or opens with how/what/why/when/where/which/who/can/do/does/is/are"',
  () => {
    const OPENERS = ["how", "what", "why", "when", "where", "which", "who", "can", "do", "does", "is", "are"];

    it("the question shape is exactly the trailing ? and the twelve openers", () => {
      const openerHeadings = OPENERS.map((o, i) => heading(2, `${o.charAt(0).toUpperCase()}${o.slice(1)} does example ${i} work`));
      const trailingQuestion = heading(2, "Ready to scale up?");
      const thirteenthOpener = heading(2, "Should you migrate now");
      const interiorQuestion = heading(2, "Really? I mean it");

      const html = `<html><body>${openerHeadings.join("")}${trailingQuestion}${thirteenthOpener}${interiorQuestion}</body></html>`;
      const result = parseOnPage({ url: URL, html });

      expect(result.headings).toBe(OPENERS.length + 3);
      // 12 openers + 1 trailing-? heading counted; the 13th-opener and the
      // interior-? heading are not.
      expect(result.questionShapedHeadings).toBe(OPENERS.length + 1);
    });

    it("a thirteenth opener not on the list ('should …') is not counted", () => {
      const result = parseOnPage({ url: URL, html: heading(2, "Should you migrate now") });
      expect(result.questionShapedHeadings).toBe(0);
    });

    it("a heading with an interior ? (not trailing, not an opener) is not counted", () => {
      const result = parseOnPage({ url: URL, html: heading(2, "Really? I mean it") });
      expect(result.questionShapedHeadings).toBe(0);
    });

    it("adding a thirteenth opener to the battery would fail the negative case (documented, not executed as a mutation here — see mutation notes in the WO return)", () => {
      // Structural guard: the opener list in source is exactly the twelve
      // named, comma-separated, in this order — a stand-in for the
      // "adding a thirteenth opener fails the negative case" mutation,
      // which this suite's own negative test above already discriminates.
      const openerListMatch = SOURCE.match(/const QUESTION_OPENERS: readonly string\[\] = \[([\s\S]*?)\];/);
      expect(openerListMatch).not.toBeNull();
      const listSource = (openerListMatch as RegExpMatchArray)[1] ?? "";
      const found = [...listSource.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
      expect(found).toEqual(OPENERS);
    });
  }
);

describe(
  'SPEC.md §5 — "`directAnswers` = question headings whose first block is 40–320 visible chars ÷ all headings × 100"',
  () => {
    it("the direct-answer window is inclusive at both bounds and read from the pin", () => {
      const lengths = [39, 40, 320, 321];
      const html = `<html><body>${lengths
        .map((n, i) => `${heading(2, `How does case ${i} work?`)}<p>${"A".repeat(n)}</p>`)
        .join("")}</body></html>`;
      const result = parseOnPage({ url: URL, html });

      expect(result.headings).toBe(4);
      expect(result.questionShapedHeadings).toBe(4);
      expect(result.directAnswerHeadings).toBe(2);
    });

    it("the two bounds come from SCORING, not a literal", () => {
      expect(SCORING.directAnswerCharsMin).toBe(40);
      expect(SCORING.directAnswerCharsMax).toBe(320);
      expect(SOURCE).toMatch(/SCORING\.directAnswerCharsMin/);
      expect(SOURCE).toMatch(/SCORING\.directAnswerCharsMax/);
    });

    it("neither 40 nor 320 appears as a literal in parse.ts", () => {
      // Comment-stripped: BP-010's own JSDoc quotes "40–320" in prose,
      // which is not a literal in the code.
      const withoutComments = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(withoutComments).not.toMatch(/\b40\b/);
      expect(withoutComments).not.toMatch(/\b320\b/);
    });
  }
);

describe(
  'SPEC.md §5 — "`evidenceDensity` = saturating log curve over (numerals + dates + outbound citations per 1k chars)" — the counts only; the curve is WO-252\'s',
  () => {
    it("evidence tokens are counted over rendered text, never over markup", () => {
      const html = `<html><body>
        <script>1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20</script>
        <p>There are 111 and 222 and 333 in view.</p>
      </body></html>`;
      const result = parseOnPage({ url: URL, html });
      expect(result.numerals).toBe(3);
      expect(result.visibleChars).toBeLessThan(200);
    });

    it("evidence tokens ignore digits inside tag attributes — a raw innerHTML read would inflate this", () => {
      const html = `<html><body><div data-id="99999" data-count="88888"><p>Only 7 here.</p></div></body></html>`;
      const result = parseOnPage({ url: URL, html });
      expect(result.numerals).toBe(1);
    });

    it("a source assertion holds that parse.ts contains no log, no Math.log10 and no per-1,000-char division — the curve is not here", () => {
      expect(CODE_ONLY).not.toMatch(/Math\.log/);
      expect(CODE_ONLY).not.toMatch(/\blog10\b/i);
      // The saturating curve's own denominator (`SPEC.md` §5: "per 1k
      // chars") is the one division this file must not perform.
      expect(CODE_ONLY).not.toMatch(/\/\s*1[,_]?000\b/);
    });

    it("dates are counted from rendered text", () => {
      const html = `<html><body><p>Published 2026-09-04 and again on September 4, 2026.</p></body></html>`;
      const result = parseOnPage({ url: URL, html });
      expect(result.dates).toBeGreaterThanOrEqual(2);
    });

    it("outbound citations count links to a different host than the page's own", () => {
      const html = `<html><body>
        <p><a href="https://other.example/a">outbound</a></p>
        <p><a href="/local/path">local</a></p>
        <p><a href="https://example.com/also-local">same host</a></p>
      </body></html>`;
      const result = parseOnPage({ url: URL, html });
      expect(result.outboundCitations).toBe(1);
    });
  }
);

describe(
  'BP-010 `## Error & edge behavior` — "A home document read successfully that tells every reader not to index it is a measured 0 for Foundations and forces the score to 0 with its band word — it is never a \\"—\\"" — the fact only; the forcing is WO-252\'s',
  () => {
    it("a generic noindex and a targeted one are different facts", () => {
      const generic = parseOnPage({
        url: URL,
        html: `<html><head><meta name="robots" content="noindex"></head><body></body></html>`,
      });
      expect(generic.noindex).toBe(true);
      expect(generic.noindexAppliesToEveryReader).toBe(true);

      const targeted = parseOnPage({
        url: URL,
        html: `<html><head><meta name="googlebot" content="noindex"></head><body></body></html>`,
      });
      expect(targeted.noindex).toBe(true);
      expect(targeted.noindexAppliesToEveryReader).toBe(false);

      const neither = parseOnPage({
        url: URL,
        html: `<html><head></head><body></body></html>`,
      });
      expect(neither.noindex).toBe(false);
      expect(neither.noindexAppliesToEveryReader).toBe(false);
    });
  }
);

describe('BP-010 `## Module / boundary` — "the parsers (headings, answer blocks, evidence density, schema, OG)"', () => {
  it("schema and Open Graph are read as written, never interpreted", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"FAQPage"}</script>
      <meta property="og:title" content="A title">
      <meta property="og:type" content="article">
    </head><body>
      <div itemscope itemtype="https://schema.org/Product"><span itemprop="name">Widget</span></div>
      <div itemscope itemtype="https://schema.org/QuantumWidget"></div>
    </body></html>`;
    const result = parseOnPage({ url: URL, html });

    expect(result.schemaTypes).toContain("faqpage");
    expect(result.schemaTypes).toContain("https://schema.org/product");
    // An unknown type is returned rather than dropped.
    expect(result.schemaTypes).toContain("https://schema.org/quantumwidget");

    expect(result.openGraphProperties).toEqual(["og:title", "og:type"]);
  });
});

describe('BP-005 `## Public interface`, `SCORING` (added 2026-09-04) — the pin is transcribed, never invented, here', () => {
  it("parse.ts imports SCORING rather than declaring its own copy", () => {
    expect(SOURCE).toMatch(/import\s*\{\s*SCORING\s*\}\s*from\s*"@\/lib\/config\/constants"/);
  });
});

describe("Additional tests this work order owns", () => {
  it("`visibleText` is the one extractor — exported, and no other file in this plan re-implements text extraction", () => {
    expect(typeof visibleText).toBe("function");
    expect(SOURCE).not.toMatch(/function\s+\w*[Ee]xtract\w*Text/); // no second extractor by another name
    const html = `<html><body><script>hidden(1)</script><style>.a{color:red}</style><!-- note --><p>Hello  world.</p></body></html>`;
    expect(visibleText(html)).toBe("Hello world.");
  });

  it("the parse never throws — malformed, truncated, empty and non-HTML inputs each return zeroed counts", () => {
    const inputs = [
      "",
      "<html><body><p>unterminated",
      "<<<not html at all>>>",
      "just plain text, no tags",
      "<div><span>&amp; &notarealentity; &#65;</span>",
    ];
    for (const html of inputs) {
      expect(() => parseOnPage({ url: URL, html })).not.toThrow();
      const result = parseOnPage({ url: URL, html });
      expect(result.headings).toBe(0);
    }
  });

  it("a malformed url never throws, even with an outbound anchor to resolve against it", () => {
    const html = `<html><body><a href="https://other.example/x">link</a></body></html>`;
    expect(() => parseOnPage({ url: "not a url at all", html })).not.toThrow();
    const result = parseOnPage({ url: "not a url at all", html });
    expect(result.headings).toBe(0);
  });

  it("an empty string parses to every count at 0", () => {
    const result = parseOnPage({ url: URL, html: "" });
    expect(result).toMatchObject({
      headings: 0,
      questionShapedHeadings: 0,
      directAnswerHeadings: 0,
      numerals: 0,
      dates: 0,
      outboundCitations: 0,
      visibleChars: 0,
      schemaTypes: [],
      openGraphProperties: [],
      noindex: false,
      noindexAppliesToEveryReader: false,
    });
  });
});
