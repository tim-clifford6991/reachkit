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
// **It is the report's one solid primary** (owner's ruling on issue #291).
// The screen had two filled accent buttons — this one and the free-page
// card's submit — and §9.1 gives a screen one. Start keeps the fill because
// it is what the screen is for; the free-page control takes the outline
// rank in accent and says so in its own header. Nothing changes here: the
// ruling is recorded on the control it kept, so the next reader of this
// file does not re-open it.
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
import { Btn, Card } from "@/ui/components";
import { VETO } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../_address/measured";

/** The price, at the ladder's big-figure rung — the one headline number
 *  this card carries. */
const PRICE_SIZE: React.CSSProperties = { fontSize: "var(--t-num-big)", lineHeight: 1.05 };

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
  p: { startAction?: () => Promise<void>; terms?: OfferTerms } = {}
): React.JSX.Element {
  const specs = TERM_LINES[p.terms ?? "report"]();

  return (
    // No card head. The approved set draws this card headless on both
    // surfaces that carry it (UI-SPEC S2 module 6, S4): it opens on the
    // price, which is the answer §2.5 says a card leads with, and an
    // eyebrow above it would name the card the button already names.
    <Card state="default" title={null}>
      {/* REQ-022 c1: "€49 per month and says that VAT is included". The
          amount is the ladder's big figure and the terms sit on its
          baseline beside it. Centred, as the set draws the whole card. */}
      <div className="flex flex-wrap items-baseline justify-center gap-2 text-center">
        <div className="font-semibold" style={PRICE_SIZE}>
          <Num>{copy("price.amount")}</Num>
        </div>
        <span className="t-sm font-semibold text-[color:var(--ink-quiet)]">{copy("price.interval")}</span>
      </div>

      {/* The four the offer states, each with the set's own check mark in
          `--ok` and a hairline between them — a list of what is included,
          which is what a tick means and the one place `--ok` is not a
          state on this screen. The glyph is decorative: every row says in
          writing what it includes. */}
      <ul className="flex list-none flex-col p-0 text-left">
        {specs.map((line) => (
          <li
            key={line}
            className="border-base-300 t-sm flex items-center gap-3 border-t py-2 first:border-t-0"
          >
            <Check size={15} strokeWidth={2.4} className="text-success shrink-0" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {p.startAction ? (
        <form action={p.startAction}>
          <Btn label={copy("offer.start.priced")} variant="primary" pill block type="submit" />
        </form>
      ) : (
        <Btn label={copy("offer.start.priced")} variant="primary" pill block />
      )}
      <p className="t-explain text-center text-[color:var(--ink-quiet)]">{copy("offer.cancel_self_service")}</p>
    </Card>
  );
}
