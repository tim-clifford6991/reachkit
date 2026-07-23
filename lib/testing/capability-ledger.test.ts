/**
 * CAPABILITY LEDGER — one capability, one implementation (R-11.7, 2026-07-21).
 *
 * The generalization of RC1 (one keyword-brand detector) and G9 (the paid-data
 * ledger) from "two known consumers" to "the whole `lib/` tree". Every past
 * duplication in this repo — two upgrade paths, two market-ladder shapes, two
 * demand systems, free/paid action forks — was fixed REACTIVELY, after the
 * drift shipped, by collapsing to one shared function. Nothing fired when the
 * SECOND implementation was added. This gate is that missing alarm.
 *
 * A registered capability names its ONE canonical module + the exported symbols
 * that ARE the capability. Two machine checks, both mutation-proven:
 *
 *   A. NO SECOND DEFINER — scan every `.ts` in `lib/` (excluding tests) for any
 *      OTHER top-level definition of a registered symbol outside its canonical
 *      module. A second `function brandTokensFor` / `const discoverDemand =`
 *      anywhere → fail. Exact-name collision only: deterministic and cheaply
 *      mutation-provable. Deliberately NOT body-shape similarity (non-
 *      deterministic, false-positives on legitimately distinct same-named pairs
 *      like the two `buildClassifyPrompt`s — the repo's own no-LLM-judge
 *      reasoning, CLAUDE.md "Known open risks", applies).
 *
 *   B. A LIVE CONSUMER CALLS IT — each capability names one consumer that
 *      really CALLS a canonical symbol, asserted through `expectCallsSymbol`
 *      (the anti-vacuity primitive: an import / comment / type-ref cannot
 *      satisfy it). A capability nobody calls is dead — delete it, don't pin it.
 *
 * RATCHET: the ledger only GROWS. New shared capability (e.g. Phase A's
 * `computeMarket`, Phase B's relevance judge) → add its entry the moment it
 * lands, so a later re-fork is caught. Removing an entry needs a documented
 * reason in the commit (the capability genuinely went away).
 *
 * MUTATION-PROVEN (watched failing, then reverted — "a guard you have not seen
 * fail is not a guard"):
 *   A ← add `function discoverDemand() {}` to lib/scan/free-report.ts → check A
 *       reports a second definer (verified this session; reverted).
 *   B ← delete the `brandTokensFor(` call from lib/scan/search-visibility.ts,
 *       keep the import → expectCallsSymbol fails (the RC1 idiom).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expectCallsSymbol, stripNoise } from "@/lib/testing/tripwire";

interface Capability {
  /** kebab-case name of the capability, for the failure message. */
  capability: string;
  /** the ONE module allowed to DEFINE the exports below (repo-relative). */
  canonicalModule: string;
  /** the exported symbols that ARE this capability — no other lib/ file may define them. */
  exports: string[];
  /** one file that really CALLS a canonical symbol (proves the capability is live). */
  consumer: string;
}

/**
 * The ledger. Every entry's exports were verified to be defined in exactly one
 * `lib/` file at introduction (2026-07-21). Order is stable; append new
 * capabilities, never renumber.
 */
const CAPABILITY_LEDGER: Capability[] = [
  {
    capability: "keyword-brand-detection",
    canonicalModule: "lib/scan/referral/brand-keywords.ts",
    exports: ["brandTokensFor", "isBrandKeyword"],
    consumer: "lib/scan/search-visibility.ts",
  },
  {
    capability: "scan-dedupe-policy",
    canonicalModule: "lib/app/add-product.ts",
    exports: ["resolveProductScan"],
    consumer: "app/api/scan/route.ts",
  },
  {
    capability: "action-floor",
    canonicalModule: "lib/scan/action-linking.ts",
    exports: ["ensurePerCategoryFloor", "topUpActions", "recomputeActionImpacts"],
    consumer: "lib/scan/full-scan.ts",
  },
  {
    capability: "deterministic-action-drafts",
    canonicalModule: "lib/scan/action-drafts.ts",
    exports: ["fillDeterministicDrafts"],
    consumer: "lib/scan/free-report.ts",
  },
  {
    capability: "demand-discovery-core",
    canonicalModule: "lib/scan/demand/index.ts",
    exports: ["discoverDemand"],
    consumer: "lib/scan/gap/run.ts",
  },
  {
    capability: "external-cost-cap-seam",
    canonicalModule: "lib/scan/scan-caps.ts",
    exports: ["externalCapCentsFor"],
    consumer: "lib/inngest/functions/scan-requested.ts",
  },
  {
    capability: "free-search-visibility-gather",
    canonicalModule: "lib/scan/search-visibility.ts",
    exports: ["gatherFreeSearchVisibility"],
    consumer: "lib/scan/free-report.ts",
  },
  {
    // Phase S (2026-07-21): extracted from collect.ts so the paid initial
    // collect AND the deepen-time re-collect share ONE discovery path.
    // NOTE the distinct name: the referral cohort's `discoverCompetitors`
    // (lib/scan/referral/discover-competitors.ts) is a DIFFERENT capability
    // (closeness-ranked cohort), so this scan-facts discovery is
    // `discoverScanCompetitors` — the ledger's no-second-definer check caught
    // the collision and forced the rename (exactly its job).
    capability: "scan-competitor-discovery",
    canonicalModule: "lib/scan/scan-competitors.ts",
    exports: ["discoverScanCompetitors"],
    consumer: "lib/scan/collect.ts",
  },
  {
    // Phase B (2026-07-22, D3): the ONE LLM relevance judge. Classifies real
    // keyword strings as category/niche/irrelevant to the subject's business —
    // the structural replacement for the coarse token-overlap relevance that
    // kept mislabeling markets (mixpanel-for-fathom). The keyword-brand detector
    // (RC1) and the score-side classifier stay separate capabilities; this owns
    // relevance JUDGING only. Pinned so a future scan surface can't re-fork it.
    capability: "relevance-judging",
    canonicalModule: "lib/scan/relevance-judge.ts",
    exports: ["judgeRelevance"],
    consumer: "lib/scan/search-visibility.ts",
  },
];

/** Recursively list every non-test `.ts`/`.tsx` under a root (repo-relative). */
function listSourceFiles(rootRel: string): string[] {
  const root = resolve(process.cwd(), rootRel);
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      if (/\.test\.tsx?$/.test(entry) || entry.endsWith(".d.ts")) continue;
      out.push(full.slice(resolve(process.cwd()).length + 1));
    }
  };
  walk(root);
  return out;
}

/** True if `clean` (noise-stripped) DEFINES `symbol` at the source level. */
function definesSymbol(clean: string, symbol: string): boolean {
  const s = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    new RegExp(`\\bfunction\\s+${s}\\s*[(<]`),
    new RegExp(`\\b(?:export\\s+)?(?:const|let)\\s+${s}\\s*[:=]`),
    new RegExp(`\\b(?:export\\s+)?class\\s+${s}\\b`),
  ].some((p) => p.test(clean));
}

const LIB_FILES = listSourceFiles("lib");

describe("capability ledger — one capability, one implementation (R-11.7)", () => {
  // Sanity: the file walk actually found the tree (a guard over an empty set
  // is a guard over nothing — the no-scan-ejection lesson).
  it("scans a non-trivial lib/ tree", () => {
    expect(LIB_FILES.length).toBeGreaterThan(100);
  });

  for (const cap of CAPABILITY_LEDGER) {
    describe(cap.capability, () => {
      it(`is defined only in its canonical module (${cap.canonicalModule})`, () => {
        for (const sym of cap.exports) {
          const offenders: string[] = [];
          for (const rel of LIB_FILES) {
            if (rel === cap.canonicalModule) continue;
            const clean = stripNoise(readFileSync(resolve(process.cwd(), rel), "utf8"));
            if (definesSymbol(clean, sym)) offenders.push(rel);
          }
          expect(
            offenders,
            `capability "${cap.capability}": "${sym}" is a canonical export of ${cap.canonicalModule}, ` +
              `but a SECOND definition exists in: ${offenders.join(", ")}. Route the consumer through the ` +
              `canonical module instead of re-forking (RC1/R-11.7).`,
          ).toEqual([]);
        }
      });

      it(`really defines its exports (the ledger names the right module)`, () => {
        const clean = stripNoise(readFileSync(resolve(process.cwd(), cap.canonicalModule), "utf8"));
        for (const sym of cap.exports) {
          expect(
            definesSymbol(clean, sym),
            `capability "${cap.capability}": ${cap.canonicalModule} is pinned as the definer of "${sym}" ` +
              `but does not define it — fix the ledger's canonicalModule.`,
          ).toBe(true);
        }
      });

      it(`has a live consumer that calls it (${cap.consumer})`, () => {
        // Assert the consumer calls at least the first export (the capability's
        // entry point). expectCallsSymbol refuses an import/comment/type-ref.
        expectCallsSymbol(cap.consumer, cap.exports[0]!);
      });
    });
  }
});
