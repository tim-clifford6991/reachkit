/**
 * Full distribution funnel (test harness): URL → category → closest competitors →
 * their SEO + traffic + scores → per-competitor referrer categorization (HOW each
 * competitor is discovered: marketplace / blog / media / community / … vs low-value
 * AI-directory noise) → aggregate discovery-channel picture → channels the user is
 * missing → LLM-synthesized key actions.
 *
 * Heavy (many DataForSEO calls) — test-only. Profiles are cached; backlink lists are not.
 */
import { normalizeHost, isNoiseHost, isBoilerplateSource } from "@/lib/scan/referral/classify";
import { productNameFromHost } from "@/lib/scan/referral/discover-competitors";
import { enrichEntity, type ScoredEntity } from "@/lib/scan/referral/intel";
import { discoverReferralChannels } from "@/lib/scan/referral/discover";
import { classifyOpportunityPages, type OppChannelType } from "@/lib/scan/referral/classify-pages";
import { cachedBacklinks, cohortFor, cachedBrandedSearchBatch } from "@/lib/scan/cache/cached-adapters";
import { MAX_SELECTED } from "@/lib/scan/competitor-selection";
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";
import { classifyReferrers, QUALITY_CATEGORIES, type ReferrerCategory } from "@/lib/scan/referral/classify-referrers";
import type { OnStageCallback } from "@/lib/scan/types";
import { channelStrengthFor, type ChannelGroup, type StrengthBucket } from "@/lib/scan/referral/channel-strength";
import { enrichReferrers } from "@/lib/scan/referral/referrer-enrich";
import { fetchTrafficForHosts } from "@/lib/scan/adapters/dataforseo-traffic";

export interface QualityReferrer {
  host: string;
  category: ReferrerCategory;
  /** Deep link to the exact referring page/article where the backlink lives. */
  url: string;
  /** Anchor text of the link (what it says). */
  anchor: string;
  /** Which page on the competitor it points to. */
  target: string;
  /** F4 — referring domain's authority (0–1000) + whether the link is dofollow. */
  authority?: number | null;
  dofollow?: boolean | null;
  /** WS1 — the referring host's own organic ETV ("platform reach"), null when
   *  the reach call is unavailable (fixtures/no keys/failure). NOT click-through. */
  etv?: number | null;
  /** WS1 — "low" = tiny + low-authority referrer (shown muted), else "core". */
  relevance?: "core" | "low";
}

export interface ReferralBreakdown {
  sampled: number; // referring domains examined
  byCategory: Partial<Record<ReferrerCategory, number>>; // how they're discovered
  /** The meaningful, pursuable referring sites with deep links (excludes noise). */
  topQualityReferrers: QualityReferrer[];
  /** Fraction of referrers in a real discovery channel (vs low-value noise). */
  qualityShare: number;
}

interface RawRef {
  host: string;
  url: string;
  anchor: string;
  target: string;
  authority?: number | null;
  dofollow?: boolean | null;
}

export interface CompetitorDeep extends ScoredEntity {
  closeness: number;
  reason: string;
  backlinks: ReferralBreakdown;
}

export interface ActionableChannel {
  host: string;
  type: OppChannelType;
  action: string;
  competitorsUsing: number;
}

export interface FunnelResult {
  subject: ScoredEntity & { category: string; backlinks: ReferralBreakdown };
  category: string;
  competitors: CompetitorDeep[];
  /** Aggregate across the cohort: where competitors are discovered (quality channels). */
  discoveryChannels: Partial<Record<ReferrerCategory, number>>;
  channelsMissing: ActionableChannel[];
  /** WS1 — per-domain quality-channel strength for the gap-map matrix (incl. subject). */
  channelStrength: Record<string, Record<ChannelGroup, StrengthBucket>>;
}

const isQuality = (c: ReferrerCategory) => QUALITY_CATEGORIES.includes(c);

/** Top distinct referrers for a domain (by backlink rank), with the deep link to
 *  the exact referring page. one_per_domain mode → the strongest page per host.
 *  Limit 120 (not 60): `byCategory` — the gap-map's channel-strength counts — is
 *  tallied over THIS set, and 60 top-rank hosts (of 300 already fetched) skew to
 *  big media, so directory/community/partner channels read a false "None". The
 *  wider slice surfaces real presence; display is still capped at 30 in
 *  buildBreakdown, so only the counting set grows (2026-07-27). */
async function rawReferrers(domain: string, limit = 120): Promise<RawRef[]> {
  const refs = await cachedBacklinks(domain, 300);
  const seen = new Set<string>();
  const out: RawRef[] = [];
  for (const r of refs) {
    const h = r.referringHost;
    if (!h || h === domain || isNoiseHost(h) || seen.has(h)) continue;
    seen.add(h);
    out.push({ host: h, url: r.referringUrl, anchor: r.anchorText, target: r.targetUrl, authority: r.domainRank ?? null, dofollow: r.dofollow ?? null });
    if (out.length >= limit) break;
  }
  return out;
}

function buildBreakdown(refs: RawRef[], cats: Map<string, ReferrerCategory>): ReferralBreakdown {
  const byCategory: Partial<Record<ReferrerCategory, number>> = {};
  const topQuality: QualityReferrer[] = [];
  let quality = 0;
  for (const r of refs) {
    const c = cats.get(r.host) ?? "other";
    byCategory[c] = (byCategory[c] ?? 0) + 1;
    // A boilerplate SOURCE page (privacy/terms/cookie/legal/sitemap) is never a
    // genuine referral — exclude it from the quality set and count so it can't be
    // shown as a top "directory" source beside the venue's whole-site traffic
    // (the dontpayfull /privacy → plausible /privacy case). Still counted in
    // byCategory (raw host tally); only the QUALITY surface is protected.
    if (isQuality(c) && !isBoilerplateSource(r.url)) {
      quality++;
      if (topQuality.length < 30) topQuality.push({ host: r.host, category: c, url: r.url, anchor: r.anchor, target: r.target, authority: r.authority ?? null, dofollow: r.dofollow ?? null });
    }
  }
  return { sampled: refs.length, byCategory, topQualityReferrers: topQuality, qualityShare: refs.length ? quality / refs.length : 0 };
}

async function classifyChannels(
  opps: Array<{ host: string; competitorsUsing: number }>,
  self: string,
  category: string,
): Promise<ActionableChannel[]> {
  if (opps.length === 0) return [];
  const cls = await classifyOpportunityPages({ productName: productNameFromHost(self), category, hosts: opps.map((o) => o.host) });
  const byHost = new Map(cls.classifications.map((c) => [c.host, c]));
  return opps
    .map((o) => {
      const c = byHost.get(o.host.toLowerCase());
      return { host: o.host, type: (c?.type ?? "other") as OppChannelType, action: c?.action ?? "", actionable: c?.actionable ?? false, competitorsUsing: o.competitorsUsing };
    })
    .filter((o) => o.actionable)
    .map(({ actionable: _a, ...rest }) => rest);
}

/** WS1 — attach platform reach + relevance to every entity's referrers and
 *  compute the per-domain channel-strength matrix. Pure; reach is pre-fetched. */
export function applyFunnelEnrichment(result: FunnelResult, reach: Map<string, number>): FunnelResult {
  const enrichBreakdown = (bd: ReferralBreakdown): ReferralBreakdown => ({
    ...bd,
    topQualityReferrers: enrichReferrers(bd.topQualityReferrers, reach),
  });
  const subject = { ...result.subject, backlinks: enrichBreakdown(result.subject.backlinks) };
  const competitors = result.competitors.map((c) => ({ ...c, backlinks: enrichBreakdown(c.backlinks) }));
  const channelStrength: FunnelResult["channelStrength"] = {};
  for (const e of [subject, ...competitors]) channelStrength[e.domain] = channelStrengthFor(e.backlinks.byCategory);
  return { ...result, subject, competitors, channelStrength };
}

export async function gatherFullFunnel(rawSelf: string, opts: { topN?: number; competitorDomains?: string[]; onStage?: OnStageCallback } = {}): Promise<FunnelResult> {
  const self = normalizeHost(rawSelf);
  const topN = opts.topN ?? MAX_SELECTED;
  const cohortKey = (opts.competitorDomains ?? []).map((d) => d.toLowerCase()).sort().join(",");
  // Poison guard (invariant #3, don't-cache-empties — applied to the funnel blob):
  // if there WAS a real referrer cohort to classify but the classification came
  // back wholesale-empty (LLM truncation/outage → every host defaults to "other"),
  // the byCategory matrix reads all-"None" for the whole cohort. Refuse to cache
  // that for 7 days — recompute next load (cheap: the DataForSEO sub-results stay
  // cached; only the chunked Haiku classify re-runs). A genuinely referrer-less
  // site (0 hosts) is NOT poison — it caches its legitimately-empty matrix.
  let classifyFailed = false;
  // Persist the whole funnel (incl. the uncached homepage-classification step) so
  // each dashboard load is instant and makes ZERO new DataForSEO/LLM calls.
  // v2: includes lens (traffic sources + growth activities) on each entity.
  return cachedJson(`funnel2:${self}:${topN}:${cohortKey}`, 7 * DAY_MS, async () => {
  // Stage: fired inside cachedJson body so only cold computes emit progress events.
  opts.onStage?.({ key: "funnel:profile", label: "Profiling your site" });

  // 1. Category + cohort (user-selected when provided, else closeness-ranked).
  const closest = await cohortFor(self, opts.competitorDomains);
  const cohort = closest.ranked.slice(0, topN).map((r) => r.domain);

  // Batch branded-search volume for the whole cohort in ONE keywords_data call
  // (was one per entity). Map brand→volume; enrichEntity reads its own from here.
  const brandName = (d: string) => productNameFromHost(d);
  const brandVolumes = await cachedBrandedSearchBatch([self, ...cohort].map(brandName)).catch(() => ({} as Record<string, number>));
  const volFor = (d: string) => brandVolumes[brandName(d).trim().toLowerCase()] ?? 0;

  // 2. Subject + competitor scores/traffic/mix, and the raw referrer hosts per competitor.
  const [subject, comps, selfRefs, referrerLists] = await Promise.all([
    enrichEntity(self, true, volFor(self)),
    Promise.all(cohort.map((d) => enrichEntity(d, false, volFor(d)))),
    rawReferrers(self),
    Promise.all(cohort.map((d) => rawReferrers(d))),
  ]);

  opts.onStage?.({ key: "funnel:competitors", label: "Finding & ranking competitors", detail: `Found ${cohort.length} competitor${cohort.length === 1 ? "" : "s"}` });

  // 3. ONE batched LLM call categorizing every referrer host across the cohort
  //    (subject + competitors), so the subject's own channel mix is comparable.
  const allHosts = [...new Set([...selfRefs, ...referrerLists.flat()].map((r) => r.host))];
  const cats = await classifyReferrers(allHosts, closest.category);
  // Wholesale classify failure signature: a real host set went in, nothing came
  // back (every batch threw/parsed-empty). buildBreakdown then defaults all hosts
  // to "other" → the all-"None" matrix. Flag it so cachedJson refuses to persist.
  // A partial (some batches classified) yields cats.size > 0 → kept, as intended.
  classifyFailed = classificationDegraded(allHosts.length, cats.size);

  opts.onStage?.({ key: "funnel:backlinks", label: "Measuring traffic & backlinks" });

  // 3b. Build per-domain referral breakdowns (byCategory available after classify).
  const selfBacklinks = buildBreakdown(selfRefs, cats);

  const competitors: CompetitorDeep[] = comps.map((c, i) => ({
    ...c,
    closeness: closest.ranked[i]?.closeness ?? 0,
    reason: closest.ranked[i]?.reason ?? "",
    backlinks: buildBreakdown(referrerLists[i]!, cats),
  }));

  // 3c. The per-entity traffic "lens" (computeTrafficLens) was REMOVED 2026-07-28:
  //     it only ever fed the dashboard "traffic by channel" donut, whose shares
  //     were a log-normalised blend of backlink COUNTS + branded-search volume
  //     shown as % of TRAFFIC (existence-as-magnitude, dropped in Phase 3, R-1.10).
  //     The dashboard now renders an honest backlink CHANNEL MIX from byCategory,
  //     so the lens is dead compute — gone, with its `lens` field.
  const subjectWithLens: ScoredEntity = { ...subject };
  const competitorsWithLens: CompetitorDeep[] = competitors.map((c) => ({ ...c }));

  // Aggregate: how competitors are discovered (quality channels only).
  const discoveryChannels: Partial<Record<ReferrerCategory, number>> = {};
  for (const c of competitorsWithLens) {
    for (const [cat, n] of Object.entries(c.backlinks.byCategory)) {
      if (QUALITY_CATEGORIES.includes(cat as ReferrerCategory)) {
        discoveryChannels[cat as ReferrerCategory] = (discoveryChannels[cat as ReferrerCategory] ?? 0) + (n ?? 0);
      }
    }
  }

  // 4. Channels the user is missing.
  opts.onStage?.({ key: "funnel:gaps", label: "Mapping content gaps" });
  let channelsMissing: ActionableChannel[] = [];
  if (cohort.length >= 2) {
    const ref = await discoverReferralChannels({ selfDomain: self, competitorDomains: cohort, limit: 40 });
    channelsMissing = await classifyChannels(ref.opportunities.slice(0, 25), self, closest.category);
  }

  const preliminary: FunnelResult = {
    subject: { ...subjectWithLens, category: closest.category, backlinks: selfBacklinks },
    category: closest.category,
    competitors: competitorsWithLens,
    discoveryChannels,
    channelsMissing,
    channelStrength: {},
  };

  // WS1 — one bulk reach call for every quality-referrer host across the cohort.
  // Runs inside costedIntelStep (the /api/app/intel cost context); fixtures/no-keys
  // → empty map → etv stays null (degrade, never invent).
  const reachHosts = [...new Set(
    [preliminary.subject, ...preliminary.competitors].flatMap((e) => e.backlinks.topQualityReferrers.map((r) => r.host)),
  )];
  const reach = await fetchTrafficForHosts(reachHosts);
  return applyFunnelEnrichment(preliminary, reach);
  }, { isEmpty: () => classifyFailed });
}

// A funnel whose entire cohort classified to "other" (map size 0 on a real host
// set) is a degraded blob, not a real result — never cache it. Floor keeps a tiny
// legit host set (which could plausibly all be "other") from tripping the guard.
const POISON_MIN_HOSTS = 8;

/**
 * True when a referrer classification is DEGRADED — a real cohort of hosts went
 * in (`hostCount >= POISON_MIN_HOSTS`) but `classifyReferrers` returned NOTHING
 * (`classifiedCount === 0`), the signature of a wholesale LLM truncation/outage
 * that collapses the whole byCategory matrix to all-"None". Used as the funnel
 * cache's `isEmpty` predicate so a degraded blob is never persisted for the TTL.
 * A referrer-less site (hostCount 0) and a partial classification (count > 0)
 * both return false — only wholesale failure on a real host set trips it.
 */
export function classificationDegraded(hostCount: number, classifiedCount: number): boolean {
  return hostCount >= POISON_MIN_HOSTS && classifiedCount === 0;
}
