// §4.5 · Canvas: WeeklyScan — how far ahead each rival is, in both arms.
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
import { Users } from "lucide-react";
import { RivalSparkline } from "@/ui/charts";
import { Badge, Card } from "@/ui/components";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { SwapOffer } from "@/lib/market/rivals/offer";
import type { Tone } from "@/ui/types";
import { DESTINATION_HREF } from "../_shell/destinations";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { renderValue } from "./present";
import type { RatioRival, RivalGapModule } from "./rivals";

/** §2.5: the badge on a rival row reports the customer's own progress —
 *  the gap that used to be — so it is a success state, never an alarm. */
const WAS_TONE: Tone = "ok";
const RIVAL_LABEL = "overview.rivals.title" satisfies CopyKey;

/* Where this card's parts sit, as `Canvas: WeeklyScan` draws them: token
 * utilities on the registered `Card`, so the screen writes no class of its
 * own and no stylesheet (`docs/DESIGN.md`, "What is retired"). */
/** The head: the artboard's 20px glyph and its eyebrow, both quiet ink. */
const HEAD = "flex min-w-0 items-center gap-(--s-2) text-(color:--ink-3)";
const EYEBROW = "eyebrow font-bold tracking-[0.1em]";
/** A column of parts; `min-w-0` so a long domain shrinks rather than
 *  pushing the document sideways at the compact floor. */
const STACK = "flex min-w-0 flex-col gap-(--s-2)";
/** One rival: name, sparkline, figure — one column below 240px of plot. */
const ROW = "grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] items-center gap-(--s-3)";
/** A chart's own box: every chart is drawn at the width of what holds it. */
const CHART_BOX = "min-w-0 overflow-x-auto";
/** A value and what it carries, on one baseline, wrapping rather than
 *  shrinking (ADR-093 decision 3 — text is never shrunk to fit). */
const CARRY = "flex min-w-0 flex-wrap items-baseline gap-(--s-2)";
/** The artboard's dim line under a card: 13px in the second ink. */
const DIM = "text-(length:--t-sm) text-(color:--ink-2)";
/** REQ-096 c6's offer, sunk under the rival it is about. */
const OFFER = "flex min-w-0 flex-col items-start gap-(--s-2)";

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
    <div className={OFFER}>
      <p className="explain">{line}</p>
      {/* A link that reads as a button, the same case and the same daisyUI
          pair `WeekModule` states its reason for. */}
      <a href={SWAP_HREF[p.offer.destination]} className="btn btn-sm btn-ghost">
        {control}
      </a>
    </div>
  );
}

/** Where `SwapOffer.destination` goes. A `Record` over the handle's own
 *  union, so a second destination is a compile error here rather than a
 *  control that leads nowhere — and the address itself is
 *  `DESTINATION_HREF`'s, written once for the whole app (issue #223). */
const SWAP_HREF: Record<Extract<SwapOffer, { offered: true }>["destination"], string> = {
  "settings.competitors": DESTINATION_HREF.settings,
};

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
    <div className={STACK}>
      <div className={ROW}>
        <div className={CHART_BOX}>
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
          <span className={CARRY}>
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

/** The card's head: the glyph and the eyebrow the artboard draws, and no
 *  chip — `Canvas: WeeklyScan` draws its section heads bare. */
function Head(): React.JSX.Element {
  return (
    <span className={HEAD}>
      <Users aria-hidden size={ICON} strokeWidth={STROKE} />
      <span className={EYEBROW}>{copy("overview.rivals.title")}</span>
    </span>
  );
}

export function RivalModule(p: {
  rivals: RivalGapModule;
  /** The site's own stated zone — the one every date on this screen is
   *  written in (REQ-073 c1). */
  timeZone: string;
  /** UI-SPEC S13's arm. Before the first weekly pass nothing has been
   *  sized, and the card says when it will be rather than drawing rows
   *  with no plots in them. */
  weekZero?: { firstDueOn: Date } | null;
}): React.JSX.Element {
  const weekZero = p.weekZero ?? null;
  if (weekZero !== null) {
    const line = writtenLine("overview.rivals.line.week-zero", {
      due: formatDate(weekZero.firstDueOn, p.timeZone),
    });
    return (
      <section data-testid="overview-rivals">
        <Card state="default" title={<Head />}>
          {line === null ? null : <p className={DIM}>{line}</p>}
        </Card>
      </section>
    );
  }

  const line = writtenLine(p.rivals.lineKey);
  const windowLine = comparisonWindow(p.rivals, p.timeZone);

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
    <section data-testid="overview-rivals">
      {/* The head is the artboard's: glyph, eyebrow, and no pill — the rows
          are this card's answer. */}
      <Card state="default" title={<Head />}>
        <div className={STACK}>{rows}</div>
        {p.rivals.kind === "absolute" ? (
          <p className={`explain ${CARRY}`} data-testid="overview-rivals-own">
            <span>{copy("overview.rivals.you")}</span>
            <span className="num">{renderValue(p.rivals.own, RIVAL_LABEL).text}</span>
          </p>
        ) : null}
        {line === null ? null : <p className={DIM}>{line}</p>}
        {windowLine === null ? null : (
          <p className="explain" data-testid="overview-rivals-comparison-window">
            {windowLine}
          </p>
        )}
      </Card>
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

/** The head's glyph, at the artboard's size and the design system's stroke
 *  (`docs/DESIGN.md`, "Components": lucide, 20px in chrome, stroke 1.75). */
const ICON = 20;
const STROKE = 1.75;
