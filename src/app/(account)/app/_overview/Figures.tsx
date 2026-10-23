// SPEC §4 (owner, 2026-10-19, the simple model; board Main) — this week's AI
// and Google figures side by side, then the ones that move over months. Each
// figure is counted over the rows its link opens; a figure nothing measured is
// left out, never drawn as 0.
import type React from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { BlogReadsModel } from "@/lib/publish/reads/model";
import { ANSWER_RATE_WEEKS } from "@/lib/config/constants";
import { PlaceLine } from "@/ui/charts/PlaceLine";
import { ReadsBars } from "@/ui/charts/ReadsBars";
import { formatCount, formatDay, SHELL_LOCALE } from "../_shell/format";
import { FIRST_PAGE, type AiPages, type BestMover, type MonthsFacts } from "@/lib/measure/figures";
import { percent, type PromptsModel } from "./prompts-model";

/** Where each figure's rows are listed. */
export const AI_PAGES_HREF = "/app/ai-answers";
export const GOOGLE_PAGES_HREF = "/app/search?show=live";

const INK = "text-base-content/70";
const CARD = "card card-border min-w-0 bg-base-100";
const BODY = "card-body min-w-0 gap-3 p-5";
const READS_CHART = copy("overview.ai.reads.chart");
const ID = { ai: "overview-ai", mover: "overview-mover", months: "overview-months" } as const;
const MOVER_CHART = copy("draft.live.chart");

/** "Oct 5": a week or a reading as the figures name it. */
function shortDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, month: "short", day: "numeric" }).format(at);
}

function readsLine(n: number): string {
  if (n === 0) return copy("overview.ai.reads.none");
  return n === 1 ? copy("overview.ai.reads.one") : copy("overview.ai.reads", { n: formatCount(n) });
}

export function AiFigure(p: { pages: AiPages | null; reads: BlogReadsModel }): React.JSX.Element | null {
  const reads = p.reads.show && p.reads.fetches.kind !== "unmeasured" ? p.reads : null;
  if (p.pages === null && reads === null) return null;
  return (
    <section className={CARD} aria-labelledby={ID.ai} data-testid={ID.ai}>
      <div className={BODY}>
        <h2 id={ID.ai} className="eyebrow">
          {copy("overview.ai.title")}
        </h2>
        {p.pages === null ? null : (
          <>
            <p className="flex min-w-0 flex-wrap items-baseline gap-2.5">
              <span className="num text-4xl font-semibold" data-testid="overview-tile-ai-linked">
                {formatCount(p.pages.linked.length)}
              </span>
              <span className={`text-sm ${INK}`}>{copy("overview.ai.linked.of", { of: formatCount(p.pages.asked.length) })}</span>
            </p>
            <progress className="progress progress-primary w-full" value={p.pages.linked.length} max={p.pages.asked.length} aria-hidden />
            <p className={`flex min-w-0 flex-wrap gap-x-3.5 gap-y-1 text-xs ${INK}`}>
              <span>{copy("overview.ai.linked.own", { n: formatCount(p.pages.linked.length) })}</span>
              <span>{copy("overview.ai.linked.not-yet", { n: formatCount(p.pages.asked.length - p.pages.linked.length) })}</span>
            </p>
          </>
        )}
        {reads === null || reads.fetches.kind === "unmeasured" ? null : (
          <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-3 border-t border-base-300 pt-3">
            <div className="flex min-w-0 flex-1 basis-36 flex-col gap-1">
              <p className="text-sm" data-testid="overview-tile-ai-reads">
                {readsLine(reads.fetches.value)}
              </p>
              <p className={`text-xs ${INK}`}>{copy("overview.ai.reads.who")}</p>
            </div>
            {reads.weekly.length < 2 ? null : (
              <ReadsBars
                label={READS_CHART}
                weeks={reads.weekly.map((week) => ({ name: shortDay(new Date(`${week.start}T12:00:00Z`), "UTC"), count: week.fetches }))}
              />
            )}
          </div>
        )}
        <Link className="link mt-auto text-sm font-semibold" href={AI_PAGES_HREF} prefetch={true}>
          {copy("overview.ai.each")}
        </Link>
      </div>
    </section>
  );
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
              <span className="num text-4xl font-semibold" data-testid="overview-tile-mover">
                {formatCount(mover.place)}
              </span>
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
              <p className={`text-xs ${INK}`}>{copy("draft.live.band")}</p>
            </div>
            {mover.climbing ? <p className="text-sm">{copy("overview.mover.climbing")}</p> : null}
          </>
        )}
        <Link className="link mt-auto text-sm font-semibold" href={GOOGLE_PAGES_HREF} prefetch={true}>
          {copy("overview.mover.each")}
        </Link>
      </div>
    </section>
  );
}

function changeLine(now: number, then: number | null, keys: { up: "overview.months.score.up" | "overview.months.market.up"; down: "overview.months.score.down" | "overview.months.market.down"; same: "overview.months.score.same" | "overview.months.market" }): string | null {
  if (then === null) return null;
  if (now === then) return copy(keys.same);
  return copy(now > then ? keys.up : keys.down, { n: formatCount(then) });
}

function Measure(p: { label: string; figure: string; of: string | null; line: string | null; testId: string }): React.JSX.Element {
  return (
    <div className="min-w-0 flex-1 basis-60 rounded-box bg-base-200 px-3.5 py-3" data-testid={p.testId}>
      <p className="eyebrow">{p.label}</p>
      <p className="num text-2xl font-bold">
        {p.figure}
        {p.of === null ? null : <span className={`ms-1.5 text-sm font-semibold ${INK}`}>{p.of}</span>}
      </p>
      {p.line === null ? null : <p className={`text-xs ${INK}`}>{p.line}</p>}
    </div>
  );
}

/** Reputation counts the unbranded prompts' answers alone; `measurePrompts`
 *  leaves the branded ones out of the rate. */
export function MonthsFigure(p: { months: MonthsFacts; reputation: PromptsModel; timeZone: string }): React.JSX.Element {
  const { reading, scan } = p.months;
  const next = formatDay(new Date(`${p.months.next}T12:00:00Z`), "UTC");
  const rate = p.reputation.kind === "measured" ? p.reputation.rate : null;
  const shown = p.reputation.kind === "measured" && p.reputation.rateShown;
  return (
    <section className={CARD} aria-labelledby={ID.months} data-testid={ID.months}>
      <div className={BODY}>
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-1.5">
          <h2 id={ID.months} className="text-lg font-semibold">
            {copy("overview.months.title")}
          </h2>
          <span className={`text-xs ${INK}`} data-testid="overview-months-next">
            {reading === null ? copy("overview.months.first", { date: next }) : copy("overview.months.checked", { date: next })}
          </span>
        </div>
        {reading === null ? null : (
          <div className="flex min-w-0 flex-wrap gap-3">
            {reading.score === null ? null : (
              <Measure
                testId="overview-tile-score"
                label={copy("overview.months.score")}
                figure={formatCount(reading.score)}
                of={copy("overview.months.of", { of: "100" })}
                line={changeLine(reading.score, scan.score, { up: "overview.months.score.up", down: "overview.months.score.down", same: "overview.months.score.same" })}
              />
            )}
            {reading.market === null ? null : (
              <Measure
                testId="overview-tile-market"
                label={copy("overview.search.tile.market")}
                figure={`${formatCount(reading.market.top10)} ${copy("overview.months.of", { of: formatCount(reading.market.of) })}`}
                of={null}
                line={
                  changeLine(reading.market.top10, scan.market, { up: "overview.months.market.up", down: "overview.months.market.down", same: "overview.months.market" }) ??
                  copy("overview.months.market")
                }
              />
            )}
            {rate === null ? null : (
              <Measure
                testId="overview-tile-reputation"
                label={copy("overview.months.reputation")}
                figure={`${formatCount(rate.linked + rate.named)} ${copy("overview.months.of", { of: formatCount(rate.samples) })}`}
                of={null}
                line={copy("overview.months.reputation.line", { weeks: formatCount(ANSWER_RATE_WEEKS) })}
              />
            )}
          </div>
        )}
        <p className={`text-xs ${INK}`} data-testid="overview-months-note">
          {copy("overview.months.note")}
          {rate === null || !shown
            ? null
            : ` ${copy("overview.months.range", { low: formatCount(percent(rate.low)), high: formatCount(percent(rate.high)) })}`}
        </p>
      </div>
    </section>
  );
}
