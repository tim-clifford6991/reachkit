// The three ways to get pages written, side by side, and what each costs a
// month on one scale. How it works and Pricing draw the same comparison.
import type React from "react";
import { Building2, Clock4, Sparkles, User } from "lucide-react";
import { PRICE_EUR_CENTS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { CostBars } from "@/ui/charts";
import { HOW_FACTS } from "./facts";
import { AGENCY_BENCHMARK } from "./specimen";

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

/** The five jobs every way has to do, in order. */
const JOBS: readonly CopyKey[] = [
  "how.value.job.research",
  "how.value.job.choose",
  "how.value.job.write",
  "how.value.job.publish",
  "how.value.job.check",
];

/** Each way's header tile and job chips: whose work it is reads at a glance, amber for yours, solid for ours. */
const WAYS = [
  { name: "how.value.diy", icon: User, jobs: "how.value.diy.jobs", time: "how.value.diy.time", covers: "how.value.diy.covers", cost: "how.value.diy.cost", chip: "badge-warning badge-soft" },
  { name: "how.value.agency", icon: Building2, jobs: "how.value.agency.jobs", time: "how.value.agency.time", covers: "how.value.agency.covers", cost: "how.value.agency.cost", chip: "badge-ghost" },
  { name: "chrome.wordmark", icon: Sparkles, jobs: "how.value.ours.jobs", time: "how.value.ours.time", covers: "how.value.ours.covers", cost: "landing.price.month", chip: "badge-primary" },
] as const;

const ROWS = ["jobs", "time", "covers", "cost"] as const;

/** The chart's one scale, in the currency each fee is written in. */
const SCALE_MAX = 1000;

/** With `caption`, the short comparison: no covers row and no chart, the
 *  chart's source moved into the caption. */
export function ThreeWays(p: { caption?: string } = {}): React.JSX.Element {
  const price = copy("price.amount");
  const rows = p.caption === undefined ? ROWS : ROWS.filter((row) => row !== "covers");
  const source = (
    <a href={AGENCY_BENCHMARK.url} className="link" target="_blank" rel="noopener">
      {copy("how.value.source", { providers: AGENCY_BENCHMARK.providers, year: AGENCY_BENCHMARK.year })}
    </a>
  );
  const vars = { minutes: HOW_FACTS.setupMinutes, price, fee: AGENCY_BENCHMARK.fee, jobs: JOBS.length };
  const ours = PRICE_EUR_CENTS / 100;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        {WAYS.map((way) => {
          const Icon = way.icon;
          const mine = way.name === "chrome.wordmark";
          const diy = way.name === "how.value.diy";
          // The cost is a figure with its line under it; doing it yourself costs hours, so its figure is words.
          const figure = { "how.value.diy": copy("how.value.diy.cost.head"), "how.value.agency": AGENCY_BENCHMARK.fee, "chrome.wordmark": price }[way.name];
          return (
            <article key={way.name} className={`card bg-base-100 min-w-0 overflow-hidden border ${mine ? "border-primary" : "border-base-300"}`}>
              <div className={`flex items-center gap-2.5 border-b px-4.5 py-4 ${mine ? "bg-primary/10 border-primary/20" : "border-base-300"}`}>
                <span className={`rounded-field grid size-9 shrink-0 place-items-center ${mine ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70"}`}>
                  <Icon {...ICON} />
                </span>
                <h3 className="text-base font-semibold">{copy(way.name)}</h3>
              </div>
              <div className="divide-base-200 flex flex-col divide-y px-4.5 pt-1.5 pb-4.5">
                {rows.map((row) => (
                  <div key={row} className="flex flex-col gap-1 py-2.5">
                    <p className="flex flex-col gap-0.5">
                      <span className="text-base-content/70 text-xs font-bold tracking-wider uppercase">{copy(`how.value.${row}` as CopyKey, vars)}</span>
                      {row === "cost" ? (
                        <span className={`flex items-center gap-1.5 font-bold ${diy ? "text-base" : mine ? "text-primary text-3xl leading-tight tabular-nums" : "text-xl leading-tight tabular-nums"}`}>
                          {diy ? <Clock4 size={16} strokeWidth={1.75} className="text-warning" aria-hidden /> : null}
                          {figure}
                        </span>
                      ) : null}
                      <span className={`text-sm ${row === "cost" ? "" : "font-semibold"}`}>{copy(row === "cost" ? way.cost : way[row], vars)}</span>
                    </p>
                    {row === "jobs" ? (
                      <ul className="flex flex-wrap gap-1">
                        {JOBS.map((job) => (
                          <li key={job} className={`badge badge-sm font-semibold ${way.chip}`}>
                            {copy(job)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {p.caption === undefined ? (
        <figure className="card card-border bg-base-100 min-w-0">
          <div className="card-body gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold">{copy("how.value.chart")}</h3>
              <span className="text-base-content/70 text-xs">{copy("how.value.chart.scale", { min: 0, max: SCALE_MAX.toLocaleString("en-US") })}</span>
            </div>
            <CostBars
              max={SCALE_MAX}
              rows={[
                {
                  name: copy("how.value.agency"),
                  value: copy("how.value.chart.agency", { fee: AGENCY_BENCHMARK.fee }),
                  span: [AGENCY_BENCHMARK.low, AGENCY_BENCHMARK.high],
                },
                { name: copy("how.value.diy"), value: copy("how.value.diy.time"), span: null },
                { name: copy("chrome.wordmark"), value: copy("how.value.ours.cost", vars), span: [0, ours], you: true },
              ]}
            />
            <figcaption className="text-base-content/70 text-xs">{source}</figcaption>
          </div>
        </figure>
      ) : (
        <p className="text-base-content/70 text-sm">
          {p.caption} {source}
        </p>
      )}
    </div>
  );
}
