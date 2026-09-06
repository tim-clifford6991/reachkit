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
// 2026-09-05, issue #19: `startAction` is how the *other* surface that
// carries this offer — `/pricing`, the scanless one — gives that control
// its destination. REQ-021 criterion 4 says that surface states the terms
// "on the same terms the offer at the end of a report states (criterion
// 2)"; the strongest reading of that is one component, rendered twice, so
// the two cannot drift by construction. Everything above the control is
// identical either way; only where Start goes differs, and the report
// screen passes nothing and is unchanged.
import type React from "react";
import { Btn, Card } from "@/ui/components";
import { VETO } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../_address/measured";

export function PricingCard(p: { startAction?: () => Promise<void> } = {}): React.JSX.Element {
  const specs = [
    copy("offer.cadence.page", { value: copy("offer.cadence.page.value") }),
    copy("offer.cadence.measure", { value: copy("offer.cadence.measure.value") }),
    copy("offer.cadence.movement", { value: copy("offer.cadence.movement.value") }),
    copy("offer.veto.window", {
      value: copy("offer.veto.window.value", { hours: String(VETO.defaultHours) }),
    }),
  ];

  return (
    <Card state="default" title={<span>{copy("offer.start")}</span>}>
      <div className="flex flex-wrap items-baseline gap-2">
        <div className="text-4xl font-bold">
          <Num>{copy("price.amount")}</Num>
        </div>
        <span className="opacity-60">{copy("price.interval")}</span>
      </div>
      <ul className="flex list-none flex-col gap-2 p-0">
        {specs.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {p.startAction ? (
        <form action={p.startAction}>
          <Btn label={copy("offer.start")} variant="primary" block type="submit" />
        </form>
      ) : (
        <Btn label={copy("offer.start")} variant="primary" block />
      )}
      <p className="text-xs opacity-60">{copy("offer.cancel_self_service")}</p>
    </Card>
  );
}
