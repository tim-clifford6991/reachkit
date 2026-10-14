// src/lib/scan/cards.ts — the rivals, the two cards and the coherence
// verdict, counted over SERPs a pass already holds (§6.6's "zero extra
// cost").
//
// One function for the two callers that count them: a pass's last stage
// (`score` in `run.ts`) and the re-score of a stored report (`rescore.ts`,
// issue 1426). Both read the same stored inputs, so a report re-scored with
// the current code says what a new pass over the same SERPs would say.
import { checkCoherence, type CoherenceVerdict } from "@/lib/market/coherence/check";
import { buildAiAnswersCard, type AiAnswersCard, type BatteryAnswers } from "@/lib/market/questions/matrix";
import type { RivalSizeBand } from "@/lib/market/rivals/band";
import { deriveRivals, type RivalCandidate } from "@/lib/market/rivals/derive";
import { buildPresenceCard, type PresenceCard } from "@/lib/market/rivals/presence";
import type { MarketSerp, QuestionView, SelectedSearchView } from "@/lib/market/views";
import type { Measured } from "@/lib/measure/measured";

export interface Cards {
  rivals: RivalCandidate[];
  sources: string[];
  presence: PresenceCard;
  card: AiAnswersCard;
  coherence: CoherenceVerdict;
}

export function cardsOf(a: {
  serps: readonly Measured<MarketSerp>[];
  questions: readonly QuestionView[];
  /** The searches the SERPs were bought for, in their order: the pass's own
   *  selection, or — read back from a report — each question's search. */
  selected?: readonly SelectedSearchView[];
  battery?: readonly BatteryAnswers[];
  /** `RivalSize` as far as a band goes: a stored sizing, or its slim export. */
  rivalSizes: Measured<readonly { domain: string; state: string; band?: RivalSizeBand }[]>;
  ownDomain: string;
  /** The site's name, as `namesSite` reads it; `null` where none is known. */
  siteName?: string | null;
  coverage: AiAnswersCard["coverage"];
}): Cards {
  const readSerps: MarketSerp[] = [];
  for (const serp of a.serps) if (serp.kind !== "unmeasured") readSerps.push(serp.value);

  // The bands this pass already holds (issue 858): a far domain is never
  // one of the report's rivals, and the nearest lead.
  const sizes = new Map<string, RivalSizeBand>();
  if (a.rivalSizes.kind !== "unmeasured") {
    for (const size of a.rivalSizes.value) if (size.state === "sized" && size.band !== undefined) sizes.set(size.domain, size.band);
  }
  const derivation = deriveRivals({ serps: readSerps, ownDomain: a.ownDomain, sizes });

  return {
    rivals: derivation.rivals,
    sources: derivation.sources,
    presence: buildPresenceCard({
      serps: a.serps,
      selected: a.selected ?? a.questions.map((question) => question.search),
      ownDomain: a.ownDomain,
      rivals: derivation.rivals,
    }),
    card: buildAiAnswersCard({
      questions: a.questions,
      serps: a.serps,
      ...(a.battery === undefined ? {} : { battery: a.battery }),
      ownDomain: a.ownDomain,
      siteName: a.siteName ?? null,
      coverage: a.coverage,
    }),
    coherence: checkCoherence({ serps: readSerps, measuredCount: readSerps.length }),
  };
}
