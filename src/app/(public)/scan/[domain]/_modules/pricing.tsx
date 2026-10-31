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
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { VETO, WEEK_PLAN } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { HOW_FACTS } from "@/app/(public)/_how/facts";
import { FLOAT } from "@/ui/lift";
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
    copy("offer.cadence.page", { weekPages: WEEK_PLAN.days }),
    copy("pricing.plan.checked"),
    copy("offer.cadence.movement"),
    copy("offer.veto.window"),
  ],
  pricing: () => [
    copy("landing.pace", { weekPages: WEEK_PLAN.days }),
    copy("pricing.plan.chosen"),
    copy("pricing.plan.checked"),
    copy("pricing.plan.mail"),
    // The window is the pin's, in both wordings: one home, two sentences.
    copy("offer.pricing.veto", { hours: String(VETO.defaultHours) }),
  ],
};


/** The price, the terms where this shape puts them under it, the refusal
 *  line where there is one, Start, and the cancel line under it. */
function PriceBox(p: {
  start: React.ReactNode;
  cancel: string;
  refused?: boolean;
  terms?: React.ReactNode;
  note?: React.ReactNode;
  free?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {/* REQ-022 c1: "€49 per month and says that VAT is included". */}
      <div className="flex flex-wrap items-baseline justify-center gap-2 text-center">
        <span className="text-5xl leading-none">
          <Num figure>{copy("price.amount")}</Num>
        </span>
        <span className="text-base-content/70 text-sm">{copy("price.interval")}</span>
      </div>
      {p.note ?? null}
      {p.terms ?? null}
      {/* Issue #624: the vendor refused to open checkout. One written line
          on the offer itself, above the control that will try again. */}
      {p.refused ? (
        <div role="alert" className="alert alert-error">
          <span>{copy("offer.checkout.refused")}</span>
        </div>
      ) : null}
      {p.start}
      <p className="text-base-content/70 flex grow-0 items-center justify-center gap-1.5 text-xs">
        <ShieldCheck size={14} strokeWidth={1.75} aria-hidden />
        {p.cancel}
      </p>
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

export function PricingCard(
  p: {
    startAction?: () => Promise<void>;
    terms?: OfferTerms;
    refused?: boolean;
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

  if (p.close === true) {
    return (
      <section className={`card bg-base-100 ${FLOAT}`}>
        <div className="card-body gap-8 p-6 md:p-10 lg:flex-row lg:items-center lg:gap-12">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <h2 className="text-3xl font-bold">{p.heading ?? copy("offer.close.heading")}</h2>
            {p.line === undefined ? null : <p className="max-w-prose">{p.line}</p>}
            <Terms specs={specs} />
            <p className="text-base-content/70 flex flex-wrap gap-x-1 text-sm">
              <span>{copy("how.steps.part", { minutes: String(HOW_FACTS.setupMinutes) })}</span>
              <a href="/how-it-works#you-do" className="link link-primary inline-flex items-center gap-1 font-semibold">
                {copy("how.steps.part.more")}
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
              </a>
            </p>
          </div>
          <div className="bg-primary/5 rounded-box ring-primary/15 shrink-0 p-6 ring-1 lg:w-96">
            <PriceBox start={control} cancel={cancel} refused={p.refused} free={p.free} />
          </div>
        </div>
      </section>
    );
  }

  // The report's card opens on the price; the pricing page's names the plan
  // and how it is billed first (board Pricing).
  const named = terms === "pricing";
  return (
    <section className={`card bg-base-100 ${FLOAT}`}>
      <div className="card-body">
        {named ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title">{copy("chrome.wordmark")}</h2>
            <span className="badge badge-soft badge-primary">{copy("pricing.plan.badge")}</span>
          </div>
        ) : null}
        <PriceBox
          start={control}
          cancel={cancel}
          refused={p.refused}
          terms={<Terms specs={specs} />}
          note={
            named ? (
              <p className="text-base-content/70 text-center text-sm">
                {copy("pricing.plan.billing")}
              </p>
            ) : null
          }
          free={p.free}
        />
      </div>
    </section>
  );
}
