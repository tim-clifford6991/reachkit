// BUILD §4.5 — how far ahead each rival is, in both arms.
//
// SPEC §4 (board AppCompetitors): closed under "How far ahead competitors
// are". Per rival: name · `RivalSparkline` (Recharts, no tone prop — rival
// strength is never red) · "{x}× your size" · "from {x}×" or "no clear
// change". Below `RATIO_UNLOCK` the cold-start arm shows absolute counts
// beside the customer's own and never the gap-shrinking line. Week 0 draws
// the deep pass's sizes as the starting rows and says so (#793); where the
// deep pass sized nobody it draws no rows, only when sizing arrives.
//
// A far rival is a market leader, not a row (SPEC §6 right-sizing, issue
// 858): the far ones share one secondary line and REQ-096 c6's one link to
// the competitors card, below the reachable rows — both or neither.
import type React from "react";
import Link from "next/link";
import { RivalSparkline } from "@/ui/charts";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { SwapOffer } from "@/lib/market/rivals/offer";
import { DESTINATION_HREF } from "../_shell/destinations";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { CLOSED, renderValue } from "./present";
import type { MarketLeaders, RatioRival, RivalGapModule } from "./rivals";

const RIVAL_LABEL = "overview.rivals.title" satisfies CopyKey;
const TEST_ID = "overview-rivals";

const SWAP_HREF: Record<Extract<SwapOffer, { offered: true }>["destination"], string> = {
  "settings.competitors": DESTINATION_HREF.settings,
};

function Card(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <details className={`card card-border min-w-0 bg-base-100 ${CLOSED.root}`} data-testid={TEST_ID}>
      <summary className="collapse-title flex min-h-0 min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 p-4 pe-10">
        <h2 className="text-base font-semibold">
          {copy(RIVAL_LABEL)} <span className="text-sm font-normal text-base-content/70">{copy("overview.rivals.ahead.sub")}</span>
        </h2>
      </summary>
      <div className="collapse-content flex min-w-0 flex-col gap-4 px-4">{p.children}</div>
    </details>
  );
}

/** The far rivals the customer tracks, as market leaders on one secondary
 *  line with REQ-096 c6's one control (issue 858) — never rows of "your
 *  rivals", and never leading the card. Where no tracked rival is within
 *  reach, the card says so first. */
function Leaders(p: {
  leaders: MarketLeaders;
  reachable: number;
  /** What a size is, ahead of the leaders' line. */
  note: string | null;
}): React.JSX.Element | null {
  const { domains, swap } = p.leaders;
  const noted = p.note === null ? null : <p className="text-xs text-base-content/70">{p.note}</p>;
  if (domains.length === 0 || !swap.offered) return noted;
  const none = p.reachable === 0 ? writtenLine("overview.rivals.none-reachable") : null;
  const leaders = writtenLine("overview.rivals.leaders", { rivals: domains.join(", ") });
  const control = writtenLine("overview.rivals.leaders.swap");
  if (leaders === null || control === null) return noted;
  const line = p.note === null ? leaders : `${p.note} ${leaders}`;
  return (
    <div className="flex flex-col gap-2" data-testid="overview-rivals-leaders">
      {none === null ? null : <p className="text-sm">{none}</p>}
      <div className="flex flex-wrap items-center gap-2 rounded-box bg-base-200 p-3">
        <p className="text-xs text-base-content/70">{line}</p>
        {/* daisyUI's `.btn` is `flex-shrink: 0` at a fixed height, so at
            320px this sentence stood 8px past the row it wraps in (#1040).
            `max-w-full` holds it to the row and `h-auto` lets it take the
            second line — the shape `CategoryChoice` gives its own. */}
        <Link
          href={SWAP_HREF[swap.destination]}
          prefetch={true}
          className="btn btn-ghost btn-sm h-auto min-h-8 max-w-full py-1"
        >
          {control}
        </Link>
      </div>
    </div>
  );
}

function RivalRow(p: {
  domain: string;
  value: string;
  previous: string | null;
  series: readonly (number | null)[];
  account: string | undefined;
}): React.JSX.Element {
  const label = copy("overview.rivals.spark.label", { rival: p.domain });
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {/* No scroller any more (#959). It was here because the sparkline
            drew its name, its plot and its figure on one row, which did not
            fit a phone; the plot is full-width under its own label line now
            and the row has nothing to scroll. One fewer allow-listed box
            hiding a value the customer cannot see. */}
        <div className="min-w-0 flex-1">
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
          <span className="num text-xs text-base-content/70">{p.previous}</span>
        )}
      </div>
    </li>
  );
}

export function RivalModule(p: {
  rivals: RivalGapModule;
  timeZone: string;
  weekZero?: { firstDueOn: Date; startingOn: Date } | null;
}): React.JSX.Element {
  const weekZero = p.weekZero ?? null;
  if (weekZero !== null && !anySized(p.rivals)) {
    const line = writtenLine("overview.rivals.line.week-zero", {
      due: formatDate(weekZero.firstDueOn, p.timeZone),
    });
    return (
      <Card>
        {line === null ? null : <p className="text-sm text-base-content/70">{line}</p>}
      </Card>
    );
  }

  const line = writtenLine(p.rivals.lineKey);
  const starting =
    weekZero === null
      ? null
      : writtenLine("overview.rivals.line.starting", {
          on: formatDate(weekZero.startingOn, p.timeZone),
          due: formatDate(weekZero.firstDueOn, p.timeZone),
        });
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
          />
        ))
      : p.rivals.rivals.map((rival) => (
          <RivalRow
            key={rival.domain}
            domain={rival.domain}
            value={copy("overview.rivals.ratio", { ratio: renderValue(rival.ratio, RIVAL_LABEL).text })}
            previous={previousFigure(rival.previous, renderValue(rival.ratio, RIVAL_LABEL).text)}
            series={rival.series}
            account={rival.breakAccount}
          />
        ));

  return (
    <Card>
      {rows.length === 0 ? null : <ul className="flex min-w-0 flex-col gap-3">{rows}</ul>}
      {p.rivals.kind === "absolute" ? (
        <p className="flex flex-wrap items-baseline gap-2 text-sm" data-testid="overview-rivals-own">
          <span>{copy("overview.rivals.you")}</span>
          <span className="num">{renderValue(p.rivals.own, RIVAL_LABEL).text}</span>
        </p>
      ) : null}
      {line === null ? null : <p className="text-xs text-base-content/70">{line}</p>}
      {starting === null ? null : <p className="text-xs text-base-content/70">{starting}</p>}
      {windowLine === null ? null : (
        <p className="num text-xs text-base-content/70" data-testid="overview-rivals-comparison-window">
          {windowLine}
        </p>
      )}
      <Leaders
        leaders={p.rivals.leaders}
        reachable={p.rivals.rivals.length}
        note={p.rivals.kind === "ratio" && p.rivals.rivals.length > 0 ? copy("overview.rivals.ahead.size") : null}
      />
    </Card>
  );
}

/** Whether any row carries a measured size — week 0 draws rows only then. */
function anySized(rivals: RivalGapModule): boolean {
  // A market leader was sized: that is what made it far.
  if (rivals.leaders.domains.length > 0) return true;
  return rivals.kind === "absolute"
    ? rivals.rivals.some((rival) => rival.ranked.kind !== "unmeasured")
    : rivals.rivals.some((rival) => rival.ratio.kind !== "unmeasured");
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

/** "from 4.6×" where the ratio moved since the reading before; "no clear
 *  change" where it held; nothing where no earlier ratio can be compared. */
function previousFigure(previous: RatioRival["previous"], now: string): string | null {
  if (previous.kind === "first_ratio" || previous.kind === "spans_change") return null;
  const rendered = renderValue(previous, RIVAL_LABEL);
  if (rendered.isDash) return null;
  return rendered.text === now ? copy("overview.rivals.flat") : copy("overview.rivals.from", { ratio: rendered.text });
}
