/**
 * Live dogfood runner for demand discovery (M3).
 *
 * Skipped by default (no network in CI). Run it live to surface ReachKit's own
 * demand pockets — founders posting about distribution struggles:
 *
 *   REACHKIT_USE_FIXTURES=false RUN_DOGFOOD=1 \
 *     ANTHROPIC_API_KEY=… DATAFORSEO_LOGIN=… DATAFORSEO_PASSWORD=… \
 *     npm run test:int -- demand-dogfood
 *
 * It prints the generated pain queries and the ranked demand pockets (with the
 * top threads to engage). Real API spend is ~$0.10–0.30.
 */

import { test, expect } from "vitest";
import { runDemandDogfood } from "@/lib/scan/demand/dogfood";

const RUN = process.env.RUN_DOGFOOD === "1";

test.runIf(RUN)(
  "dogfood: ReachKit's own demand pockets",
  async () => {
    const res = await runDemandDogfood({ queryCap: 8 });

    console.log("\n=== PAIN QUERIES ===");
    for (const q of res.painQueries) console.log("  •", q);

    console.log(
      `\n=== ${res.buyerPainHits}/${res.totalHits} buyer-pain hits → ${res.pockets.length} demand pockets ===`,
    );
    for (const p of res.pockets.slice(0, 10)) {
      console.log(
        `\n${p.surface}  (score ${p.score.toFixed(2)} · ${p.count} threads · intent ${p.intentSum.toFixed(1)})`,
      );
      for (const t of p.topThreads) {
        const when = t.publishedAt ? t.publishedAt.slice(0, 10) : "date?";
        console.log(`  • [intent ${t.intent.toFixed(1)} · ${when}] ${t.title}`);
        console.log(`      ${t.url}`);
      }
    }

    expect(res.painQueries.length).toBeGreaterThan(0);
  },
  180_000,
);
