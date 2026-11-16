// SPEC §4 *Overview is board Main* — the three "so far" totals, AI first, each
// opening the rows it counts, with one closed panel saying what they count.
import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import type { Total, Totals as Model } from "@/lib/measure/totals";
import { shownKey } from "@/lib/measure/registry";
import { formatCount, formatDate } from "../_shell/format";

const ID = "overview-totals";
const INK = "whitespace-normal text-base-content/70";
const NONE = "—";

const STATS = [
  { of: "ai", label: copy("overview.totals.ai.label"), href: "/app/ai-answers", testId: shownKey("overview-total-ai") },
  { of: "google", label: copy("overview.totals.google.label"), href: "/app/search", testId: shownKey("overview-total-google") },
  { of: "pages", label: copy("overview.totals.pages.label"), href: "/app/search?show=live", testId: shownKey("overview-total-pages") },
] as const;

/** Exactly one state; a first count is never shown as growth. */
function stateLine(total: Total, due: Date, timeZone: string): string {
  switch (total.kind) {
    case "due":
      return copy("overview.totals.first.due", { date: formatDate(due, timeZone) });
    case "first":
      return copy("overview.totals.first", { date: formatDate(new Date(`${total.week}T12:00:00Z`), "UTC") });
    case "added":
      return copy("overview.totals.added", { n: formatCount(total.n) });
    case "flat":
      return copy("overview.totals.added.none");
    case "unread":
      return copy("overview.totals.unread.ai");
  }
}

export function Totals(p: { totals: Model; due: { measured: Date; pages: Date }; timeZone: string }): React.JSX.Element {
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={ID} data-testid={ID}>
      <h2 id={ID} className="text-xl font-bold tracking-tight">
        {copy("overview.totals.title")}
      </h2>
      <div className="stats stats-vertical lg:stats-horizontal card-border w-full bg-base-100">
        {STATS.map((stat) => {
          const total = p.totals[stat.of];
          return (
            <div key={stat.of} className="stat min-w-0" data-testid={stat.testId}>
              <p className={`stat-title ${INK}`}>{stat.label}</p>
              <Link className="stat-value link link-hover font-semibold tabular-nums" href={stat.href} prefetch={true}>
                {total.kind === "due" ? (
                  <>
                    <span aria-hidden>{NONE}</span>
                    <span className="sr-only">{copy("overview.totals.unmeasured.sr")}</span>
                  </>
                ) : (
                  formatCount(total.total)
                )}
              </Link>
              <p className={`stat-desc ${INK}`}>{stateLine(total, stat.of === "pages" ? p.due.pages : p.due.measured, p.timeZone)}</p>
            </div>
          );
        })}
      </div>
      <details className="collapse collapse-arrow card-border min-w-0 bg-base-100" data-testid="overview-totals-how">
        <summary className="collapse-title font-semibold">{copy("overview.totals.how.title")}</summary>
        <div className="collapse-content flex flex-col gap-2 text-sm">
          <p>
            {copy("overview.totals.how.ai")} {copy("overview.totals.how.ai.brand")}
          </p>
          <p>{copy("overview.totals.how.google")}</p>
          <p>{copy("overview.totals.how.pages")}</p>
        </div>
      </details>
    </section>
  );
}
