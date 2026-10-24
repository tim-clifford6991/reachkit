// The Market tab panels' props beyond the set itself, for suites about other behaviour.
import type { MarketFigures } from "@/app/(account)/app/settings/market-figures";

export const SETS = { searches: 12, questions: 23, competitors: 2 } as const;

/** CompetitorsPanel's props for a set, each competitor measured at the given figures. */
export function competitorProps(
  competitors: readonly string[],
  figures: MarketFigures = {
    cards: Object.fromEntries(competitors.map((domain) => [domain, { google: { n: 5, of: 12 }, ai: { n: 41, of: 184 } }])),
    you: { google: { n: 1, of: 12 }, ai: { n: 11, of: 184 } },
  }
) {
  return {
    competitors,
    figures,
    measuredFrom: "Oct 26, 2026",
    ownDomain: "harborplumbing.example",
    leaders: [] as readonly string[],
    detail: { googleOn: "Monday 19 October", searches: 12, questions: 23 },
  };
}
