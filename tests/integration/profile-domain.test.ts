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
import { profileDomain } from "@/lib/scan/profile";

const RUN = process.env.RUN_PROFILE === "1";
const DOMAIN = process.env.PROFILE_DOMAIN ?? "stripe.com";

test.runIf(RUN)(
  `profile ${DOMAIN}`,
  async () => {
    const p = await profileDomain(DOMAIN);

    console.log(`\n=== ${p.domain} ===`);
    if (p.seo) {
      console.log(
        `SEO: ${p.seo.organicKeywords} keywords · ETV ${p.seo.etv.toFixed(0)} · ` +
          `authority ${p.seo.authority} · ${p.seo.referringDomains} referring domains`,
      );
    } else {
      console.log("SEO: (no data)");
    }
    console.log(`\nChannels (${p.channels.length}):`);
    for (const c of p.channels) {
      const cad = c.cadence
        ? ` · ${c.cadence.totalPosts} posts, ${c.cadence.postsLast90} in last 90d, ` +
          `last ${c.cadence.lastPublishedAt?.slice(0, 10) ?? "?"} ${c.cadence.active ? "(active)" : "(dormant)"}`
        : "";
      console.log(`  • ${c.label}${c.url ? ` — ${c.url}` : ""}${cad}`);
    }

    expect(p.domain).toBe(DOMAIN);
  },
  120_000,
);
