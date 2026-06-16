/**
 * Live domain-profiling runner (M2). Skipped by default (no network in CI).
 *
 * Profile any domain's content channels (with recency cadence) + SEO standing:
 *
 *   REACHKIT_USE_FIXTURES=false RUN_PROFILE=1 PROFILE_DOMAIN=stripe.com \
 *     DATAFORSEO_LOGIN=… DATAFORSEO_PASSWORD=… \
 *     npm run test:int -- profile-domain
 */

import { test, expect } from "vitest";
import { profileDomain, profileCohort, type DistributionProfile } from "@/lib/scan/profile";

const RUN = process.env.RUN_PROFILE === "1";
const COHORT = process.env.PROFILE_COHORT === "1";
const DOMAIN = process.env.PROFILE_DOMAIN ?? "stripe.com";

function printProfile(p: DistributionProfile): void {
  console.log(`\n=== ${p.domain} ===`);
  if (p.seo) {
    const auth = p.seo.authority ?? "—";
    const refd = p.seo.referringDomains ?? "—";
    console.log(
      `SEO: ${p.seo.organicKeywords} keywords · ETV ${p.seo.etv.toFixed(0)} · ` +
        `authority ${auth} · ${refd} referring domains`,
    );
  } else {
    console.log("SEO: (no data)");
  }
  console.log(`Channels (${p.channels.length}):`);
  for (const c of p.channels) {
    const cad = c.cadence
      ? ` · ${c.cadence.totalPosts} posts, ${c.cadence.postsLast90} in last 90d, ` +
        `last ${c.cadence.lastPublishedAt?.slice(0, 10) ?? "?"} ${c.cadence.active ? "(active)" : "(dormant)"}`
      : "";
    console.log(`  • ${c.label}${c.url ? ` — ${c.url}` : ""}${cad}`);
  }
}

test.runIf(RUN && !COHORT)(
  `profile ${DOMAIN}`,
  async () => {
    const p = await profileDomain(DOMAIN);
    printProfile(p);
    expect(p.domain).toBe(DOMAIN);
  },
  120_000,
);

// Full fan-out: the user's domain + its top-5 competitors (discovered + profiled
// in parallel through the shared cache). PROFILE_COHORT=1 to run.
test.runIf(RUN && COHORT)(
  `profile cohort for ${DOMAIN}`,
  async () => {
    const cohort = await profileCohort(DOMAIN, { topN: 5 });
    console.log(`\nCompetitors discovered: ${cohort.competitorDomains.join(", ") || "(none)"}`);
    printProfile(cohort.self);
    for (const c of cohort.competitors) printProfile(c);
    expect(cohort.self.domain).toBe(DOMAIN);
  },
  300_000,
);
