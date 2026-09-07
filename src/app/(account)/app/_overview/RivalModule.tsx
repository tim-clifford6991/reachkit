// BUILD §4.5 — how far ahead each rival is, in both arms.
//
// §4.5 item 4: "per rival — name · falling sparkline (gray, accent
// endpoint) · `78×` big mono · `was 276×` success badge. One dim line:
// 'Every line pointing down is the gap shrinking.'"
//
// **The series colour is not this file's to choose, and that is the point.**
// `RivalSparkline`'s props accept no `Tone` at all, so §2.5's "rival
// strength is neutral gray, never red" is not a convention a reviewer has
// to catch here — there is no prop to break it with. What this file passes
// is a name, a written value and the points.
//
// **The cold-start arm says something different.** Below `RATIO_UNLOCK` the
// module renders the rivals' absolute counts beside the customer's own —
// which is a `ContextValue` and renders bare, because §4.5's never-bare rule
// binds headline numbers and says so — and the line it states is
// `lineKey`, which the resolver guarantees is not the gap-shrinking one.
// Nothing is shrinking yet; saying it were would be the module's one
// available lie.
//
// **The figure arrives already written.** `78×` and `was 276×` are composed
// from registry keys with the number in a slot, so no `×` character is
// written at a call site and the chart never divides.
import type React from "react";
import { RivalSparkline } from "@/ui/charts";
import { Badge } from "@/ui/components";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { SwapOffer } from "@/lib/market/rivals/offer";
import type { Tone } from "@/ui/types";
import { DESTINATION_HREF } from "../_shell/destinations";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { renderValue } from "./present";
import type { RatioRival, RivalGapModule } from "./rivals";
import { CARRY, CHART_BOX, EYEBROW, MODULE, OFFER, RIVAL_ENTRY, RIVAL_ROW, STACK } from "./style";

/** §2.5: the badge on a rival row reports the customer's own progress —
 *  the gap that used to be — so it is a success state, never an alarm. */
const WAS_TONE: Tone = "ok";
const RIVAL_LABEL = "overview.rivals.title" satisfies CopyKey;

/** Where `SwapOffer.destination` goes. A `Record` over the handle's own
 *  union, so a second destination is a compile error here rather than a
 *  control that leads nowhere — and the address itself is
 *  `DESTINATION_HREF`'s, written once for the whole app (issue #223). */
const SWAP_HREF: Record<Extract<SwapOffer, { offered: true }>["destination"], string> = {
  "settings.competitors": DESTINATION_HREF.settings,
};

/**
 * REQ-096 c6, under the rival it is about.
 *
 * **Under that rival's own row, and never at the head of the module.** c6
 * says "the same place", and a banner over the set would be a statement
 * about every rival in it — which is what c7 forbids the product implying.
 * The other rows are untouched: the far rival keeps its row, its plot and
 * its figure, and nothing here removes, hides or reorders it.
 *
 * **One control, and it is a link.** `Btn` is a `<button>` with an
 * `onClick`; this navigates to the competitors card, where the customer
 * makes the change themselves. It names no replacement and offers no
 * removal — `swapOffer` carries a destination and a rival and has nowhere
 * to put either.
 *
 * **Both sentences or neither.** This screen renders nothing for a key the
 * owner has not written — not the key, not a placeholder, not a `TODO`
 * (`page.test.tsx` asserts it over the whole document) — and a control
 * with no label is not a control. So while either sentence is owed the far
 * rival's row is exactly the row every other rival gets, and the offer
 * appears the moment both are written, with no code change.
 */
function Offer(p: { offer: SwapOffer }): React.JSX.Element | null {
  if (!p.offer.offered) return null;
  const line = writtenLine("overview.rivals.far.line", { rival: p.offer.rival });
  const control = writtenLine("overview.rivals.far.swap");
  if (line === null || control === null) return null;
  return (
    <div style={OFFER}>
      <p className="rk-prov">{line}</p>
      {/* A link that reads as a button, the same case and the same daisyUI
          pair `WeekModule` states its reason for. */}
      <a href={SWAP_HREF[p.offer.destination]} className="btn btn-sm btn-ghost">
        {control}
      </a>
    </div>
  );
}

/** A rival's plot and its written figure, in the order §4.5 sets them out.
 *  `RivalSparkline` already lays out name · plot · value as one row; the
 *  badge sits beside it, because the chart deliberately accepts no badge
 *  prop. */
function RivalRow(p: {
  domain: string;
  value: string;
  previous: string | null;
  series: readonly (number | null)[];
  account: string | undefined;
  offer: SwapOffer;
}): React.JSX.Element {
  const label = copy("overview.rivals.spark.label", { rival: p.domain });
  const points = [...p.series];

  return (
    <div style={RIVAL_ENTRY}>
    <div style={RIVAL_ROW}>
      <div style={CHART_BOX}>
        {p.account === undefined ? (
          <RivalSparkline
            name={p.domain}
            value={p.value}
            label={label}
            points={points.filter((point): point is number => point !== null)}
          />
        ) : (
          <RivalSparkline
            name={p.domain}
            value={p.value}
            label={label}
            points={points}
            account={p.account}
          />
        )}
      </div>
      {p.previous === null ? null : (
        <span style={CARRY}>
          <Badge tone={WAS_TONE}>
            <span className="num">{p.previous}</span>
          </Badge>
        </span>
      )}
    </div>
    <Offer offer={p.offer} />
    </div>
  );
}

export function RivalModule(p: {
  rivals: RivalGapModule;
  /** The site's own stated zone — the one every date on this screen is
   *  written in (REQ-073 c1). */
  timeZone: string;
}): React.JSX.Element {
  const line = writtenLine(p.rivals.lineKey);
  const windowLine = comparisonWindow(p.rivals, p.timeZone);
  const title = copy("overview.rivals.title");

  const rows =
    p.rivals.kind === "absolute"
      ? p.rivals.rivals.map((rival) => (
          <RivalRow
            key={rival.domain}
            domain={rival.domain}
            // The cold-start arm's figure is a plain count, never a ratio
            // (§6.6: "division by zero renders as ∞× and reads as broken").
            value={renderValue(rival.ranked, RIVAL_LABEL).text}
            previous={null}
            series={rival.series}
            account={rival.breakAccount}
            offer={rival.offer}
          />
        ))
      : p.rivals.rivals.map((rival) => (
          <RivalRow
            key={rival.domain}
            domain={rival.domain}
            value={copy("overview.rivals.ratio", {
              ratio: renderValue(rival.ratio, RIVAL_LABEL).text,
            })}
            previous={previousFigure(rival.previous)}
            series={rival.series}
            account={rival.breakAccount}
            offer={rival.offer}
          />
        ));

  return (
    <section style={MODULE} data-testid="overview-rivals">
      <p className="eyebrow" style={EYEBROW}>{title}</p>
      <div style={STACK}>{rows}</div>
      {p.rivals.kind === "absolute" ? (
        <p className="rk-prov" style={CARRY} data-testid="overview-rivals-own">
          <span>{copy("overview.rivals.you")}</span>
          <span className="num">{renderValue(p.rivals.own, RIVAL_LABEL).text}</span>
        </p>
      ) : null}
      {line === null ? null : <p className="rk-prov">{line}</p>}
      {windowLine === null ? null : (
        <p className="rk-prov" data-testid="overview-rivals-comparison-window">
          {windowLine}
        </p>
      )}
    </section>
  );
}

/** REQ-071 c13 — the window this card compared over, stated on the runs
 *  where it could not compare across the whole of it. One line for the
 *  card rather than one per rival: the change is the site's, not a
 *  rival's, and repeating it per row would state one fact three times. */
function comparisonWindow(rivals: RivalGapModule, timeZone: string): string | null {
  if (rivals.kind !== "ratio") return null;
  const spanning = rivals.rivals.find((rival) => rival.previous.kind === "spans_change");
  if (spanning === undefined || spanning.previous.kind !== "spans_change") return null;
  // The date the window starts at: the change itself. Everything this card
  // can honestly compare is on this side of it.
  return writtenLine("overview.comparison.window", {
    since: formatDate(spanning.previous.marker.on, timeZone),
  });
}

/** The `was 276×` badge — or, on the measurement that first crossed the
 *  threshold, nothing: there was no previous ratio, and one computed after
 *  the fact from two numbers nobody compared at the time would be a
 *  measurement the product never took. The crossing measurement's own
 *  counts are what the model carries instead, and they are shown by the
 *  points the sparkline already draws. */
function previousFigure(previous: RatioRival["previous"]): string | null {
  if (previous.kind === "first_ratio") return null;
  // REQ-071 c12 (issue #205): the two readings straddle a date the site's
  // answers changed, so their difference is not movement. No badge — and
  // the card states the span it would have compared over instead
  // (`comparisonWindow` below), which is c13's "say which window".
  if (previous.kind === "spans_change") return null;
  const rendered = renderValue(previous, RIVAL_LABEL);
  if (rendered.isDash) return null;
  return copy("overview.rivals.was", {
    previous: copy("overview.rivals.ratio", { ratio: rendered.text }),
  });
}
