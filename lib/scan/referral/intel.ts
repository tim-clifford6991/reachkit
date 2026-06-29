/**
 * Dashboard intel — the productized output of the validated reverse-referral
 * pipeline, ready to render on the app dashboard.
 *
 * Assembles, for a subject domain:
 *   - the inferred micro-category
 *   - size-comparable competitors, each with an estimated discoverability score
 *     and a referral traffic-source split (organic/referral/social/direct)
 *   - actionable distribution channels (page-classified, joinable only)
 *
 * Reuses existing engine functions wholesale: profileDomainCached, verifiedScore,
 * estimateTrafficMix, discoverReferralChannels, classifyOpportunityPages.
 */
import { serverDb } from "@/lib/db/client";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { productNameFromHost } from "@/lib/scan/referral/discover-competitors";
import { cachedDiscoverCompetitors, cachedBrandedSearch } from "@/lib/scan/cache/cached-adapters";
import { inferCategoryAndQueries } from "@/lib/scan/referral/llm-competitors";
import { discoverReferralChannels } from "@/lib/scan/referral/discover";
import { classifyOpportunityPages, type OppChannelType } from "@/lib/scan/referral/classify-pages";
import { profileDomainCached } from "@/lib/scan/profile/cache";
import { estimateTrafficMix, type TrafficMix } from "@/lib/scan/profile/traffic-mix";
import { bandFor } from "@/lib/scan/score-bands";
import type { DistributionProfile } from "@/lib/scan/profile/types";
import type { TrafficLens } from "@/lib/scan/referral/traffic-lens";

/**
 * Traffic-source split + the raw signals that drive each share, so the UI can
 * drill down. These are ESTIMATES from public SEO signals, not measured analytics:
 *   organic  ← number of organic keywords the domain ranks for
 *   referral ← number of referring domains (backlinks)
 *   social   ← community mentions (HN/Reddit)
 *   direct   ← a fixed 20% assumption (type-in / branded; nothing measures it)
 */
export interface TrafficMixDetail {
  organic: number;
  referral: number;
  social: number;
  direct: number;
  organicKeywords: number;
  referringDomains: number;
  socialMentions: number;
}

export interface ScoredEntity {
  domain: string;
  isSubject: boolean;
  /** Estimated monthly organic traffic (DataForSEO ETV). */
  monthlyTraffic: number;
  /** Estimated discoverability score 0–100 (same engine as the user's score). */
  score: number;
  band: string;
  mix: TrafficMixDetail | null;
  // Supply-lens inputs — raw signals needed by computeTrafficLens in the funnel
  // (byCategory isn't available yet in enrichEntity, so lens is set post-classify).
  /** Estimated paid-search traffic value (same rank-overview response, zero cost). */
  paidEtv: number;
  /** Google Ads monthly search volume for the brand name (direct-traffic proxy). */
  brandedSearchVolume: number;
  /** Number of top organic pages returned by the relevant-pages endpoint. */
  topPagesCount: number;
  /**
   * Two-lens supply view (traffic sources + growth activities). Set to null by
   * `enrichEntity` and populated by `gatherFullFunnel` after `classifyReferrers`
   * provides the per-category referrer breakdown needed to complete the computation.
   */
  lens: TrafficLens | null;
}

export interface ActionableChannel {
  host: string;
  type: OppChannelType;
  action: string;
  competitorsUsing: number;
  reachWeight: number;
}

export interface DashboardIntel {
  /** The user's own app — always shown alongside competitors for comparison. */
  subject: ScoredEntity;
  category: string;
  competitors: ScoredEntity[];
  actionableChannels: ActionableChannel[];
}

const log100 = (value: number, ref: number) => Math.min(100, (Math.log1p(Math.max(0, value)) / Math.log1p(ref)) * 100);

/**
 * Traffic-grounded discoverability score (0–100) for an entity (subject or rival),
 * measured the same way for everyone so the benchmark is comparable.
 *
 * Discoverability = "are people actually finding you", so it is DOMINATED by real
 * monthly organic traffic (ETV). A product with 0 traffic scores near 0 no matter
 * how many surfaces it has — fixing the old bug where a zero-traffic app scored ~46
 * just for having a blog. Keyword footprint + backlink authority + channel presence
 * are secondary contributors.
 */
function entityScore(p: DistributionProfile): number {
  const etv = p.seo?.etv ?? 0;
  const kw = p.seo?.organicKeywords ?? 0;
  const rd = p.seo?.referringDomains ?? 0;
  const presence =
    p.channels.filter((c) => c.cadence?.active).length +
    p.communities.filter((c) => c.active).length +
    (p.marketplace?.length ?? 0);

  const traffic = log100(etv, 100_000); // 100k organic visits/mo → ~100
  const keywords = log100(kw, 5_000);
  const authority = log100(rd, 1_000);
  const reach = log100(presence, 6);

  return Math.round(0.55 * traffic + 0.2 * keywords + 0.15 * authority + 0.1 * reach);
}

const communityMentions = (p: DistributionProfile): number => p.communities.reduce((s, c) => s + (c.mentions ?? 0), 0);

export async function enrichEntity(domain: string, isSubject: boolean): Promise<ScoredEntity> {
  try {
    // backlinks: true → referring domains populate referral share + fair scoring.
    const profile = await profileDomainCached(domain, { light: true, backlinks: true });
    const score = entityScore(profile);
    const base = estimateTrafficMix(profile);
    const mix: TrafficMixDetail | null = base
      ? {
          organic: base.organic,
          referral: base.referral,
          social: base.social,
          direct: base.direct,
          organicKeywords: profile.seo?.organicKeywords ?? 0,
          referringDomains: profile.seo?.referringDomains ?? 0,
          socialMentions: communityMentions(profile),
        }
      : null;

    // Branded-search volume: proxy for direct/branded traffic channel share.
    // Best-effort — a missing keywords subscription returns 0, never throws.
    const brandedSearchVolume = await cachedBrandedSearch(productNameFromHost(domain)).catch(() => 0);

    return {
      domain,
      isSubject,
      monthlyTraffic: Math.round(profile.seo?.etv ?? 0),
      score,
      band: bandFor(score).label,
      mix,
      paidEtv: profile.seo?.paidEtv ?? 0,
      brandedSearchVolume,
      topPagesCount: profile.seo?.topPages?.length ?? 0,
      // lens is null here — byCategory isn't available until gatherFullFunnel
      // runs classifyReferrers. The funnel sets this on each entity post-classify.
      lens: null,
    };
  } catch {
    return {
      domain,
      isSubject,
      monthlyTraffic: 0,
      score: 0,
      band: bandFor(0).label,
      mix: null,
      paidEtv: 0,
      brandedSearchVolume: 0,
      topPagesCount: 0,
      lens: null,
    };
  }
}

/**
 * End-to-end dashboard intel for a subject domain. Never throws on partial failure.
 * When `competitorDomains` is given (the user's chosen benchmark set) we use those;
 * otherwise we auto-discover. Category is inferred either way for channel classification.
 */
export async function gatherDashboardIntel(
  rawSelf: string,
  opts: { competitorDomains?: string[] } = {},
): Promise<DashboardIntel> {
  const self = normalizeHost(rawSelf);
  const chosen = (opts.competitorDomains ?? []).map(normalizeHost).filter((d) => d && d !== self);

  let domains: string[];
  let category: string;
  if (chosen.length >= 1) {
    domains = [...new Set(chosen)].slice(0, 5);
    category = (await inferCategoryAndQueries({ productName: productNameFromHost(self), host: self })).category;
  } else {
    const disc = await cachedDiscoverCompetitors(self);
    domains = disc.domains;
    category = disc.category;
  }

  // The user's own app + competitors — scores, monthly traffic, mix (cached profiles).
  const [subject, ...competitors] = await Promise.all([
    enrichEntity(self, true),
    ...domains.map((d) => enrichEntity(d, false)),
  ]);

  // Actionable channels (needs ≥2 competitors for the intersection).
  let actionableChannels: ActionableChannel[] = [];
  if (domains.length >= 2) {
    const ref = await discoverReferralChannels({ selfDomain: self, competitorDomains: domains, limit: 40 });
    const top = ref.opportunities.slice(0, 25);
    if (top.length) {
      const cls = await classifyOpportunityPages({
        productName: productNameFromHost(self),
        category,
        hosts: top.map((o) => o.host),
      });
      const byHost = new Map(cls.classifications.map((c) => [c.host, c]));
      actionableChannels = top
        .map((o) => {
          const c = byHost.get(o.host.toLowerCase());
          return {
            host: o.host,
            type: (c?.type ?? "other") as OppChannelType,
            action: c?.action ?? "",
            actionable: c?.actionable ?? false,
            competitorsUsing: o.competitorsUsing,
            reachWeight: o.reachWeight,
          };
        })
        .filter((o) => o.actionable)
        .map(({ actionable: _a, ...rest }) => rest);
    }
  }

  return { subject, category, competitors, actionableChannels };
}

/**
 * Compute intel and patch it into the scan's persisted report_payload, so the
 * dashboard renders instantly. Best-effort: mirrors attachMarketAnalysis. The core
 * report is already persisted, so a failure here never breaks the scan.
 */
/** Write a (JSON-serializable) intel object into the scan's report_payload. */
export async function persistCompetitiveIntel(scanId: string, intel: DashboardIntel): Promise<void> {
  const db = serverDb();
  const { data } = await db.from("scans").select("report_payload").eq("id", scanId).maybeSingle();
  const payload = (data?.report_payload ?? null) as Record<string, unknown> | null;
  if (!payload) return;
  payload.competitiveIntel = { generatedAt: new Date().toISOString(), ...intel };
  await db.from("scans").update({ report_payload: payload }).eq("id", scanId);
}

export async function attachCompetitiveIntel(
  scanId: string,
  storeUrl: string,
  competitorDomains?: string[],
): Promise<DashboardIntel> {
  const intel = await gatherDashboardIntel(storeUrl, competitorDomains?.length ? { competitorDomains } : {});
  await persistCompetitiveIntel(scanId, intel);
  return intel;
}
