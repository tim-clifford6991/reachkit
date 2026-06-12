/**
 * §9.5 Bounded agentic loops.
 *
 * Three loop types described in spec:
 *   1. competitorDiscoveryLoop — iterative competitor expansion (this file, §9.5 loop 1)
 *   2. Evidence / Critic loop — implemented by the Critic reject/revise cycle (Task 8,
 *      lib/llm/critic.ts). No separate implementation needed here.
 *   3. Gap-chasing budget reallocation — weakestQuestion helper (this file, §9.5 loop 3)
 */
import { BudgetExceededError } from "@/lib/tools/registry";
import type { ScanBudget } from "@/lib/tools/registry";
import type { Competitor } from "@/lib/scan/types";
import type { ScanContext } from "@/lib/scan/pipeline";
import { findCompetitors } from "@/lib/scan/tools/find-competitors";
import { callEmbed } from "@/lib/llm/embed";
import { searchSimilar } from "@/lib/scan/embeddings";
import { rankCompetitors } from "@/lib/scan/competitors";
import { hostname } from "@/lib/scan/url";

// ---------------------------------------------------------------------------
// 1. Generic bounded loop framework
// ---------------------------------------------------------------------------

export interface LoopOpts<T> {
  /** Hard ceiling on number of rounds. */
  maxRounds: number;
  /** Shared budget — checked before each round for callCeiling. */
  budget: ScanBudget;
  /**
   * Optional soft ceiling on total tool calls.
   * Loop stops before a round if budget.callsMade >= callCeiling.
   * Recommended range: 30–60 (§9.5).
   */
  callCeiling?: number;
  /** Derives the de-duplication key for each item. */
  key: (item: T) => string;
}

/**
 * Run `round` repeatedly, accumulating de-duped results.
 *
 * Stop conditions (whichever fires first):
 *   1. `maxRounds` reached.
 *   2. A round adds **zero** new items (diminishing returns / no-novelty).
 *   3. `budget.callsMade >= callCeiling` (checked before each round).
 *   4. `round` throws `BudgetExceededError` — swallowed, returns accumulated.
 *
 * De-duplication is first-seen-wins by `opts.key`.
 */
export async function boundedLoop<T>(
  opts: LoopOpts<T>,
  round: (accumulated: T[]) => Promise<T[]>,
): Promise<T[]> {
  const seen = new Map<string, T>();
  const { maxRounds, budget, callCeiling, key } = opts;

  for (let i = 0; i < maxRounds; i++) {
    // Stop before running if callCeiling is set and already breached
    if (callCeiling !== undefined && budget.callsMade >= callCeiling) break;

    let roundItems: T[];
    try {
      roundItems = await round([...seen.values()]);
    } catch (err) {
      if (err instanceof BudgetExceededError) break; // stop gracefully, no rethrow
      throw err;
    }

    // De-dupe: first-seen-wins
    let novelty = 0;
    for (const item of roundItems) {
      const k = key(item);
      if (!seen.has(k)) {
        seen.set(k, item);
        novelty++;
      }
    }

    // No-novelty stop: this round added nothing new
    if (novelty === 0) break;
  }

  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// 2. Competitor-discovery loop (§9.5 loop 1)
// ---------------------------------------------------------------------------

/**
 * Iteratively expand the competitor set by running `findCompetitors` for the
 * latest names and pulling pgvector positioning neighbours via `searchSimilar`.
 *
 * - maxRounds: 3   (first-pass is never assumed complete — §9.5)
 * - callCeiling: 50 (within the 30–60 recommended range)
 * - key: normalized hostname
 *
 * Fixture-aware: `findCompetitors` already short-circuits in fixture mode, so
 * the loop converges in 1 round on fixtures (second round adds nothing new).
 *
 * Wiring into the full scan pipeline is Task 13.
 */
export async function competitorDiscoveryLoop(
  ctx: ScanContext,
  productName: string,
  storeUrl: string,
  seedCompetitors: Competitor[],
): Promise<Competitor[]> {
  const toolCtx = { scanId: ctx.scanId, mode: ctx.mode, budget: ctx.budget };
  const selfHost = hostname(storeUrl);
  const subjectKey = storeUrl;

  return boundedLoop<Competitor>(
    {
      maxRounds: 3,
      budget: ctx.budget,
      callCeiling: 50,
      key: (c) => hostname(c.url),
    },
    async (accumulated) => {
      // Derive names to search from the most recent accumulated set
      // (seed competitors in round 0, expanded set in later rounds)
      const allSoFar: Competitor[] =
        accumulated.length === 0 ? seedCompetitors : accumulated;

      const recentNames = allSoFar
        .slice(0, 5)
        .map((c) => c.name)
        .filter(Boolean);

      // Run findCompetitors for each recent name and collect results
      // Use the first name (or productName fallback) for the primary call
      const searchName =
        recentNames[0] !== undefined && recentNames[0].length > 0
          ? recentNames[0]
          : productName;

      let fresh: Competitor[] = [];

      try {
        const result = await findCompetitors.run(
          { productName: searchName, storeUrl, subjectKey },
          toolCtx,
        );
        fresh = result.competitors;
      } catch (err) {
        // Propagate BudgetExceededError so boundedLoop can catch it
        if (err instanceof BudgetExceededError) throw err;
        // Other errors degrade gracefully
        fresh = [];
      }

      // Pull positioning neighbours from pgvector
      let neighbours: Competitor[] = [];
      try {
        const queryText = `${productName} ${recentNames.join(" ")}`.trim();
        const vecs = await callEmbed([queryText]);
        const vec = vecs[0];
        if (vec !== undefined) {
          const similar = await searchSimilar(vec, {
            subjectType: "positioning",
            k: 5,
          });
          // Parse competitor URLs from content strings like "https://example.com"
          neighbours = similar
            .map((s) => {
              const urlMatch = s.content.match(/https?:\/\/[^\s"']+/);
              if (!urlMatch) return null;
              const url = urlMatch[0] ?? "";
              return {
                name: hostname(url),
                url,
                source: "embedding_neighbour",
                rank: 99,
              } satisfies Competitor;
            })
            .filter((c): c is Competitor => c !== null);
        }
      } catch {
        // pgvector errors are non-fatal; continue with just the tool results
        neighbours = [];
      }

      const candidates: Competitor[] = [...fresh, ...neighbours];

      // Rank and filter candidates (excluding self)
      const ranked = rankCompetitors(candidates, { selfHost, cap: 10 });

      return ranked;
    },
  );
}

// ---------------------------------------------------------------------------
// 3. Gap-chasing budget helper (§9.5 loop 3)
// ---------------------------------------------------------------------------

/** The four evidence questions that guide budget reallocation. */
export interface CoverageMap {
  whatYouOffer: number;
  whoItsFor: number;
  whereTheyAre: number;
  whatToDo: number;
}

/**
 * Returns the key with the lowest coverage score.
 * Remaining budget should be reallocated to the weakest question.
 *
 * Pure function — no side effects.
 * Tie-breaking: first key in declaration order wins.
 */
export function weakestQuestion(coverage: CoverageMap): keyof CoverageMap {
  const entries = [
    ["whatYouOffer", coverage.whatYouOffer],
    ["whoItsFor", coverage.whoItsFor],
    ["whereTheyAre", coverage.whereTheyAre],
    ["whatToDo", coverage.whatToDo],
  ] as const satisfies ReadonlyArray<readonly [keyof CoverageMap, number]>;

  let weakestKey: keyof CoverageMap = "whatYouOffer";
  let minScore = coverage.whatYouOffer;

  for (const [k, score] of entries) {
    if (score < minScore) {
      minScore = score;
      weakestKey = k;
    }
  }

  return weakestKey;
}
