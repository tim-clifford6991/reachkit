// BUILD §4.1 module 6 — the pricing card
//
// The price, four spec rows, the start control and the cancel line. This
// is the one place on the report where a payment is named; nothing above
// it is hidden, blurred, rounded down, locked or marked as available on
// payment (REQ-004 c5), so there is no tier parameter anywhere on this
// screen to pass.
//
// This module mints no copy key: its sentences are `offer.ts`'s. The
// pricing page's veto line takes `VETO.defaultHours` through its `{hours}`
// slot, so the window is written down once, in `constants.ts`; the report's
// says no hours, because the window can be set.
//
// The start control begins checkout (§3, §13): on the report its origin is
// the report's scan (issue #785), on `/pricing` it is scanless.
//
// **It is the report's one solid primary** (DESIGN rule 1). Start keeps
// the fill because it is the paying path; the free-page control is soft.
//
// daisyUI in the route: `card`, `alert`, `btn`; lucide for the ticks.
//
// `refused` is the same additive shape as `startAction`: the surface that
// can start a checkout is the surface that can be refused one, and the line
// belongs to the offer rather than to either page's own frame.
//
// 2026-09-05, issue #19: `startAction` is how the *other* surface that
// carries this offer — `/pricing`, the scanless one — gives that control
// its destination. REQ-021 criterion 4 says that surface states the terms
// "on the same terms the offer at the end of a report states (criterion
// 2)"; the strongest reading of that is one component, rendered twice, so
// the two cannot drift by construction. Everything above the control is
// identical either way; only where Start goes differs — the report screen
// passes its own report-origin action (issue #785).
import type React from "react";
import { Suspense } from "react";
import { ArrowRight, Check } from "lucide-react";
import { OFFER_ENDS_ON, OFFER_SPOTS, SETUP_MINUTES, VETO, WEEK_PLAN } from "@/lib/config/constants";
import type { SpotsLeft } from "@/lib/account/offer/spots";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { HOW_FACTS } from "@/app/(public)/_how/facts";
import { BrandMark } from "@/app/_brand/Brand";
import { FLOAT } from "@/ui/lift";
import { offerOf } from "../../../_chrome/offer-sentence";
import { Num } from "../_address/measured";
import { WhenRefused } from "../../../pricing/refused";
import type { CheckoutRefusal } from "../../../pricing/state";
import { FirstFifty } from "./first-fifty";
import { BarStart, OfferBar } from "./offer-bar";

/** The static pricing page's `refused`: the marker is read in the browser. */
export const REFUSED_IN_QUERY = "query" as const;

type Refused = CheckoutRefusal | null | typeof REFUSED_IN_QUERY;

/** Each refusal's line: the vendor's, or the visitor's network past the checkout limit. */
const REFUSAL_LINE = { refused: "offer.checkout.refused", limited: "offer.checkout.refused.limit" } as const satisfies Record<CheckoutRefusal, CopyKey>;

/** Which of the two approved wordings of the same four terms this card
 *  states.
 *
 *  `report` is the owner's ruling of 2026-09-04 — the four slotted
 *  `offer.cadence.*`/`offer.veto.*` lines, written for the end of a report.
 *  `pricing` is UI-SPEC S4's, which the approved set spells out
 *  unbracketed and ruling 11a therefore makes approved copy (issue #369).
 *
 *  **Same four facts, two sentences each.** Nothing about what is offered
 *  differs, which is what keeps REQ-021 c4's "on the same terms" true
 *  across the two screens; and neither wording is a draft of the other, so
 *  a ruling is not re-opened by a later drawing. It is not a tier, a
 *  parameter or a branch on identity: it is which screen is speaking. */
export type OfferTerms = "report" | "pricing";

const TERM_LINES: Readonly<Record<OfferTerms, () => readonly string[]>> = {
  report: () => [
    copy("offer.cadence.page", { weekPages: WEEK_PLAN.days }),
    copy("offer.cadence.movement"),
    copy("offer.veto.window"),
  ],
  pricing: () => [
    copy("landing.pace", { weekPages: WEEK_PLAN.days }),
    copy("pricing.plan.chosen"),
    copy("pricing.plan.rivals", { rivals: String(HOW_FACTS.rivals) }),
    copy("pricing.plan.mail"),
    // The window is the pin's, in both wordings: one home, two sentences.
    copy("offer.pricing.veto", { hours: String(VETO.defaultHours) }),
  ],
};


/** The price, the terms where this shape puts them under it, the refusal
 *  line where there is one, Start, and the cancel line under it. */
function PriceBox(p: {
  start: React.ReactNode;
  /** The pricing page's card sets the price flush left, as its board does. */
  left?: boolean;
  /** The report's close: a rule sets the free path apart. */
  close?: boolean;
  cancel: string;
  refused?: Refused;
  terms?: React.ReactNode;
  offer: React.ReactNode;
  free?: React.ReactNode;
}): React.JSX.Element {
  const refusedLine = (refusal: CheckoutRefusal): React.JSX.Element => (
    <div role="alert" className="alert alert-error">
      <span>{copy(REFUSAL_LINE[refusal])}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      {/* The price alone: no tax wording, for every buyer. */}
      <div className={`flex flex-wrap items-baseline gap-2 ${p.left === true ? "" : "justify-center text-center"}`}>
        <span className="text-5xl leading-none">
          <Num figure>{copy("price.amount")}</Num>
        </span>
        <span className="text-base-content/70 text-sm">{copy("price.interval")}</span>
      </div>
      {p.terms ?? null}
      {p.offer}
      {/* Issue #624: the vendor refused to open checkout. One written line
          on the offer itself, above the control that will try again. */}
      {p.refused === REFUSED_IN_QUERY ? (
        <Suspense fallback={null}>
          <WhenRefused lines={{ refused: refusedLine("refused"), limited: refusedLine("limited") }} />
        </Suspense>
      ) : p.refused ? (
        refusedLine(p.refused)
      ) : null}
      {p.start}
      <p className="text-base-content/70 text-center text-xs">{p.cancel}</p>
      {p.close === true && p.free !== undefined ? <div className="divider my-0" /> : null}
      {p.free ?? null}
    </div>
  );
}

function Terms(p: { specs: readonly string[] }): React.JSX.Element {
  return (
    <ul className="flex list-none flex-col gap-3 p-0 text-left">
      {p.specs.map((line) => (
        <li key={line} className="flex items-start gap-2.5">
          <Check size={16} strokeWidth={1.75} className="text-success mt-1 shrink-0" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

/** The first-50 block, the setup promise every buyer gets, and the spots line directly above Start. */
function Offer(p: { spots: SpotsLeft | null | undefined; built: boolean }): React.JSX.Element {
  const promise = <p className="text-sm font-semibold">{copy("offer.promise.call", { minutes: String(SETUP_MINUTES) })}</p>;
  if (p.spots === undefined) return promise;
  const of = String(OFFER_SPOTS);
  const block = (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <div>
        <h3 className="text-base font-semibold">{copy("offer.card.title", { of })}</h3>
        <p className="text-base-content/70 text-sm">{copy("offer.card.until", { endsOn: OFFER_ENDS_ON })}</p>
      </div>
      <Terms specs={[copy("offer.card.setup"), copy("offer.card.video"), copy("offer.card.checkins"), copy("offer.card.email")]} />
    </div>
  );
  return (
    <FirstFifty read={p.built} offer={offerOf(p.spots, p.built)} block={block} promise={promise} before={copy("offer.spots.before", { of, endsOn: OFFER_ENDS_ON })} />
  );
}

/** The phone offer bar: `startAction` is the page's own checkout start, posted from a second form. */
export function PhoneOfferBar(p: {
  startAction: () => Promise<void>;
  spots: SpotsLeft | null;
  built: boolean;
  refused?: Refused;
}): React.JSX.Element {
  return (
    <OfferBar
      read={p.built}
      offer={offerOf(p.spots, p.built)}
      words={{
        before: copy("offer.spots.before", { of: String(OFFER_SPOTS), endsOn: OFFER_ENDS_ON }),
        promise: copy("offer.banner.promise", { minutes: String(SETUP_MINUTES) }),
        refused: { refused: copy(REFUSAL_LINE.refused), limited: copy(REFUSAL_LINE.limited) },
      }}
      refused={p.refused}
      start={
        <form action={p.startAction}>
          <BarStart label={copy("offer.start.priced")} />
        </form>
      }
    />
  );
}

export function PricingCard(
  p: {
    startAction?: () => Promise<void>;
    terms?: OfferTerms;
    refused?: Refused;
    /** The report's price close (#1068, board `R12-2-Report`): a heading and
     *  the terms on the left, the price and Start in a panel on the right.
     *  The same component and the same facts; only the shape is wider. */
    close?: boolean;
    /** The close's heading, where the report has a sharper one than the offer's. */
    heading?: string;
    /** The one line under that heading. */
    line?: string;
    /** The free path, under Start. */
    free?: React.ReactNode;
    /** The read of the first-50 spots, `null` where it failed; without one no first-50 block is drawn. */
    spots?: SpotsLeft | null;
    /** The read was made at build, so the browser fills the count and any state that moved since. */
    built?: boolean;
  } = {}
): React.JSX.Element {
  const terms = p.terms ?? "report";
  const specs = TERM_LINES[terms]();
  const cancel = copy("pricing.plan.cancel");
  const start = (
    <button type={p.startAction ? "submit" : "button"} className="btn btn-primary btn-lg btn-block">
      {copy("offer.start.priced")}
      <ArrowRight size={18} strokeWidth={1.75} aria-hidden />
    </button>
  );
  const control = p.startAction ? <form action={p.startAction}>{start}</form> : start;
  const offer = <Offer spots={p.spots} built={p.built === true} />;
  // Below `md` the same action, in a second form, stays in reach once the card's Start scrolls away.
  const bar = p.startAction ? <PhoneOfferBar startAction={p.startAction} spots={p.spots ?? null} built={p.built === true} refused={p.refused} /> : null;

  if (p.close === true) {
    return (
      <section className="card border border-(--accent-line) bg-(--accent-bg)">
        <div className="card-body gap-8 p-5 md:p-10 lg:flex-row lg:items-center lg:gap-12">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <h2 className="text-3xl font-bold">{p.heading ?? copy("offer.close.heading")}</h2>
            {p.line === undefined ? null : <p className="max-w-prose">{p.line}</p>}
            <Terms specs={specs} />
            <p className="text-base-content/70 text-sm">{copy("how.steps.part")}</p>
          </div>
          <div className={`bg-base-100 rounded-box shrink-0 p-6 lg:w-96 ${FLOAT}`}>
            <PriceBox start={control} close cancel={cancel} refused={p.refused} offer={offer} free={p.free} />
          </div>
        </div>
        {bar}
      </section>
    );
  }

  // The report's card opens on the price; the pricing page's names the plan first.
  const named = terms === "pricing";
  return (
    <section className={`card bg-base-100 ${FLOAT}`}>
      <div className="card-body">
        {named ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title">
              <BrandMark />
              {copy("chrome.wordmark")}
            </h2>
            <span className="badge badge-soft badge-primary font-semibold">{copy("pricing.plan.badge")}</span>
          </div>
        ) : null}
        <PriceBox
          start={control}
          left={named}
          cancel={cancel}
          refused={p.refused}
          terms={<Terms specs={specs} />}
          offer={offer}
          free={p.free}
        />
      </div>
      {bar}
    </section>
  );
}
