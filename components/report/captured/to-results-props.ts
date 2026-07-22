/**
 * toResultsProps — map the live ReportPayload onto the captured ResultsScreen's
 * props. Wires the fields that map cleanly (score, pillars, fixes, positioning
 * gap, site label); the audience tag-chips use the positioning prose (a clean
 * multi-tag audience model is a follow-up data service), and the search-gap
 * rows come from the market keyword-gap when present.
 */

import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";
import { renderableExamples } from "@/lib/scan/explicit-terms";
import type { ResultsScreenProps, Fix, GapRow } from "./results-screen";

const PILLAR_NOTE = (v: number, isMin: boolean) =>
  isMin ? "biggest lever" : v < 50 ? "needs work" : v >= 70 ? "strong surface" : "room to climb";

const CATEGORY_LABEL: Record<string, string> = { content: "Content", outreach: "Outreach", seo_aso: "SEO" };
const effortLabel = (min: number) => (min < 30 ? "Quick" : min <= 120 ? "Medium" : "Deep");

// E3 — numeral guard on rendered LLM prose (the trustmrr "180,000 monthly
// visitors" class): an LLM-authored field (`identityLine`, `mirrorGap`, the
// mirror's audience tags) must never carry a quantitative claim we didn't
// measure — presenting an unverified third-party number as our own finding is
// the defect, not the underlying data (which is left untouched everywhere
// else). Deterministic scrub at THIS props boundary: drop any SENTENCE
// carrying a digit-run of 3+ consecutive digits (≥100, incl. "180,000" via
// its "180"/"000" groups, "45,000+"). Never applied to measured numbers
// (demand, volumes, percentages) — those are template strings, not LLM prose.
const DIGIT_RUN_RE = /\d{3,}/;
/** Splits `text` into sentences (kept, incl. trailing punctuation + leading
 *  whitespace). Protects decimal points ("2.5 million") from being read as a
 *  sentence terminator first — a naive split fractures "…with 45,000+
 *  options and 2.5 million user reviews." into "…and 2." + "5 million user
 *  reviews.", and the surviving fragment loses its digit-run entirely (real
 *  corpus finding: getapp.com's "2.5 million user reviews, backed by 16+
 *  years" leaked past the scrub exactly this way on the first pass). */
const NUMERAL_GUARD_SENTINEL = "\u0001";
function splitSentences(text: string): string[] {
  const protectedText = text.replace(/(\d)\.(\d)/g, `$1${NUMERAL_GUARD_SENTINEL}$2`);
  return (protectedText.match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.split(NUMERAL_GUARD_SENTINEL).join("."));
}
/** Drops any sentence carrying an unmeasured 3+-digit-run number. Emptying
 *  the field is expected and handled by the existing #11 omission machinery
 *  downstream (identityLine `?`, mirrorGrounded `.length > 0`). */
function scrubNumerals(text: string): string {
  return splitSentences(text)
    .filter((s) => !DIGIT_RUN_RE.test(s))
    .join("")
    .trim();
}
/** Same scrub applied per-tag (a tag IS the whole "sentence"). */
function scrubNumeralTags(tags: string[]): string[] {
  return tags.filter((t) => !DIGIT_RUN_RE.test(t));
}

export function toResultsProps(
  report: ReportPayload,
  siteLabel: string,
  totalActions?: number,
  /** Pre-redaction keyword-gap count — the free-tier redaction empties
   *  `market.gap.keywordGap`, so the caller passes the full payload's total
   *  ("show the total, render a fraction", same as `totalActions`). */
  totalGapQueries?: number,
): ResultsScreenProps {
  const b = report.score.breakdown;
  // Radar axes 0/1/2 are Content/Outreach/SEO; `assessed:false` means the pillar
  // had no measured signal (e.g. off-site outreach on a free on-site scan). Such a
  // pillar must render as "Not measured", never a damning 0/100, and must not be
  // eligible as the "biggest lever" (min) — a 0 it never earned.
  const radar = report.score.radar ?? [];
  const measuredAt = (i: number): boolean => (radar[i] ? radar[i]!.assessed !== false : true);
  const measured = { content: measuredAt(0), outreach: measuredAt(1), seo: measuredAt(2) };
  const measuredVals = [
    measured.content ? b.content : null,
    measured.outreach ? b.outreach : null,
    measured.seo ? b.seo : null,
  ].filter((v): v is number => v !== null);
  const minVal = measuredVals.length ? Math.min(...measuredVals) : -1;
  const pillars = [
    { label: "Content", value: b.content, note: PILLAR_NOTE(b.content, measured.content && b.content === minVal), measured: measured.content },
    { label: "Outreach", value: b.outreach, note: PILLAR_NOTE(b.outreach, measured.outreach && b.outreach === minVal), measured: measured.outreach },
    { label: "SEO", value: b.seo, note: PILLAR_NOTE(b.seo, measured.seo && b.seo === minVal), measured: measured.seo },
  ];

  const byDelta = (a: ActionCard, b2: ActionCard) =>
    (b2.expectedOutcome?.delta ?? 0) - (a.expectedOutcome?.delta ?? 0);
  const flat = [
    ...report.whatToDoThisWeek.quickWins,
    ...report.whatToDoThisWeek.medium,
    ...report.whatToDoThisWeek.longPlay,
  ];
  // Prefer actions with a positive predicted delta, but NEVER let the filter
  // empty a non-empty plan (regression: real scans whose cards carried delta 0
  // rendered "your top 0 ranked fixes").
  const positive = flat.filter((a) => (a.expectedOutcome?.delta ?? 0) > 0);
  const base = positive.length > 0 ? positive : flat;
  // The free board LEADS with the data-driven keyword growth moves (real
  // category/niche searches to win, by demand) — the on-thesis "3 actions to
  // improve your standing in your niche/category", not generic on-page hygiene.
  // These carry `.opportunity` (`opportunityActionsFromSearch`); the remaining
  // signal/LLM fixes follow, ranked by score impact. Paid LLM cards never carry
  // `.opportunity`, so paid ordering stays pure impact-ranked (unchanged).
  // Display order: the data-driven keyword growth moves (by demand) lead, then
  // the remaining fixes by score impact. Which actions are PRESENT here is already
  // decided upstream by `redactReportForTier` (opportunity-aware: ≤2 opportunities
  // + best other fix for free); this only orders whatever survived. Paid LLM cards
  // carry no `.opportunity`, so paid stays pure impact-ranked.
  const opps = base
    .filter((a) => a.opportunity)
    .sort((a, b2) => (b2.opportunity!.volume) - (a.opportunity!.volume));
  const restFixes = base.filter((a) => !a.opportunity).sort(byDelta);
  const allActions = [...opps, ...restFixes];

  const toFix = (a: ActionCard, rank: number): Fix => ({
    rank,
    title: a.title,
    why: a.why,
    effort: effortLabel(a.effortMin),
    pillar: CATEGORY_LABEL[a.category] ?? a.category,
    pred: a.expectedOutcome?.delta ?? 0,
    // Data-driven fix cards (keyword opportunities) render their real monthly
    // search volume — the number that makes them a growth move, not hygiene.
    metric: a.opportunity ? `${a.opportunity.volume.toLocaleString()}/mo` : undefined,
  });
  // Phase C / D4 (2026-07-21, supersedes P4's 2): the free board ALWAYS shows 3
  // ranked fixes — the owner's directive ("the user should always, regardless see
  // 3 fixes"). The generator floors the plan to FREE_MIN_ACTIONS=3 real fixes
  // (never fabricated — `categoryNearMisses`), so 3 is always available on a real
  // scan; the cards stay terse (no prose "why"). Change Protocol: the constant +
  // this rationale move together.
  const SHOWN_FIXES = 3;
  const fixes: Fix[] = allActions.slice(0, SHOWN_FIXES).map((a, i) => toFix(a, i + 1));
  const rest = allActions.slice(SHOWN_FIXES);
  const lockedPreview: Fix[] = rest.slice(0, 2).map((a, i) => toFix(a, fixes.length + i + 1));
  const lockedWorth = rest.reduce((s, a) => s + (a.expectedOutcome?.delta ?? 0), 0);
  const fullTotal = totalActions ?? allActions.length;
  // P4 fix: previously `rest.length || Math.max(0, fullTotal - fixes.length)`
  // — that shortcut relied on `rest` being EMPTY whenever `allActions` was
  // already free-redaction-truncated (true back when SHOWN_FIXES(3) matched
  // FREE_PREVIEW_ACTIONS(3) exactly: a redacted array of ≤3 sliced at 3 left
  // nothing). With SHOWN_FIXES now 2, a redacted 3-action array slices to a
  // NON-empty 1-item `rest`, so the `||` incorrectly reported "1 more" instead
  // of the true withheld total — caught by the R4 rubric test on every real
  // corpus fixture. `fullTotal` already accounts for BOTH cases (the caller
  // passes the pre-redaction total; it defaults to allActions.length when
  // there's no redaction), so it is always the correct basis on its own.
  const lockedCount = Math.max(0, fullTotal - fixes.length);

  const pm = report.whatYouOffer.positioningMirror;

  // The intro owns ONLY the on-page story (the headline above owns search), so
  // it must gate on the ON-PAGE driver — never `report.score.total`, which on
  // every v5 web report is the UNIFIED geomean of on-page × search. Gating the
  // on-page claim on the mixed number produces exactly the contradiction this
  // split exists to prevent: a flawless page (on-page 98) invisible in search
  // (search 4, unified ~20) would render "has real on-page gaps" three lines
  // above its own 98/100 on-page driver bar. Falls back to `score.total` only
  // when there's no free searchVisibility (paid reports use the 3 on-page
  // pillar bars instead, where `score.total` IS the on-page-only number).
  const onPageForIntro = report.searchVisibility?.onPageReadiness ?? report.score.total;

  // Clean LLM-authored audience tags — who the page is written FOR vs who it reads
  // AS. Replaces the old naive prose-splitting that produced garbage chips
  // ("trustmrr", "updated hourly —"). Empty when a legacy report predates the field.
  // E3: also scrub any tag carrying an unmeasured 3+-digit-run number — a
  // rendered tag is short, mirror-kit LLM prose exactly like identityLine.
  const cleanTags = (tags: string[] | undefined): string[] =>
    scrubNumeralTags((tags ?? []).filter((t) => typeof t === "string" && t.trim().length >= 2).map((t) => t.trim()).slice(0, 5));

  // GROUNDING (invariant #11): the Positioning Mirror is a reviews-vs-listing
  // comparison. `actualAudience` ("who the page reads AS") is derived from reviews;
  // when there are none, the synth guard leaves it empty — and without it there is
  // no mirror, only the listing describing itself. Omit the WHOLE section rather
  // than render "Your page reads as —" or (worse) tags invented from fabricated
  // reviews (reachkit.app, scan 6d49d58e). Omission is the honest degrade; a
  // "no reviews found" zero-state would be a claim about the internet we can't make.
  const actualTagsRaw = cleanTags(pm.actualAudience);
  const mirrorGrounded = actualTagsRaw.length > 0;
  const intendedTags = mirrorGrounded ? cleanTags(pm.intendedAudience) : [];
  const actualTags = mirrorGrounded ? actualTagsRaw : [];

  // Search-gap rows. Paid deep scans carry the rival keyword-gap
  // (`market.gap.keywordGap`); FREE web scans carry the honest subject-only
  // category gap (`searchVisibility.categoryGap` — YOUR category terms where you're
  // not winning, with other-brand noise stripped). Prefer the paid gap.
  const kg = report.market?.gap?.keywordGap ?? [];
  const sv = report.searchVisibility ?? null;
  const oppFor = (v: number) => (v >= 2000 ? "High" : v >= 500 ? "Med" : "Low");
  let gapRows: GapRow[];
  let gapCount: number;
  if (kg.length > 0) {
    gapRows = kg.slice(0, 4).map((k) => {
      const vol = typeof k.volume === "number" ? k.volume.toLocaleString() : String(k.volume ?? "—");
      return { query: k.keyword, volume: `${vol}`, rank: "Not ranking", ranked: false, opp: oppFor(k.volume) };
    });
    gapCount = kg.length;
  } else {
    // FREE: the demand-derived opportunities — the biggest searches in your category
    // that you don't win, MERGED from your real category rankings + category demand
    // (not just the LLM seeds). Each carries your actual position when you rank for
    // it, so "where you are today" reads "#12" (a real, discoverable near-miss)
    // rather than a bare "Not winning". `yourPosition` is optional and absent on
    // pre-2026-07-18 payloads → "Not ranking" (no crash; null-coalesce rule).
    const opps = sv?.categoryOpportunities ?? [];
    gapRows = opps.slice(0, 4).map((k) => {
      const ranks = typeof k.yourPosition === "number";
      return {
        query: k.keyword,
        volume: k.volume.toLocaleString(),
        rank: ranks ? `#${k.yourPosition}` : "Not ranking",
        ranked: ranks,
        opp: oppFor(k.volume),
      };
    });
    gapCount = opps.length;
  }

  // Search Visibility panel — shown whenever the gather ran (ONE gate, mirrors
  // report.ts). Even a site that ranks for NOTHING renders here (the zero-state),
  // so we never show an empty "Your category" header.
  const searchVisibility = sv
    ? {
        score: sv.score,
        onPageReadiness: sv.onPageReadiness ?? report.score.total,
        keywordsRanked: sv.keywordsRanked,
        estMonthlyVisits: sv.estMonthlyVisits,
        // `footprintComplete` + `categoryPhrases` were added in the free-scan number-
        // honesty work (WS1/WS2). `report_payload` is one JSON blob and OLDER scans
        // predate these fields — every consumer MUST null-coalesce or the render
        // crashes `undefined.length` on a pre-WS2 payload (live: a 2026-07-12
        // reflect.app scan re-rendered on the WS2 build → TypeError). Default false
        // (old payloads were the capped-50 sample) and [] (no reconcilable phrases).
        footprintComplete: sv.footprintComplete ?? false,
        brandPct: sv.brandPct,
        categoryPct: sv.categoryPct,
        // D3 (2026-07-20, data board P1): aggregatedPct/aggregatedExamples are
        // the AGGREGATED footprint dimension (directory/aggregator listing
        // share, peeled out of offTopicPct — see search-visibility.ts).
        // `?? 0`/`?? []` for legacy-payload safety (a pre-P1 persisted scan
        // predates these fields). P3 renders these as the aggregation strip.
        aggregatedPct: sv.aggregatedPct ?? 0,
        aggregatedExamples: sv.aggregatedExamples ?? [],
        offTopicPct: sv.offTopicPct,
        categoryWins: sv.categoryWins,
        categoryDemand: sv.categoryDemand,
        categoryPhrases: sv.categoryPhrases ?? [],
        // WS-D/M3 (2026-07-19) — all additive, all legacy-defaulted (?? [] rule).
        // FINAL-REVIEW FIX: a rung's `demand` is the SUM of every phrase priced
        // for it, but the render used to label it with ONLY `phrases[0].keyword`
        // — so a multi-phrase rung's number looked like it belonged to a single
        // phrase that didn't add up to it. Pass every phrase through so the
        // renderer can itemise the rest as chips (the same G4 idiom already used
        // for `categoryPhrases`) and the number visually reconciles to its parts.
        // Task B (2026-07-19, ladder restructure): MEDIUM was dropped from the
        // ladder — `computeMarketTiers` no longer emits it, but an OLDER
        // persisted `report_payload` may still carry a `medium` rung from
        // before this change. Defensively filter it out here (at the props
        // boundary, same discipline as the `?? []` rule) rather than trust the
        // type — a legacy JSON blob can contain a string the current type
        // doesn't, and the renderer must never show a rung this design retired.
        // Corpus finding (getapp.com, 2026-07-19): a pre-Task-B persisted
        // payload can carry an INVERTED broad rung — demand BELOW the category
        // hero (broad 10 above a hero of 30). The lib-level inversion guard
        // (`computeMarketTiers`) never emits one going forward but cannot clean
        // already-persisted rows, so the props boundary enforces it too: a
        // "broad" rung that isn't actually bigger than the category is dropped,
        // same discipline as the `medium` filter above it. Rubric R6 pins this.
        marketTiers: (sv.marketTiers ?? [])
          .filter((t) => (t.tier as string) === "broad" || (t.tier as string) === "niche")
          .filter((t) => (t.tier as string) !== "broad" || t.demand > sv.categoryDemand)
          .map((t) => ({
            tier: t.tier,
            label: t.phrases[0]?.keyword ?? "",
            demand: t.demand,
            bestPosition: t.bestPosition,
            phrases: t.phrases.map((ph) => ({ keyword: ph.keyword, volume: ph.volume })),
          })),
        winsRows: (sv.categoryRanked ?? [])
          .filter((r) => typeof r.yourPosition === "number" && r.yourPosition <= 3)
          .slice(0, 3)
          .map((r) => ({ keyword: r.keyword, volume: r.volume, yourPosition: r.yourPosition as number })),
        // Editorial curation (corpus finding: x.com rendered `"porn hub"` as a
        // named example): explicit terms never render as examples; the split
        // percentages still count them — only the NAMED examples are curated.
        offTopicExamples: renderableExamples(sv.offTopicExamples).slice(0, 3),
        // P2/P3 (2026-07-20, data board): the CATEGORY (broad, laddered-large)
        // and NICHE (specific) cards. `?? null` — absent on any payload
        // captured before P2 (or when the synth had no `categoryNiche` seed);
        // `<MarketCard>` (results-screen.tsx) falls back to the pre-P2
        // market-tier ladder render when null, never crashes/blanks.
        categoryCard: sv.categoryCard ?? null,
        categoryLeader: sv.categoryLeader ?? null,
        nicheCard: sv.nicheCard ?? null,
      }
    : null;

  // Coherent headline (was the incoherent "a 98 means customers land on someone
  // else"). Lead with the real gap: no rankings at all is the sharpest hook; then a
  // low category-capture; then the other-brands story.
  // Phase A (2026-07-21): the HEADLINE market number must equal the CATEGORY
  // CARD's number — else the page contradicts itself (headline "80 searches"
  // vs card "90,500"). When the market card is ready (leader-grounded or
  // subject-laddered), lead with ITS demand; only fall back to the subject
  // `categoryDemand` when there is no ready card (legacy/0-ranking payloads).
  const cardReady = !!sv && !!sv.categoryCard && sv.categoryCard.rankedTop3.length + sv.categoryCard.gaps.length > 0;
  const heroDemand = cardReady ? sv!.categoryCard!.demand : sv ? sv.categoryDemand : 0;
  const demandStr = heroDemand.toLocaleString();
  // Honest headline. The old branch said "you capture just {categoryCaptureRate}%"
  // — but categoryCaptureRate WAS the search-presence score under a second label
  // (identical in 10/10 prod scans), so it read as a fabricated capture percentage.
  // Deleted; we lead with the real signal instead: the category demand (the
  // market card's number, reconciled above) and a LOW search-presence score.
  const headline = searchVisibility
    ? searchVisibility.keywordsRanked === 0
      ? heroDemand > 0
        ? `Google ranks you for nothing yet — and your category gets ${demandStr} searches a month, all going to someone else.`
        : `Google ranks you for nothing yet — you're invisible in the searches your buyers make.`
      : heroDemand > 0 && searchVisibility.score < 30
        ? `Your category gets ${demandStr} searches a month — and you're barely visible for any of them.`
        : searchVisibility.offTopicPct >= 55
          ? `${searchVisibility.offTopicPct}% of the searches you rank for are other companies' brand names, not yours.`
          : `You're on the board in search — but leaving real category traffic on the table.`
    : `${report.score.total}/100 on-site readiness. The gap that matters is where buyers search — and that's below.`;

  // MINOR polish: only append an ellipsis when the string was ACTUALLY cut —
  // a bare 160-char slice with no ellipsis reads as a sentence that just stops.
  // E3: scrub BEFORE truncation — a dropped sentence must not just eat into
  // the 160-char budget, it must never appear at all.
  const rawIdentity = scrubNumerals((pm.listingSays ?? "").trim());
  // Review fix (IMPORTANT B, the belt) — a degraded fetch must never show an
  // identity line, even a STALE one from a payload whose positioningMirror
  // was captured before this scan's fetch failed (e.g. a refresh persisting
  // `fetchDegraded` over an older good mirror). The exclusionary extract-side
  // fix (lib/llm/extract.ts) already prevents a NEW garbage/degraded scan
  // from producing a mirror at all; this is the second, independent layer —
  // the degrade line must render ALONE, never alongside a confident-looking
  // (possibly stale) identity claim.
  const identityLine = report.fetchDegraded
    ? ""
    : rawIdentity.length > 160
      ? rawIdentity.slice(0, 159) + "…"
      : rawIdentity;

  return {
    siteLabel,
    identityLine,
    // Part C — honest fetch-quality degrade state. `?? false` per the
    // report_payload rule: an older/legacy persisted report never carried
    // this field at all.
    fetchDegraded: report.fetchDegraded ?? false,
    score: report.score.total,
    marketPosition: report.marketPosition?.total ?? null,
    searchVisibility,
    // Real competitor names we discovered (the compare-set) — their per-rival
    // category share is the paid unlock; free just names who buyers weigh you against.
    competitors: (report.whereTheyAre?.competitorGap ?? [])
      .map((c) => c.competitor)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .slice(0, 6),
    headline,
    intro:
      onPageForIntro >= 60
        ? "is in decent on-page shape. The plan below focuses on where you can still gain ground."
        : "has real on-page gaps holding it back. The plan below starts with the fixes that matter most.",
    pillars,
    fixes,
    lockedPreview,
    lockedCount,
    lockedWorth,
    intendedTags,
    actualTags,
    // The gap is the intended-vs-actual mismatch — meaningless (and ungrounded)
    // without the review-derived `actual`. Blank it when the mirror isn't grounded.
    // E3: scrub the gap sentence too — the gap is LLM-authored prose exactly
    // like identityLine, just derived from a different comparison.
    mirrorGap: mirrorGrounded ? scrubNumerals(pm.gap) : "",
    gapRows,
    gapTotal: totalGapQueries ?? (gapCount || gapRows.length),
  };
}
