/**
 * Live market-analysis runner (M4). Skipped by default. Runs the full pipeline —
 * cohort + demand → gap → plan — and prints the founder-facing output:
 *
 *   REACHKIT_USE_FIXTURES=false RUN_MARKET=1 MARKET_DOMAIN=trustmrr.com \
 *     npm run test:int -- market-analysis
 */

import { test, expect } from "vitest";
import { runMarketAnalysis } from "@/lib/scan/gap";

const RUN = process.env.RUN_MARKET === "1";
const DOMAIN = process.env.MARKET_DOMAIN ?? "trustmrr.com";

test.runIf(RUN)(
  `market analysis for ${DOMAIN}`,
  async () => {
    const { cohort, demand, gap, plan } = await runMarketAnalysis(DOMAIN, { topN: 5 });

    console.log(`\n=== ${cohort.self.domain} vs ${cohort.competitorDomains.join(", ")} ===`);

    console.log("\nCHANNEL MATRIX (you | rivals active / total):");
    for (const r of gap.channelMatrix) {
      const you = r.self.present ? (r.self.active ? "active" : "dormant") : "—";
      if (r.competitorsActive === 0 && !r.self.present) continue;
      console.log(`  ${r.kind.padEnd(11)} you:${you.padEnd(8)} rivals:${r.competitorsActive}/${r.total}`);
    }

    console.log(`\nDEMAND: ${demand.buyerPainHits}/${demand.totalHits} buyer-pain hits → ${demand.pockets.length} pockets`);

    console.log("\nDISTRIBUTION PLAN:");
    plan.items.forEach((i, n) => {
      console.log(`  ${n + 1}. [${i.kind}] ${i.title}`);
      console.log(`     ${i.why}`);
    });

    expect(cohort.self.domain).toBeTruthy();
  },
  300_000,
);
