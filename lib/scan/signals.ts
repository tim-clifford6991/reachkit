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
    why: "Your title is the single strongest on-page ranking and click signal.", howToFix: "Write a 30–60 character title with your primary keyword near the front." },
  { key: "meta_description", pillar: "seo", label: "Meta description", weight: 0.1, thresholds: { pass: 70, warn: 40 }, platforms: ALL, source: "exists",
    why: "The description shapes your search snippet and click-through rate.", howToFix: "Add a 120–160 character description that states the value and a reason to click." },
  { key: "schema_jsonld", pillar: "seo", label: "Structured data", weight: 0.12, thresholds: { pass: 100, warn: 50 }, platforms: WEB, source: "parse",
    why: "JSON-LD/schema.org lets search engines render rich results for your page.", howToFix: "Add a JSON-LD block (SoftwareApplication, Product, or Organization)." },
  { key: "canonical_url", pillar: "seo", label: "Canonical URL", weight: 0.08, thresholds: { pass: 100, warn: 50 }, platforms: WEB, source: "parse",
    why: "A canonical tag prevents duplicate-content dilution of your ranking.", howToFix: "Add <link rel=\"canonical\"> pointing at the preferred URL." },
  { key: "heading_structure", pillar: "seo", label: "Heading structure", weight: 0.1, thresholds: { pass: 70, warn: 40 }, platforms: WEB, source: "parse",
    why: "One clear H1 plus H2/H3 sub-heads tells search engines what the page covers.", howToFix: "Use exactly one H1 and structure sections with H2/H3 sub-headings." },
  { key: "organic_keywords", pillar: "seo", label: "Organic keyword footprint", weight: 0.25, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "The breadth of queries you already rank for is your discoverability base.", howToFix: "Publish keyword-targeted pages for the themes in your search-gap list." },
  { key: "keyword_rankings", pillar: "seo", label: "Ranking positions", weight: 0.15, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "Where you actually rank for tracked terms determines real traffic.", howToFix: "Improve on-page relevance and internal links for near-page-1 terms." },
  { key: "referring_domains", pillar: "seo", label: "Referring domains", weight: 0.1, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "new",
    why: "Links from distinct domains are the strongest off-page authority signal.", howToFix: "Earn links via launches, guest posts, and directory listings." },

  // ── Content (0.30) ─────────────────────────────────────────────────────────
  { key: "content_depth", pillar: "content", label: "Content depth", weight: 0.25, thresholds: { pass: 70, warn: 40 }, platforms: WEB, source: "parse",
    why: "Thin pages rarely rank; substantive copy earns relevance and trust.", howToFix: "Expand the page past ~300 words with specifics buyers search for." },
  { key: "content_cadence", pillar: "content", label: "Publishing cadence", weight: 0.25, thresholds: { pass: 70, warn: 40 }, platforms: WEB, source: "wire",
    why: "Fresh, regular content compounds discoverability over time.", howToFix: "Ship a post on a predictable cadence (e.g. one useful piece a week)." },
  { key: "owned_channels", pillar: "content", label: "Owned channels", weight: 0.2, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "More owned surfaces (blog, YouTube, newsletter) = more ways to be found.", howToFix: "Stand up one additional owned channel your rivals already use." },
  { key: "social_share_tags", pillar: "content", label: "Social share tags", weight: 0.15, thresholds: { pass: 70, warn: 40 }, platforms: WEB, source: "parse",
    why: "OpenGraph/Twitter tags control how your link looks when shared.", howToFix: "Add og:title, og:description, og:image and twitter:card meta tags." },
  { key: "media_richness", pillar: "content", label: "Media & alt coverage", weight: 0.15, thresholds: { pass: 70, warn: 40 }, platforms: ALL, source: "parse",
    why: "Images with alt text aid accessibility, image search, and comprehension.", howToFix: "Add descriptive alt text to every meaningful image." },

  // ── Outreach (0.25) ────────────────────────────────────────────────────────
  { key: "marketplace_presence", pillar: "outreach", label: "Marketplace presence", weight: 0.25, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "Listings on PH/G2/Capterra/AlternativeTo are high-intent discovery surfaces.", howToFix: "Claim and complete the marketplace listings your rivals appear on." },
  { key: "community_presence", pillar: "outreach", label: "Community presence", weight: 0.25, thresholds: { pass: 60, warn: 25 }, platforms: WEB, source: "wire",
    why: "Recent mentions in HN/Reddit show your audience is finding and discussing you.", howToFix: "Engage authentically in the threads your buyers already read." },
  { key: "share_of_voice", pillar: "outreach", label: "Share of voice", weight: 0.2, thresholds: { pass: 50, warn: 20 }, platforms: WEB, source: "wire",
    why: "Your slice of community mentions vs rivals is competitive visibility.", howToFix: "Increase quality mentions where rivals currently out-share you." },
  { key: "comparison_pages", pillar: "outreach", label: "Comparison pages", weight: 0.15, thresholds: { pass: 60, warn: 25 }, platforms: ALL, source: "exists",
    why: "\"X vs Y\" and \"alternatives\" pages capture high-intent comparison searches.", howToFix: "Publish honest comparison pages against the rivals buyers weigh you against." },
  { key: "press_mentions", pillar: "outreach", label: "Press & news mentions", weight: 0.15, thresholds: { pass: 50, warn: 20 }, platforms: ALL, source: "new",
    why: "Recent press signals momentum and earns authoritative links.", howToFix: "Pitch launches and milestones to relevant newsletters and outlets." },
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
