// SPEC §4 (owner, 2026-10-19, E3) — Billing's "This month": the period and
// four tiles, as board SettingsAccount draws them.
import type React from "react";
import { Fragment } from "react";
import { copy } from "@/lib/presentation/copy";
import type { MonthGot } from "@/lib/account/billing";
import type { DayKey } from "../../calendar/dates";
import { SHELL_LOCALE } from "../../_shell/format";

const INK = "text-base-content/70";

/** What the tiles need beyond the stored month. */
export interface MonthContext {
  timeZone: string;
  price: string;
  /** The days this week with a page still to go live; `null` where Plan could not be read. */
  planned: readonly DayKey[] | null;
  /** When the first page goes live, where none has yet. */
  first: string | null;
}

/** One tile: a count and what it counts. A zero is quiet; an unread count says so in words. */
function Tile(p: { value: number | null; label: string; cap?: string | null; testId: string }): React.JSX.Element {
  return (
    <li className="bg-base-200 rounded-box flex min-w-0 flex-col gap-1 p-4" data-testid={p.testId}>
      {p.value === null ? (
        <span className={`text-base wrap-anywhere ${INK}`}>{copy("settings.month.not-measured")}</span>
      ) : (
        <span className={`figure text-3xl ${p.value === 0 ? INK : ""}`}>{p.value}</span>
      )}
      <span className="text-sm wrap-anywhere">{p.label}</span>
      {p.cap == null ? null : <span className={`text-sm wrap-anywhere ${INK}`}>{p.cap}</span>}
    </li>
  );
}

/** "7 Oct", as the board writes a period's ends, in the site's zone. */
function dayMonth(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, day: "numeric", month: "short" }).formatToParts(at);
  return `${parts.find((x) => x.type === "day")?.value ?? ""} ${parts.find((x) => x.type === "month")?.value ?? ""}`;
}

export function MonthPanel(p: { got: MonthGot | null; context: MonthContext }): React.JSX.Element {
  const { got, context } = p;
  const title = <h2 className="card-title text-(length:--h3)">{copy("settings.month.title")}</h2>;
  // A month that could not be read is never drawn as zeros.
  if (got === null) {
    return (
      <section className="card card-border min-w-0 bg-base-100" data-testid="billing-month">
        <div className="card-body gap-4">
          {title}
          <p className={`text-sm wrap-anywhere ${INK}`} data-testid="billing-month-unread">
            {copy("settings.month.unread")}
          </p>
        </div>
      </section>
    );
  }
  const ends = [dayMonth(got.from, context.timeZone), dayMonth(got.to, context.timeZone)];
  // The period's two ends are dates, so they alone are mono.
  const period = copy("settings.month.period", { from: "\u0000", to: "\u0000", price: context.price }).split("\u0000");

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="billing-month">
      <div className="card-body gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          {title}
          <p className={`text-sm wrap-anywhere ${INK}`} data-testid="billing-month-period">
            {period.map((text, i) => (
              <Fragment key={i}>
                {text}
                {i < ends.length ? <span className="num">{ends[i]}</span> : null}
              </Fragment>
            ))}
          </p>
        </div>

        <ul className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4" data-layout="month">
          <Tile value={got.live} label={copy("settings.month.live")} testId="billing-month-live" />
          <Tile value={got.reports.length} label={copy("settings.month.reports")} testId="billing-month-reports" />
          <Tile
            value={got.asked === null ? null : got.asked.searches + (got.asked.questions ?? 0)}
            label={copy("settings.month.asked")}
            cap={got.asked?.questions === null ? copy("settings.month.asked.split.unmeasured", { searches: String(got.asked.searches) }) : null}
            testId="billing-month-asked"
          />
          <Tile value={context.planned === null ? null : context.planned.length} label={copy("settings.month.planned")} testId="billing-month-planned" />
        </ul>
        {got.live === 0 && context.first !== null ? (
          <p className={`text-sm wrap-anywhere ${INK}`} data-testid="billing-month-first">
            {copy("settings.month.first", { when: context.first })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
