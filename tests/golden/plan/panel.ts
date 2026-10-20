// tests/golden/plan/panel.ts — each customer-panel site's stored topics, as
// the rows `choose` reads. Not a suite.
//
// The source is the last stored panel run that holds the site
// (`docs/walk/panel/<run>.json`, `sites[].topics`): query, status, type,
// fit, volume and the stored `ready`. What a run does not store is fixed
// here, the same for every site: a ready row is banded `winnable` (it passed
// the right-sizing law), an unready one has no stored reason (`null`), an Improve
// row is a thin page (no rule lifts it), no row has a source or a cluster,
// and the rows were created in the order the run lists them. The profile is
// read off the run's own market conclusion. A row's shape is what readiness
// stores from the site's newest stored SERP for its search
// (`scripts/panel/evidence/<domain>.json`). 0¢: nothing is measured.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { Language } from "@/lib/locale/locales";
import type { Profile } from "@/lib/market/questions/profile";
import { measured, unmeasured } from "@/lib/measure/measured";
import { queryKey } from "@/lib/opportunities/cluster";
import { freshRead, type KindOfBusiness, type TopTenRead, type TopTenRow } from "@/lib/opportunities/derive/top-ten-kind";
import { shapedEvidence } from "@/lib/opportunities/readiness";
import { readOpportunity, type OpportunityRow } from "@/lib/opportunities/store";
import { FAMILY_OF, type OpportunityType } from "@/lib/opportunities/types";

const PANEL = "docs/walk/panel";
export const AT = new Date("2026-10-19T06:00:00.000Z");
export const SITE_ID = "33333333-3333-4333-8333-333333333333";
const SCAN_ID = "44444444-4444-4444-8444-444444444444";

export interface StoredTopic {
  query: string;
  status: string;
  type: OpportunityType;
  fit: number | null;
  volume: number | null;
  ready: boolean;
}

interface StoredSite {
  site: { domain: string; language: string };
  siteName: string | null;
  market: { buyer: string; job: string; category: string; synonyms?: string[] } | null;
  topics?: StoredTopic[];
}

export interface PanelSite {
  domain: string;
  /** The run the topics come from, `docs/walk/panel/<run>.json`. */
  run: string;
  profile: Profile;
  rows: OpportunityRow[];
}

/** The customer panel, in its run order. */
export function panelDomains(): string[] {
  const panel: { sites: { domain: string }[] } = JSON.parse(readFileSync(`${PANEL}/sites.json`, "utf8"));
  return panel.sites.map((site) => site.domain);
}

/** Runs oldest first: a dated run before a re-run of the same date (`<date>-<issue>`). */
function runs(): string[] {
  return readdirSync(PANEL)
    .filter((file) => file.endsWith(".json") && file !== "sites.json")
    .map((file) => file.slice(0, -".json".length))
    .sort();
}

export function panelSite(domain: string): PanelSite {
  for (const run of runs().reverse()) {
    const stored: { sites: StoredSite[] } = JSON.parse(readFileSync(`${PANEL}/${run}.json`, "utf8"));
    const site = stored.sites.find((entry) => entry.site.domain === domain);
    if (site?.market == null || (site.topics ?? []).length === 0) continue;
    const serps = storedSerps(domain);
    const business = businessOf(domain);
    const rows = site.topics!.map((topic, n) => rowOf(domain, topic, n)).map((row) => {
      const read = freshRead(serps.get(queryKey(row.target_query ?? "")), AT);
      return { ...row, evidence: shapedEvidence(readOpportunity(row), read, business) };
    });
    return { domain, run, profile: profileOf(site), rows };
  }
  throw new Error(`no stored panel run holds topics for ${domain}`);
}

/** The newest stored organic SERP for each search the site's passes bought. */
export function storedSerps(domain: string): Map<string, TopTenRead> {
  const file = `scripts/panel/evidence/${domain}.json`;
  const serps = new Map<string, TopTenRead>();
  if (!existsSync(file)) return serps;
  const evidence: { source: string; cache_key: string; created_at: string; payload: { organic?: TopTenRow[]; localPack?: unknown[] }[] | null }[] =
    JSON.parse(readFileSync(file, "utf8"));
  for (const row of evidence.filter((entry) => entry.source === "serp/google/organic").sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const serp = row.payload?.[0];
    if (serp === undefined || (serp.organic ?? []).length === 0) continue;
    serps.set(queryKey(row.cache_key.split("|")[0]!), { at: new Date(row.created_at), rows: serp.organic!, localPack: (serp.localPack ?? []).length > 0 });
  }
  return serps;
}

/** The business as the panel lists it: its first kind and its one place. */
export function businessOf(domain: string): KindOfBusiness {
  const panel: { sites: { domain: string; kinds: KindOfBusiness["kind"][]; place?: string[] }[] } = JSON.parse(readFileSync(`${PANEL}/sites.json`, "utf8"));
  const site = panel.sites.find((entry) => entry.domain === domain);
  return { kind: site?.kinds[0] ?? null, serves: site?.place === undefined ? null : { name: site.place[0] } };
}

function profileOf(site: StoredSite): Profile {
  const market = site.market!;
  return {
    category: market.category,
    job: market.job,
    offeringType: market.category,
    audienceTerms: [market.buyer],
    namedRivals: [],
    vocabulary: market.synonyms ?? [],
    brandTokens: [(site.siteName ?? site.site.domain.split(".")[0]!).toLowerCase()],
    ...(site.site.language === "en" ? {} : { language: site.site.language as Language }),
  };
}

export function rowOf(domain: string, topic: StoredTopic, n: number): OpportunityRow {
  const family = FAMILY_OF[topic.type];
  const volume = topic.volume === null ? unmeasured<number>("not_attempted", AT) : measured(topic.volume, AT);
  const evidence =
    family === "improve"
      ? { family, query: topic.query, volume, shortfall: { kind: "thin", words: unmeasured<number>("not_attempted", AT) } }
      : { family, query: topic.query, volume };
  const id = `${domain}#${String(n).padStart(2, "0")}`;
  return {
    id,
    site_id: SITE_ID,
    scan_id: SCAN_ID,
    type: topic.type,
    family,
    target_query: topic.query,
    target_ref: id,
    proposed_slug: null,
    title: null,
    volume: topic.volume,
    evidence,
    acceptance: { form: "top20", query: topic.query },
    fit_band: topic.ready ? "winnable" : null,
    business_fit: topic.fit,
    effort: 0.5,
    status: topic.status,
    cluster_key: null,
    absorbed_queries: [],
    ready: topic.ready,
    unready_reason: null,
    created_at: new Date(AT.getTime() - 86_400_000 + n * 1000).toISOString(),
  };
}
