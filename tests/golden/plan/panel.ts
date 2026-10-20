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
// read off the run's own market conclusion. 0¢: nothing is measured.
import { readdirSync, readFileSync } from "node:fs";
import type { Language } from "@/lib/locale/locales";
import type { Profile } from "@/lib/market/questions/profile";
import { measured, unmeasured } from "@/lib/measure/measured";
import type { OpportunityRow } from "@/lib/opportunities/store";
import { FAMILY_OF, type OpportunityType } from "@/lib/opportunities/types";

const PANEL = "docs/walk/panel";
export const AT = new Date("2026-10-19T06:00:00.000Z");
export const SITE_ID = "33333333-3333-4333-8333-333333333333";
const SCAN_ID = "44444444-4444-4444-8444-444444444444";

interface StoredTopic {
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
    return { domain, run, profile: profileOf(site), rows: site.topics!.map((topic, n) => rowOf(domain, topic, n)) };
  }
  throw new Error(`no stored panel run holds topics for ${domain}`);
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

function rowOf(domain: string, topic: StoredTopic, n: number): OpportunityRow {
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
