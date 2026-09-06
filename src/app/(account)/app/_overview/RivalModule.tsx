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
import type { Tone } from "@/ui/types";
import { writtenLine } from "../_shell/written";
import { renderValue } from "./present";
import type { RatioRival, RivalGapModule } from "./rivals";
import { CARRY, CHART_BOX, EYEBROW, MODULE, RIVAL_ROW, STACK } from "./style";

/** §2.5: the badge on a rival row reports the customer's own progress —
 *  the gap that used to be — so it is a success state, never an alarm. */
const WAS_TONE: Tone = "ok";
const RIVAL_LABEL = "overview.rivals.title" satisfies CopyKey;

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
}): React.JSX.Element {
  const label = copy("overview.rivals.spark.label", { rival: p.domain });
  const points = [...p.series];

  return (
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
  );
}

export function RivalModule(p: { rivals: RivalGapModule }): React.JSX.Element {
  const line = writtenLine(p.rivals.lineKey);
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
    </section>
  );
}

/** The `was 276×` badge — or, on the measurement that first crossed the
 *  threshold, nothing: there was no previous ratio, and one computed after
 *  the fact from two numbers nobody compared at the time would be a
 *  measurement the product never took. The crossing measurement's own
 *  counts are what the model carries instead, and they are shown by the
 *  points the sparkline already draws. */
function previousFigure(previous: RatioRival["previous"]): string | null {
  if (previous.kind === "first_ratio") return null;
  const rendered = renderValue(previous, RIVAL_LABEL);
  if (rendered.isDash) return null;
  return copy("overview.rivals.was", {
    previous: copy("overview.rivals.ratio", { ratio: rendered.text }),
  });
}
