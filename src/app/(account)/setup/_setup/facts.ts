// BUILD §4.3 — everything the setup screen reads, before it is a model.
//
// One shape, so a fixture and a future query answer the same question —
// the idiom `src/app/(account)/app/_shell/model.ts` already establishes for
// the app shell. `assembleSetup` is pure: facts in, model out. The reading
// of those facts is `provider.ts`'s, and today it reads `fixture.ts`.
import {
  initialSetupState,
  onMarketConcluded,
  onRivalsConcluded,
  type ReportFacts,
  type SetupState,
} from "@/lib/market/setup/state";
import type { RivalSet } from "@/lib/market/setup/rivals";
import { FIRST_STEP, isSetupStep, type SetupStepId } from "../steps";
import { setupCards, type SetupCards } from "@/lib/publish/setup/cards";
import { BATTERY } from "@/lib/config/constants";
import type { SiteProfile } from "@/lib/site-profile/types";
import type { BusinessEdits, BusinessProfile } from "@/lib/site-profile/business/types";
import { confirmedProfile, type MarketReading } from "@/lib/site-profile/business/confirm";
import type { StoredQuestion } from "@/lib/scan/report";
import type { DerivableMarket } from "@/lib/market/questions/rederive";
import type { RivalGrid } from "./panel-rivals";
import type { OnboardingStage } from "@/lib/scan/deep/progress";

/** SPEC §5: the twelve questions the scan phrased for the measured market,
 *  shown read-only, and the scan they belong to. */
export interface SetupQuestions {
  scanId: string;
  items: readonly StoredQuestion[];
  /** §12 ruling 4: what a corrected category re-derives the twelve over —
   *  the market this scan already bought. `null` where it measured none,
   *  and then a correction derives nothing rather than guessing. */
  derivable: DerivableMarket | null;
}

export interface SetupFacts {
  /** REQ-021 c6 versus c7. A completed report for the address the account
   *  will use — whether or not it was the report the purchase came from —
   *  or `null` for a purchase with no report behind it, in which case the
   *  address field is empty and nothing is pre-filled from the payment. */
  measured: { domain: string; report: ReportFacts } | null;
  /** D28 (#1185): the market and rivals ReachKit already concluded for
   *  this site, each with its reason, or `null` where it has concluded none
   *  yet — and then the rivals card opens seeking. */
  concluded: {
    category: string;
    reason: string;
    rivals: readonly { domain: string; reason: string }[];
  } | null;
  /** SPEC §5's read-only questions for the measured market, or `null`
   *  where no report phrased any. */
  questions: SetupQuestions | null;
  /** §9's edge hostname, from `HOSTED_EDGE_CNAME_TARGET`. Read by the
   *  provider, never by the cards. */
  cnameTarget: string;
  /** SPEC.md §5 (2026-09-12), "The site profile is confirmed here": what
   *  the scan read of this site — the inventory, the site name and the
   *  brand-voice summary. `null` where no scan has built one for this
   *  domain yet, and then the card does not render: a profile card with
   *  no profile in it would state a reading nobody made. */
  profile: SiteProfile | null;
  /** SPEC §5 and §7 (2026-09-20, #970): the other two readings step two's
   *  lists are made of — the market's four fields, and the customer's own
   *  decisions over both. `null` and `NO_EDITS` are the ordinary states of
   *  a founder whose market has not been measured and who has corrected
   *  nothing; the step then shows what the crawl read, which is what it
   *  showed before it had a store. */
  market: MarketReading | null;
  edits: BusinessEdits;
  /** SPEC §5 (2026-09-20, #922): what this founder has already answered and
   *  which step they left. `null` for a founder with nothing saved — the
   *  screen then opens on its first step with only what the scan read. */
  saved: SavedAnswers | null;
  /** SPEC §5 (2026-09-20, #923): the rivals step's own panel — the searches
   *  the scan measured × the customer and each rival. `null` where nothing
   *  has been measured for this address, and the panel then draws a shape
   *  and says so rather than a grid of empty dots. */
  rivalGrid: RivalGrid | null;
  /** The pass's step as the server knows it, and the channel the browser
   *  may watch for the next one (#923). */
  passStage: OnboardingStage | null;
  passChannel: string | null;
}

/** The shape `_setup/store.ts`'s `savedSetupFor` answers with, declared
 *  here so `assembleSetup` stays pure and testable without a database. */
export interface SavedAnswers {
  category: string | null;
  competitors: readonly string[];
  voiceText: string | null;
  step: string | null;
}

export interface SetupScreenModel {
  state: SetupState;
  cards: SetupCards;
  /** §9's edge hostname, carried onto the model (SPEC §5, 2026-09-12).
   *
   *  The record is no longer a fact the server can settle alone: its name
   *  is `<label>.<domain>` and both halves move while the founder is on
   *  the screen — they type their address, and they choose their label. So
   *  the screen composes it, and the one thing it cannot derive is the
   *  target the record points at. It is a deployment binding, not a
   *  sentence and not a secret. */
  cnameTarget: string;
  /** The profile, carried through unchanged. Nothing is derived from it
   *  here: the chips' counts are `purposeCounts`'s, over the inventory. */
  profile: SiteProfile | null;
  /** SPEC §5 and §7 (2026-09-20, #970): the same confirmed business profile
   *  Settings › Your business draws — the crawl's reading and the market's,
   *  with the customer's removals and additions applied. Step two's four
   *  lists open on it, so a correction made in Settings is already here. */
  business: BusinessProfile;
  /** REQ-026 c9: the limit is stated on screen, so the screen is given it
   *  rather than spelling the number itself. */
  competitorsMax: number;
  questions: SetupQuestions | null;
  /** What the voice box opens on: the founder's own words where a voice
   *  step has stored some, else the paragraph the scan read, else empty. */
  voiceText: string;
  /** SPEC §5 (2026-09-20): the step `/setup` opens on when the address
   *  carries no `?step=` of its own. */
  openAt: SetupStepId;
  /** #923's rivals panel, carried through unchanged. Nothing is derived
   *  from it here: `rivalGridOf` is its one derivation and it is pure. */
  rivalGrid: RivalGrid | null;
  /** The step the pass was on when the server rendered, or `null` where no
   *  pass is running (#923). The status line opens on this and is only ever
   *  *replaced* by something newer, so it never starts empty and never
   *  shows a spinner in front of a fact the server already had. */
  passStage: OnboardingStage | null;
  /** The founder's own realtime channel name, composed on the server from
   *  the session's site. `null` where there is no site row yet, and the
   *  line then simply does not subscribe. */
  passChannel: string | null;
}

export function assembleSetup(facts: SetupFacts): SetupScreenModel {
  const opened = initialSetupState(facts.measured);
  const c = facts.concluded;
  const settled =
    c === null
      ? opened
      : onRivalsConcluded(
          onMarketConcluded(opened, { category: c.category, reason: c.reason }),
          c.rivals.map((rival) => rival.domain),
          Object.fromEntries(c.rivals.map((rival) => [rival.domain, rival.reason])),
          BATTERY.COMPETITORS_MAX
        );
  const state = restored(settled, facts.saved);

  return {
    state,
    cards: setupCards({ siteDomain: state.siteDomain, cnameTarget: facts.cnameTarget }),
    cnameTarget: facts.cnameTarget,
    profile: facts.profile,
    // Pure, over the three readings the provider handed in: the same
    // function Settings applies, so neither screen has a second answer to
    // what this business sells.
    business: confirmedProfile({
      profile: facts.profile,
      market: facts.market,
      edits: facts.edits,
    }),
    competitorsMax: BATTERY.COMPETITORS_MAX,
    questions: facts.questions,
    voiceText: facts.saved?.voiceText ?? facts.profile?.voice?.text ?? "",
    openAt: openAtFor(facts.saved),
    rivalGrid: facts.rivalGrid,
    passStage: facts.passStage,
    passChannel: facts.passChannel,
  };
}

/**
 * SPEC §5 (2026-09-20, issue 922): "Each step saves as it is left so a
 * reload resumes." A founder who answered the site step and came back is
 * shown their own market and their own rivals, not the scan's reading of
 * them again.
 *
 * A saved category that is the one the scan inferred leaves the market card
 * *inferred*, so the report's own rivals stay on offer; a category the
 * founder changed makes it *stated*, which is what it was when they left.
 *
 * **Restoring a market buys nothing.** `onMarketStated` is deliberately not
 * used here: it puts the rivals card back into `seeking`, and a founder who
 * reloads `/setup` five times would spend five suggestion calls against
 * their own pass. The suggestions this read already settled are kept as
 * they are, and only a card that never had a market to seek against — a
 * purchase with no report behind it — is moved to `seeking`, once.
 */
function restored(state: SetupState, saved: SavedAnswers | null): SetupState {
  if (saved === null) return state;

  const category = saved.category?.trim() ?? "";
  const keepMarket =
    category === "" || (state.market.state !== "empty" && state.market.category === category);
  const withMarket: SetupState = keepMarket
    ? state
    : {
        ...state,
        market: { state: "stated", category },
        suggestions:
          state.suggestions.state === "awaiting_market"
            ? { state: "seeking", candidates: Object.freeze([]) }
            : state.suggestions,
      };

  if (saved.competitors.length === 0) return withMarket;
  const offered = new Set(withMarket.suggestions.candidates);
  const rivals: RivalSet = Object.freeze(
    saved.competitors.map((domain) =>
      Object.freeze({ domain, origin: offered.has(domain) ? ("suggested" as const) : ("typed" as const) })
    )
  );
  return { ...withMarket, rivals };
}

/** The step the screen opens on. An unknown handle — a row written by a
 *  build that named its steps differently — reads as the beginning, which
 *  is the answer that can never strand a founder. */
function openAtFor(saved: SavedAnswers | null): SetupStepId {
  const step = saved?.step;
  return isSetupStep(step) ? step : FIRST_STEP;
}
