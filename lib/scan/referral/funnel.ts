/**
 * Full distribution funnel (test harness): URL → category → closest competitors →
 * their SEO + traffic + scores → per-competitor referrer categorization (HOW each
 * competitor is discovered: marketplace / blog / media / community / … vs low-value
 * AI-directory noise) → aggregate discovery-channel picture → channels the user is
 * missing → LLM-synthesized key actions.
 *
 * Heavy (many DataForSEO calls) — test-only. Profiles are cached; backlink lists are not.
 */
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { normalizeHost, isNoiseHost } from "@/lib/scan/referral/classify";
import { productNameFromHost } from "@/lib/scan/referral/discover-competitors";
import { enrichEntity, type ScoredEntity } from "@/lib/scan/referral/intel";
import { discoverReferralChannels } from "@/lib/scan/referral/discover";
import { classifyOpportunityPages, type OppChannelType } from "@/lib/scan/referral/classify-pages";
import { cachedBacklinks, cohortFor } from "@/lib/scan/cache/cached-adapters";
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";
import { classifyReferrers, QUALITY_CATEGORIES, type ReferrerCategory } from "@/lib/scan/referral/classify-referrers";
import { computeTrafficLens, type TrafficLens } from "@/lib/scan/referral/traffic-lens";
import { serverDb } from "@/lib/db/client";

export interface QualityReferrer {
  host: string;
  category: ReferrerCategory;
  /** Deep link to the exact referring page/article where the backlink lives. */
  url: string;
  /** Anchor text of the link (what it says). */
  anchor: string;
  /** Which page on the competitor it points to. */
  target: string;
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

export interface KeyAction {
  action: string;
  why: string;
  priority: "high" | "medium" | "low";
}

export interface FunnelResult {
  subject: ScoredEntity & { category: string; backlinks: ReferralBreakdown };
  category: string;
  competitors: CompetitorDeep[];
  /** Aggregate across the cohort: where competitors are discovered (quality channels). */
  discoveryChannels: Partial<Record<ReferrerCategory, number>>;
  channelsMissing: ActionableChannel[];
  keyActions: KeyAction[];
}

const isQuality = (c: ReferrerCategory) => QUALITY_CATEGORIES.includes(c);

// ---------------------------------------------------------------------------
// Domain intel persistence — structured typed storage per domain (Task 3)
// ---------------------------------------------------------------------------

type EntityWithBreakdown = ScoredEntity & { backlinks: ReferralBreakdown };

/**
 * Upsert one row into `domain_intel` for the given entity + referral breakdown.
 * Best-effort — a missing table or write error is logged and silently swallowed
 * so it never breaks the gather.
 */
async function persistDomainIntel(entity: EntityWithBreakdown): Promise<void> {
  try {
    const db = serverDb();
    await db.from("domain_intel").upsert(
      {
        domain: entity.domain,
        organic_etv: Math.round(entity.monthlyTraffic),
        organic_keywords: entity.mix?.organicKeywords ?? 0,
        paid_etv: Math.round(entity.paidEtv),
        paid_keywords: 0, // not available on ScoredEntity; set separately if needed
        referring_domains: entity.mix?.referringDomains ?? 0,
        branded_search_volume: entity.brandedSearchVolume,
        top_pages_count: entity.topPagesCount,
        quality_share: entity.backlinks.qualityShare,
        referrer_categories: entity.backlinks.byCategory,
        traffic_sources: entity.lens?.sources ?? {},
        growth_activities: entity.lens?.activities ?? {},
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "domain" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[domain_intel] persist failed for ${entity.domain}: ${msg}`);
  }
}

/** Top distinct referrers for a domain (by backlink rank), with the deep link to
 *  the exact referring page. one_per_domain mode → the strongest page per host. */
async function rawReferrers(domain: string, limit = 40): Promise<RawRef[]> {
  const refs = await cachedBacklinks(domain, 250);
  const seen = new Set<string>();
  const out: RawRef[] = [];
  for (const r of refs) {
    const h = r.referringHost;
    if (!h || h === domain || isNoiseHost(h) || seen.has(h)) continue;
    seen.add(h);
    out.push({ host: h, url: r.referringUrl, anchor: r.anchorText, target: r.targetUrl });
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
    if (isQuality(c)) {
      quality++;
      if (topQuality.length < 12) topQuality.push({ host: r.host, category: c, url: r.url, anchor: r.anchor, target: r.target });
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

async function synthesizeKeyActions(input: {
  subject: ScoredEntity;
  category: string;
  competitors: CompetitorDeep[];
  discoveryChannels: Partial<Record<ReferrerCategory, number>>;
  channelsMissing: ActionableChannel[];
}): Promise<KeyAction[]> {
  const compLines = input.competitors
    .map((c) => `- ${c.domain}: score ${c.score}, ${c.monthlyTraffic.toLocaleString()}/mo; quality referrers e.g. ${c.backlinks.topQualityReferrers.slice(0, 5).map((r) => `${r.host}(${r.category})`).join(", ") || "—"}`)
    .join("\n");
  const chLines = input.channelsMissing.slice(0, 12).map((c) => `- ${c.host} (${c.type}): ${c.action}`).join("\n");
  const discovery = Object.entries(input.discoveryChannels).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}: ${n}`).join(", ");
  const prompt = `A founder runs "${input.subject.domain}" — a ${input.category}. Discoverability ${input.subject.score}/100, ~${input.subject.monthlyTraffic.toLocaleString()} monthly visits.

How competitors are DISCOVERED (aggregate referrer channels, quality only): ${discovery || "(thin)"}

Competitors:
${compLines}

Channels the founder is ABSENT from that feed competitors:
${chLines || "(none surfaced)"}

Give the 3–5 highest-leverage actions that would most move this founder's discoverability — grounded in WHERE competitors are actually found (the channels above), not generic SEO. Be specific.

Return ONLY a JSON array:
[ { "action": "<concrete action>", "why": "<why it moves the needle, ≤20 words>", "priority": "high"|"medium"|"low" } ]`;
  try {
    const { text } = await callModel({ model: "claude-haiku-4-5-20251001", system: "You are a pragmatic growth advisor for solo founders. Ground actions in where competitors are actually discovered. Return only a JSON array.", prompt, scanId: null, stage: "synth" });
    const parsed = JSON.parse(extractJson(text));
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 5).map((a) => {
      const o = a as Record<string, unknown>;
      return {
        action: String(o.action ?? "").trim(),
        why: String(o.why ?? "").trim(),
        priority: (["high", "medium", "low"].includes(String(o.priority)) ? o.priority : "medium") as KeyAction["priority"],
      };
    }).filter((a) => a.action);
  } catch {
    return [];
  }
}

export async function gatherFullFunnel(rawSelf: string, opts: { topN?: number; competitorDomains?: string[] } = {}): Promise<FunnelResult> {
  const self = normalizeHost(rawSelf);
  const topN = opts.topN ?? 4;
  const cohortKey = (opts.competitorDomains ?? []).map((d) => d.toLowerCase()).sort().join(",");
  // Persist the whole funnel (incl. the uncached homepage-classification step) so
  // each dashboard load is instant and makes ZERO new DataForSEO/LLM calls.
  // v2: includes lens (traffic sources + growth activities) on each entity.
  return cachedJson(`funnel2:${self}:${topN}:${cohortKey}`, 7 * DAY_MS, async () => {
  // 1. Category + cohort (user-selected when provided, else closeness-ranked).
  const closest = await cohortFor(self, opts.competitorDomains);
  const cohort = closest.ranked.slice(0, topN).map((r) => r.domain);

  // 2. Subject + competitor scores/traffic/mix, and the raw referrer hosts per competitor.
  const [subject, comps, selfRefs, referrerLists] = await Promise.all([
    enrichEntity(self, true),
    Promise.all(cohort.map((d) => enrichEntity(d, false))),
    rawReferrers(self),
    Promise.all(cohort.map((d) => rawReferrers(d))),
  ]);

  // 3. ONE batched LLM call categorizing every referrer host across the cohort
  //    (subject + competitors), so the subject's own channel mix is comparable.
  const allHosts = [...new Set([...selfRefs, ...referrerLists.flat()].map((r) => r.host))];
  const cats = await classifyReferrers(allHosts, closest.category);

  // 3b. Build per-domain referral breakdowns (byCategory available after classify).
  const selfBacklinks = buildBreakdown(selfRefs, cats);

  const competitors: CompetitorDeep[] = comps.map((c, i) => ({
    ...c,
    closeness: closest.ranked[i]?.closeness ?? 0,
    reason: closest.ranked[i]?.reason ?? "",
    backlinks: buildBreakdown(referrerLists[i]!, cats),
  }));

  // 3c. Compute the two-lens supply view for each entity now that byCategory is known.
  //     This requires organic/paid etv, referring domains, branded search volume,
  //     topPagesCount, and organicKeywords — all carried on ScoredEntity from enrichEntity.
  const lensFor = (e: ScoredEntity, bd: ReferralBreakdown): TrafficLens =>
    computeTrafficLens({
      organicEtv: e.monthlyTraffic,
      paidEtv: e.paidEtv,
      referringDomains: e.mix?.referringDomains ?? 0,
      brandedSearchVolume: e.brandedSearchVolume,
      byCategory: bd.byCategory,
      topPagesCount: e.topPagesCount,
      organicKeywords: e.mix?.organicKeywords ?? 0,
    });

  const subjectWithLens: ScoredEntity = { ...subject, lens: lensFor(subject, selfBacklinks) };
  const competitorsWithLens: CompetitorDeep[] = competitors.map((c) => ({
    ...c,
    lens: lensFor(c, c.backlinks),
  }));

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
  let channelsMissing: ActionableChannel[] = [];
  if (cohort.length >= 2) {
    const ref = await discoverReferralChannels({ selfDomain: self, competitorDomains: cohort, limit: 40 });
    channelsMissing = await classifyChannels(ref.opportunities.slice(0, 25), self, closest.category);
  }

  // 5. Key actions grounded in discovery channels.
  const keyActions = await synthesizeKeyActions({ subject: subjectWithLens, category: closest.category, competitors: competitorsWithLens, discoveryChannels, channelsMissing });

  const funnelSubject = { ...subjectWithLens, category: closest.category, backlinks: selfBacklinks };

  // 6. Persist structured per-domain intel rows (best-effort, never breaks the gather).
  void Promise.all([
    persistDomainIntel({ ...funnelSubject }),
    ...competitorsWithLens.map((c) => persistDomainIntel(c)),
  ]).catch((err) => console.error("[domain_intel] batch persist error:", err));

  return { subject: funnelSubject, category: closest.category, competitors: competitorsWithLens, discoveryChannels, channelsMissing, keyActions };
  });
}
