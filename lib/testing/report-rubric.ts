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
export function derivableNumbers(payload: ReportPayload): Map<number, string> {
  const out = new Map<number, string>();
  const add = (value: number, source: string) => {
    if (Number.isFinite(value) && !out.has(value)) out.set(value, source);
  };

  const walk = (node: unknown, path: string): void => {
    if (typeof node === "number") {
      add(node, `payload value at ${path}`);
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
  walk(payload, "");

  // (d) Named render derivations — each names its renderer source expression.
  add(100, 'the "/ 100" gauge + driver-bar denominator (results-screen.tsx)');
  add(tierByPlan("solo").monthly, 'tierByPlan("solo").monthly — the PRICE_LINE unlock price (lib/billing/pricing.ts)');

  const acts = payload.whatToDoThisWeek;
  const fullActions = acts.quickWins.length + acts.medium.length + acts.longPlay.length;
  add(fullActions, "Σ action buckets — the “show N of TOTAL” teaser total (public-report.tsx fullActions)");
  const redacted = redactReportForTier(payload, "free").whatToDoThisWeek;
  const shownActions = redacted.quickWins.length + redacted.medium.length + redacted.longPlay.length;
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

/** Mirrors to-results-props.ts `cleanTags` — the mirror-grounding gate. */
const cleanTags = (tags: string[] | undefined): string[] =>
  (tags ?? []).filter((t) => typeof t === "string" && t.trim().length >= 2);

interface SectionRule {
  id: string;
  /** Copy that renders ONLY inside this section (matched on visible text). */
  marker: string;
  /** True ⇔ the payload carries the input that grounds this section. */
  grounded: (p: ReportPayload) => boolean;
}

const SECTION_RULES: SectionRule[] = [
  {
    id: "rivalry-names",
    marker: "Buyers compare you to",
    grounded: (p) =>
      (p.searchVisibility?.categoryDemand ?? 0) > 0 &&
      (p.whereTheyAre?.competitorGap ?? []).some((c) => typeof c.competitor === "string" && c.competitor.length > 0),
  },
  {
    id: "rivalry-degrade-tease",
    marker: "Someone is winning these searches today.",
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
    marker: "searches/mo across your category",
    grounded: (p) => (p.searchVisibility?.categoryDemand ?? 0) > 0,
  },
  {
    id: "off-topic-examples",
    marker: "e.g. you rank for",
    // Mirrors the render boundary's editorial curation (`renderableExamples`):
    // a payload whose only examples are explicit terms grounds NO example copy.
    grounded: (p) =>
      !!p.searchVisibility &&
      p.searchVisibility.keywordsRanked > 0 &&
      p.searchVisibility.offTopicPct >= 40 &&
      renderableExamples(p.searchVisibility.offTopicExamples).length > 0,
  },
  {
    id: "positioning-mirror",
    marker: "Positioning Mirror",
    grounded: (p) => cleanTags(p.whatYouOffer.positioningMirror.actualAudience).length > 0,
  },
  {
    id: "wins-sentence",
    marker: "You rank in the top 3 for",
    grounded: (p) => (p.searchVisibility?.categoryDemand ?? 0) > 0 && (p.searchVisibility?.categoryWins ?? 0) > 0,
  },
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
    const expectedLocked = Math.max(0, fullActions - Math.min(shownActions, 3));
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

      // "your weaker half" (G5, E2 facts-first copy): only when search
      // presence is genuinely the lower driver — and always then, whenever an
      // opportunity row rendered.
      const weakerHalf = text.includes("your weaker half");
      const searchIsWeaker = sv.score < onPage;
      if (weakerHalf && !searchIsWeaker) {
        violations.push({ rule: "R5", message: `"the weaker half" rendered but search presence (${sv.score}) is not below on-page readiness (${onPage})` });
      }
      const kgLen = payload.market?.gap?.keywordGap?.length ?? 0;
      const hasOppRow = kgLen > 0 || (sv.categoryOpportunities?.length ?? 0) > 0;
      if (!weakerHalf && searchIsWeaker && hasOppRow) {
        violations.push({ rule: "R5", message: `search presence (${sv.score}) is the weaker driver and an opportunity rendered, but "the weaker half" clause is missing` });
      }

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
    const validBroad =
      !!sv && sv.categoryDemand > 0 && (sv.marketTiers ?? []).some((t) => t.tier === "broad" && t.demand > sv.categoryDemand);
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
// Registry + runner
// ---------------------------------------------------------------------------

/** Every rubric rule, in priority order. The corpus test pins this list's
 *  length as an only-grows floor — deleting a rule is a ratchet violation. */
export const RUBRIC_RULES: RubricRule[] = [r1NoGarbage, r2NumberBasis, r3EmptyInputNoSection, r4TeaserParity, r5ComparativeCopy, r6LadderSanity, r7NoNumeralClaimsInLlmProse];

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
