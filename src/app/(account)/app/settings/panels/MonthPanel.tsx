// SPEC §4 (owner, 2026-10-19, E3) — Billing's "What you got this month".
import type React from "react";
import { CalendarCheck } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { MonthGot } from "@/lib/account/billing";
import { formatDate } from "../../_shell/format";

const INK = "text-base-content/70";

const FIGURES: readonly { count: "live" | "refreshed" | "scans"; label: CopyKey }[] = [
  { count: "live", label: "settings.month.live" },
  { count: "refreshed", label: "settings.month.refreshed" },
  { count: "scans", label: "settings.month.scans" },
];

function Figure(p: { label: CopyKey; value: number | null; testId: string }): React.JSX.Element {
  return (
    <div className="stat min-w-0 px-0" data-testid={p.testId}>
      {p.value === null ? (
        <span className={`stat-value text-base font-normal wrap-anywhere ${INK}`}>{copy("settings.month.not-measured")}</span>
      ) : (
        <span className="stat-value figure text-3xl">{p.value}</span>
      )}
      <span className="stat-desc text-sm wrap-anywhere">{copy(p.label)}</span>
    </div>
  );
}

export function MonthPanel(p: { got: MonthGot; timeZone: string }): React.JSX.Element {
  const { got } = p;
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="billing-month">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <CalendarCheck size={20} strokeWidth={1.75} aria-hidden />
          {copy("settings.month.title")}
        </h2>
        <p className={`num-phrase text-sm wrap-anywhere ${INK}`}>
          {copy("settings.month.period", { from: formatDate(got.from, p.timeZone), to: formatDate(got.to, p.timeZone) })}
        </p>
        <div className="grid min-w-0 grid-cols-1 gap-x-6 sm:grid-cols-3">
          {FIGURES.map(({ count, label }) => (
            <Figure key={count} label={label} value={got[count]} testId={`billing-month-${count}`} />
          ))}
        </div>
        <h3 className="eyebrow">{copy("settings.month.checks")}</h3>
        {got.pages.length === 0 ? (
          <p className={`text-sm ${INK}`}>{copy("settings.month.no-pages")}</p>
        ) : (
          <ul className="list min-w-0" data-testid="billing-month-pages">
            {got.pages.map((page, index) => (
              <li className="list-row min-w-0 grid-cols-1 px-0 sm:grid-cols-[1fr_auto]" key={index}>
                <span className="min-w-0 text-sm wrap-anywhere">
                  {page.title ?? copy("settings.month.untitled")}
                  {page.refresh ? <span className="badge badge-ghost badge-sm ml-2">{copy("settings.month.refresh")}</span> : null}
                </span>
                <span className={`num-phrase text-sm wrap-anywhere ${INK}`}>
                  {page.checks === null
                    ? copy("settings.month.not-measured")
                    : copy("draft.checks.headline", { passed: page.checks.passed, total: page.checks.total })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={`text-xs wrap-anywhere ${INK}`}>{copy("settings.month.note")}</p>
      </div>
    </section>
  );
}
