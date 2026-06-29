/**
 * LIVE validation of the reverse-referral engine (corrected design):
 *   1. domain_intersection over the COMPETITORS → domains feeding multiple rivals
 *   2. self's own referring domains (backlinks one_per_domain) → what self already has
 *   3. opportunities = (feeds ≥2 competitors) − (self's referrers)
 *
 * Subject is the UNDERDOG so missing channels actually surface.
 * Run: pnpm test:int tests/integration/referral-discovery.test.ts
 *   REF_SELF=savvycal.com REF_COMPETITORS="cal.com,calendly.com,acuityscheduling.com" pnpm test:int ...
 */
process.env.REACHKIT_USE_FIXTURES = "true";

import { describe, it, expect } from "vitest";
import { fetchDomainIntersection, fetchBacklinks } from "@/lib/scan/adapters/dataforseo-backlinks";
import { fetchTrafficForHosts } from "@/lib/scan/adapters/dataforseo-traffic";
import { classifyReferrer, isUbiquitousHost, normalizeHost } from "@/lib/scan/referral/classify";

const SELF = process.env.REF_SELF || "savvycal.com";
const COMPETITORS = (process.env.REF_COMPETITORS || "cal.com,calendly.com,acuityscheduling.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

describe("reverse-referral (LIVE, corrected)", () => {
  it(
    "surfaces niche platforms feeding ≥2 competitors that the subject lacks",
    async () => {
      // 1. Domains referring to multiple competitors (intersection over competitors only).
      const { rows } = await fetchDomainIntersection(COMPETITORS, { limit: 400 });
      // 2. Self's own referring domains.
      const selfRefs = await fetchBacklinks(SELF, { limit: 1000 });
      const selfHosts = new Set(selfRefs.map((r) => normalizeHost(r.referringHost)));

      // NOISE FILTERS — the difference between "useless advice" and a real channel.
      // (a) customer-embed TLDs: schools/govs paste "book a meeting" links; not channels.
      const isCustomerEmbedTld = (h: string) =>
        /\.(edu|gov)$/.test(h) || /\.(edu|gov|ac)\.[a-z]{2}$/.test(h) || /\.gov\.[a-z]{2}$/.test(h);
      // (b) generic mega-authority sites that link to everything → not selective channels.
      const GENERIC = new Set([
        "amazon.com", "craigslist.org", "intuit.com", "squarespace.com", "shopify.com",
        "outlook.com", "prnewswire.com", "zendesk.com", "hubspot.com", "justia.com",
        "fresha.com", "setmore.com", "jotform.com", "prospeo.io",
      ]);
      const isNoise = (h: string) => isUbiquitousHost(h) || isCustomerEmbedTld(h) || GENERIC.has(h);

      // 3. Traffic-weight referring hosts.
      const hosts = [...new Set(rows.map((r) => r.referringHost))].filter((h) => !isNoise(h));
      const traffic = await fetchTrafficForHosts(hosts);

      type Opp = { host: string; channel: string; comps: number; reach: number };
      const scored: Opp[] = rows
        .filter((r) => !isNoise(r.referringHost))
        .map((r) => {
          const etv = traffic.get(r.referringHost) ?? 0;
          const comps = r.targetIdxs.length;
          return {
            host: r.referringHost,
            channel: classifyReferrer(r.referringHost, `https://${r.referringHost}`),
            comps,
            reach: Math.log1p(etv) * comps,
            selfPresent: selfHosts.has(r.referringHost),
          } as Opp & { selfPresent: boolean };
        })
        .filter((o) => o.comps >= 2)
        .sort((a, b) => b.reach - a.reach) as (Opp & { selfPresent: boolean })[];

      const opportunities = (scored as (Opp & { selfPresent: boolean })[]).filter((o) => !o.selfPresent);
      const shared = (scored as (Opp & { selfPresent: boolean })[]).filter((o) => o.selfPresent);

      const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
      const line = (o: Opp) =>
        `${pad(o.host, 34)} ${pad(o.channel, 11)} ${o.comps}/${COMPETITORS.length} rivals  reach ${o.reach.toFixed(1).padStart(6)}`;

      console.log(`\n=== ${SELF} (underdog) vs [${COMPETITORS.join(", ")}] ===`);
      console.log(`intersection rows=${rows.length}  self referrers=${selfHosts.size}`);
      console.log(`OPPORTUNITIES=${opportunities.length}  shared=${shared.length}\n`);
      console.log(`--- TOP OPPORTUNITIES (feed ≥2 rivals, ${SELF} ABSENT) ---`);
      for (const o of opportunities.slice(0, 30)) console.log(line(o));
      console.log(`\n--- SHARED (${SELF} already present) ---`);
      for (const o of shared.slice(0, 8)) console.log(line(o));
      console.log("");

      expect(rows.length).toBeGreaterThan(0);
    },
    120_000,
  );
});
