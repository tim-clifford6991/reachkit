// BUILD §4.5 — how far ahead each rival is, in both arms.
//
// SPEC §4: rivals' lines. Per rival: name · `RivalSparkline` (Recharts, no
// tone prop — rival strength is never red) · the written figure · a `was`
// badge. Below `RATIO_UNLOCK` the cold-start arm shows absolute counts
// beside the customer's own and never the gap-shrinking line. Week 0 draws
// no rows, only when sizing arrives.
//
// A far rival (REQ-096 c6) carries one line and one link to the
// competitors card under its own row — both sentences or neither.
import type React from "react";
import { Users } from "lucide-react";
import { RivalSparkline } from "@/ui/charts";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { SwapOffer } from "@/lib/market/rivals/offer";
import { DESTINATION_HREF } from "../_shell/destinations";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { renderValue } from "./present";
import type { RatioRival, RivalGapModule } from "./rivals";

const RIVAL_LABEL = "overview.rivals.title" satisfies CopyKey;
const TEST_ID = "overview-rivals";

const SWAP_HREF: Record<Extract<SwapOffer, { offered: true }>["destination"], string> = {
  "settings.competitors": DESTINATION_HREF.settings,
};

function Card(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={TEST_ID}>
      <div className="card-body gap-4 p-5">
        <h2 className="card-title text-xs font-semibold uppercase tracking-wide text-base-content/60">
          <Users aria-hidden size={20} strokeWidth={1.75} />
          {copy(RIVAL_LABEL)}
        </h2>
        {p.children}
      </div>
    </section>
  );
}

function Offer(p: { offer: SwapOffer }): React.JSX.Element | null {
  if (!p.offer.offered) return null;
  const line = writtenLine("overview.rivals.far.line", { rival: p.offer.rival });
  const control = writtenLine("overview.rivals.far.swap");
  if (line === null || control === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-box bg-base-200 p-3">
      <p className="text-xs text-base-content/70">{line}</p>
      <a href={SWAP_HREF[p.offer.destination]} className="btn btn-ghost btn-sm">
        {control}
      </a>
    </div>
  );
}

function RivalRow(p: {
  domain: string;
  value: string;
  previous: string | null;
  series: readonly (number | null)[];
  account: string | undefined;
  offer: SwapOffer;
}): React.JSX.Element {
  const label = copy("overview.rivals.spark.label", { rival: p.domain });
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 overflow-x-auto">
          {p.account === undefined ? (
            <RivalSparkline
              name={p.domain}
              value={p.value}
              label={label}
              points={p.series.filter((point): point is number => point !== null)}
            />
          ) : (
            <RivalSparkline name={p.domain} value={p.value} label={label} points={[...p.series]} account={p.account} />
          )}
        </div>
        {p.previous === null ? null : (
          <span className="badge badge-success badge-soft num">{p.previous}</span>
        )}
      </div>
      <Offer offer={p.offer} />
    </li>
  );
}

export function RivalModule(p: {
  rivals: RivalGapModule;
  timeZone: string;
  weekZero?: { firstDueOn: Date } | null;
}): React.JSX.Element {
  const weekZero = p.weekZero ?? null;
  if (weekZero !== null) {
    const line = writtenLine("overview.rivals.line.week-zero", {
      due: formatDate(weekZero.firstDueOn, p.timeZone),
    });
    return <Card>{line === null ? null : <p className="text-sm text-base-content/70">{line}</p>}</Card>;
  }

  const line = writtenLine(p.rivals.lineKey);
  const windowLine = comparisonWindow(p.rivals, p.timeZone);

  const rows =
    p.rivals.kind === "absolute"
      ? p.rivals.rivals.map((rival) => (
          <RivalRow
            key={rival.domain}
            domain={rival.domain}
            // Cold start: a plain count, never a ratio.
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
            value={copy("overview.rivals.ratio", { ratio: renderValue(rival.ratio, RIVAL_LABEL).text })}
            previous={previousFigure(rival.previous)}
            series={rival.series}
            account={rival.breakAccount}
            offer={rival.offer}
          />
        ));

  return (
    <Card>
      <ul className="flex min-w-0 flex-col gap-3">{rows}</ul>
      {p.rivals.kind === "absolute" ? (
        <p className="flex flex-wrap items-baseline gap-2 text-sm" data-testid="overview-rivals-own">
          <span>{copy("overview.rivals.you")}</span>
          <span className="num">{renderValue(p.rivals.own, RIVAL_LABEL).text}</span>
        </p>
      ) : null}
      {line === null ? null : <p className="text-xs text-base-content/60">{line}</p>}
      {windowLine === null ? null : (
        <p className="num text-xs text-base-content/60" data-testid="overview-rivals-comparison-window">
          {windowLine}
        </p>
      )}
    </Card>
  );
}

/** REQ-071 c13 — the window this card compared over, where a change fell
 *  inside it. One line for the card: the change is the site's. */
function comparisonWindow(rivals: RivalGapModule, timeZone: string): string | null {
  if (rivals.kind !== "ratio") return null;
  const spanning = rivals.rivals.find((rival) => rival.previous.kind === "spans_change");
  if (spanning === undefined || spanning.previous.kind !== "spans_change") return null;
  return writtenLine("overview.comparison.window", {
    since: formatDate(spanning.previous.marker.on, timeZone),
  });
}

/** The `was 276×` badge — none on the first ratio, and none across a change
 *  (the difference would not be movement). */
function previousFigure(previous: RatioRival["previous"]): string | null {
  if (previous.kind === "first_ratio" || previous.kind === "spans_change") return null;
  const rendered = renderValue(previous, RIVAL_LABEL);
  if (rendered.isDash) return null;
  return copy("overview.rivals.was", {
    previous: copy("overview.rivals.ratio", { ratio: rendered.text }),
  });
}
