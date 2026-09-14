// BUILD §4.1 module 6 — the pricing card
//
// The price, four spec rows, the start control and the cancel line. This
// is the one place on the report where a payment is named; nothing above
// it is hidden, blurred, rounded down, locked or marked as available on
// payment (REQ-004 c5), so there is no tier parameter anywhere on this
// screen to pass.
//
// This module mints no copy key: all eight sentences are `offer.ts`'s,
// ruled by the owner on 2026-09-04. The one number it renders that is a
// pin rather than an owner string is the veto window — `VETO.defaultHours`
// — which travels into `offer.veto.window.value`'s `{hours}` slot, so
// "24h veto" is written down once, in `constants.ts`.
//
// The start control is a link to checkout in the shipped journey (§3, §13,
// issue #33). Until that lands it is a control with no destination rather
// than an invented one.
//
// **It is the report's one solid primary** (DESIGN rule 1). Start keeps
// the fill because it is the paying path; the free-page control is outline.
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
// identical either way; only where Start goes differs, and the report
// screen passes nothing and is unchanged.
import type React from "react";
import { Check } from "lucide-react";
import { VETO } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../_address/measured";

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
    copy("offer.cadence.page", { value: copy("offer.cadence.page.value") }),
    copy("offer.cadence.measure", { value: copy("offer.cadence.measure.value") }),
    copy("offer.cadence.movement", { value: copy("offer.cadence.movement.value") }),
    copy("offer.veto.window", {
      value: copy("offer.veto.window.value", { hours: String(VETO.defaultHours) }),
    }),
  ],
  pricing: () => [
    copy("offer.pricing.page"),
    copy("offer.pricing.measure"),
    copy("offer.pricing.movement"),
    // The window is the pin's, in both wordings: one home, two sentences.
    copy("offer.pricing.veto", { hours: String(VETO.defaultHours) }),
  ],
};

export function PricingCard(
  p: { startAction?: () => Promise<void>; terms?: OfferTerms; refused?: boolean } = {}
): React.JSX.Element {
  const specs = TERM_LINES[p.terms ?? "report"]();
  const start = (
    <button
      type={p.startAction ? "submit" : "button"}
      className="btn btn-primary btn-block"
    >
      {copy("offer.start.priced")}
    </button>
  );

  return (
    // Headless: the card opens on the price, which is its answer.
    <section className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-4">
        {/* REQ-022 c1: "€49 per month and says that VAT is included". */}
        <div className="flex flex-wrap items-baseline justify-center gap-2 text-center">
          <div className="text-5xl font-semibold">
            <Num>{copy("price.amount")}</Num>
          </div>
          <span className="text-base-content/60 text-sm font-semibold">{copy("price.interval")}</span>
        </div>

        <ul className="flex list-none flex-col p-0 text-left">
          {specs.map((line) => (
            <li
              key={line}
              className="border-base-300 flex items-center gap-3 border-t py-2 text-sm first:border-t-0"
            >
              <Check size={16} strokeWidth={1.75} className="text-success shrink-0" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {/* Issue #624: the vendor refused to open checkout. One written line
            on the offer itself, above the control that will try again. */}
        {p.refused ? (
          <div role="alert" className="alert alert-error">
            <span>{copy("offer.checkout.refused")}</span>
          </div>
        ) : null}

        {p.startAction ? <form action={p.startAction}>{start}</form> : start}
        <p className="text-base-content/60 grow-0 text-center text-xs">
          {copy("offer.cancel_self_service")}
        </p>
      </div>
    </section>
  );
}
