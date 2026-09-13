// Canvas: Dashboard — how far ahead each rival is, in both arms.
//
// The series colour is not this file's to choose: `RivalSparkline` accepts no
// `Tone` at all, so "rival strength is neutral, never red" is not a
// convention a reviewer has to catch — there is no prop to break it with.
//
// The cold-start arm renders the rivals' absolute counts beside the
// customer's own and states `lineKey`, which the resolver guarantees is not
// the gap-shrinking one: nothing is shrinking yet.
//
// The figures arrive already written — no `×` is composed at a call site and
// the chart never divides.
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
import {
  CARD_HEAD,
  CARD_LABEL,
  CARRY,
  CHART_BOX,
  GLYPH,
  OFFER,
  PROV,
  QUIET,
  RIVAL_ENTRY,
  RIVAL_ROW,
  SECTION,
  STROKE,
} from "./style";

/** §2.5: the badge on a rival row reports the customer's own progress — the
 *  gap that used to be — so it is a success state, never an alarm. */
const WAS_TONE: Tone = "ok";
const RIVAL_LABEL = "overview.rivals.title" satisfies CopyKey;

/** Where `SwapOffer.destination` goes. A `Record` over the handle's own
 *  union, so a second destination is a compile error rather than a control
 *  that leads nowhere. */
const SWAP_HREF: Record<Extract<SwapOffer, { offered: true }>["destination"], string> = {
  "settings.competitors": DESTINATION_HREF.settings,
};

/** The swap offer, under the rival it is about and never at the head of the
 *  module: a banner over the set would be a statement about every rival in
 *  it. Both sentences or neither — a control with no label is not a control,
 *  so while either is owed the far rival's row is every other rival's row. */
function Offer(p: { offer: SwapOffer }): React.JSX.Element | null {
  if (!p.offer.offered) return null;
  const line = writtenLine("overview.rivals.far.line", { rival: p.offer.rival });
  const control = writtenLine("overview.rivals.far.swap");
  if (line === null || control === null) return null;
  return (
    <div className={OFFER}>
      <p className={PROV}>{line}</p>
      {/* A link, not `Btn`: it navigates to the competitors card, where the
          customer makes the change themselves. */}
      <a href={SWAP_HREF[p.offer.destination]} className={SWAP_LINK}>
        {control}
      </a>
    </div>
  );
}

/** A rival's plot and its written figure. `RivalSparkline` already lays out
 *  name · plot · value as one row; the badge sits beside it, because the
 *  chart deliberately accepts no badge prop. */
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
    <div className={RIVAL_ENTRY}>
      <div className={RIVAL_ROW}>
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

export function RivalModule(p: {
  rivals: RivalGapModule;
  /** The site's own stated zone — the one every date on this screen uses. */
  timeZone: string;
  /** Before the first weekly pass nothing has been sized, and the card says
   *  when it will be rather than drawing rows with no plots in them. */
  weekZero?: { firstDueOn: Date } | null;
}): React.JSX.Element {
  const title = copy("overview.rivals.title");
  const head = (
    <div className={CARD_HEAD}>
      <span className={CARD_LABEL}>
        <Users aria-hidden size={GLYPH} strokeWidth={STROKE} />
        <span className="eyebrow">{title}</span>
      </span>
    </div>
  );

  const weekZero = p.weekZero ?? null;
  if (weekZero !== null) {
    const line = writtenLine("overview.rivals.line.week-zero", {
      due: formatDate(weekZero.firstDueOn, p.timeZone),
    });
    return (
      <section data-testid="overview-rivals">
        <Card state="default" title={head}>
          <div className={SECTION}>
            {line === null ? null : <p className={QUIET}>{line}</p>}
          </div>
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
            // The cold-start arm's figure is a plain count, never a ratio.
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
      <Card state="default" title={head}>
        <div className={SECTION}>
          <div className={SECTION}>{rows}</div>
          {p.rivals.kind === "absolute" ? (
            <p className={`${PROV} ${CARRY}`} data-testid="overview-rivals-own">
              <span>{copy("overview.rivals.you")}</span>
              <span className="num">{renderValue(p.rivals.own, RIVAL_LABEL).text}</span>
            </p>
          ) : null}
          {line === null ? null : <p className={QUIET}>{line}</p>}
          {windowLine === null ? null : (
            <p className={PROV} data-testid="overview-rivals-comparison-window">
              {windowLine}
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}

/** The window this card compared over, stated on the runs where it could not
 *  compare across the whole of it. One line for the card rather than one per
 *  rival: the change is the site's, not a rival's. */
function comparisonWindow(rivals: RivalGapModule, timeZone: string): string | null {
  if (rivals.kind !== "ratio") return null;
  const spanning = rivals.rivals.find((rival) => rival.previous.kind === "spans_change");
  if (spanning === undefined || spanning.previous.kind !== "spans_change") return null;
  return writtenLine("overview.comparison.window", {
    since: formatDate(spanning.previous.marker.on, timeZone),
  });
}

/** The `was 276×` badge — or, on the measurement that first crossed the
 *  threshold, nothing: a ratio computed after the fact from two numbers
 *  nobody compared at the time would be a measurement never taken. Two
 *  readings straddling a change are not movement either. */
function previousFigure(previous: RatioRival["previous"]): string | null {
  if (previous.kind === "first_ratio") return null;
  if (previous.kind === "spans_change") return null;
  const rendered = renderValue(previous, RIVAL_LABEL);
  if (rendered.isDash) return null;
  return copy("overview.rivals.was", {
    previous: copy("overview.rivals.ratio", { ratio: rendered.text }),
  });
}

/** The quiet accent word the offer's one control reads as. */
const SWAP_LINK = "text-(length:--t-sm) font-semibold text-primary";
