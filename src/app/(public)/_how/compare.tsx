// The three ways to get pages written, side by side, and what each costs a
// month on one scale. How it works and Pricing draw the same comparison.
import type React from "react";
import { Building2, Sparkles, User } from "lucide-react";
import { PRICE_EUR_CENTS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { CostBars } from "@/ui/charts";
import { HOW_FACTS } from "./facts";
import { AGENCY_BENCHMARK } from "./specimen";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** The five jobs every way has to do, in order. */
const JOBS: readonly CopyKey[] = [
  "how.value.job.research",
  "how.value.job.choose",
  "how.value.job.write",
  "how.value.job.publish",
  "how.value.job.check",
];

const WAYS = [
  { name: "how.value.diy", icon: User, jobs: "how.value.diy.jobs", time: "how.value.diy.time", covers: "how.value.diy.covers", cost: "how.value.diy.cost" },
  { name: "how.value.agency", icon: Building2, jobs: "how.value.agency.jobs", time: "how.value.agency.time", covers: "how.value.agency.covers", cost: "how.value.agency.cost" },
  { name: "chrome.wordmark", icon: Sparkles, jobs: "how.value.ours.jobs", time: "how.value.ours.time", covers: "how.value.ours.covers", cost: "how.value.ours.cost" },
] as const;

const ROWS = ["jobs", "time", "covers", "cost"] as const;

/** The chart's one scale, in the currency each fee is written in. */
const SCALE_MAX = 1000;

export function ThreeWays(): React.JSX.Element {
  const price = copy("price.amount");
  const vars = { minutes: HOW_FACTS.setupMinutes, price, fee: AGENCY_BENCHMARK.fee, jobs: JOBS.length };
  const ours = PRICE_EUR_CENTS / 100;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        {WAYS.map((way) => {
          const Icon = way.icon;
          return (
            <article
              key={way.name}
              className={`card bg-base-100 min-w-0 border ${way.name === "chrome.wordmark" ? "border-primary" : "border-base-300"}`}
            >
              <div className="card-body gap-3">
                <h3 className="card-title text-base">
                  <Icon {...ICON} />
                  {copy(way.name)}
                </h3>
                {ROWS.map((row) => (
                  <div key={row} className="flex flex-col gap-1">
                    <p className="flex flex-col">
                      <span className="text-base-content/70 text-xs">{copy(`how.value.${row}` as CopyKey, vars)}</span>
                      {row === "cost" && way.name === "how.value.diy" ? (
                        <span className="text-sm font-semibold">{copy("how.value.diy.cost.head")}</span>
                      ) : null}
                      <span className={`text-sm ${row === "cost" ? "font-semibold" : ""}`}>{copy(way[row], vars)}</span>
                    </p>
                    {row === "jobs" ? (
                      <ul className="flex flex-wrap gap-1">
                        {JOBS.map((job) => (
                          <li key={job} className="badge badge-ghost badge-sm">
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
          <figcaption className="text-base-content/70 text-xs">
            <a href={AGENCY_BENCHMARK.url} className="link" target="_blank" rel="noopener">
              {copy("how.value.source", { providers: AGENCY_BENCHMARK.providers, year: AGENCY_BENCHMARK.year })}
            </a>
          </figcaption>
        </div>
      </figure>
    </div>
  );
}
