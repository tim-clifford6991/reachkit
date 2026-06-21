/**
 * computeScanSignals — turns the available scan inputs into the persisted
 * 18-signal rows (raw/normalised/weight/contribution/state) for the explainability
 * panel + breakdown chart. Pure + deterministic; unit-tested in node.
 *
 * Wave A signals come from the parsed HTML (HtmlSignals), Wave B from a thin
 * layer-3 input struct the pipeline derives from the market analysis, and
 * comparison_pages from the existing ScoreComponents. A signal with no available
 * input is emitted as `unmeasured` (null normalised/contribution) — never a fake zero.
 */

import type { Platform } from "./router";
import type { HtmlSignals } from "./extract-html";
import type { ScoreComponents } from "./score-full";
import {
  signalsForPlatform,
  stateFor,
  PILLAR_WEIGHTS,
  type Pillar,
  type SignalState,
} from "./signals";

/** Layer-3 signal inputs the pipeline derives from MarketAnalysis (paid scans). */
export interface MarketSignalInputs {
  organicKeywords?: number | null;
  rankedKeywordCount?: number | null;
  referringDomains?: number | null;
  marketplaceCount?: number | null;
  communityMentions?: number | null;
  /** Self share of community voice, 0..1. */
  shareOfVoicePct?: number | null;
  ownedChannelCount?: number | null;
  contentPostsPerMonth?: number | null;
  recentBuzzCount?: number | null;
}

export interface ScanSignalRow {
  signalKey: string;
  pillar: Pillar;
  rawValue: number | null;
  normalised: number | null;
  weight: number;
  contribution: number | null;
  state: SignalState | "unmeasured";
  platform: Platform;
}

interface Ctx {
  html: HtmlSignals | null;
  components: ScoreComponents;
  market: MarketSignalInputs | null;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const logScale = (v: number, ref: number) =>
  clamp((Math.log10(1 + Math.max(0, v)) / Math.log10(1 + ref)) * 100);
const inRange = (n: number, lo: number, hi: number) => n >= lo && n <= hi;

type Scored = { raw: number | null; norm: number | null };
const M = (raw: number | null, norm: number): Scored => ({ raw, norm });
const UNMEASURED: Scored = { raw: null, norm: null };

/** Per-signal scoring → raw + normalised (0–100), or UNMEASURED if no input. */
const SCORERS: Record<string, (c: Ctx) => Scored> = {
  // SEO
  title_tag: ({ html }) =>
    html ? M(html.title.length, !html.title.present ? 0 : inRange(html.title.length, 30, 60) ? 100 : 60) : UNMEASURED,
  meta_description: ({ html }) =>
    html ? M(html.metaDescription.length, !html.metaDescription.present ? 0 : inRange(html.metaDescription.length, 120, 160) ? 100 : 60) : UNMEASURED,
  schema_jsonld: ({ html }) => (html ? M(html.jsonLd.present ? 1 : 0, html.jsonLd.present ? 100 : 0) : UNMEASURED),
  canonical_url: ({ html }) => (html ? M(html.canonical.present ? 1 : 0, html.canonical.present ? 100 : 0) : UNMEASURED),
  heading_structure: ({ html }) =>
    html ? M(html.headings.h1Count, html.headings.wellStructured ? 100 : html.headings.h1Count >= 1 ? 50 : 0) : UNMEASURED,
  organic_keywords: ({ market }) =>
    market?.organicKeywords != null ? M(market.organicKeywords, logScale(market.organicKeywords, 500)) : UNMEASURED,
  keyword_rankings: ({ market }) =>
    market?.rankedKeywordCount != null ? M(market.rankedKeywordCount, logScale(market.rankedKeywordCount, 50)) : UNMEASURED,
  referring_domains: ({ market }) =>
    market?.referringDomains != null ? M(market.referringDomains, logScale(market.referringDomains, 100)) : UNMEASURED,

  // Content
  content_depth: ({ html }) => (html ? M(html.wordCount, logScale(html.wordCount, 600)) : UNMEASURED),
  content_cadence: ({ market }) =>
    market?.contentPostsPerMonth != null ? M(market.contentPostsPerMonth, logScale(market.contentPostsPerMonth, 8)) : UNMEASURED,
  owned_channels: ({ market }) =>
    market?.ownedChannelCount != null ? M(market.ownedChannelCount, logScale(market.ownedChannelCount, 5)) : UNMEASURED,
  social_share_tags: ({ html }) =>
    html
      ? M(null, (html.openGraph.present ? 40 : 0) + (html.openGraph.hasImage ? 30 : 0) + (html.twitterCard.present ? 30 : 0))
      : UNMEASURED,
  media_richness: ({ html }) =>
    html ? M(html.images.count, html.images.count === 0 ? 40 : Math.round(html.images.altCoverage * 100)) : UNMEASURED,

  // Outreach
  marketplace_presence: ({ market }) =>
    market?.marketplaceCount != null ? M(market.marketplaceCount, logScale(market.marketplaceCount, 4)) : UNMEASURED,
  community_presence: ({ market }) =>
    market?.communityMentions != null ? M(market.communityMentions, logScale(market.communityMentions, 20)) : UNMEASURED,
  share_of_voice: ({ market }) =>
    market?.shareOfVoicePct != null ? M(market.shareOfVoicePct, clamp(market.shareOfVoicePct * 200)) : UNMEASURED,
  comparison_pages: ({ components }) => M(components.comparisonPagesLive, clamp(components.comparisonPagesLive)),
  press_mentions: ({ market }) =>
    market?.recentBuzzCount != null ? M(market.recentBuzzCount, logScale(market.recentBuzzCount, 5)) : UNMEASURED,
};

export function computeScanSignals(
  mode: Platform,
  html: HtmlSignals | null,
  components: ScoreComponents,
  market?: MarketSignalInputs | null,
): ScanSignalRow[] {
  const ctx: Ctx = { html, components, market: market ?? null };

  return signalsForPlatform(mode).map((sig) => {
    const { raw, norm } = (SCORERS[sig.key] ?? (() => UNMEASURED))(ctx);
    const measured = norm != null;
    const contribution = measured
      ? Math.round(sig.weight * (norm / 100) * PILLAR_WEIGHTS[sig.pillar] * 100 * 100) / 100
      : null;
    return {
      signalKey: sig.key,
      pillar: sig.pillar,
      rawValue: raw,
      normalised: measured ? Math.round(norm) : null,
      weight: sig.weight,
      contribution,
      state: measured ? stateFor(norm, sig.thresholds) : "unmeasured",
      platform: mode,
    };
  });
}
