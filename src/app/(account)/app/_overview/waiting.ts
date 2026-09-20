// SPEC §4 (2026-09-20, #908) — the page waiting for review, as the Overview
// tab leads with it.
//
// "the page waiting for review with a one-sentence reason, a small view of
// it as readers will see it, *Read it* and *Stop this page*."
//
// **The reason is chosen here and written in the registry.** Four arms, one
// per shape of evidence the opportunity carries, and no sentence is composed
// at a call site: this module picks the key and hands over the values, the
// view formats the numbers, and the registry says the words.
//
// **Nothing is measured and nothing is re-derived.** Every value is a
// projection of what the pass stored on the opportunity at creation
// (`_shell/page-target.ts`'s `PageTarget`), read by `store.ts`. A page whose
// target facts were never read renders its unmeasured arm — the third one
// below — rather than a zero, which REQ-004 forbids as a reading that was
// never taken.
//
// **The target is declared structurally rather than imported.** `PageTarget`
// lives in `_shell/page-target.ts`, which type-imports `Choice` — and
// `Choice`'s own module graph reaches the vendor clients and the language
// model. Overview's import-graph guard (`tests/app/overview/page.test.tsx`)
// counts a type import exactly as it counts a value one, so a screen that
// named that type would drag both into its graph. `store.ts` builds a
// `WaitingTarget` from the stored `PageTarget`; that is where the two meet,
// and `store.ts` is behind `provider.ts`'s lazy import.
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import { BAND_LABELS } from "@/lib/presentation/bands";
// By file, never through a barrel: this reaches one type union and must not
// pull the opportunities store behind a screen that needs none of it.
import type { Winnability } from "@/lib/opportunities/types";

/** The two stages that wait on a reader. A page in any other state is not
 *  waiting for review and never reaches this card. */
export type WaitingStage = "your_review";

/** What the pass measured about the search this page is written to win —
 *  `PageTarget`'s own members, plus who holds the answer today. */
export interface WaitingTarget {
  search: string;
  /** Searches a month, as the pass measured it. */
  volume: Measured<number>;
  /** The band, as a handle. The words are `BAND_LABELS.winnability`'s. */
  winnability: Winnability;
  /** Who answers that search today — the rival the evidence recorded. Empty
   *  where the page improves one of the customer's own pages, and where the
   *  row carries no target facts at all. */
  answeredTodayBy: readonly string[];
}

/** One page in review, as `store.ts` and `fixture.ts` read it. */
export interface WaitingPageFacts {
  draftId: string;
  /** The customer's own words for their page, never a sentence composed
   *  here. */
  title: string;
  stage: WaitingStage;
  /** When it publishes if the customer does nothing — the draft's own stored
   *  `veto_deadline`. `null` where no window is running: nothing publishes
   *  it on a clock, so there is no time to state. */
  goesLiveAt: Date | null;
  /** `null` for a Fix page, which has no market target at all (SPEC §9). */
  target: WaitingTarget | null;
  /** Whether this page updates one the site already has (SPEC §7,
   *  2026-09-20's known-content rule) rather than adding a new one. */
  update: boolean;
  /** The first lines of the body, as readers will see them. Empty before the
   *  page has been written, and the small view then shows its title alone. */
  lead: string;
  /** The address readers reach it at, where the destination has one of its
   *  own. `null` for a destination with no host to state — never an empty
   *  string, which would read as an address. */
  readerHost: string | null;
}

/** Which sentence the card states, and what fills it. The view formats the
 *  numbers (`present.ts` is the one path from a `Measured` to a string); this
 *  is the choice of arm and the values it needs. */
export type WaitingReason =
  | { key: "overview.waiting.why.answered-by"; search: string; volume: Measured<number>; rival: string }
  | { key: "overview.waiting.why.not-high-enough"; search: string; volume: Measured<number> }
  | { key: "overview.waiting.why.search"; search: string }
  | { key: "overview.waiting.why.fix" };

export interface WaitingPage {
  draftId: string;
  title: string;
  /** The stage word, from the calendar's own five (`calendar.stage.*`) —
   *  one vocabulary for a page's standing, spoken the same on every screen. */
  stageKey: CopyKey;
  goesLiveAt: Date | null;
  reason: WaitingReason;
  /** The chips beside the stage: new page or update, and the band this
   *  search falls in where the pass read one. Keys, never words. */
  badges: readonly CopyKey[];
  lead: string;
  readerHost: string | null;
  /** The one address both controls act on: *Read it* opens it, *Stop this
   *  page* moves it. */
  href: string;
}

const STAGE_KEY: Readonly<Record<WaitingStage, CopyKey>> = Object.freeze({
  your_review: "calendar.stage.your-review",
});

/**
 * The page in review, resolved.
 *
 * The arms, in the order they are asked:
 *
 *  1. **No target at all** — a Fix page. It has no search, no demand and no
 *     band, so it states what a Fix is and draws no band chip.
 *  2. **A search with no demand read back.** `volume` is `unmeasured`, so no
 *     number may be stated about it; the sentence names the search alone.
 *  3. **A rival holds the answer** — a Write or Earn target, whose evidence
 *     recorded the rival it is written to overtake.
 *  4. **Nobody else holds it** — an Improve target, which is the customer's
 *     own page not standing high enough.
 */
export function readWaitingPage(facts: WaitingPageFacts): WaitingPage {
  const badges: CopyKey[] = [
    facts.update ? "overview.waiting.badge.update" : "overview.waiting.badge.new",
  ];
  if (facts.target !== null) badges.push(BAND_LABELS.winnability[facts.target.winnability]);

  return {
    draftId: facts.draftId,
    title: facts.title,
    stageKey: STAGE_KEY[facts.stage],
    goesLiveAt: facts.goesLiveAt,
    reason: reasonOf(facts.target),
    badges,
    lead: facts.lead,
    readerHost: facts.readerHost,
    href: `/app/draft/${facts.draftId}`,
  };
}

function reasonOf(target: WaitingTarget | null): WaitingReason {
  if (target === null) return { key: "overview.waiting.why.fix" };
  if (target.volume.kind === "unmeasured") {
    return { key: "overview.waiting.why.search", search: target.search };
  }
  const rival = target.answeredTodayBy[0];
  if (rival !== undefined) {
    return {
      key: "overview.waiting.why.answered-by",
      search: target.search,
      volume: target.volume,
      rival,
    };
  }
  return {
    key: "overview.waiting.why.not-high-enough",
    search: target.search,
    volume: target.volume,
  };
}
