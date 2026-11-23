// The rivals, both cards and the coherence verdict, counted over SERPs a pass already holds. One function for a pass's last stage and the re-score of a stored report,
// so a re-scored report says what a new pass over the same SERPs would.
import { checkCoherence, type CoherenceVerdict } from "@/lib/market/coherence/check";
import { buildAiAnswersCard, type AiAnswersCard, type BatteryAnswers } from "@/lib/market/questions/matrix";
import type { RivalSizeBand } from "@/lib/market/rivals/band";
import { deriveRivals, type RivalCandidate } from "@/lib/market/rivals/derive";
import { profileTown, readsLocal, type ReachProfile } from "@/lib/market/rivals/reach";
import { buildPresenceCard, type PresenceCard } from "@/lib/market/rivals/presence";
import type { MarketSerp, QuestionView, SelectedSearchView } from "@/lib/market/views";
import type { Measured } from "@/lib/measure/measured";

type StoredReachProfile = { town?: string; offeringType?: string; category?: string | null; reach?: unknown; kind?: unknown };

/** Whether a stored report's town is still its market: a free pass's stands while its profile reads a town it sells in; a paid pass's stands.
 *  Where it does not, the searches were bought there, so the report is read in that town until rescanned and the re-score lists it stale. */
export function placeStands(r: {
  locale?: { place?: unknown; placeFrom?: unknown } | null;
  market: Measured<{ profile: StoredReachProfile }>;
}): boolean {
  if (r.locale?.place === undefined) return false;
  const profile = r.market.kind === "unmeasured" ? null : reachProfileOf(r.market.value.profile);
  if (r.locale.placeFrom === undefined || profile === null) return true;
  return profileTown(profile) !== "";
}

/** A stored report's reach: the town its searches were bought in, its profile read and its home page's structured data. */
export function reachOfReport(r: {
  locale?: { place?: unknown; placeFrom?: unknown } | null;
  market: Measured<{ profile: StoredReachProfile }>;
  onPage: Measured<{ schemaTypes: readonly string[] }>;
}): NonNullable<Parameters<typeof cardsOf>[0]["reach"]> {
  const profile = r.market.kind === "unmeasured" ? null : reachProfileOf(r.market.value.profile);
  return {
    measuredInTown: r.locale?.place !== undefined,
    profile,
    schemaTypes: r.onPage.kind === "unmeasured" ? [] : r.onPage.value.schemaTypes,
  };
}

/** Whether a stored report's market is local, as its rivals were read. */
export function localOfReport(r: Parameters<typeof reachOfReport>[0] & { serps: readonly Measured<MarketSerp>[] }): boolean {
  return readsLocal({ ...reachOfReport(r), serps: r.serps.flatMap((serp) => (serp.kind === "unmeasured" ? [] : [serp.value])) });
}

function reachProfileOf(profile: StoredReachProfile): ReachProfile {
  return {
    ...(profile.town === undefined ? {} : { town: profile.town }),
    ...(profile.offeringType === undefined ? {} : { offeringType: profile.offeringType }),
    ...(typeof profile.category === "string" ? { category: profile.category } : {}),
    ...(profile.reach === undefined ? {} : { reach: profile.reach }),
    ...(profile.kind === undefined ? {} : { kind: profile.kind }),
  };
}

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
  /** What the site says of its reach: a local business's local pack leads its rivals. Absent is a national market. */
  reach?: Omit<Parameters<typeof readsLocal>[0], "serps">;
  /** The site's name, as `namesSite` reads it; `null` where none is known. */
  siteName?: string | null;
  /** The one place a local business serves, where it serves one. */
  town?: string;
  coverage: AiAnswersCard["coverage"];
}): Cards {
  const readSerps: MarketSerp[] = [];
  for (const serp of a.serps) if (serp.kind !== "unmeasured") readSerps.push(serp.value);

  // The bands this pass already holds: a far domain is never one of the report's rivals, and the nearest lead.
  const sizes = new Map<string, RivalSizeBand>();
  if (a.rivalSizes.kind !== "unmeasured") {
    for (const size of a.rivalSizes.value) if (size.state === "sized" && size.band !== undefined) sizes.set(size.domain, size.band);
  }
  const local = a.reach !== undefined && readsLocal({ ...a.reach, serps: readSerps });
  const derivation = deriveRivals({ serps: readSerps, ownDomain: a.ownDomain, sizes, local, category: a.reach?.profile?.category });

  return {
    rivals: derivation.rivals,
    sources: derivation.sources,
    presence: buildPresenceCard({
      serps: a.serps,
      selected: a.selected ?? a.questions.map((question) => question.search),
      ownDomain: a.ownDomain,
      rivals: derivation.rivals,
      local,
      sources: derivation.sources,
    }),
    card: buildAiAnswersCard({
      questions: a.questions,
      serps: a.serps,
      ...(a.battery === undefined ? {} : { battery: a.battery }),
      ownDomain: a.ownDomain,
      siteName: a.siteName ?? null,
      town: a.town,
      coverage: a.coverage,
    }),
    coherence: checkCoherence({ serps: readSerps, measuredCount: readSerps.length }),
  };
}
