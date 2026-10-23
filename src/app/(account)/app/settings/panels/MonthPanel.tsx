// SPEC §4 (owner, 2026-10-19, E3) — Billing's "What you got this month": four
// tiles, the period bar and the detail, as board SettingsBilling draws them.
import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import type { MonthGot } from "@/lib/account/billing";
import { addDays, dayKeyOf, fullDate, type DayKey } from "../../calendar/dates";
import { CALENDAR_HREF } from "../../_overview/week";
import { SHELL_LOCALE } from "../../_shell/format";
import { WEEK_PLAN } from "@/lib/config/constants";
import { Linked } from "../Linked";

const INK = "text-base-content/70";

/** What the tiles and the bar need beyond the stored month. */
export interface MonthContext {
  timeZone: string;
  today: DayKey;
  price: string;
  /** The live hosted address, or `null` where there is none. */
  host: string | null;
  /** The days this week with a page still to go live; `null` where Plan could not be read. */
  planned: readonly DayKey[] | null;
  /** When the first page goes live, where none has yet. */
  first: string | null;
}

/** One tile: a count, what it counts, and a line under it. A zero is quiet; an unread count says so. */
function Tile(p: { value: number | null; label: string; cap: string | null; testId: string }): React.JSX.Element {
  return (
    <li className="bg-base-200 rounded-box flex min-w-0 flex-col gap-1 p-3" data-testid={p.testId}>
      {p.value === null ? (
        <span className={`text-base wrap-anywhere ${INK}`}>{copy("settings.month.not-measured")}</span>
      ) : (
        <span className={`figure text-3xl ${p.value === 0 ? INK : ""}`}>{p.value}</span>
      )}
      <span className="text-sm wrap-anywhere">{p.label}</span>
      {p.cap === null ? null : <span className={`text-xs wrap-anywhere ${INK}`}>{p.cap}</span>}
    </li>
  );
}

function monthDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, month: "short", day: "numeric" }).format(at);
}

/** Every day of the period, first to last. */
function daysOf(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let day = from; day < to && out.length < 62; day = addDays(day, 1)) out.push(day);
  return out;
}

export function MonthPanel(p: { got: MonthGot | null; context: MonthContext }): React.JSX.Element {
  const { got, context } = p;
  const title = <h2 className="card-title text-base">{copy("settings.month.title")}</h2>;
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
  const zone = context.timeZone;
  const from = dayKeyOf(got.from, zone);
  const to = dayKeyOf(got.to, zone);
  const liveDays = new Set(got.liveAt.map((at) => dayKeyOf(at, zone)));
  const plannedDays = new Set(context.planned ?? []);
  const reports = new Intl.ListFormat(SHELL_LOCALE, { type: "conjunction" }).format(got.reports.map((at) => monthDay(at, zone)));

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="billing-month">
      <div className="card-body gap-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            {title}
            <p className={`num-phrase text-sm wrap-anywhere ${INK}`}>
              {copy("settings.month.period", { from: fullDate(from), to: fullDate(to), price: context.price })}
            </p>
          </div>
          <Link href={CALENDAR_HREF} className="link link-primary text-sm">
            {copy("settings.month.all")}
          </Link>
        </div>

        <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            value={got.live}
            label={copy("settings.month.live")}
            cap={context.host === null ? null : copy("settings.month.live.where", { host: context.host })}
            testId="billing-month-live"
          />
          <Tile value={got.reports.length} label={copy("settings.month.reports")} cap={got.reports.length === 0 ? null : reports} testId="billing-month-reports" />
          <Tile
            value={got.asked === null ? null : got.asked.searches + got.asked.questions}
            label={copy("settings.month.asked")}
            cap={
              got.asked === null
                ? null
                : copy("settings.month.asked.split", { searches: String(got.asked.searches), questions: String(got.asked.questions) })
            }
            testId="billing-month-asked"
          />
          <Tile
            value={context.planned === null ? null : context.planned.length}
            label={copy("settings.month.planned")}
            cap={copy("settings.month.planned.cap", { days: String(WEEK_PLAN.days) })}
            testId="billing-month-planned"
          />
        </ul>
        {got.live === 0 && context.first !== null ? (
          <p className={`text-sm wrap-anywhere ${INK}`} data-testid="billing-month-first">
            {copy("settings.month.first", { when: context.first })}
          </p>
        ) : null}

        <figure
          className="flex min-w-0 flex-col gap-2"
          aria-label={copy("settings.month.bar", {
            from: fullDate(from),
            to: fullDate(to),
            live: String(got.live),
            planned: String(plannedDays.size),
          })}
          data-testid="billing-month-bar"
        >
          <div className="flex min-w-0 gap-px">
            {daysOf(from, to).map((day) => (
              <span
                key={day}
                aria-hidden
                className={`h-3 min-w-0 flex-1 rounded-sm ${
                  liveDays.has(day) ? "bg-success" : plannedDays.has(day) ? "bg-primary" : "bg-base-300"
                } ${day === context.today ? "outline outline-2 outline-base-content" : ""}`}
              />
            ))}
          </div>
          <div className={`num flex min-w-0 flex-wrap justify-between gap-2 text-xs ${INK}`}>
            <span>{fullDate(from)}</span> <span>{copy("settings.month.today")}</span> <span>{fullDate(to)}</span>
          </div>
          <p className={`flex min-w-0 flex-wrap gap-x-4 text-xs ${INK}`}>
            <span className="inline-flex items-center gap-1">
              <span className="bg-success inline-block size-2 rounded-sm" aria-hidden />
              {copy("settings.month.legend.live")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="bg-primary inline-block size-2 rounded-sm" aria-hidden />
              {copy("settings.month.legend.planned")}
            </span>
          </p>
        </figure>

        <details className="collapse collapse-arrow border-base-300 min-w-0 border" data-testid="billing-month-detail">
          <summary className="collapse-title text-sm">{copy("settings.month.detail")}</summary>
          <div className={`collapse-content flex min-w-0 flex-col gap-2 text-xs ${INK}`}>
            <p className="wrap-anywhere">{copy("settings.month.note")}</p>
            <p className="wrap-anywhere">
              <Linked sentence={copy("settings.month.climb")} word={copy("shell.nav.overview")} href="/app" />
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
