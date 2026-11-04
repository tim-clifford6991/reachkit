// SPEC §4 (owner, 2026-10-19, the simple model; board Main) — this week's best
// mover beside the measures checked monthly. Each figure is counted over the
// rows its link opens; a figure nothing measured is left out, never drawn as 0.
import type React from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { GrowthLine } from "@/ui/charts/GrowthLine";
import { PlaceLine } from "@/ui/charts/PlaceLine";
import { formatCount, formatShortDay, SHELL_LOCALE } from "../_shell/format";
import { FIRST_PAGE, type BestMover, type MonthsFacts } from "@/lib/measure/figures";
import { shownKey } from "@/lib/measure/registry";

/** Where each figure's rows are listed. */
export const AI_PAGES_HREF = "/app/ai-answers";
export const GOOGLE_PAGES_HREF = "/app/search?show=live";

const INK = "text-base-content/70";
const CARD = "card card-border min-w-0 bg-base-100";
const BODY = "card-body min-w-0 gap-3 p-5";
const ID = { mover: "overview-mover", months: "overview-months" } as const;
const MOVER_CHART = copy("draft.live.chart");

/** "Oct 5": a week or a reading as the figures name it. */
export function shortDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, month: "short", day: "numeric" }).format(at);
}

/** `undefined` where no page holds a place yet: nothing to say about moving. */
export function MoverFigure(p: { mover: BestMover | null | undefined; timeZone: string }): React.JSX.Element | null {
  if (p.mover === undefined) return null;
  const { mover } = p;
  return (
    <section className={CARD} aria-labelledby={ID.mover} data-testid={ID.mover}>
      <div className={BODY}>
        <h2 id={ID.mover} className="eyebrow">
          {copy("overview.mover.title")}
        </h2>
        {mover === null ? (
          <p className="text-sm" data-testid="overview-mover-none">
            {copy("overview.mover.none")}
          </p>
        ) : (
          <>
            <p className="num min-w-0 wrap-anywhere">{mover.search}</p>
            <p className="flex min-w-0 flex-wrap items-baseline gap-2.5">
              <Link className="link link-hover text-4xl leading-none font-semibold tracking-tight tabular-nums" href={GOOGLE_PAGES_HREF} prefetch={true} data-testid={shownKey("overview-best-mover")}>
                {formatCount(mover.place)}
              </Link>
              <span className={`text-sm ${INK}`}>{copy("overview.mover.place")}</span>
              <span className="badge badge-soft badge-success gap-1">
                <TrendingUp size={16} strokeWidth={1.75} aria-hidden />
                {copy("overview.mover.up", { n: formatCount(mover.gain), date: shortDay(new Date(mover.first.at), p.timeZone) })}
              </span>
            </p>
            <div className="flex w-full max-w-xs min-w-0 flex-col gap-1">
              <PlaceLine
                label={MOVER_CHART}
                firstPage={FIRST_PAGE}
                readings={[
                  { name: shortDay(new Date(mover.first.at), p.timeZone), place: mover.first.place },
                  { name: shortDay(new Date(mover.readAt), p.timeZone), place: mover.place },
                ]}
              />
              <p className={`flex items-center gap-1.5 text-xs ${INK}`}>
                <span className="h-2 w-3 shrink-0 rounded-xs border border-(--chart-goal)/40 bg-(--chart-goal)/15" aria-hidden />
                {copy("draft.live.band")}
              </p>
            </div>
            {mover.climbing ? <p className="text-sm">{copy("overview.mover.climbing")}</p> : null}
          </>
        )}
      </div>
    </section>
  );
}

function changeLine(now: number, then: number | null, keys: { up: "overview.months.score.up" | "overview.months.market.up"; down: "overview.months.score.down" | "overview.months.market.down"; same: "overview.months.score.same" | "overview.months.market" }): string | null {
  if (then === null) return null;
  if (now === then) return copy(keys.same);
  return copy(now > then ? keys.up : keys.down, { n: formatCount(then) });
}

/** The move from the scan's value to today's; no line where the scan measured nothing. */
function moveLine(then: number | null, now: number): React.JSX.Element | null {
  if (then === null) return null;
  return <GrowthLine compact weeks={[{ name: "scan", value: then }, { name: "now", value: now }]} />;
}

function Measure(p: { label: string; figure: string; of: string | null; line: string | null; testId: string; mark: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 basis-60 items-center justify-between gap-3 rounded-box bg-base-200 px-3.5 py-3" data-testid={p.testId}>
      <div className="min-w-0">
        <p className="eyebrow">{p.label}</p>
        <p className="text-2xl font-bold tabular-nums" data-testid="overview-months-figure">
          {p.figure}
          {p.of === null ? null : <span className={`ms-1.5 text-sm font-semibold ${INK}`}>{p.of}</span>}
        </p>
        {p.line === null ? null : <p className={`text-xs ${INK}`}>{p.line}</p>}
      </div>
      {p.mark}
    </div>
  );
}

export function MonthsFigure(p: { months: MonthsFacts; timeZone: string }): React.JSX.Element {
  const { reading, scan } = p.months;
  const next = formatShortDay(new Date(`${p.months.next}T12:00:00Z`), "UTC");
  // A count of one set of searches says nothing about a count of another.
  const scanMarket = scan.market !== null && scan.market.of === reading?.market?.of ? scan.market.top10 : null;
  return (
    <section className={CARD} aria-labelledby={ID.months} data-testid={ID.months}>
      <div className={BODY}>
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-1.5">
          <h2 id={ID.months} className="text-xl font-bold tracking-tight">
            {copy("overview.months.title")}
          </h2>
          <span className={`text-xs ${INK}`} data-testid="overview-months-next">
            {reading === null ? copy("overview.months.first", { date: next }) : copy("overview.months.checked", { date: next })}
          </span>
        </div>
        {reading === null || (reading.score === null && reading.market === null) ? null : (
          <div className="flex min-w-0 flex-wrap gap-3">
            {reading.score === null ? null : (
              <Measure
                testId={shownKey("overview-score-month")}
                label={copy("overview.months.score")}
                figure={formatCount(reading.score)}
                of={copy("overview.months.of", { of: "100" })}
                line={changeLine(reading.score, scan.score, { up: "overview.months.score.up", down: "overview.months.score.down", same: "overview.months.score.same" })}
                mark={moveLine(scan.score, reading.score)}
              />
            )}
            {reading.market === null ? null : (
              <Measure
                testId={shownKey("overview-market-month")}
                label={copy("overview.search.tile.market")}
                figure={`${formatCount(reading.market.top10)} ${copy("overview.months.of", { of: formatCount(reading.market.of) })}`}
                of={null}
                line={
                  changeLine(reading.market.top10, scanMarket, { up: "overview.months.market.up", down: "overview.months.market.down", same: "overview.months.market" }) ??
                  copy("overview.months.market")
                }
                mark={moveLine(scanMarket, reading.market.top10)}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
