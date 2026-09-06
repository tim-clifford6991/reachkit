// tests/pins.test.ts — BUILD §1: "`src/lib/config/constants.ts` **every**
// pinned number in this document, `tests/pins.test.ts` asserting them."
//
// Issue #8. Every pin in `src/lib/config/constants.ts` asserted against the
// clause that rules it, by quotation and never by line number: the clause is
// the test's name, and a second block asserts every quoted clause is still
// the words the owner files use. A pin that drifts fails here; a clause that
// is reworded fails here too, and the pin is re-read rather than re-typed.
//
// This file runs first (`vitest.config.ts`'s `PinsFirstSequencer`) and under
// a second, so a drifted constant fails before anything expensive runs.
//
// Where the ruling clause lives in the frozen corpus (`archive/`, frozen
// 2026-09-04 and never written to) it is quoted by id and text without a
// drift check: a frozen document cannot drift. Where it lives in `BUILD.md`,
// `DECISIONS.md` or `DATA-COSTS.md` — the three that can — the quote is
// checked.
//
// Companion file: `tests/config/constants.test.ts` is structural (frozen,
// imports nothing, carries no band word). Values live here.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as pins from "../src/lib/config/constants.ts";
import { BAND_LABELS } from "../src/lib/presentation/bands.ts";
import { copy } from "../src/lib/presentation/copy/index.ts";

const SUITE_START = Date.now();
const ROOT = path.resolve(import.meta.dirname, "..");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const doc = (name: string) => norm(readFileSync(path.join(ROOT, name), "utf8"));

const BUILD = doc("BUILD.md");
const DECISIONS = doc("DECISIONS.md");
const DATA_COSTS = doc("DATA-COSTS.md");
const PINS_SOURCE = readFileSync(path.join(ROOT, "tests/pins.test.ts"), "utf8");

/**
 * Every clause this file quotes from a document that can still change.
 * `B` = BUILD.md, `D` = DECISIONS.md, `C` = DATA-COSTS.md. The integrity
 * block at the foot asserts each one is still in its document, so a
 * reworded spec fails here rather than leaving a test name quietly lying.
 */
const B = {
  pinsHome:
    "`src/lib/config/constants.ts` **every** pinned number in this document, `tests/pins.test.ts` asserting them.",
  rankedFree: "| `RANKED_FREE_ROWS / COST` | 50 rows · 1.8¢ |",
  rankedPaid: "| `RANKED_PAID_ROWS / COST` | 300 rows · 4.8¢ |",
  rankedRival: "| `RANKED_RIVAL_ROWS / COST` | 100 rows · 2.4¢ |",
  competitorsDomain: "| `COMPETITORS_DOMAIN_COST` | 1.5¢ |",
  suggestions: "| `SUGGESTIONS_COST` | 1.8¢ / call @ 50 rows |",
  serpPrices: "| `SERP_LIVE / SERP_STD` | 0.2¢ · 0.06¢ |",
  chatgpt: "| `CHATGPT_SCRAPE_STD` | 0.12¢ (paid battery only — never on the free path) |",
  aiMode: "| `AI_MODE_LIVE / STD` | 0.2¢ · 0.06¢ |",
  questions: "| `QUESTIONS` | 12 |",
  targetSerps: "| `TARGET_SERPS_MAX` | 13 |",
  measuredPages: "| `MEASURED_PAGES_MAX` | 25 |",
  competitorsMax: "| `COMPETITORS_MAX` | 5 |",
  caps: "| `CAP_FREE / CAP_DEEP / CAP_WEEKLY / CAP_DRAFT` | 12¢ · 150¢ · 40¢ · 45¢ |",
  platformDomains:
    "| `PLATFORM_DOMAINS` | reddit, quora, youtube, wikipedia, g2, capterra, medium, linkedin, producthunt, stackoverflow, … (closed list) |",
  rivalScore: "| `RIVAL_SCORE` | top10Appearances + 2×aiCitations (§6.6) |",
  serpLocation: "| `SERP_LOCATION` | Google US · en (MVP; §6.3a) |",
  locale:
    "Every SERP, suggestion and volume uses Google US / `en` — one location constant (`SERP_LOCATION`), never per-customer derivation.",
  aiModeRow: "| **Google AI Mode** | Google's AI answer surface, own SERP endpoint, cited sources | 0.06¢ std / 0.2¢ live |",
  chatgptRow: "| **ChatGPT (LLM Scraper)** | The actual ChatGPT product's answer, scraped | 0.12¢ std / 0.4¢ live |",
  scoreBands: "Bands: 0–24 Invisible · 25–49 Hard to find · 50–74 Findable · 75–100 Dominant",
  answerability: "Answerability = shape of the home + measured pages, 0–100, floored at 1",
  directAnswers:
    "`directAnswers` = question headings whose first block is 40–320 visible chars ÷ all headings × 100",
  cacheWindows:
    "Cache windows: own domain 7d · rivals 30d · SERPs 30d (except the weekly target re-check) · suggestions 30d.",
  rescan: "**A free re-scan of the same domain within 7 days serves the stored report** — no new spend.",
  cooldown: "(Failure cooldown stays 24h as specced.)",
  fetcher:
    "Every fetch of user-supplied URLs goes through one SSRF-guarded, DNS-pinned, size-capped fetcher",
  neverPull: "Never: SERP depth >10 · search operators (`site:` = 5×) · clickstream flags · `load_async_ai_overview`",
  freeBounds: "Bounds: 5 free scans/IP/h · 1 in-flight/IP · 200 free scans/day",
  freeSeconds: "Free ≈60s live; deep live; weekly standard",
  weeklyUtc: "| `weekly/refresh` | Mon 06:00 UTC |",
  winnability:
    "**Winnability (right-sizing):** a Write target qualifies only if its top-10 contains at least one domain whose ranked count ≤ max(500, 5× customer's).",
  supplyCap: "**Supply is the cap:** never invent an opportunity to fill a day.",
  doorway:
    "**Not a doorway**: answers the target question before naming the product (checked: first 300 chars contain no brand mention).",
  nearDuplicate: "**Near-duplicate gate**: ≥85% similarity vs the customer's published set = never queued.",
  regenerate: "**Do-not-claim list**: hard output filter (string/semantic match), failure = regenerate, twice = needs-attention.",
  noPromptTricks: "no prompt-shaped tricks, no hidden instructions, in any generated page",
  veto: "Autopilot = auto-approve when the veto window (default 24h, settable 0–7d) expires without a veto.",
  vetoStepper: "veto window stepper 0–7d default 24h",
  rateLimits: "Autopilot hard limits regardless of settings: ≤1 publish/day, ≤8/week",
  retryThree: "failed → retry ×3 → needs_attention",
  verify24h: "**Verification:** publish +24h → fetch the live URL, confirm reachable/indexable/ in-sitemap/AI-readable (chips in the day panel).",
  robots:
    "a robots.txt **we serve** that allows GPTBot, ClaudeBot, OAI-SearchBot, Claude-SearchBot, PerplexityBot, Google-Extended.",
  nurture: "Nurture: max 3 mails (24h/72h/168h), stops on conversion.",
  goal400: 'footnote pair: start value · "At 400 the big category terms unlock."',
  goal6: 'AI answers `n/12` (dot row incl. dashed goal dots + "goal: 6")',
  ratioUnlock:
    'The ratio module unlocks at ranked ≥ 10 with copy "now comparable".',
  twoAlerts:
    '**This week**: 7-day strip (done/today/next) + "Open calendar →" + up to two alerts (today\'s page pending veto → "Read it"; a needs-you item → action button).',
  selectionScore: "score = intentWeight × log10(volume + 1) volume floor: 50/mo",
  intentWeights:
    "3 decision best X · X vs Y · X alternatives · top X tools 3 solution {category} software|tool|app|platform 2 problem how to {job} · {pain phrase} 1 informational what is X",
  composition: "≥4 decision · ≥3 solution · ≤3 rival-brand · ≤2 how-to",
  coherence:
    "if no domain appears in ≥3 of the 12 top-10s, the market set is likely wrong (disjoint SERPs = incoherent market)",
  correction: "one correction per free scan re-runs steps 2–5 (~4.2¢; worst case 10.5¢, still under the 12¢ cap)",
  rivalScoreFormula: "score = top10Appearances + 2 × aiCitations (cited-by-AI weighs double)",
  topFive: "top 5 by score = suggested rivals",
  priceFlat: "€49/mo flat.",
  taxDeferred: "**Tax handling is deferred (owner ruling, 28 Aug): no Stripe Tax at launch** — charge €49",
  pricingCard: "**Pricing card**: €49/mo + four spec rows (1/day · weekly · weekly · 24h veto)",
  cappedDraft: "`CAP_DRAFT` 45¢ is enforced headroom.",
  draftGenerate:
    "| `draft/generate` | daily, evening | Next opportunity → pipeline → `in_review`, veto clock starts, daily email |",
  publishVerify: "| `publish/verify` | +24h | Liveness checks |",
  weeklyRefreshRow:
    "| `weekly/refresh` | Mon 06:00 UTC | Weekly scan per active site → re-derive → verdicts → movement email |",
  absentFrom: "\"5 biggest searches you're absent from\" table (search · /mo · holds #1)",
  hostedCname:
    "**Hosted CMS:** `content.{customer-domain}` by CNAME → our edge route serves static-rendered pages by Host header.",
  draftEditor:
    "**Edit = Markdown textarea with a live preview pane** (owner ruling, 28 Aug) — two columns on desktop, tabbed on mobile, autosaved, no rich-text editor.",
} as const;

const D = {
  locale: "MVP is US-English only: one `SERP_LOCATION` constant, one written footer line. Locale derivation is v1.1.",
  tax: "No Stripe Tax at launch. Charge €49 tax-inclusive, collect country + VAT ID so records exist.",
  adr052: "The €49 Stripe Price is tax-inclusive with Stripe Tax off; switching tax on must never raise a customer's bill. — ADR-052",
  adr001: "One band-label registry (`BAND_LABELS`) owns all six band words; disjointness asserted once. — ADR-001",
  adr002: "Report pages are `noindex` forever and in no sitemap; v1 report removal is a written request, not an authenticated control. — ADR-002",
  adr022: "One closed, pinned list of AI reader user-agents (`AI_READER_AGENTS`); blocked-readers count, unblock lines and hosted robots policy all read it. — ADR-022",
  adr090: "`AI_CRAWLERS` is folded into `AI_READER_AGENTS`; one name. — ADR-090",
  adr051: "Deletion is a tombstone plus a 30-day purge; unreachability is enforced by row policy, not by callers. — ADR-051",
  adr060: 'Weekly measurement is triggered hourly and gated on each site\'s own local Monday; "Mon 06:00 UTC" is not the trigger. — ADR-060',
  adr094: "The free report's AI matrix DOES set `load_async_ai_overview` (counts Google's actual AI answers).",
  freeCap: 'Free-scan cap stays 12¢ ("a lead magnet … wasting money on it is a crime").',
  aiOneReading:
    "Overview's AI-answers tile shows one reading only: weeks present in the trailing window. The composite score has no tile on Overview.",
  markdownEditor:
    "Draft editing is a Markdown textarea with a live preview pane; no rich-text editor.",
} as const;

const C = {
  nano: "| Nano class (GPT-nano / Flash-Lite) | $0.20 · $1.25 |",
  haiku: "| **Haiku 4.5** | $1.00 · $5.00 |",
  competitorsRows: "| Labs `competitors_domain` | Rival domains **with their footprint metrics** in one call | **1.5¢** @ 25 rows |",
  suggestionsRows: "| Labs `keyword_suggestions` | The market's search set + volumes from a seed | **~1.8¢** per call @ 50 rows |",
  serpRow: "| SERP Google organic, advanced | Who holds a target search's top 10 | **0.2¢** live · 0.06¢ standard |",
} as const;

// ─────────────────────────────────────────────────────── BUILD §6.1 price book

describe("BUILD §6.1 price book — the vendor unit prices, quoted row by row", () => {
  it(`${B.rankedFree} — PRICE_BOOK.RANKED_FREE_ROWS / RANKED_FREE_COST_C`, () => {
    expect(pins.PRICE_BOOK.RANKED_FREE_ROWS).toBe(50);
    expect(pins.PRICE_BOOK.RANKED_FREE_COST_C).toBe(1.8);
  });

  it(`${B.rankedPaid} — PRICE_BOOK.RANKED_PAID_ROWS / RANKED_PAID_COST_C`, () => {
    expect(pins.PRICE_BOOK.RANKED_PAID_ROWS).toBe(300);
    expect(pins.PRICE_BOOK.RANKED_PAID_COST_C).toBe(4.8);
  });

  it(`${B.rankedRival} — PRICE_BOOK.RANKED_RIVAL_ROWS / RANKED_RIVAL_COST_C`, () => {
    expect(pins.PRICE_BOOK.RANKED_RIVAL_ROWS).toBe(100);
    expect(pins.PRICE_BOOK.RANKED_RIVAL_COST_C).toBe(2.4);
  });

  it(`${B.competitorsDomain} — PRICE_BOOK.COMPETITORS_DOMAIN_COST_C`, () => {
    expect(pins.PRICE_BOOK.COMPETITORS_DOMAIN_COST_C).toBe(1.5);
  });

  it(`${B.suggestions} — PRICE_BOOK.SUGGESTIONS_COST_C, and the "@ 50 rows" half is VENDOR.suggestionsRows`, () => {
    expect(pins.PRICE_BOOK.SUGGESTIONS_COST_C).toBe(1.8);
    expect(pins.VENDOR.suggestionsRows).toBe(50);
  });

  it(`${B.serpPrices} — PRICE_BOOK.SERP_LIVE_C / SERP_STD_C`, () => {
    expect(pins.PRICE_BOOK.SERP_LIVE_C).toBe(0.2);
    expect(pins.PRICE_BOOK.SERP_STD_C).toBe(0.06);
  });

  it(`${B.chatgpt} — PRICE_BOOK.CHATGPT_SCRAPE_STD_C (the std price only; §6.2's "0.12¢ std / 0.4¢ live" states the pair and only std is pinned, the free path making zero such calls)`, () => {
    expect(pins.PRICE_BOOK.CHATGPT_SCRAPE_STD_C).toBe(0.12);
  });

  // The archived BP-005 `## Public interface` carries a 2026-09-03 addendum
  // raising these two to 0.4 / 0.12 by reading the LLM-Scraper row of
  // `DATA-COSTS.md` §1. BUILD.md rules (CLAUDE.md: "The spec is BUILD.md"),
  // and BUILD.md states 0.2 / 0.06 twice — the §6.1 row and the §6.2 tier
  // table — consistent with AI Mode being a SERP endpoint priced at the SERP
  // row. constants.ts follows BUILD.md and so does this assertion; the
  // divergence is reported to the owner, never silently resolved here.
  it(`${B.aiMode} — PRICE_BOOK.AI_MODE_LIVE_C / AI_MODE_STD_C`, () => {
    expect(pins.PRICE_BOOK.AI_MODE_LIVE_C).toBe(0.2);
    expect(pins.PRICE_BOOK.AI_MODE_STD_C).toBe(0.06);
  });

  it(`${B.aiModeRow} — the same pair, stated the other way round in §6.2`, () => {
    expect(pins.PRICE_BOOK.AI_MODE_STD_C).toBe(0.06);
    expect(pins.PRICE_BOOK.AI_MODE_LIVE_C).toBe(0.2);
  });

  it("every price-book member is a positive finite number of cents, and the group is frozen", () => {
    for (const [key, value] of Object.entries(pins.PRICE_BOOK)) {
      expect(typeof value, key).toBe("number");
      expect(Number.isFinite(value), key).toBe(true);
      expect(value, key).toBeGreaterThan(0);
    }
    expect(Object.isFrozen(pins.PRICE_BOOK)).toBe(true);
  });
});

describe("BUILD §6.1 battery — the four counts the whole pipeline is sized by", () => {
  it(`${B.questions} — BATTERY.QUESTIONS`, () => {
    expect(pins.BATTERY.QUESTIONS).toBe(12);
  });

  it(`${B.targetSerps} — BATTERY.TARGET_SERPS_MAX`, () => {
    expect(pins.BATTERY.TARGET_SERPS_MAX).toBe(13);
  });

  it(`${B.measuredPages} — BATTERY.MEASURED_PAGES_MAX`, () => {
    expect(pins.BATTERY.MEASURED_PAGES_MAX).toBe(25);
  });

  it(`${B.competitorsMax} — BATTERY.COMPETITORS_MAX`, () => {
    expect(pins.BATTERY.COMPETITORS_MAX).toBe(5);
  });

  it("the battery holds exactly those four counts and nothing that tunes them", () => {
    expect(Object.keys(pins.BATTERY).sort()).toEqual([
      "COMPETITORS_MAX",
      "MEASURED_PAGES_MAX",
      "QUESTIONS",
      "TARGET_SERPS_MAX",
    ]);
  });
});

describe("BUILD §6.1 caps — the four spend ceilings, in cents", () => {
  it(`${B.caps} — CAPS.FREE_C / DEEP_C / WEEKLY_C / DRAFT_C`, () => {
    expect(pins.CAPS.FREE_C).toBe(12);
    expect(pins.CAPS.DEEP_C).toBe(150);
    expect(pins.CAPS.WEEKLY_C).toBe(40);
    expect(pins.CAPS.DRAFT_C).toBe(45);
  });

  it(`DECISIONS 2026-09-03 — "${D.freeCap}" — FREE_C is ruled at 12, not merely left there`, () => {
    expect(pins.CAPS.FREE_C).toBe(12);
  });

  it(`${B.correction} — one correction composes inside FREE_C, and the stated worst case is under it`, () => {
    expect(10.5).toBeLessThan(pins.CAPS.FREE_C);
    expect(pins.CORRECTION.perScan).toBe(1);
  });

  it(`${B.cappedDraft} — CAPS.DRAFT_C`, () => {
    expect(pins.CAPS.DRAFT_C).toBe(45);
  });
});

describe("BUILD §6.1 — PLATFORM_DOMAINS, the closed partition list", () => {
  it(`${B.platformDomains} — the ten names §6.1 states, in its order`, () => {
    expect([...pins.PLATFORM_DOMAINS]).toEqual([
      "reddit",
      "quora",
      "youtube",
      "wikipedia",
      "g2",
      "capterra",
      "medium",
      "linkedin",
      "producthunt",
      "stackoverflow",
    ]);
  });

  // §6.1's row ends in an ellipsis, so the list is what §6.1 states and not a
  // complete list on its face. An empty list would silently make every
  // platform hit a rival candidate, so it is asserted non-empty in its own
  // right.
  it("is non-empty and holds no duplicate", () => {
    expect(pins.PLATFORM_DOMAINS.length).toBeGreaterThan(0);
    expect(new Set(pins.PLATFORM_DOMAINS).size).toBe(pins.PLATFORM_DOMAINS.length);
  });
});

describe("BUILD §6.1 / §6.3a — SERP_LOCATION, the one locale constant", () => {
  it(`${B.serpLocation} — the row's "Google US · en" is the DataForSEO pair { location: "United States", language: "en" }`, () => {
    expect(pins.SERP_LOCATION.location).toBe("United States");
    expect(pins.SERP_LOCATION.language).toBe("en");
  });

  it(`BUILD §6.3a — "${B.locale}"`, () => {
    expect(Object.keys(pins.SERP_LOCATION).sort()).toEqual(["language", "location"]);
  });

  it(`DECISIONS 2026-08-28 — "${D.locale}"`, () => {
    expect(pins.SERP_LOCATION.language).toBe("en");
  });
});

// ───────────────────── the five names BUILD §6.1 uses that constants.ts does not

/**
 * `scripts/drift-audit.mjs` reads BUILD §6.1's price-book table and looks for
 * each row's identifier in `constants.ts`. Five rows do not match, and the
 * audit's own instruction is "may be pinned under another name — say which,
 * or rename". This block is where each is said. It asserts the mapping — the
 * BUILD name resolves to that member, at that value — so a rename on either
 * side fails here rather than leaving the audit's five rows unexplained.
 *
 * `RIVAL_SCORE` was the sixth until #27 pinned it under its own name; its
 * own block is below, and the audit now matches that row by name.
 */
describe("BUILD §6.1 names that constants.ts pins under another identifier — the mapping, stated", () => {
  it("`CAP_FREE` / `CAP_DEEP` / `CAP_WEEKLY` / `CAP_DRAFT` → CAPS.FREE_C / DEEP_C / WEEKLY_C / DRAFT_C (one group, the `_C` suffix naming the unit BUILD writes as ¢)", () => {
    const mapped = {
      CAP_FREE: pins.CAPS.FREE_C,
      CAP_DEEP: pins.CAPS.DEEP_C,
      CAP_WEEKLY: pins.CAPS.WEEKLY_C,
      CAP_DRAFT: pins.CAPS.DRAFT_C,
    };
    expect(mapped).toEqual({ CAP_FREE: 12, CAP_DEEP: 150, CAP_WEEKLY: 40, CAP_DRAFT: 45 });
  });

  it("`SERP_LIVE` / `SERP_STD` → PRICE_BOOK.SERP_LIVE_C / SERP_STD_C", () => {
    expect({ SERP_LIVE: pins.PRICE_BOOK.SERP_LIVE_C, SERP_STD: pins.PRICE_BOOK.SERP_STD_C }).toEqual({
      SERP_LIVE: 0.2,
      SERP_STD: 0.06,
    });
  });

  it("`AI_MODE_LIVE` / `AI_MODE_STD` → PRICE_BOOK.AI_MODE_LIVE_C / AI_MODE_STD_C", () => {
    expect({ AI_MODE_LIVE: pins.PRICE_BOOK.AI_MODE_LIVE_C, AI_MODE_STD: pins.PRICE_BOOK.AI_MODE_STD_C }).toEqual({
      AI_MODE_LIVE: 0.2,
      AI_MODE_STD: 0.06,
    });
  });

  it("`CHATGPT_SCRAPE_STD` → PRICE_BOOK.CHATGPT_SCRAPE_STD_C", () => {
    expect(pins.PRICE_BOOK.CHATGPT_SCRAPE_STD_C).toBe(0.12);
  });

  it("`COMPETITORS_DOMAIN_COST` → PRICE_BOOK.COMPETITORS_DOMAIN_COST_C", () => {
    expect(pins.PRICE_BOOK.COMPETITORS_DOMAIN_COST_C).toBe(1.5);
  });

});

// ─────────────────────────────── §6.1 / §6.6 rival derivation, and §4.1's absent-from list

describe("BUILD §6.1 / §6.6 — RIVAL_SCORE, the two weights the derivation is scored by", () => {
  it(`${B.rivalScore} · §6.6, quoted: "${B.rivalScoreFormula}" — RIVAL_SCORE.top10Weight / aiCitationWeight. The two weights only: the formula that adds them is \`src/lib/market/rivals/derive.ts\`'s, and constants.ts holds coefficients, never formula shape`, () => {
    expect(pins.RIVAL_SCORE.top10Weight).toBe(1);
    expect(pins.RIVAL_SCORE.aiCitationWeight).toBe(2);
    expect(Object.keys(pins.RIVAL_SCORE).sort()).toEqual(["aiCitationWeight", "top10Weight"]);
  });

  it('§6.6\'s parenthesis is the derivation of the pair, quoted: "cited-by-AI weighs double" — the AI weight is exactly twice the top-10 weight, so a change to one that does not keep the ratio fails here', () => {
    expect(pins.RIVAL_SCORE.aiCitationWeight).toBe(2 * pins.RIVAL_SCORE.top10Weight);
  });

  it(`${B.topFive} — the count on that line is BATTERY.COMPETITORS_MAX, not a second five minted beside it`, () => {
    expect(pins.BATTERY.COMPETITORS_MAX).toBe(5);
  });

  it(`§4.1's Google-search card, quoted: "${B.absentFrom}" · REQ-008 c4, quoted: "up to five of the biggest are listed, each with its monthly volume and the domain currently holding the top position" — ABSENT_FROM_MAX`, () => {
    expect(pins.ABSENT_FROM_MAX).toBe(5);
  });

  it("ABSENT_FROM_MAX and BATTERY.COMPETITORS_MAX share the number 5 by two clauses saying five, never by derivation: one bounds the absent-from rows §4.1 lists, the other the rivals §6.6 suggests, and they move independently", () => {
    expect(pins.ABSENT_FROM_MAX).toBe(pins.BATTERY.COMPETITORS_MAX);
    expect(B.absentFrom).toContain("5 biggest searches");
    expect(B.topFive).toContain("top 5 by score");
  });
});

// ───────────────────────────────────────────────── BUILD §5 scoring boundaries

describe("BUILD §5 scoring — the boundaries and coefficients that are pins", () => {
  it(`${B.scoreBands} — SCORE_BAND_BOUNDS holds the four lower bounds and none of the four words`, () => {
    expect(pins.SCORE_BAND_BOUNDS).toEqual({
      invisible: 0,
      "hard-to-find": 25,
      findable: 50,
      dominant: 75,
    });
    for (const value of Object.values(pins.SCORE_BAND_BOUNDS)) expect(typeof value).toBe("number");
  });

  it(`${B.answerability} — SCORING.answerabilityFloor`, () => {
    expect(pins.SCORING.answerabilityFloor).toBe(1);
  });

  it(`${B.directAnswers} — SCORING.directAnswerCharsMin / Max, a range closed at both ends`, () => {
    expect(pins.SCORING.directAnswerCharsMin).toBe(40);
    expect(pins.SCORING.directAnswerCharsMax).toBe(320);
    expect(pins.SCORING.directAnswerCharsMin).toBeLessThan(pins.SCORING.directAnswerCharsMax);
  });

  it("SCORING carries the three numbers BUILD §5 states and no fourth — the presence floor is `src/lib/measure/score.ts`'s, equal by coincidence of value and not by derivation", () => {
    expect(Object.keys(pins.SCORING).sort()).toEqual([
      "answerabilityFloor",
      "directAnswerCharsMax",
      "directAnswerCharsMin",
    ]);
  });
});

// ──────────────────────────────────────── BUILD §6.4 cache windows and the free path

describe("BUILD §6.4 — cache windows, the free path's own bounds, and the DNS bound", () => {
  it(`${B.cacheWindows} — CACHE_WINDOWS_D`, () => {
    expect(pins.CACHE_WINDOWS_D).toEqual({ own: 7, rival: 30, serp: 30, suggestions: 30 });
  });

  // BUILD §6.4's parenthetical exception — "(except the weekly target
  // re-check)" — has no pin in constants.ts. The archived BP-005 interface
  // declares `serpWeeklyRecheck: 7` for it; the value is not in the file, so
  // it is named here as owed rather than asserted at a value nobody pinned.
  it("the stated exception, the weekly target re-check, carries no window of its own in constants.ts — named, not invented", () => {
    expect(Object.keys(pins.CACHE_WINDOWS_D)).not.toContain("serpWeeklyRecheck");
    expect(B.cacheWindows).toContain("except the weekly target re-check");
  });

  it(`${B.rescan} — FREE_RESCAN_WINDOW_D, and it is the same 7 days §6.4's cache window gives the customer's own domain`, () => {
    expect(pins.FREE_RESCAN_WINDOW_D).toBe(7);
    expect(pins.FREE_RESCAN_WINDOW_D).toBe(pins.CACHE_WINDOWS_D.own);
  });

  it(`${B.cooldown} — FAILURE_COOLDOWN_H`, () => {
    expect(pins.FAILURE_COOLDOWN_H).toBe(24);
  });

  // BUILD §6.4 and BP-006 bound the fetch (8 s default, 15 s hard max) but
  // name no bound for the bare "does this name resolve" question. 5000 ms is
  // chosen — a parameter, not a transcription — and pinned so `dns.ts`
  // carries no number of its own.
  it(`${B.fetcher} — DNS_TIMEOUT_MS is the resolver bound §6.4 does not state, chosen and pinned once`, () => {
    expect(pins.DNS_TIMEOUT_MS).toBe(5000);
    expect(Number.isFinite(pins.DNS_TIMEOUT_MS)).toBe(true);
    expect(pins.DNS_TIMEOUT_MS).toBeGreaterThan(0);
  });
});

describe("DECISIONS 2026-09-03 (ADR-094) — the async AI-Overview reservation multiplier", () => {
  it(`${B.neverPull} — superseded for the first pass by "${D.adr094}"`, () => {
    expect(pins.ASYNC_AIO_SURCHARGE_MULTIPLIER).toBe(2);
  });

  it("ADR-094 decision 3, the vendor's own rule \"Add one base price\" — the multiplier is 2, and it prices the reservation, never the settled charge", () => {
    expect(pins.ASYNC_AIO_SURCHARGE_MULTIPLIER).toBe(2);
    expect(pins.PRICE_BOOK.SERP_LIVE_C * pins.ASYNC_AIO_SURCHARGE_MULTIPLIER).toBeCloseTo(0.4, 10);
  });
});

// ────────────────────────────────────────────────────── §11's bounds and timings

describe("§11 bounds — the free path's rate limits and the report's clock", () => {
  it(`§11, quoted: "${B.freeBounds}" — FREE_BOUNDS`, () => {
    expect(pins.FREE_BOUNDS).toEqual({ scansPerIpPerHour: 5, inFlightPerIp: 1, scansPerDay: 200 });
  });

  it("the two windows those bounds are counted over — HOURLY_WINDOW_H = 1, DAILY_WINDOW_H = 24 — are pinned, so \"per hour\" and \"per day\" are stated once", () => {
    expect(pins.HOURLY_WINDOW_H).toBe(1);
    expect(pins.DAILY_WINDOW_H).toBe(24);
  });

  it(`§11, quoted: "${B.freeSeconds}" — TIMING.reportTargetS`, () => {
    expect(pins.TIMING.reportTargetS).toBe(60);
  });

  it("TIMING.reportCeilingS = 90 — BP-001's ceiling on the same run, and it is above the target it ceilings", () => {
    expect(pins.TIMING.reportCeilingS).toBe(90);
    expect(pins.TIMING.reportCeilingS).toBeGreaterThan(pins.TIMING.reportTargetS);
  });

  it('REQ-029 c5, quoted: "a pass that fails outright, or that has not ended 10 minutes after setup was submitted … the founder is released into the app all the same" — TIMING.deepReleaseMin', () => {
    expect(pins.TIMING.deepReleaseMin).toBe(10);
  });

  it('REQ-029 c1, quoted: "the screen shows them at least once every 30 seconds that the pass is still running" — TIMING.progressHeartbeatS, and DEEP_HEARTBEAT_S ticks at half of it so the customer never waits a whole window to learn nothing changed', () => {
    expect(pins.TIMING.progressHeartbeatS).toBe(30);
    expect(pins.DEEP_HEARTBEAT_S).toBe(15);
    expect(pins.DEEP_HEARTBEAT_S * 2).toBe(pins.TIMING.progressHeartbeatS);
  });

  // Quoted from the frozen corpus (`archive/`, frozen 2026-09-04): a
  // document that cannot drift is quoted by id and text without a drift
  // check, per this file's header.
  it('BP-034 `## NFR budget`, quoted: "a rival suggestion call is bounded at 3 s and, on timeout, leaves `SuggestionState` at `none_found` rather than holding the screen — **setup is never held on suggestions**" — TIMING.suggestCeilingS, and it is well inside the free report\'s own ceiling', () => {
    expect(pins.TIMING.suggestCeilingS).toBe(3);
    expect(pins.TIMING.suggestCeilingS).toBeLessThan(pins.TIMING.reportCeilingS);
  });
});

describe("DECISIONS 2026-08-31 (ADR-060) — the weekly clock is site-local, and no UTC hour is pinned", () => {
  it(`${D.adr060} — WEEK_START = "monday", WEEKLY_DUE_HOUR_LOCAL = 6`, () => {
    expect(pins.WEEK_START).toBe("monday");
    expect(pins.WEEKLY_DUE_HOUR_LOCAL).toBe(6);
  });

  it(`§11's jobs table still says "${B.weeklyUtc}" in writing — the landmine ADR-060 defuses. No constant names a UTC hour, so the written words cannot become the trigger by being read as a pin`, () => {
    const names = Object.keys(pins);
    expect(names.filter((n) => /UTC/i.test(n))).toEqual([]);
    expect(pins.WEEKLY_DUE_HOUR_LOCAL).toBe(6);
  });

  it('REQ-065 c1, quoted: "a week beginning on Monday in the time zone the customer set" — WEEK_START is the day word, lowercased, and never a number', () => {
    expect(typeof pins.WEEK_START).toBe("string");
    expect(pins.WEEK_START).toBe("monday");
  });

  it('REQ-024 c5, quoted: "when 15 minutes have passed since the charge and no one has signed in at the address that paid" — MAINTENANCE_TICK_MINUTES is the tick that notices', () => {
    expect(pins.MAINTENANCE_TICK_MINUTES).toBe(15);
  });
});

// ────────────────────────────────────────────────── §11 jobs — the runner's pins

describe("§11 jobs — the three pins the runner itself is sized by", () => {
  it('BP-003 error behaviour, quoted: "No job fans out across customers inside one invocation past a fixed concurrency; a slow site never starves the rest of Monday." — JOB_FAN_OUT_CONCURRENCY is that fixed concurrency: a whole number of customers, greater than one so the fan-out is a fan-out, and bounded so one tick cannot open unbounded vendor work', () => {
    expect(pins.JOB_FAN_OUT_CONCURRENCY).toBe(10);
    expect(Number.isInteger(pins.JOB_FAN_OUT_CONCURRENCY)).toBe(true);
    expect(pins.JOB_FAN_OUT_CONCURRENCY).toBeGreaterThan(1);
  });

  it(`${B.draftGenerate} · BP-003 NFR budget, quoted: "\`draft/generate\` runs the evening before the publish date in the site's zone and must finish before the veto window would start" — DRAFT_DUE_HOUR_LOCAL is that evening hour: an hour of the day, in the afternoon-or-later half that "evening" can name, and site-local like WEEKLY_DUE_HOUR_LOCAL`, () => {
    expect(pins.DRAFT_DUE_HOUR_LOCAL).toBe(18);
    expect(Number.isInteger(pins.DRAFT_DUE_HOUR_LOCAL)).toBe(true);
    expect(pins.DRAFT_DUE_HOUR_LOCAL).toBeGreaterThanOrEqual(12);
    expect(pins.DRAFT_DUE_HOUR_LOCAL).toBeLessThan(24);
  });

  it(`${B.weeklyRefreshRow} is the row ADR-060 defuses, and the draft hour is pinned the same way it is — the name ends LOCAL, no constant names a UTC hour, and the two due hours are separate pins that happen to differ`, () => {
    expect(Object.keys(pins).filter((n) => /UTC/i.test(n))).toEqual([]);
    expect(Object.keys(pins).filter((n) => /_DUE_HOUR_/.test(n)).sort()).toEqual([
      "DRAFT_DUE_HOUR_LOCAL",
      "WEEKLY_DUE_HOUR_LOCAL",
    ]);
  });

  it(`${B.publishVerify} · §9, quoted: "${B.verify24h}" — PUBLISH_VERIFY_DELAY_H is the "+24h" both lines state`, () => {
    expect(pins.PUBLISH_VERIFY_DELAY_H).toBe(24);
  });

  it("PUBLISH_VERIFY_DELAY_H and DAILY_WINDOW_H share the number 24 and nothing else: §11's `publish/verify` delay and BP-023's free-scan rate-limit window are separate clauses, so neither is derived from the other", () => {
    expect(pins.PUBLISH_VERIFY_DELAY_H).toBe(pins.DAILY_WINDOW_H);
    expect(B.publishVerify).toContain("+24h");
    expect(B.freeBounds).toContain("200 free scans/day");
  });

  it(`${B.freeBounds} — §11's bounds line is FREE_BOUNDS, already pinned above; the jobs table adds no fourth bound of its own`, () => {
    expect(pins.FREE_BOUNDS).toEqual({ scansPerIpPerHour: 5, inFlightPerIp: 1, scansPerDay: 200 });
  });
});

// ────────────────────────────────────────── §7 opportunities, winnability, supply

describe("§7 opportunities — winnability, rival size, effort and fit", () => {
  it(`§7, quoted: "${B.winnability}" — WINNABILITY.qualifyFloor / qualifyMultiple`, () => {
    expect(pins.WINNABILITY.qualifyFloor).toBe(500);
    expect(pins.WINNABILITY.qualifyMultiple).toBe(5);
  });

  it('REQ-047 c10, quoted: "Winnable, where a domain in its top ten ranks for no more than the greater of 100 searches and twice the customer\'s own measured count" — WINNABILITY.nearFloor / nearMultiple', () => {
    expect(pins.WINNABILITY.nearFloor).toBe(100);
    expect(pins.WINNABILITY.nearMultiple).toBe(2);
  });

  it('REQ-096 c2, quoted: "`near`, where the rival appears in no more than the greater of 100 searches and twice the customer\'s own measured count … `middle`, where it is not `near` and appears in no more than the greater of 500 searches and five times the customer\'s own count" — RIVAL_SIZE_BANDS', () => {
    expect(pins.RIVAL_SIZE_BANDS).toEqual({ nearFloor: 100, nearMultiple: 2, middleFloor: 500, middleMultiple: 5 });
  });

  it("the two groups are separately pinned and stay so: a target's winnability and a rival's size share three numbers today by REQ-047 c10 and REQ-096 c2 stating the same bound, never by derivation", () => {
    expect(pins.WINNABILITY.nearFloor).toBe(pins.RIVAL_SIZE_BANDS.nearFloor);
    expect(pins.WINNABILITY.nearMultiple).toBe(pins.RIVAL_SIZE_BANDS.nearMultiple);
    expect(pins.WINNABILITY.qualifyFloor).toBe(pins.RIVAL_SIZE_BANDS.middleFloor);
    expect(pins.WINNABILITY.qualifyMultiple).toBe(pins.RIVAL_SIZE_BANDS.middleMultiple);
  });

  it("BP-040 d3 — EFFORT_BY_TYPE covers the seven ranked types, every value in (0, 1); `unblock` is unranked and carries no effort", () => {
    expect(pins.EFFORT_BY_TYPE).toEqual({
      answerable_page: 0.2,
      expand_page: 0.3,
      refresh_page: 0.3,
      answer_page: 0.5,
      keyword_page: 0.5,
      comparison_page: 0.6,
      format_page: 0.7,
    });
    for (const [type, effort] of Object.entries(pins.EFFORT_BY_TYPE)) {
      expect(effort, type).toBeGreaterThan(0);
      expect(effort, type).toBeLessThan(1);
    }
    expect(Object.keys(pins.EFFORT_BY_TYPE)).not.toContain("unblock");
  });

  it('BP-040 d3, and REQ-047 c10\'s "A Not-yet target is never queued for a page" — FIT_WEIGHT weights the three winnability handles, and `not-yet` weighs 0 so the ranking `demand × intent × (1−effort) × fit` can never surface one', () => {
    expect(pins.FIT_WEIGHT).toEqual({ winnable: 1.0, reach: 0.5, "not-yet": 0 });
    expect(pins.FIT_WEIGHT["not-yet"]).toBe(0);
    expect(Object.keys(pins.FIT_WEIGHT).sort()).toEqual(["not-yet", "reach", "winnable"]);
  });

  it(`§7, quoted: "${B.supplyCap}" · REQ-095 c1, quoted: "it does not stop while fewer than 30 unused qualifying opportunities exist" — SUPPLY.deepTarget and SUPPLY_TARGET_DEPTH are the same 30`, () => {
    expect(pins.SUPPLY.deepTarget).toBe(30);
    expect(pins.SUPPLY_TARGET_DEPTH).toBe(30);
    expect(pins.SUPPLY_TARGET_DEPTH).toBe(pins.SUPPLY.deepTarget);
  });

  it('REQ-095 c5, quoted: "Given a customer\'s unused supply falls below 7, when they open the app, then the screen they land on carries one written line saying supply is running short" — SUPPLY.shortThreshold and SUPPLY_SHORT_BELOW are the same 7', () => {
    expect(pins.SUPPLY.shortThreshold).toBe(7);
    expect(pins.SUPPLY_SHORT_BELOW).toBe(7);
    expect(pins.SUPPLY_SHORT_BELOW).toBe(pins.SUPPLY.shortThreshold);
  });

  it('REQ-063 c2, quoted: "Given a page published less than three weeks ago, when its verdict is produced, then it is marked as working if it already passes its recorded test, and otherwise as too early to judge" — TOO_EARLY_WEEKS', () => {
    expect(pins.TOO_EARLY_WEEKS).toBe(3);
  });

  it('§7, quoted: "Ranking: `demand × intent × (1−effort) × fit`, one list." — DEMAND_LOG_DIVISOR is the demand term\'s scale, chosen (§7 fixes the formula\'s shape and no term\'s scale) so that log10(volume + 1) saturates at 1.0 at 100,000/mo, above any volume a market set carries', () => {
    expect(pins.DEMAND_LOG_DIVISOR).toBe(5);
    expect(Math.min(1, Math.log10(10 ** pins.DEMAND_LOG_DIVISOR) / pins.DEMAND_LOG_DIVISOR)).toBe(1);
    // Saturates rather than clips: the term is 1 at the point it reaches
    // it and never exceeds 1 above it.
    expect(Math.log10(10 ** (pins.DEMAND_LOG_DIVISOR - 1)) / pins.DEMAND_LOG_DIVISOR).toBeLessThan(1);
  });

  it('§7, quoted: "`keyword_page` | Rival top-20 for a query ≥10/mo; customer absent" — WRITE_VOLUME_FLOOR_PER_MONTH, and it is not §6.7\'s selection floor', () => {
    expect(pins.WRITE_VOLUME_FLOOR_PER_MONTH).toBe(10);
    // Two floors, stated independently by the spec: §6.7\'s admits a
    // search into the twelve, §7\'s makes it worth a page. Neither is
    // derived from the other, and asserting they differ is what keeps a
    // later tidy-up from collapsing them.
    expect(pins.WRITE_VOLUME_FLOOR_PER_MONTH).not.toBe(pins.SELECTION.volumeFloorPerMonth);
  });

  it('§7, quoted: "`expand_page` | Customer ranks 4–30, page thin" — IMPROVE_POSITION_BAND is that band, inclusive at both ends', () => {
    expect(pins.IMPROVE_POSITION_BAND).toEqual({ min: 4, max: 30 });
  });

  it('§7, quoted: "`expand_page` | Customer ranks 4–30, page thin" — THIN_PAGE_VISIBLE_CHARS is what "thin" means in the unit the parser measures (`OnPageFacts.visibleChars`); chosen, since §7 states the trigger and no number', () => {
    expect(pins.THIN_PAGE_VISIBLE_CHARS).toBe(1800);
    // Roughly 300 words at ~6 characters a word including spaces. Stated
    // as a bound rather than a bare literal so a retune that crossed into
    // absurdity — a floor no real page could sit under, or one every page
    // sits under — fails here.
    expect(pins.THIN_PAGE_VISIBLE_CHARS).toBeGreaterThan(500);
    expect(pins.THIN_PAGE_VISIBLE_CHARS).toBeLessThan(10_000);
  });
});

// ────────────────────────────────────────────────────────────── §8 generation

describe("§8 generation — the three hard rules that are numbers", () => {
  it(`§8, quoted: "${B.doorway}" — GENERATION.brandGapChars`, () => {
    expect(pins.GENERATION.brandGapChars).toBe(300);
  });

  it(`§8, quoted: "${B.nearDuplicate}" · REQ-050 c9, quoted: "it is queued only if it is less than 85 per cent similar to each of them" — GENERATION.duplicateThreshold and NEAR_DUPLICATE_MAX are the same 0.85`, () => {
    expect(pins.GENERATION.duplicateThreshold).toBe(0.85);
    expect(pins.NEAR_DUPLICATE_MAX).toBe(0.85);
    expect(pins.NEAR_DUPLICATE_MAX).toBe(pins.GENERATION.duplicateThreshold);
  });

  it(`§8, quoted: "${B.regenerate}" · REQ-053 c3, quoted: "it is regenerated once and no more" — GENERATION.regenerations`, () => {
    expect(pins.GENERATION.regenerations).toBe(1);
  });

  it("BP-042 · REQ-050 c9 — SHINGLE_SIZE = 5, the window the similarity above is measured over", () => {
    expect(pins.SHINGLE_SIZE).toBe(5);
    expect(Number.isInteger(pins.SHINGLE_SIZE)).toBe(true);
  });

  it(`REQ-050 c8, quoted: "it carries no sentence addressed to a machine reader rather than a human one — no instruction, directive or assertion aimed at an assistant, a crawler or a ranking system about how to treat, cite, rank or recommend the page" · §14, quoted: "${B.noPromptTricks}" — MACHINE_ADDRESS_PATTERNS is a battery, never empty, every member a case-insensitive regex`, () => {
    expect(pins.MACHINE_ADDRESS_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of pins.MACHINE_ADDRESS_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp);
      expect(pattern.flags).toContain("i");
      expect(pattern.global).toBe(false); // a `g` regex carries lastIndex between calls
    }
  });

  it("BP-043 · REQ-053 — CLAIM_RECHECK_SWEEP_MAX = 25 drafts per invocation, a bound on one sweep and not on the work", () => {
    expect(pins.CLAIM_RECHECK_SWEEP_MAX).toBe(25);
  });
});

// ─────────────────────────────────────────── §9 publishing, autopilot, verifying

describe("§9 publishing and autopilot — the veto window, the hard limits, the retries", () => {
  it(`§9, quoted: "${B.veto}" · §4.7, quoted: "${B.vetoStepper}" — VETO`, () => {
    expect(pins.VETO).toEqual({ defaultHours: 24, minDays: 0, maxDays: 7 });
  });

  it("the veto default sits inside the range the customer may set — 0 ≤ 24h ≤ 7d — so no default is unreachable from the stepper", () => {
    expect(pins.VETO.defaultHours / 24).toBeGreaterThanOrEqual(pins.VETO.minDays);
    expect(pins.VETO.defaultHours / 24).toBeLessThanOrEqual(pins.VETO.maxDays);
  });

  it(`§9, quoted: "${B.rateLimits}" — RATE_LIMITS`, () => {
    expect(pins.RATE_LIMITS).toEqual({ publishesPerDay: 1, publishesPerWeek: 8 });
  });

  it(`§9's state machine, quoted: "${B.retryThree}" · REQ-056 c4, quoted: "retried automatically only while that reason is one a repeated attempt could clear, and at most three times" — PUBLISH_RETRY_BACKOFF_MIN holds exactly three delays, ascending, in minutes`, () => {
    expect([...pins.PUBLISH_RETRY_BACKOFF_MIN]).toEqual([5, 30, 180]);
    expect(pins.PUBLISH_RETRY_BACKOFF_MIN).toHaveLength(3);
    for (let i = 1; i < pins.PUBLISH_RETRY_BACKOFF_MIN.length; i++) {
      expect(pins.PUBLISH_RETRY_BACKOFF_MIN[i]).toBeGreaterThan(pins.PUBLISH_RETRY_BACKOFF_MIN[i - 1]!);
    }
  });

  it('REQ-074 c1, quoted: "the date it was last checked, which is never more than 24 hours old whether or not a publish was attempted in between" — DESTINATION_HEALTH_MAX_AGE_H', () => {
    expect(pins.DESTINATION_HEALTH_MAX_AGE_H).toBe(24);
  });

  it("PUBLISH_DELIVER_TIMEOUT_MS = 20000 — the bound on one whole delivery attempt (issue #46, raised by #45)", () => {
    expect(pins.PUBLISH_DELIVER_TIMEOUT_MS).toBe(20_000);
  });

  it("it is above the egress seam's hard maximum (BUILD §6.4: 8 s default, 15 s hard maximum), so a single slow request still fails on its own bound and is reported as itself", () => {
    // The two bounds are on two different things — one byte-stream toward
    // one customer URL, and one whole delivery attempt — so the ordering is
    // asserted rather than one derived from the other. The egress seam's
    // own numbers are module-local to `src/lib/egress/safe-fetch.ts`; 15 s
    // is quoted from §6.4 here, not imported.
    const EGRESS_HARD_MAX_MS = 15_000;
    expect(pins.PUBLISH_DELIVER_TIMEOUT_MS).toBeGreaterThan(EGRESS_HARD_MAX_MS);
  });

  it("and below the first retry step, so a held attempt is retried rather than left open past its own backoff", () => {
    expect(pins.PUBLISH_DELIVER_TIMEOUT_MS).toBeLessThan(pins.PUBLISH_RETRY_BACKOFF_MIN[0]! * 60_000);
  });

  it("REQ-057 c1's stop link is minted at 32 bytes of CSPRNG entropy — VETO_TOKEN_BYTES", () => {
    expect(pins.VETO_TOKEN_BYTES).toBe(32);
  });

  it("BP-058 NFR budget, quoted: \"Health checks are debounced to at most one per destination per 60 s, so a burst of page loads makes one check\" — DESTINATION_HEALTH_DEBOUNCE_S", () => {
    expect(pins.DESTINATION_HEALTH_DEBOUNCE_S).toBe(60);
  });

  it('REQ-074 c6, quoted: "Given a destination has needed reconnecting for 24 hours … when those 24 hours pass, then one `account` mail is sent" — DESTINATION_BREAKAGE_MAIL_DELAY_H', () => {
    expect(pins.DESTINATION_BREAKAGE_MAIL_DELAY_H).toBe(24);
  });

  it("DESTINATION_BREAKAGE_MAIL_DELAY_H and DESTINATION_HEALTH_MAX_AGE_H share the number 24 and nothing else: one is how long a breakage stands before the customer is written to, the other how stale a check may be before it is run again — neither is derived from the other", () => {
    expect(pins.DESTINATION_BREAKAGE_MAIL_DELAY_H).toBe(pins.DESTINATION_HEALTH_MAX_AGE_H);
  });

  it(`§9, quoted: "${B.verify24h}" · BP-049 NFR budget, quoted: "\`VERIFY.coverageFloor = 0.95\` and \`VERIFY.userAgent\` belong in BP-005" — VERIFY`, () => {
    expect(pins.VERIFY.coverageFloor).toBe(0.95);
    expect(pins.VERIFY.coverageFloor).toBeGreaterThan(0);
    expect(pins.VERIFY.coverageFloor).toBeLessThanOrEqual(1);
  });

  it(`§9's hosted CMS, quoted: "${B.hostedCname}" — HOSTED_SUBDOMAIN_LABEL is the "content" label that line prints, and nothing else about the record is pinned: the host it points at is \`HOSTED_EDGE_CNAME_TARGET\`, an env binding, because it differs per deployment`, () => {
    expect(pins.HOSTED_SUBDOMAIN_LABEL).toBe("content");
    expect(B.hostedCname).toContain(`${pins.HOSTED_SUBDOMAIN_LABEL}.{customer-domain}`);
  });

  it("HOSTED_SUBDOMAIN_LABEL is a label, never a hostname — it carries no dot, so no constant here can become half a record", () => {
    expect(pins.HOSTED_SUBDOMAIN_LABEL).not.toContain(".");
  });

  it("VERIFY.userAgent is our own token and never one of the six AI readers — impersonating one would be a false statement to a server we are measuring", () => {
    expect(pins.VERIFY.userAgent).toBe("ReachKitVerify/1.0 (+https://reachkit.app)");
    for (const agent of pins.AI_READER_AGENTS) {
      expect(pins.VERIFY.userAgent).not.toContain(agent);
    }
  });

  it("VERIFY.sitemapMaxDocuments bounds one page's check — a sitemap index names further documents, and following them without a bound turns one check into a crawl of a site ReachKit does not serve (issue #50)", () => {
    expect(pins.VERIFY.sitemapMaxDocuments).toBe(5);
    // At least the two conventional addresses plus one document a robots
    // policy may name, or the bound would refuse a shape of site the check
    // has to read.
    expect(pins.VERIFY.sitemapMaxDocuments).toBeGreaterThanOrEqual(3);
    expect(Number.isInteger(pins.VERIFY.sitemapMaxDocuments)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────── the AI reader agents

describe("DECISIONS 2026-08-31 (ADR-022, ADR-090) — one closed list of AI reader user-agents", () => {
  it(`REQ-059 c4, quoted: "it blocks no general search engine crawler and permits by name GPTBot, ClaudeBot, OAI-SearchBot, Claude-SearchBot, PerplexityBot and Google-Extended." — AI_READER_AGENTS is those six, in that order`, () => {
    expect([...pins.AI_READER_AGENTS]).toEqual([
      "GPTBot",
      "ClaudeBot",
      "OAI-SearchBot",
      "Claude-SearchBot",
      "PerplexityBot",
      "Google-Extended",
    ]);
  });

  it(`§9, quoted: "${B.robots}" — the hosted robots policy names the same six, so the list is one list`, () => {
    for (const agent of pins.AI_READER_AGENTS) {
      expect(B.robots).toContain(agent);
    }
  });

  it(`${D.adr022} — an empty list fails here rather than silently reporting no reader blocked`, () => {
    expect(pins.AI_READER_AGENTS.length).toBeGreaterThan(0);
    expect(new Set(pins.AI_READER_AGENTS).size).toBe(pins.AI_READER_AGENTS.length);
  });

  it(`${D.adr090} — there is no second list under any other name`, () => {
    expect(Object.keys(pins).filter((n) => /CRAWLER/i.test(n))).toEqual([]);
  });
});

// ────────────────────────────────────── §6.7 the market chain's own coefficients

describe("§6.7 from a URL to the 12 questions — selection, coherence, correction", () => {
  it(`§6.7 step 3, quoted: "${B.selectionScore}" — SELECTION.volumeFloorPerMonth`, () => {
    expect(pins.SELECTION.volumeFloorPerMonth).toBe(50);
  });

  it(`§6.7 step 3's intent table, quoted: "${B.intentWeights}" — SELECTION.intentWeights`, () => {
    expect(pins.SELECTION.intentWeights).toEqual({ decision: 3, solution: 3, problem: 2, informational: 1 });
  });

  it(`§6.7 step 3, quoted: "${B.composition}" — SELECTION.minDecision / minSolution / maxRivalBrand / maxHowTo, and the two floors fit inside the twelve`, () => {
    expect(pins.SELECTION.minDecision).toBe(4);
    expect(pins.SELECTION.minSolution).toBe(3);
    expect(pins.SELECTION.maxRivalBrand).toBe(3);
    expect(pins.SELECTION.maxHowTo).toBe(2);
    expect(pins.SELECTION.minDecision + pins.SELECTION.minSolution).toBeLessThanOrEqual(pins.BATTERY.QUESTIONS);
  });

  it(`§6.7 step 5, quoted: "${B.coherence}" · REQ-094 c2, quoted: "a quarter of the searches the report measured, rounded up, or two, whichever is the greater. That threshold is three where twelve searches were measured" — COHERENCE, and the rule reproduces §6.7's 3 at a denominator of 12`, () => {
    expect(pins.COHERENCE).toEqual({ minMeasuredSearches: 3, shareDivisor: 4, minAppearances: 2 });
    const threshold = Math.max(Math.ceil(pins.BATTERY.QUESTIONS / pins.COHERENCE.shareDivisor), pins.COHERENCE.minAppearances);
    expect(threshold).toBe(3);
  });

  it('REQ-094 c5, quoted: "one written line says a free scan allows one correction and that this one has been used" · c7, quoted: "the correction may be submitted once more on criterion 1\'s terms" — CORRECTION.perScan and .retries', () => {
    expect(pins.CORRECTION.perScan).toBe(1);
    expect(pins.CORRECTION.retries).toBe(1);
  });

  it("CORRECTION.offerMaxAgeDays = 7 — the correction is offered for as long as the stored report it corrects is the one a re-scan is refused in favour of, so it is the same 7 days as FREE_RESCAN_WINDOW_D and moves with it", () => {
    expect(pins.CORRECTION.offerMaxAgeDays).toBe(7);
    expect(pins.CORRECTION.offerMaxAgeDays).toBe(pins.FREE_RESCAN_WINDOW_D);
  });

  it('REQ-009 c8, quoted: "it follows that problem\'s own count and nothing else: a problem measured at 0 always carries the lowest of the three … and of any two reports the one with the larger count for the same problem never carries the lower severity" — SEVERITY_THRESHOLDS, three problems, each mid < high', () => {
    expect(pins.SEVERITY_THRESHOLDS).toEqual({
      blocked_readers: { mid: 1, high: 3 },
      missing_pages: { mid: 1, high: 10 },
      unquotable_pages: { mid: 1, high: 2 },
    });
    for (const [problem, band] of Object.entries(pins.SEVERITY_THRESHOLDS)) {
      expect(band.mid, problem).toBeGreaterThan(0); // 0 is always the lowest level
      expect(band.high, problem).toBeGreaterThan(band.mid);
    }
  });
});

// ──────────────────────────────────────── §4.2 / lifecycle: the mail clocks

describe("§4.2 and the account lifecycle — every clock that is a pin", () => {
  it(`§4.2, quoted: "${B.nurture}" · REQ-010 c9, quoted: "at most three follow-up emails are sent for that domain, at 24, 72 and 168 hours after that domain's sequence begins" — NURTURE_H and NURTURE_MAX_TOUCHES agree with each other`, () => {
    expect([...pins.NURTURE_H]).toEqual([24, 72, 168]);
    expect(pins.NURTURE_MAX_TOUCHES).toBe(3);
    expect(pins.NURTURE_H).toHaveLength(pins.NURTURE_MAX_TOUCHES);
  });

  it('REQ-010 c12, quoted: "A sequence that has not begun within 7 days of its own page\'s delivery is dropped and never sent" — SEQUENCE_START_DEADLINE_DAYS', () => {
    expect(pins.SEQUENCE_START_DEADLINE_DAYS).toBe(7);
  });

  it('REQ-010 c8, quoted: "Delivery to that address is retried for 24 hours from the first attempt; if nothing has been delivered by then, no further attempt is made" — FIRST_PAGE_RETRY_WINDOW_H, and FIRST_PAGE_RETRY_MINUTES\' last offset is exactly that window', () => {
    expect(pins.FIRST_PAGE_RETRY_WINDOW_H).toBe(24);
    expect([...pins.FIRST_PAGE_RETRY_MINUTES]).toEqual([5, 30, 120, 360, 720, 1440]);
    expect(pins.FIRST_PAGE_RETRY_MINUTES.at(-1)).toBe(pins.FIRST_PAGE_RETRY_WINDOW_H * 60);
    for (let i = 1; i < pins.FIRST_PAGE_RETRY_MINUTES.length; i++) {
      expect(pins.FIRST_PAGE_RETRY_MINUTES[i]).toBeGreaterThan(pins.FIRST_PAGE_RETRY_MINUTES[i - 1]!);
    }
  });

  it('REQ-025 c6, quoted: "when 24 hours have passed since their payment … there are up to three in all with the last no later than 7 days after the payment" — SETUP_REMINDER_OFFSETS_H, three offsets, the last at 7 days', () => {
    expect([...pins.SETUP_REMINDER_OFFSETS_H]).toEqual([24, 72, 168]);
    expect(pins.SETUP_REMINDER_OFFSETS_H).toHaveLength(3);
    expect(pins.SETUP_REMINDER_OFFSETS_H[0]).toBe(24);
    expect(pins.SETUP_REMINDER_OFFSETS_H.at(-1)).toBe(7 * 24);
  });

  it('REQ-077 c4, quoted: "the link expires 24 hours after it is sent, after which the pending change lapses and the account is unchanged" — EMAIL_CHANGE_TTL_H', () => {
    expect(pins.EMAIL_CHANGE_TTL_H).toBe(24);
  });

  it("BP-061 d2 — SIGNIN_LINK_TTL_H = 24, chosen rather than transcribed, and pinned so the magic link's life is stated once", () => {
    expect(pins.SIGNIN_LINK_TTL_H).toBe(24);
  });

  it("BP-063 — DANGER_TICKET_TTL_MINUTES = 30, the life of a danger-zone confirmation ticket", () => {
    expect(pins.DANGER_TICKET_TTL_MINUTES).toBe(30);
  });
});

describe("DECISIONS 2026-08-31 (ADR-051) — retention, erasure and the hosted window", () => {
  it(`${D.adr051} · REQ-079 c7, quoted: "when 30 days have passed, then the account and the sign-in address it was reached at … are no longer present in ReachKit's stored data at all" — RETENTION_D.erasure and ERASURE_DAYS are the same 30`, () => {
    expect(pins.RETENTION_D.erasure).toBe(30);
    expect(pins.ERASURE_DAYS).toBe(30);
    expect(pins.ERASURE_DAYS).toBe(pins.RETENTION_D.erasure);
  });

  it('REQ-076 c10, quoted: "when 30 days have passed since their paid-through date, then ReachKit stops serving their hosted pages and every address that served one returns 410 Gone" — RETENTION_D.hostedAfterAccess and HOSTED_RETENTION_DAYS are the same 30', () => {
    expect(pins.RETENTION_D.hostedAfterAccess).toBe(30);
    expect(pins.HOSTED_RETENTION_DAYS).toBe(30);
    expect(pins.HOSTED_RETENTION_DAYS).toBe(pins.RETENTION_D.hostedAfterAccess);
  });

  it('REQ-076 c11, quoted: "and again 7 days before the day serving stops, then they are told in writing which day it stops" — HOSTING_END_REMINDER_DAYS, and the reminder falls inside the window it warns about', () => {
    expect(pins.HOSTING_END_REMINDER_DAYS).toBe(7);
    expect(pins.HOSTING_END_REMINDER_DAYS).toBeLessThan(pins.HOSTED_RETENTION_DAYS);
  });

  it('REQ-002, quoted: "within 5 working days of its receipt" — RETENTION_D.removalSlaWorkingDays is working days, not calendar days, and is the only member of the group counted that way', () => {
    expect(pins.RETENTION_D.removalSlaWorkingDays).toBe(5);
    expect(Object.keys(pins.RETENTION_D).sort()).toEqual(["erasure", "hostedAfterAccess", "removalSlaWorkingDays"]);
  });
});

describe("DECISIONS 2026-08-31 (ADR-002) and the owner's 2026-09-05 ruling on #28 — the removed report's status", () => {
  it(`${D.adr002} · REQ-002 c3, quoted: "it shows the removed report to nobody and starts no scan for anyone … in its place one written line says the report was removed at the domain owner's request" — REPORT_REMOVED_STATUS is 410 Gone: the address existed`, () => {
    expect(pins.REPORT_REMOVED_STATUS).toBe(410);
  });

  it("it is not 404, which would say the address never existed, and not the archived plan's 200, which the owner's ruling supersedes", () => {
    expect(pins.REPORT_REMOVED_STATUS).not.toBe(404);
    expect(pins.REPORT_REMOVED_STATUS).not.toBe(200);
  });
});

// ──────────────────────────────────────────── inference prices and the vendor seam

describe("BUILD §6.3 / DATA-COSTS §1 — the inference price book, in cents per million tokens", () => {
  it(`${C.nano} — INFERENCE_PRICE_BOOK.nano, dollars per million read as cents per million`, () => {
    expect(pins.INFERENCE_PRICE_BOOK.nano).toEqual({ inCentsPerM: 20, outCentsPerM: 125 });
    expect(pins.INFERENCE_PRICE_BOOK.nano.inCentsPerM).toBe(0.2 * 100);
    expect(pins.INFERENCE_PRICE_BOOK.nano.outCentsPerM).toBe(1.25 * 100);
  });

  it(`${C.haiku} — INFERENCE_PRICE_BOOK.haiku`, () => {
    expect(pins.INFERENCE_PRICE_BOOK.haiku).toEqual({ inCentsPerM: 100, outCentsPerM: 500 });
    expect(pins.INFERENCE_PRICE_BOOK.haiku.inCentsPerM).toBe(1.0 * 100);
    expect(pins.INFERENCE_PRICE_BOOK.haiku.outCentsPerM).toBe(5.0 * 100);
  });

  it("the book holds the two tiers the MVP uses and no third — Sonnet is DATA-COSTS §1's optional upgrade and is not bought", () => {
    expect(Object.keys(pins.INFERENCE_PRICE_BOOK).sort()).toEqual(["haiku", "nano"]);
  });

  it('BP-009 NFR budget, quoted: "p95 latency: nano ≤ 3 s, haiku ≤ 20 s." — INFERENCE_TIMEOUT_MS, in milliseconds, one entry per tier the price book prices', () => {
    expect(pins.INFERENCE_TIMEOUT_MS).toEqual({ nano: 3000, haiku: 20000 });
    expect(Object.keys(pins.INFERENCE_TIMEOUT_MS).sort()).toEqual(Object.keys(pins.INFERENCE_PRICE_BOOK).sort());
  });
});

describe("BUILD §6.1 / DATA-COSTS §1 — VENDOR, the request shapes the price book prices", () => {
  it(`${C.suggestionsRows} — VENDOR.suggestionsRows, the row count §6.1's 1.8¢ is quoted at`, () => {
    expect(pins.VENDOR.suggestionsRows).toBe(50);
  });

  it(`${C.competitorsRows} — VENDOR.competitorsDomainRows, the row count §6.1's 1.5¢ is derived from`, () => {
    expect(pins.VENDOR.competitorsDomainRows).toBe(25);
  });

  it(`${C.serpRow} — the SERP row the live/standard pair above is priced at`, () => {
    expect(pins.PRICE_BOOK.SERP_LIVE_C).toBe(0.2);
    expect(pins.PRICE_BOOK.SERP_STD_C).toBe(0.06);
  });

  it('the vendor\'s own published turnaround for the standard queue — "5 minutes on average · The target turnaround time is 45 minutes" (archived RESEARCH-dataforseo-endpoints.md §2.1) — VENDOR.stdQueuePollIntervalS and .stdQueueDeadlineMin, the poll being far shorter than the deadline it polls toward', () => {
    expect(pins.VENDOR.stdQueuePollIntervalS).toBe(10);
    expect(pins.VENDOR.stdQueueDeadlineMin).toBe(45);
    expect(pins.VENDOR.stdQueuePollIntervalS).toBeLessThan(pins.VENDOR.stdQueueDeadlineMin * 60);
  });
});

// ────────────────────────────────────────────────────────── §4.5 the goal values

describe("§4.5 Overview — the four headline goal values", () => {
  it(`§4.5, quoted: "${B.goal400}" — GOAL_VALUES.searches_appeared_in`, () => {
    expect(pins.GOAL_VALUES.searches_appeared_in).toBe(400);
  });

  it(`§4.5, quoted: "${B.goal6}" — GOAL_VALUES.ai_answers, out of the twelve tracked questions`, () => {
    expect(pins.GOAL_VALUES.ai_answers).toBe(6);
    expect(pins.GOAL_VALUES.ai_answers).toBeLessThan(pins.BATTERY.QUESTIONS);
  });

  it(`BUILD §5, quoted: "${B.scoreBands}" — GOAL_VALUES.score is 50, the first score at which the product's own verdict changes from not-findable to findable`, () => {
    expect(pins.GOAL_VALUES.score).toBe(50);
    expect(pins.GOAL_VALUES.score).toBe(pins.SCORE_BAND_BOUNDS.findable);
  });

  it("GOAL_VALUES.pages_published = 30 — owner ruling, 2026-08-31: a month of daily pages. Not derivable, present rather than optional, and rendered like the other three", () => {
    expect(pins.GOAL_VALUES.pages_published).toBe(30);
    expect(Object.prototype.hasOwnProperty.call(pins.GOAL_VALUES, "pages_published")).toBe(true);
  });

  it("all four are numbers — the pairing with a copy key is BP-038's `GOALS`, so this file holds no `CopyKey`", () => {
    for (const [goal, value] of Object.entries(pins.GOAL_VALUES)) expect(typeof value, goal).toBe("number");
  });
});

// ────────────────────────────────────────────────────────── §4.5 the screen's own three

describe("§4.5 Overview — the three pins the screen itself is built on (#15)", () => {
  it(`§6.6, quoted: "${B.ratioUnlock}" — RATIO_UNLOCK is the ranked count at which a rival ratio starts meaning something`, () => {
    expect(pins.RATIO_UNLOCK).toBe(10);
    // The clause's own reason for existing: below it the module shows
    // absolute numbers, because at a count of 0 a ratio is a division by
    // zero. A threshold of 0 or 1 would put the screen back there.
    expect(pins.RATIO_UNLOCK).toBeGreaterThan(1);
  });

  it(`§4.5, quoted: "${B.twoAlerts}" — OVERVIEW_ALERT_CAP is that "up to two", and the remainder is a count rather than a third alert`, () => {
    expect(pins.OVERVIEW_ALERT_CAP).toBe(2);
    expect(B.twoAlerts).toContain("up to two alerts");
  });

  it(`DECISIONS 2026-09-03, quoted: "${D.aiOneReading}" — OVERVIEW_TRAILING_WEEKS is the window that ruling leaves unnumbered: chosen at 12, a quarter of weekly measurement, and the one window both of the screen's week-counted readings are taken over`, () => {
    // The ruling fixes *what* the tile reads (weeks present in a fixed
    // trailing window) and names no length, so the number is this build's
    // parameter (constitution rule 1.1) rather than a transcription — it is
    // asserted here against the two properties that make it the right one
    // rather than against a clause that does not state it.
    expect(pins.OVERVIEW_TRAILING_WEEKS).toBe(12);
    // The goal has to be reachable inside the window, and has to be a real
    // target rather than a formality: 6 of 12 is half of it.
    expect(pins.GOAL_VALUES.ai_answers).toBeLessThanOrEqual(pins.OVERVIEW_TRAILING_WEEKS);
    expect(pins.OVERVIEW_TRAILING_WEEKS).toBe(pins.GOAL_VALUES.ai_answers * 2);
    expect(D.aiOneReading).toContain("trailing window");
  });
});

// ────────────────────────────────────────────────────────── the three price pins

describe("§13 payments — the three price pins, €49 and tax-inclusive", () => {
  it(`§13, quoted: "${B.priceFlat}" · §4.1, quoted: "${B.pricingCard}" — the price the product states is €49 a month, flat`, () => {
    expect(B.priceFlat).toContain("€49/mo");
    expect(B.pricingCard).toContain("€49/mo");
  });

  it(`§13, quoted: "${B.taxDeferred}" · DECISIONS 2026-08-28, quoted: "${D.tax}" — the €49 is charged with Stripe Tax off`, () => {
    expect(D.tax).toContain("tax-inclusive");
  });

  it(`DECISIONS 2026-08-31, quoted: "${D.adr052}" · REQ-022 c4, quoted: "it is €49 in euro — the same amount and the same currency wherever they are, never converted to a local one — with no tax amount added to it or taken from it, any VAT due being contained within the €49, so no customer's bill rises because tax registration was set up" — the values those clauses rule are 4900 minor units, "eur", "month"`, () => {
    // REQ-022 c1 ("it reads €49 per month … and €49 is the amount checkout
    // charges") and c4 fix all three. Either constants.ts declares all three
    // at those values, or it declares none of them and records why — the
    // state BP-005's own header describes, WO-271 never having been built.
    // A partial declaration, or one at another value, fails here.
    const declared = (["PRICE_EUR_CENTS", "PRICE_CURRENCY", "PRICE_INTERVAL"] as const).filter((name) =>
      Object.prototype.hasOwnProperty.call(pins, name)
    );
    if (declared.length > 0) {
      expect(declared).toHaveLength(3);
      const priced = pins as unknown as Record<string, unknown>;
      expect(priced.PRICE_EUR_CENTS).toBe(4900);
      expect(priced.PRICE_CURRENCY).toBe("eur");
      expect(priced.PRICE_INTERVAL).toBe("month");
    } else {
      expect(declared).toEqual([]);
      // constants.ts's own header records the deferral, verbatim; the
      // absence is a stated decision and not an oversight, and this is the
      // sentence that says so. Comment markers are stripped before the
      // match so the sentence is read as prose, not as source lines.
      const prose = norm(
        readFileSync(path.join(ROOT, "src/lib/config/constants.ts"), "utf8").replace(/^\s*(\/\/|\*|\/\*\*)/gm, "")
      );
      expect(prose).toContain(
        "`PRICE_INTERVAL` are declared in BP-005's current `## Public interface` but are not part of WO-006's own enumerated file-plan list"
      );
    }
  });

  it("no price sentence lives in constants.ts whichever of the two states holds — the € sign, the word VAT and the words \"per month\" are the copy registry's, never a pin's", () => {
    const source = readFileSync(path.join(ROOT, "src/lib/config/constants.ts"), "utf8");
    expect(source).not.toContain("€");
    expect(source).not.toMatch(/\bVAT\b/);
    expect(source).not.toMatch(/\bper month\b/);
  });
});

// ─────────────────────────────────── ADR-001, asserted once and only here

describe("DECISIONS 2026-08-31 (ADR-001) — the six band words are disjoint", () => {
  const winnability = [
    copy(BAND_LABELS.winnability.winnable),
    copy(BAND_LABELS.winnability.reach),
    copy(BAND_LABELS.winnability["not-yet"]),
  ];
  const rivalSize = [
    copy(BAND_LABELS.rivalSize.near),
    copy(BAND_LABELS.rivalSize.middle),
    copy(BAND_LABELS.rivalSize.far),
  ];

  it(`${D.adr001} — the assertion is over the two sets, so a fourth term added to either is caught the moment it is added`, () => {
    const intersection = winnability.filter((term) => rivalSize.includes(term));
    expect(intersection).toEqual([]);
  });

  it("REQ-096 c9, quoted: \"no term rendered for a rival's band is a term rendered for a target's winnability band … so no single word names both how big a rival is and how winnable a target is\" — the union of the two sets holds six distinct words", () => {
    expect(new Set([...winnability, ...rivalSize]).size).toBe(6);
  });

  it("each set is three distinct terms in its own right, and none is empty or a bare handle", () => {
    expect(new Set(winnability).size).toBe(3);
    expect(new Set(rivalSize).size).toBe(3);
    for (const term of [...winnability, ...rivalSize]) {
      expect(term.length).toBeGreaterThan(0);
      expect(term).not.toMatch(/^[a-z-]+$/); // a rendered word, never the handle
    }
  });
});

// ─────────────────────────────────────────────── §13 payments — the three price
// pins and the two backstop clocks (issues #33, #91)

describe("§13 Payments — the price the Stripe Price object is built from and checked against", () => {
  it(`§13, quoted: "${B.priceFlat}" — PRICE_EUR_CENTS is that amount in minor units, so no caller multiplies by a hundred`, () => {
    expect(pins.PRICE_EUR_CENTS).toBe(4900);
    expect(pins.PRICE_EUR_CENTS).toBe(49 * 100);
    expect(Number.isInteger(pins.PRICE_EUR_CENTS)).toBe(true);
  });

  it(`${D.adr052} — PRICE_CURRENCY is the currency the amount above is denominated in, lowercased as the vendor's own Price object carries it; REQ-024's archived criterion 4 (frozen corpus) reads "it is €49 in euro — the same amount and the same currency wherever they are, never converted to a local one"`, () => {
    expect(pins.PRICE_CURRENCY).toBe("eur");
    expect(pins.PRICE_CURRENCY).toBe(pins.PRICE_CURRENCY.toLowerCase());
  });

  it(`§13, quoted: "${B.priceFlat}" — the "/mo" half. PRICE_INTERVAL is the recurring interval, singular, as the vendor's Price object names it`, () => {
    expect(pins.PRICE_INTERVAL).toBe("month");
  });

  it(`${D.tax} — no tax rate, tax behaviour or registration threshold is pinned here: the ruling is that none is charged separately, and the one literal this repository states about the Price object ("inclusive") lives beside the object's own spec, not in the price book`, () => {
    const names = Object.keys(pins);
    expect(names.filter((n) => /VAT|TAX/i.test(n))).toEqual([]);
  });
});

describe("§13 Identity — the credential's own two numbers (#35)", () => {
  it('BP-061 d3, quoted: "SHA-256 of a 256-bit random token; constant-time comparison" — LINK_TOKEN_BYTES is those 256 bits, and it is the entropy the unsalted hash rests on', () => {
    expect(pins.LINK_TOKEN_BYTES).toBe(32);
    expect(pins.LINK_TOKEN_BYTES * 8).toBe(256);
  });

  it("BP-061 — SESSION_TTL_DAYS = 30, chosen rather than transcribed: no requirement states a session lifetime, REQ-077 c5 fixes only that signing out ends one. It matches the 30-day window ERASURE_DAYS and HOSTED_RETENTION_DAYS already use, and outlives the sign-in link that opened it many times over", () => {
    expect(pins.SESSION_TTL_DAYS).toBe(30);
    expect(pins.SESSION_TTL_DAYS).toBe(pins.ERASURE_DAYS);
    expect(pins.SESSION_TTL_DAYS * 24).toBeGreaterThan(pins.SIGNIN_LINK_TTL_H);
  });
});

describe("§13 Payments — the two clocks that make sure no charge leaves a founder with nothing", () => {
  it('REQ-024 c5 (archived corpus, frozen), quoted: "when 15 minutes have passed since the charge and no one has signed in at the address that paid, then that address is written to again with an `account` mail" — PAYMENT_CHASE_MINUTES is that 15, and it is not MAINTENANCE_TICK_MINUTES, which bounds how often the tick that notices runs', () => {
    expect(pins.PAYMENT_CHASE_MINUTES).toBe(15);
    expect(Number.isInteger(pins.PAYMENT_CHASE_MINUTES)).toBe(true);
  });

  it('REQ-024 c6 (archived corpus, frozen), quoted: "when 24 hours have passed since the charge, then an account is open against that payment and a sign-in link to it has been sent to the address that paid, with no second charge" — PAYMENT_BACKSTOP_H is that 24, and the backstop is later than the chase, never the same instant', () => {
    expect(pins.PAYMENT_BACKSTOP_H).toBe(24);
    expect(pins.PAYMENT_BACKSTOP_H * 60).toBeGreaterThan(pins.PAYMENT_CHASE_MINUTES);
  });
});

// ────────────────────────────────────────────────────── the file's own contract

// ────────────────────────────────────────────────────────── §4.6 the draft editor's two intervals

describe("§4.6 the draft view — the two intervals the editor is built on (#17)", () => {
  it(`§4.6, quoted: "${B.draftEditor}" · DECISIONS 2026-08-28, quoted: "${D.markdownEditor}" — AUTOSAVE_DEBOUNCE_MS is the pause "autosaved" names, and the archived BP-044 \`## NFR budget\` derives it: "1200 ms is above ordinary inter-keystroke pauses and below the interval at which a customer starts to feel their work is at risk"`, () => {
    expect(pins.AUTOSAVE_DEBOUNCE_MS).toBe(1200);
    expect(B.draftEditor).toContain("autosaved");
    // The two properties that make 1200 the right number rather than any
    // number: it is longer than a keystroke gap (so a burst of typing is one
    // save, not one per character) and short enough that a pause is a save
    // rather than a risk the customer has to think about.
    expect(pins.AUTOSAVE_DEBOUNCE_MS).toBeGreaterThan(500);
    expect(pins.AUTOSAVE_DEBOUNCE_MS).toBeLessThan(5000);
  });

  it(`§4.6, quoted: "${B.draftEditor}" — PREVIEW_DEBOUNCE_MS is the ceiling on the "live preview pane"'s re-render; the archived BP-044 \`## NFR budget\`: "preview re-renders at most every 100 ms and runs entirely client-side, so 'as they type' costs no round trip"`, () => {
    expect(pins.PREVIEW_DEBOUNCE_MS).toBe(100);
    expect(B.draftEditor).toContain("live preview pane");
    // The preview must feel like typing and the save must not: a preview
    // interval at or above the autosave's would make the pane lag the
    // keystroke, which is the one thing "as they type" forbids.
    expect(pins.PREVIEW_DEBOUNCE_MS).toBeLessThan(pins.AUTOSAVE_DEBOUNCE_MS);
  });
});

describe("BP-005 error behaviour — every pin is asserted, by quotation and never by line number", () => {
  /**
   * The exhaustiveness gate. A pin appended to `constants.ts` without an
   * assertion here is a pinned number no clause is holding, which is the
   * state BUILD §1 exists to prevent. Adding the assertion is what makes
   * this pass — never adding the name to a list.
   */
  it("every export of src/lib/config/constants.ts is named somewhere in this file", () => {
    const unasserted = Object.keys(pins).filter((name) => !PINS_SOURCE.includes(name));
    expect(
      unasserted,
      `${unasserted.join(", ")} — pinned in constants.ts and asserted by no clause here. Add a block quoting the BUILD.md / DECISIONS.md line that rules it.`
    ).toEqual([]);
  });

  it("cites no source by file and line — rule 5.3 is `path + verbatim quote`", () => {
    const withoutImports = PINS_SOURCE.split("\n")
      .filter((line) => !/^\s*(import|\/\/ tests\/pins)/.test(line))
      .join("\n");
    expect(withoutImports).not.toMatch(/[\w./-]+\.(ts|tsx|md):\d+/);
  });

  it("asserts values and declares none — no pin's value is minted in this file", () => {
    expect(PINS_SOURCE).not.toMatch(/^\s*export\s+const\s/m);
  });

  it("every clause this file quotes is still, verbatim, in the document that rules it", () => {
    const missing: string[] = [];
    for (const [key, clause] of Object.entries(B)) if (!BUILD.includes(norm(clause))) missing.push(`BUILD.md: B.${key}`);
    for (const [key, clause] of Object.entries(D)) if (!DECISIONS.includes(norm(clause))) missing.push(`DECISIONS.md: D.${key}`);
    for (const [key, clause] of Object.entries(C)) if (!DATA_COSTS.includes(norm(clause))) missing.push(`DATA-COSTS.md: C.${key}`);
    expect(missing, `${missing.join(" · ")} — the clause moved or was reworded; re-read the pin against the new words rather than re-typing the quote`).toEqual([]);
  });

  it("runs in under a second, so a drifted constant fails before anything expensive runs", () => {
    expect(Date.now() - SUITE_START).toBeLessThan(1000);
  });
});
