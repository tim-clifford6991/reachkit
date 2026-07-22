/**
 * Rendered-report acceptance rubric — the machine-run codification of the
 * owner's live-review heuristics for the FREE PUBLIC report render (the
 * conversion surface). Every rule is a pure payload↔HTML cross-check:
 * `runReportRubric(payload, html)` takes the FULL (pre-redaction)
 * `report_payload` and the HTML produced by the REAL public path
 * (`publicReportProps` → `redactReportForTier("free")` → `toResultsProps` →
 * `renderToStaticMarkup(<ResultsScreen/>)`) and returns violations.
 *
 * WHY THIS EXISTS: every number-honesty gate before this (G1–G10, the
 * classification corpus) was created AFTER a failure shipped and was found by
 * the owner reading live renders — the acceptance oracle was a human, late and
 * expensive. This engine runs the same review every `pnpm test`, over the REAL
 * captured payloads in `lib/scan/fixtures/report-corpus/` (see
 * `components/report/captured/report-corpus.rubric.test.tsx`). It is the
 * pre-build acceptance oracle the Change Protocol's "Acceptance (corpus-first)"
 * clause points at: expected outputs exist BEFORE a user-visible change lands.
 *
 * The rules assume the public free render (`hideUnlock` false, sv present on
 * web scans). Each rule is registered in RUBRIC_RULES so the corpus test can
 * pin the rule count (rules only grow — the ratchet). Every rule has a
 * self-test in `report-rubric.test.ts` proving it FIRES on a violating input,
 * and a named production mutation in the corpus test's docblock proving it
 * bites on real fixtures ("a guard you have not seen fail is not a guard").
 */

import { parse } from "node-html-parser";
import type { ReportPayload } from "@/lib/scan/report";
import { redactReportForTier } from "@/lib/billing/entitlements";
import { tierByPlan } from "@/lib/billing/pricing";
import { renderableExamples } from "@/lib/scan/explicit-terms";

export interface RubricViolation {
  rule: string;
  message: string;
}

export interface RubricRule {
  id: string;
  title: string;
  check: (payload: ReportPayload, html: string) => RubricViolation[];
}

// ---------------------------------------------------------------------------
// Shared extraction helpers
// ---------------------------------------------------------------------------

/** Tags whose text content is code/CSS, not user-visible copy. */
const NON_COPY_TAGS = new Set(["STYLE", "SCRIPT", "NOSCRIPT", "TEMPLATE"]);

/**
 * The user-visible text of the rendered report: text nodes only, never
 * attributes (inline `style=` coordinates/hex would be pure false-positive
 * noise) and never `<style>`/`<script>` bodies (the scoped RESULTS_CSS block
 * is full of breakpoint numbers no user ever reads).
 */
export function visibleText(html: string): string {
  const root = parse(html);
  const parts: string[] = [];
  const walk = (node: ReturnType<typeof parse>): void => {
    for (const child of node.childNodes) {
      // nodeType 3 = text node in node-html-parser
      if (child.nodeType === 3) {
        parts.push(child.rawText);
      } else if (child.nodeType === 1) {
        const el = child as unknown as { rawTagName?: string };
        const tag = (el.rawTagName ?? "").toUpperCase();
        if (!NON_COPY_TAGS.has(tag)) walk(child as unknown as ReturnType<typeof parse>);
      }
    }
  };
  walk(root);
  // Decode the handful of entities renderToStaticMarkup emits into copy. None
  // affect numeric tokens; this is for phrase-level assertions on the text.
  return parts
    .join(" ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

/**
 * Every integer ≥ MIN_SIGNIFICANT rendered in the visible text, with a short
 * surrounding context for error messages. `550,000` → 550000; `#12` → 12;
 * `72%` → 72; a token immediately followed by `…` is a truncation artifact
 * (identityLine cuts prose at 159 chars, possibly mid-number) and is skipped.
 */
const MIN_SIGNIFICANT = 10;
export function renderedNumbers(html: string): Array<{ value: number; context: string }> {
  const text = visibleText(html);
  const out: Array<{ value: number; context: string }> = [];
  const re = /\d[\d,]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[0];
    if (text[m.index + token.length] === "…") continue; // truncated mid-number
    const value = Number(token.replace(/,/g, ""));
    if (!Number.isFinite(value) || value < MIN_SIGNIFICANT) continue;
    const context = text.slice(Math.max(0, m.index - 40), m.index + token.length + 40).replace(/\s+/g, " ").trim();
    out.push({ value, context });
  }
  return out;
}

/**
 * The derivable set: every number a free public render may legitimately show,
 * each mapped to the payload path / source expression it derives from. A
 * rendered number outside this set is a fabrication, an alias, or a literal —
 * exactly the resend-double-print / SpaceX-8,170 class.
 *
 * Composition (the anti-vacuity stance from `expectCallsSymbol`: every entry
 * names its source expression — a bare numeric literal with no source is
 * forbidden):
 *  (a) every numeric VALUE recursively in the payload JSON;
 *  (b) every numeric token inside payload STRING values (prose the LLM/extract
 *      wrote — "500,000+ users" in listingSays is payload-grounded);
 *  (c) every ARRAY LENGTH recursively (counts like gapTotal render as lengths);
 *  (d) the named render derivations below, each tied to its renderer source.
 */
/** The payload-agnostic half of the derivable set — (a) numeric values, (b)
 *  numeric tokens in strings, (c) array lengths, recursively over ANY JSON.
 *  Extracted so surface-specific rubrics (the paid intel/hero rubric) reuse the
 *  identical walk instead of forking it. Number values also register the
 *  integers that common render formattings produce from them: `Math.round(v)`
 *  and the compact mantissa (`fmtCompact` renders 12400 as "12.4K", from which
 *  the extractor reads 12 — a derivable rendering of a real value, not a
 *  fabrication). */
export function derivableNumbersFromJson(root: unknown): Map<number, string> {
  const out = new Map<number, string>();
  const add = (value: number, source: string) => {
    if (Number.isFinite(value) && !out.has(value)) out.set(value, source);
  };

  const walk = (node: unknown, path: string): void => {
    if (typeof node === "number") {
      add(node, `payload value at ${path}`);
      add(Math.round(node), `Math.round of payload value at ${path}`);
      if (node >= 1000) add(Math.floor(node / 1000), `compact-mantissa (…K) of payload value at ${path}`);
      if (node >= 1_000_000) add(Math.floor(node / 1_000_000), `compact-mantissa (…M) of payload value at ${path}`);
      return;
    }
    if (typeof node === "string") {
      for (const token of node.match(/\d[\d,]*/g) ?? []) {
        add(Number(token.replace(/,/g, "")), `numeric token in payload string at ${path}`);
      }
      return;
    }
    if (Array.isArray(node)) {
      add(node.length, `array length of ${path}`);
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(root, "");
  return out;
}

export function derivableNumbers(payload: ReportPayload): Map<number, string> {
  const out = derivableNumbersFromJson(payload);
  const add = (value: number, source: string) => {
    if (Number.isFinite(value) && !out.has(value)) out.set(value, source);
  };

  // (d) Named render derivations — each names its renderer source expression.
  add(100, 'the "/ 100" gauge + driver-bar denominator (results-screen.tsx)');
  add(tierByPlan("solo").monthly, 'tierByPlan("solo").monthly — the PRICE_LINE unlock price (lib/billing/pricing.ts)');

  const acts = payload.whatToDoThisWeek;
  const fullActions = acts.quickWins.length + acts.medium.length + acts.longPlay.length;
  add(fullActions, "Σ action buckets — the “show N of TOTAL” teaser total (public-report.tsx fullActions)");
  const redacted = redactReportForTier(payload, "free").whatToDoThisWeek;
  const shownActions = redacted.quickWins.length + redacted.medium.length + redacted.longPlay.length;
  // Phase C / D4 (2026-07-21, supersedes P4's 2): SHOWN_FIXES = 3 (the free
  // board always shows 3 ranked fixes). Must track `SHOWN_FIXES` in
  // to-results-props.ts — the locked-fixes teaser count is `fullActions −
  // min(shownActions, 3)`. The 2 blurred locked-preview rows are a separate,
  // non-numeric visual tease, not counted here.
  add(Math.max(0, fullActions - Math.min(shownActions, 3)), "fullActions − rendered fixes — the locked-fixes teaser count (to-results-props.ts lockedCount)");

  const sv = payload.searchVisibility;
  const kgLen = payload.market?.gap?.keywordGap?.length ?? 0;
  const oppLen = sv?.categoryOpportunities?.length ?? 0;
  const catGapLen = sv?.categoryGap?.length ?? 0;
  // Mirrors the fullGapQueries priority chain in public-report.tsx (WS-B) — a
  // drift there is a drift HERE by design: the corpus test fails loudly.
  const gapTotal = kgLen || oppLen || catGapLen;
  const rowsRendered = Math.min(kgLen > 0 ? kgLen : oppLen, 4);
  add(Math.max(0, gapTotal - rowsRendered), 'gapTotal − rendered rows — the “N more like it” tease (results-screen.tsx `more`)');

  if (sv) {
    const winsShown = Math.min(
      3,
      (sv.categoryRanked ?? []).filter((r) => typeof r.yourPosition === "number" && r.yourPosition <= 3).length,
    );
    add(Math.max(0, sv.categoryWins - winsShown), 'categoryWins − rendered wins chips — the wins-strip “+N more” disclosure (results-screen.tsx)');
  }

  return out;
}

// ---------------------------------------------------------------------------
// R1 — no garbage strings
// ---------------------------------------------------------------------------

/** Tokens that only appear when a value threaded into JSX was undefined/NaN/an
 *  unstringified object — promoted from results-screen.render.test.tsx. */
export const GARBAGE_TOKENS = ["undefined", "NaN", "[object Object]", "$undefined", "Infinity"];

const r1NoGarbage: RubricRule = {
  id: "R1",
  title: "no garbage strings in the rendered HTML",
  check: (_payload, html) =>
    GARBAGE_TOKENS.filter((g) => html.includes(g)).map((g) => ({
      rule: "R1",
      message: `rendered HTML contains "${g}" — a value threaded into JSX was undefined/NaN/an unstringified object`,
    })),
};

// ---------------------------------------------------------------------------
// R2 — every rendered number has a payload basis
// ---------------------------------------------------------------------------

const r2NumberBasis: RubricRule = {
  id: "R2",
  title: "every rendered number ≥ 10 derives from the payload (no alias, no literal, no fabrication)",
  check: (payload, html) => {
    const derivable = derivableNumbers(payload);
    const violations: RubricViolation[] = [];
    for (const { value, context } of renderedNumbers(html)) {
      if (!derivable.has(value)) {
        violations.push({
          rule: "R2",
          message: `rendered number ${value} has no payload basis — context: “…${context}…”`,
        });
      }
    }
    return violations;
  },
};

// ---------------------------------------------------------------------------
// R3 — empty input ⇒ no section (invariant #11 at report level)
// ---------------------------------------------------------------------------

/** Mirrors `marketCardReady` (results-screen.tsx) EXACTLY — a card is
 *  renderable only when it carries priced, grounded phrases (rankedTop3 ∪
 *  gaps), never an empty "0 searches/mo, None yet, None yet" shell. This is
 *  also the branch selector: whenever the CATEGORY card is ready, the six-
 *  section board (P3) supersedes the pre-P2 market-tier ladder, so every
 *  SECTION_RULE below that only fires in the legacy branch must condition on
 *  `!marketCardReady(sv.categoryCard)` too, or R3 fails on a new-path payload
 *  ("grounded but did not render") the moment its categoryCard is populated. */
function marketCardReady(card: { rankedTop3: unknown[]; gaps: unknown[] } | null | undefined): boolean {
  return !!card && card.rankedTop3.length + card.gaps.length > 0;
}

interface SectionRule {
  id: string;
  /** Copy that renders ONLY inside this section (matched on visible text). */
  marker: string;
  /** True ⇔ the payload carries the input that grounds this section. */
  grounded: (p: ReportPayload) => boolean;
}

const SECTION_RULES: SectionRule[] = [
  {
    // P4 (2026-07-20, terseness): marker updated from "Buyers compare you to"
    // — the old prose sentence ("…and rivals are taking the searches above.
    // Unlock to see how each one ranks, why they win…") is gone; the rivalry
    // teaser is now a bare "Compared to: {names}" keyword tease.
    id: "rivalry-names",
    marker: "Compared to",
    grounded: (p) =>
      (p.searchVisibility?.categoryDemand ?? 0) > 0 &&
      (p.whereTheyAre?.competitorGap ?? []).some((c) => typeof c.competitor === "string" && c.competitor.length > 0),
  },
  {
    // P4: marker updated from "Someone is winning these searches today." to
    // the new terse degrade tease's own text.
    id: "rivalry-degrade-tease",
    marker: "See who's winning these searches",
    grounded: (p) =>
      (p.searchVisibility?.categoryDemand ?? 0) > 0 &&
      !(p.whereTheyAre?.competitorGap ?? []).some((c) => typeof c.competitor === "string" && c.competitor.length > 0),
  },
  {
    id: "zero-state",
    marker: "Google ranks you for 0 searches.",
    grounded: (p) => !!p.searchVisibility && p.searchVisibility.keywordsRanked === 0,
  },
  {
    id: "category-demand-hero",
    // The PRE-P2 market-tier ladder's own hero line — superseded by the P3
    // "category-card-hero" rule below once a payload carries a ready
    // categoryCard (results-screen.tsx renders the six-section board instead).
    marker: "searches/mo across your category",
    grounded: (p) => (p.searchVisibility?.categoryDemand ?? 0) > 0 && !marketCardReady(p.searchVisibility?.categoryCard),
  },
  {
    id: "off-topic-examples",
    // P4 review fix (2026-07-20): marker updated from "e.g. you rank for" —
    // the sentence it lived in ("N% of your search traffic is other
    // companies' names — not buyers looking for you. e.g. you rank for…")
    // is gone; the terse chip now appends "· e.g. "term1", "term2"" after
    // the base percentage label.
    marker: "· e.g.",
    // Mirrors the render boundary's editorial curation (`renderableExamples`):
    // a payload whose only examples are explicit terms grounds NO example copy.
    // Superseded by the P3 aggregation strip once categoryCard is ready — the
    // old brand/category/off-topic footprint-split block (which this marker
    // lives inside) no longer renders on the new-board path.
    grounded: (p) =>
      !!p.searchVisibility &&
      p.searchVisibility.keywordsRanked > 0 &&
      p.searchVisibility.offTopicPct >= 40 &&
      renderableExamples(p.searchVisibility.offTopicExamples).length > 0 &&
      !marketCardReady(p.searchVisibility.categoryCard),
  },
  // "positioning-mirror" removed (P4, 2026-07-20): the section is now REMOVED
  // from the free board unconditionally (never gated on grounding) — R8 below
  // asserts it never renders, for any payload, rather than pairing a marker
  // with a grounding predicate that can no longer be satisfied.
  // "wins-sentence" removed (P4 review fix, 2026-07-20): the legacy "YOUR
  // CATEGORY" card's full sentence ("You rank in the top 3 for N of your
  // category's searches." / "You don't rank in the top 3 for any of your
  // category's searches yet.") is now REMOVED from the free board
  // unconditionally, same treatment as "positioning-mirror" above — a terse
  // "top 3 × N" / "not ranking" chip replaces it (results-screen.tsx). R8
  // below asserts both sentence variants never render, for any payload.
  {
    id: "category-card-hero",
    // P3 (data board §1, Overview): the hero stat, grounded on the LADDERED
    // categoryCard demand (a different number from the legacy categoryDemand
    // field above — the two coexist by design, see search-visibility.ts).
    marker: "in your market — you're in a real category",
    grounded: (p) => marketCardReady(p.searchVisibility?.categoryCard) && (p.searchVisibility?.categoryCard?.demand ?? 0) > 0,
  },
  {
    id: "opportunity-niche",
    // P3 (data board §4): the niche's own gap keywords, by volume — the
    // "what to rank for next" module (demand-sized bars). Marker updated
    // 2026-07-22 when the eyebrow "Opportunity · your niche" became the
    // clearer header "What to rank for next" (same section, R3 intent intact).
    marker: "What to rank for next",
    grounded: (p) => {
      const sv = p.searchVisibility;
      return marketCardReady(sv?.categoryCard) && marketCardReady(sv?.nicheCard) && (sv?.nicheCard?.gaps.length ?? 0) > 0;
    },
  },
  // (removed 2026-07-22) the "directory-strip" grounded rule — the aggregation
  // strip render was removed from the free board (owner decluttering note); its
  // never-renders guard now lives in report-corpus.rubric.test.tsx.
];

const r3EmptyInputNoSection: RubricRule = {
  id: "R3",
  title: "an empty input sheet renders no section — and a grounded input always renders its section",
  check: (payload, html) => {
    const text = visibleText(html);
    const violations: RubricViolation[] = [];
    for (const s of SECTION_RULES) {
      const rendered = text.includes(s.marker);
      const grounded = s.grounded(payload);
      if (rendered && !grounded) {
        violations.push({
          rule: "R3",
          message: `section "${s.id}" rendered ("${s.marker}") but its payload input is empty/ungrounded — degrade, never invent`,
        });
      }
      if (!rendered && grounded) {
        violations.push({
          rule: "R3",
          message: `section "${s.id}" is grounded in the payload but its copy ("${s.marker}") did not render — a silent drop`,
        });
      }
    }
    return violations;
  },
};

// ---------------------------------------------------------------------------
// R4 — teaser counts come from the collection their section renders, never 0
// ---------------------------------------------------------------------------

const r4TeaserParity: RubricRule = {
  id: "R4",
  title: 'teaser counts equal the collection their section renders ("Unlock all 0" is impossible)',
  check: (payload, html) => {
    const text = visibleText(html);
    const violations: RubricViolation[] = [];

    const sv = payload.searchVisibility;
    const kgLen = payload.market?.gap?.keywordGap?.length ?? 0;
    const oppLen = sv?.categoryOpportunities?.length ?? 0;
    const catGapLen = sv?.categoryGap?.length ?? 0;
    // Mirrors fullGapQueries in public-report.tsx (WS-B source-parity).
    const expectedGapTotal = kgLen || oppLen || catGapLen;

    for (const m of text.matchAll(/all (\d[\d,]*) (?:category )?opportunities|\((\d[\d,]*) queries\)/g)) {
      const n = Number((m[1] ?? m[2] ?? "").replace(/,/g, ""));
      if (n === 0) {
        violations.push({ rule: "R4", message: `a gap teaser rendered a count of 0 ("${m[0]}") — the "Unlock all 0" class` });
      } else if (n !== expectedGapTotal) {
        violations.push({
          rule: "R4",
          message: `gap teaser count ${n} ("${m[0]}") ≠ ${expectedGapTotal}, the length of the collection its section renders (fullGapQueries chain)`,
        });
      }
    }

    const acts = payload.whatToDoThisWeek;
    const fullActions = acts.quickWins.length + acts.medium.length + acts.longPlay.length;
    const redacted = redactReportForTier(payload, "free").whatToDoThisWeek;
    const shownActions = redacted.quickWins.length + redacted.medium.length + redacted.longPlay.length;
    // Phase C / D4 (2026-07-21): SHOWN_FIXES = 3 (see the derivableNumbers() comment above).
    const expectedLocked = Math.max(0, fullActions - Math.min(shownActions, 3));
    // The teaser now renders ONLY when there's a real withheld count (>0); a
    // zero-locked plan shows a generic "unlock the full plan" CTA with no number,
    // so there's nothing for this matcher to reconcile in that case.
    for (const m of text.matchAll(/(\d[\d,]*) more ranked fixes/g)) {
      const n = Number((m[1] ?? "").replace(/,/g, ""));
      if (n === 0 || n !== expectedLocked) {
        violations.push({
          rule: "R4",
          message: `locked-fixes teaser ${n} ("${m[0]}") ≠ ${expectedLocked} = fullActions(${fullActions}) − rendered preview — the count must come from the plan it teases`,
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// R5 — comparative copy renders only when the comparison holds
// ---------------------------------------------------------------------------

const r5ComparativeCopy: RubricRule = {
  id: "R5",
  title: "comparative copy is conditional on the comparison being true (G5 generalized)",
  check: (payload, html) => {
    const text = visibleText(html);
    const violations: RubricViolation[] = [];
    const sv = payload.searchVisibility;

    // Legacy payloads predate `onPageReadiness`; the props boundary coalesces
    // it to `score.total` (to-results-props.ts) — mirror that, or every
    // pre-v5-fields payload trips a false comparison violation.
    const onPage = sv?.onPageReadiness ?? payload.score.total;
    if (sv) {
      // The driver-summary line names whichever driver is ACTUALLY weaker
      // (results-screen.tsx `weakerDriver`).
      const weaker = onPage < sv.score ? "On-page readiness" : "Search presence";
      const stronger = weaker === "Search presence" ? "On-page readiness" : "Search presence";
      if (!text.includes(`${weaker} is your gap.`)) {
        violations.push({ rule: "R5", message: `driver summary must name the weaker driver — expected "${weaker} is your gap." (on-page ${onPage} vs search ${sv.score})` });
      }
      if (text.includes(`${stronger} is your gap.`)) {
        violations.push({ rule: "R5", message: `"${stronger} is your gap." contradicts the driver bars (on-page ${onPage} vs search ${sv.score})` });
      }

      // "your weaker half" (G5, E2 facts-first copy) REMOVED (P4 review fix,
      // 2026-07-20): the legacy "Your biggest untapped opportunity" block's
      // explainer sentence ("Winning this lifts Search presence — your weaker
      // half.") is gone unconditionally — the query/volume/rank chips above it
      // already carry the meaning (results-screen.tsx). This conditional
      // "must render when search is weaker" assertion is obsolete now that the
      // clause can never render for any payload; R8's BANNED_PROSE entry
      // ("weaker half") is the permanent guard against it coming back.

      // The 0-ranking headline claim must be literally true.
      if (text.includes("ranks you for nothing yet") && sv.keywordsRanked !== 0) {
        violations.push({ rule: "R5", message: `headline claims "ranks you for nothing yet" but keywordsRanked is ${sv.keywordsRanked}` });
      }
    }

    // The intro gates on the ON-PAGE driver (to-results-props.ts onPageForIntro).
    const decent = text.includes("is in decent on-page shape");
    const gaps = text.includes("has real on-page gaps");
    if (onPage >= 60 && (gaps || !decent)) {
      violations.push({ rule: "R5", message: `on-page driver is ${onPage} (≥60) but the intro ${gaps ? 'claims "has real on-page gaps"' : 'is missing "is in decent on-page shape"'}` });
    }
    if (onPage < 60 && (decent || !gaps)) {
      violations.push({ rule: "R5", message: `on-page driver is ${onPage} (<60) but the intro ${decent ? 'claims "is in decent on-page shape"' : 'is missing "has real on-page gaps"'}` });
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// R6 — ladder sanity: a BROAD rung must actually be broader than the category
// ---------------------------------------------------------------------------

const r6LadderSanity: RubricRule = {
  id: "R6",
  title: "a BROAD ladder rung renders only when its demand exceeds the category hero (no inverted ladder)",
  check: (payload, html) => {
    const text = visibleText(html);
    const violations: RubricViolation[] = [];
    const sv = payload.searchVisibility;
    // The bridge line renders ONLY under a surviving broad rung
    // (results-screen.tsx `broadTier`). Corpus finding (getapp.com legacy
    // payload): a persisted broad rung of 10 rendered ABOVE a hero of 30 —
    // the lib-level inversion guard can't clean persisted rows, so the props
    // boundary filters it and this rule pins that both ways.
    const marker = "Your category, where the plan below starts:";
    const rendered = text.includes(marker);
    // P3: the bridge line lives INSIDE the legacy ladder branch — once a
    // payload's categoryCard is ready, results-screen.tsx renders the P3
    // six-section board instead and this bridge never appears, regardless of
    // marketTiers still being present in the payload (both are computed
    // together going forward, search-visibility.ts `gatherFreeSearchVisibility`).
    const validBroad =
      !!sv &&
      sv.categoryDemand > 0 &&
      !marketCardReady(sv.categoryCard) &&
      (sv.marketTiers ?? []).some((t) => t.tier === "broad" && t.demand > sv.categoryDemand);
    if (rendered && !validBroad) {
      violations.push({
        rule: "R6",
        message: "a BROAD rung rendered but the payload has no broad tier bigger than the category hero — an inverted ladder is dishonest, drop the rung",
      });
    }
    if (!rendered && validBroad) {
      violations.push({
        rule: "R6",
        message: "the payload carries a valid broad tier (demand > category hero) but the BROAD rung did not render — a silent drop",
      });
    }
    return violations;
  },
};

// ---------------------------------------------------------------------------
// R7 — LLM-authored prose never carries an unmeasured quantitative claim
// (the trustmrr "180,000 monthly visitors" class)
// ---------------------------------------------------------------------------

/** A digit-run of 3+ consecutive digits — "180,000" (via its "180"/"000"
 *  groups), "45,000+", "500,000". Deliberately catches nothing smaller (a
 *  rank "#12" or "top 5" is not a claim about scale). */
const R7_DIGIT_RUN_RE = /\d{3,}/;

/** Splits `text` into sentences — mirrors `splitSentences` in
 *  to-results-props.ts exactly (incl. protecting decimal points like "2.5
 *  million" from being read as a sentence terminator: a naive split
 *  fractures "…45,000+ options and 2.5 million user reviews." into "…and 2."
 *  + "5 million user reviews.", and the surviving fragment loses its
 *  digit-run — the real getapp.com corpus bug this rule exists to catch), so
 *  the rubric can assert the scrub actually held on the RENDERED html. */
const DIGIT_SENTENCE_SENTINEL = "\u0001";
function digitLadenSentences(text: string | undefined): string[] {
  if (!text) return [];
  const protectedText = text.replace(/(\d)\.(\d)/g, `$1${DIGIT_SENTENCE_SENTINEL}$2`);
  return (protectedText.match(/[^.!?]+[.!?]*/g) ?? [])
    .map((s) => s.split(DIGIT_SENTENCE_SENTINEL).join(".").trim())
    .filter((s) => s.length > 0 && R7_DIGIT_RUN_RE.test(s));
}

const r7NoNumeralClaimsInLlmProse: RubricRule = {
  id: "R7",
  title: "LLM-authored prose (identity line, mirror gap, mirror audience tags) never renders an unmeasured 3+ digit-run number",
  check: (payload, html) => {
    const text = visibleText(html);
    const violations: RubricViolation[] = [];
    const pm = payload.whatYouOffer?.positioningMirror;
    const candidates = [
      ...digitLadenSentences(pm?.listingSays),
      ...digitLadenSentences(pm?.gap),
      ...(pm?.actualAudience ?? []).filter((t) => R7_DIGIT_RUN_RE.test(t)),
      ...(pm?.intendedAudience ?? []).filter((t) => R7_DIGIT_RUN_RE.test(t)),
    ];
    for (const s of candidates) {
      if (s.length >= 4 && text.includes(s)) {
        violations.push({
          rule: "R7",
          message: `LLM-authored prose "${s}" carries an unmeasured 3+ digit-run number and rendered verbatim — the trustmrr "180,000 monthly visitors" class`,
        });
      }
    }
    return violations;
  },
};

// ---------------------------------------------------------------------------
// R8 — the free board is DATA-DRIVEN, not description-driven (P4, 2026-07-20)
//
// Tim's critical P4 directive: the free board is titles + minor keywords +
// numbers ONLY, never long LLM-generated sentences. Three concrete bans, each
// a shipped violation on the live board before this phase:
//  (a) Positioning Mirror — a full LLM prose paragraph — is REMOVED from the
//      free board entirely (unconditional, not payload-gated — see the
//      SECTION_RULES note above where its old grounded entry was removed).
//  (b) a fix card's `why` sentence (the LLM's reasoning paragraph) never
//      renders — only the title + a delta chip.
//  (c) section-subtitle SENTENCES (as opposed to short pill/title labels)
//      never render.
//
// Review-fix wave (2026-07-20): P4 stripped prose from the NEW six-section
// board branch but left the LEGACY market-tier fallback branch (rendered
// when `categoryCard` is absent — 0-ranking sites, synth failures, old
// payloads; VERIFIED to be 100% of the real corpus fixtures, since they all
// predate P2) rendering full sentences unchanged. Closing the class, not the
// case: the bans below cover BOTH branches, so the ratchet catches whichever
// path a given payload takes, not just the new board's own copy.
// ---------------------------------------------------------------------------

/** Exact sentences (or unambiguous sentence fragments) that were the shipped
 *  prose violations this phase closes. Unconditional — never gated on
 *  payload grounding, because these are STRUCTURAL removals (the section/
 *  sentence is gone from the component), not inputs that can legitimately
 *  ground different copy. */
const BANNED_PROSE = [
  "Positioning Mirror",
  "Whether your page reads as the audience you actually want.",
  "What buyers search, what you capture, who takes the rest.",
  "Ordered by expected score impact.",
  "You don't rank for a single term in your own category.",
  "and rivals are taking the searches above",
  "Unlock to see how each one ranks, why they win",
  // Review-fix wave: the legacy market-tier branch's own prose (see the
  // block comment above). "Winning this lifts"/"weaker half" catch both the
  // pre-E2 wording ("Winning this term lifts your Search presence — the
  // weaker half of your Discoverability Score.") and the post-E2 tersened-
  // but-still-a-sentence wording ("Winning this lifts Search presence —
  // your weaker half.") that shipped on the legacy branch.
  "Winning this lifts",
  "Winning this term lifts",
  "weaker half",
  "more like it in your category",
  "You rank in the top 3 for",
  "You don't rank in the top 3",
  "Someone is winning these searches today",
  "The full scan discovers who's winning these searches",
  // P4 review fix (2026-07-20): the legacy footprint-split block's own
  // "not buyers looking for you" sentence — verified live-rendering on
  // directories (getapp.com: offTopicPct 100, aggregatedPct below the
  // newer strip's floor so this old sentence fired instead). The split
  // bar + percentage chips + named examples already carry the same data.
  "not buyers looking for you",
  "of your search traffic is other companies",
];

const r8Terseness: RubricRule = {
  id: "R8",
  title: "the free board is data-driven — no LLM why-sentences, no Positioning Mirror, no section subtitles (P4)",
  check: (payload, html) => {
    const text = visibleText(html);
    const violations: RubricViolation[] = [];

    for (const banned of BANNED_PROSE) {
      if (text.includes(banned)) {
        violations.push({
          rule: "R8",
          message: `banned prose rendered verbatim: "${banned}" — the free board is titles + minor keywords + numbers only, no long sentences`,
        });
      }
    }

    // A fix card's `why` (the LLM's reasoning sentence) must never render —
    // checked against every action in the FULL payload (not just the shown
    // preview), so a locked-preview card leaking a why-sentence is caught too.
    const acts = payload.whatToDoThisWeek;
    const allActions = [...acts.quickWins, ...acts.medium, ...acts.longPlay];
    for (const a of allActions) {
      if (a.why && a.why.trim().length > 0 && text.includes(a.why)) {
        violations.push({
          rule: "R8",
          message: `fix card's why-sentence rendered verbatim: "${a.why}" — terse cards show the title + a delta chip, never the reasoning sentence`,
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// R9 — magnitude / credibility (the trustmrr "10 searches/mo" class, 2026-07-21)
//
// R1–R8 verify a number is HONEST (derives from the payload). R9 verifies a
// number shown as a HERO is CREDIBLE. trustmrr.com passed every honesty rule
// while rendering "YOUR NICHE 10 searches/mo" and a category card backed by a
// single phrase — true-by-construction, and useless as a market signal. The
// owner's "too little and unrealistic" is exactly this: a market card shown as
// a hero must clear a credibility floor and rest on more than one phrase, or it
// degrades to its zero-state (a card is only "ready" when it carries priced
// phrases — see marketCardReady). The Phase A "market size + your share" model
// makes these cards credible (leader-sized demand, 8 phrases) or unready; until
// then trustmrr.com is suppressed in the corpus test as the known-bad marker.
// ---------------------------------------------------------------------------

/** A hero market/category number below this reads as noise, not a market —
 *  the trustmrr "10 searches/mo" class. Deliberately a MAGNITUDE rule only:
 *  whether a card's LABEL is the right market (trustmrr's "Business
 *  Intelligence" mislabel) is the classifier/judge's job (Phase B), and a
 *  legitimate niche can rest on a single tight phrase (savvycal 240/mo), so
 *  R9 never polices phrase COUNT — only that a number shown as a hero clears
 *  a credibility floor or degrades to its zero-state. */
const MAGNITUDE_FLOOR = 100;

const r9MarketCredibility: RubricRule = {
  id: "R9",
  title: "a market/niche card shown as a hero clears a credibility floor — not a tiny number that reads as noise",
  check: (payload, html) => {
    const sv = payload.searchVisibility;
    const violations: RubricViolation[] = [];
    if (!sv) return violations;
    const text = visibleText(html);
    type MarketCard = { demand: number; phrases?: unknown[]; rankedTop3: unknown[]; gaps: unknown[] } | null | undefined;
    const cards: Array<{ name: string; card: MarketCard }> = [
      { name: "category", card: sv.categoryCard },
      { name: "niche", card: sv.nicheCard },
    ];
    for (const { name, card } of cards) {
      // An unready card renders its zero-state, not a number — nothing to judge.
      if (!marketCardReady(card)) continue;
      const demand = card!.demand;
      // Only judge a demand number the user actually sees rendered.
      if (!(demand >= MIN_SIGNIFICANT && text.includes(demand.toLocaleString()))) continue;
      if (demand < MAGNITUDE_FLOOR) {
        violations.push({
          rule: "R9",
          message: `${name} card renders ${demand.toLocaleString()}/mo as a hero — below the ${MAGNITUDE_FLOOR}/mo credibility floor. A tiny number must degrade to its zero-state or show real market size, never stand alone (the trustmrr "10 searches/mo" class).`,
        });
      }
    }
    return violations;
  },
};

// ---------------------------------------------------------------------------
// Registry + runner
// ---------------------------------------------------------------------------

/** Every rubric rule, in priority order. The corpus test pins this list's
 *  length as an only-grows floor — deleting a rule is a ratchet violation. */
export const RUBRIC_RULES: RubricRule[] = [r1NoGarbage, r2NumberBasis, r3EmptyInputNoSection, r4TeaserParity, r5ComparativeCopy, r6LadderSanity, r7NoNumeralClaimsInLlmProse, r8Terseness, r9MarketCredibility];

export interface RubricOptions {
  /** Rule ids to skip for a fixture — a named, only-shrinks list in the corpus
   *  test. Each suppression is either a real bug awaiting its fix or a
   *  documented, reviewed exception. */
  suppress?: string[];
}

export function runReportRubric(payload: ReportPayload, html: string, opts: RubricOptions = {}): RubricViolation[] {
  const suppress = new Set(opts.suppress ?? []);
  return RUBRIC_RULES.filter((r) => !suppress.has(r.id)).flatMap((r) => r.check(payload, html));
}

// ---------------------------------------------------------------------------
// Intel rubric — the PAID surface's rules (R1 + R2i), data-shape agnostic
// ---------------------------------------------------------------------------

export interface IntelRubricRule {
  id: string;
  title: string;
  check: (data: unknown, html: string, extra: Map<number, string>) => RubricViolation[];
}

/** R1 verbatim — garbage detection is payload-agnostic. */
const r1Intel: IntelRubricRule = {
  id: "R1",
  title: r1NoGarbage.title,
  check: (_data, html) =>
    GARBAGE_TOKENS.filter((g) => html.includes(g)).map((g) => ({
      rule: "R1",
      message: `rendered HTML contains "${g}" — a value threaded into JSX was undefined/NaN/an unstringified object`,
    })),
};

/** R2i — every rendered number ≥10 on a paid intel surface derives from the
 *  DATA that drove the render (the generic JSON walk over the exact props/
 *  supply object passed to the component) plus caller-named derivations, each
 *  of which must name its renderer source expression (anti-vacuity — a bare
 *  literal with no source is forbidden). */
const r2iIntelNumberBasis: IntelRubricRule = {
  id: "R2i",
  title: "every rendered number ≥10 on the intel surface derives from its driving data",
  check: (data, html, extra) => {
    const derivable = derivableNumbersFromJson(data);
    for (const [v, s] of extra) if (!derivable.has(v)) derivable.set(v, s);
    derivable.set(100, 'the "/ 100" gauge denominator (dashboard-hero.tsx)');
    const violations: RubricViolation[] = [];
    for (const { value, context } of renderedNumbers(html)) {
      if (!derivable.has(value)) {
        violations.push({ rule: "R2i", message: `rendered number ${value} has no basis in the driving data — context: “…${context}…”` });
      }
    }
    return violations;
  },
};

/** Paid-surface rule set — its length is pinned only-grows by the paid corpus
 *  test, independent of the free RUBRIC_RULES floor. */
export const INTEL_RUBRIC_RULES: IntelRubricRule[] = [r1Intel, r2iIntelNumberBasis];

export function runIntelRubric(
  data: unknown,
  html: string,
  opts: RubricOptions & { extraDerivations?: Map<number, string> } = {},
): RubricViolation[] {
  const suppress = new Set(opts.suppress ?? []);
  const extra = opts.extraDerivations ?? new Map<number, string>();
  return INTEL_RUBRIC_RULES.filter((r) => !suppress.has(r.id)).flatMap((r) => r.check(data, html, extra));
}
