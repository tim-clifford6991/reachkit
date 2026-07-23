/**
 * The 18-signal Discoverability registry — the explicit, persisted model that
 * replaces the implicit 6-proxy blend. Each signal declares its pillar, weight
 * (within-pillar, web), pass/warn thresholds, applicable platforms, a build-cost
 * `source` tag, and the plain-English why / how-to-fix used by the explainability
 * panel. The numeric score is computed deterministically from these (no LLM).
 *
 * Wave A = `parse` (cheap HTML hygiene), Wave B = `wire` (existing layer-3 data
 * the score ignored), `exists` = already an input, `new` = future integration
 * (rendered "not measured" until enabled — never a fake zero).
 */

import type { Platform } from "./router";

export type Pillar = "content" | "outreach" | "seo";
export type SignalState = "pass" | "warn" | "fail";
export type SignalSource = "parse" | "wire" | "exists" | "new";

export interface SignalDefinition {
  key: string;
  pillar: Pillar;
  label: string;
  why: string;
  howToFix: string;
  /** Within-pillar weight on web (the rich platform); app renormalises its subset. */
  weight: number;
  /** Thresholds on the normalised 0–100 value → pass/warn/fail. */
  thresholds: { pass: number; warn: number };
  platforms: Platform[];
  source: SignalSource;
}

/** Pillar weights of the total score (sum to 1.0). */
export const PILLAR_WEIGHTS: Record<Pillar, number> = {
  content: 0.3,
  outreach: 0.25,
  seo: 0.45,
};

const ALL: Platform[] = ["web", "ios", "android"];
const WEB: Platform[] = ["web"];

export const SIGNAL_REGISTRY: readonly SignalDefinition[] = [
  // ── SEO (0.45) ─────────────────────────────────────────────────────────────
  { key: "title_tag", pillar: "seo", label: "Title tag", weight: 0.1, thresholds: { pass: 70, warn: 40 }, platforms: ALL, source: "exists",
    why: "Your title is the single strongest on-page ranking and click signal.", howToFix: "Add a clear page title with your main keyword near the front" },
  { key: "meta_description", pillar: "seo", label: "Meta description", weight: 0.1, thresholds: { pass: 70, warn: 40 }, platforms: ALL, source: "exists",
    why: "The description shapes your search snippet and click-through rate.", howToFix: "Add a meta description that states the value and a reason to click" },
  { key: "schema_jsonld", pillar: "seo", label: "Structured data", weight: 0.12, thresholds: { pass: 100, warn: 50 }, platforms: WEB, source: "parse",
    why: "JSON-LD/schema.org lets search engines render rich results for your page.", howToFix: "Add structured data so Google can show rich results" },
  { key: "canonical_url", pillar: "seo", label: "Canonical URL", weight: 0.08, thresholds: { pass: 100, warn: 50 }, platforms: WEB, source: "parse",
    why: "A canonical tag prevents duplicate-content dilution of your ranking.", howToFix: "Add a canonical tag so duplicate URLs don't split your ranking" },
  { key: "heading_structure", pillar: "seo", label: "Heading structure", weight: 0.1, thresholds: { pass: 70, warn: 40 }, platforms: WEB, source: "parse",
    why: "One clear H1 plus H2/H3 sub-heads tells search engines what the page covers.", howToFix: "Use one H1 with clear H2/H3 sub-headings" },
  { key: "organic_keywords", pillar: "seo", label: "Organic keyword footprint", weight: 0.25, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "The breadth of queries you already rank for is your discoverability base.", howToFix: "Publish pages targeting the searches in your gap list" },
  { key: "keyword_rankings", pillar: "seo", label: "Ranking positions", weight: 0.15, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "Where you actually rank for tracked terms determines real traffic.", howToFix: "Strengthen pages and internal links for terms near page 1" },
  { key: "referring_domains", pillar: "seo", label: "Referring domains", weight: 0.1, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "new",
    why: "Links from distinct domains are the strongest off-page authority signal.", howToFix: "Earn links through launches, guest posts, and directory listings" },

  // ── Content (0.30) ─────────────────────────────────────────────────────────
  // content_depth / media_richness thresholds (C3, docs/plans/2026-07-07-launch-readiness.md
  // A6): the live trustmrr.com scan hit Content 100/100 off a merely decent
  // landing page, which reads as fake-perfect. `thresholds.pass/warn` here only
  // drive the pass/warn/fail STATE badge (explainability panel, fallback-action
  // eligibility) — the numeric score comes from the `normalised` value computed
  // in compute-signals.ts, so both signals' scorers were tightened alongside
  // these bars (see the comments there). Raised conservatively (not punitively)
  // so a single strong page can still pass, but cannot trivially cap at 100.
  // CONSERVATIVE + PROVISIONAL: needs live re-validation via
  // scripts/score-calibration.mjs (monotonic strong > median > weak, median
  // indie lands 50–69 "Fair") before being considered final.
  { key: "content_depth", pillar: "content", label: "Content depth", weight: 0.25, thresholds: { pass: 80, warn: 50 }, platforms: WEB, source: "parse",
    why: "Thin pages rarely rank; substantive copy earns relevance and trust.", howToFix: "Add more real, specific copy to the page (aim for 500+ words)" },
  { key: "content_cadence", pillar: "content", label: "Publishing cadence", weight: 0.25, thresholds: { pass: 70, warn: 40 }, platforms: WEB, source: "wire",
    why: "Fresh, regular content compounds discoverability over time.", howToFix: "Publish on a steady cadence (aim for one useful post a week)" },
  { key: "owned_channels", pillar: "content", label: "Owned channels", weight: 0.2, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "More owned surfaces (blog, YouTube, newsletter) = more ways to be found.", howToFix: "Add one more owned channel (blog, YouTube, or newsletter)" },
  { key: "social_share_tags", pillar: "content", label: "Social share tags", weight: 0.15, thresholds: { pass: 70, warn: 40 }, platforms: WEB, source: "parse",
    why: "OpenGraph/Twitter tags control how your link looks when shared.", howToFix: "Add social share tags so shared links show a title and image" },
  { key: "media_richness", pillar: "content", label: "Media & alt coverage", weight: 0.15, thresholds: { pass: 80, warn: 45 }, platforms: ALL, source: "parse",
    why: "Images with alt text aid accessibility, image search, and comprehension.", howToFix: "Add alt text and more images (aim for 5+) to the page" },

  // ── Outreach (0.25) ────────────────────────────────────────────────────────
  { key: "marketplace_presence", pillar: "outreach", label: "Marketplace presence", weight: 0.25, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "Listings on PH/G2/Capterra/AlternativeTo are high-intent discovery surfaces.", howToFix: "Claim the marketplace listings your rivals appear on (PH, G2, Capterra)" },
  { key: "community_presence", pillar: "outreach", label: "Community presence", weight: 0.25, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "Recent mentions in HN/Reddit show your audience is finding and discussing you.", howToFix: "Join the threads your buyers already read (Reddit, HN)" },
  { key: "share_of_voice", pillar: "outreach", label: "Share of voice", weight: 0.2, thresholds: { pass: 50, warn: 20 }, platforms: WEB, source: "wire",
    why: "Your slice of community mentions vs rivals is competitive visibility.", howToFix: "Earn more quality mentions where rivals out-share you" },
  { key: "comparison_pages", pillar: "outreach", label: "Comparison pages", weight: 0.15, thresholds: { pass: 60, warn: 25 }, platforms: ALL, source: "exists",
    why: "\"X vs Y\" and \"alternatives\" pages capture high-intent comparison searches.", howToFix: "Publish honest 'vs' and 'alternatives' pages for the rivals buyers weigh you against" },
  { key: "press_mentions", pillar: "outreach", label: "Press & news mentions", weight: 0.15, thresholds: { pass: 50, warn: 20 }, platforms: ALL, source: "new",
    why: "Recent press signals momentum and earns authoritative links.", howToFix: "Pitch launches and milestones to relevant newsletters and outlets" },
] as const;

export function signalsForPlatform(platform: Platform): SignalDefinition[] {
  return SIGNAL_REGISTRY.filter((s) => s.platforms.includes(platform));
}

/** Pass/warn/fail from a normalised 0–100 value. */
export function stateFor(normalised: number, t: { pass: number; warn: number }): SignalState {
  if (normalised >= t.pass) return "pass";
  if (normalised >= t.warn) return "warn";
  return "fail";
}

const COMPONENT_PILLAR: Record<string, Pillar> = {
  content: "content",
  outreach: "outreach",
  seo: "seo",
  seo_aso: "seo",
};

/** The signal keys an action targets, derived from its score component/category. */
export function scoreComponentToSignalKeys(component: string): string[] {
  const pillar = COMPONENT_PILLAR[component.toLowerCase()];
  if (!pillar) return [];
  return SIGNAL_REGISTRY.filter((s) => s.pillar === pillar).map((s) => s.key);
}
