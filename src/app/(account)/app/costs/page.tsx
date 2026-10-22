// SPEC §6, issue 1478 — the owner's cost page, at `/app/costs`.
//
// What each site cost, each UTC day and the week, estimated beside billed,
// with what the vendors' own accounts say and D34's two euros a day judged
// on billed spend. Every figure is a sum of the rows `readCostPage` reads
// (`src/lib/costs/site-day.ts`), so each equals the rows it came from.
//
// Owner-only: any other account is answered `notFound()`, the screen a
// customer gets for an address that is not theirs. It is not in the
// navigation. It declares no `Surface`: the shell's layout owns this route's
// screen root (`../layout.tsx`).
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PLAN_NET_EUR_CENTS, PRICE_EUR_CENTS, TEST_DAY_EUR } from "@/lib/config/constants";
import { now } from "@/lib/config/now";
import { readCostPage, usdCentsToEur, type Activity, type Cell, type CostPage, type Who } from "@/lib/costs/site-day";
import type { FixedVendor } from "@/lib/costs/vendor-days";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { CapDays } from "@/ui/charts";
import { appAccount } from "../_session/account";
import { isOwner } from "./owner";

export const metadata: Metadata = { title: copy("meta.app.costs.title") };

/** A column head names its column. */
const COL = "col";

const SEGMENT_KEY = {
  free: "overview.costs.segment.free",
  smoke: "overview.costs.segment.smoke",
  test: "overview.costs.segment.test",
  box: "overview.costs.segment.box",
} as const satisfies Record<string, CopyKey>;

const ACTIVITY_KEY = {
  free_scan: "overview.costs.activity.free_scan",
  onboarding: "overview.costs.activity.onboarding",
  weekly: "overview.costs.activity.weekly",
  draft: "overview.costs.activity.draft",
  rescore: "overview.costs.activity.rescore",
  smoke: "overview.costs.activity.smoke",
  test: "overview.costs.activity.test",
  box: "overview.costs.activity.box",
} as const satisfies Record<Activity, CopyKey>;

const VENDOR_KEY = {
  dataforseo: "overview.costs.vendor.dataforseo",
  anthropic: "overview.costs.vendor.anthropic",
  vercel: "overview.costs.vendor.vercel",
  supabase: "overview.costs.vendor.supabase",
  jobs: "overview.costs.vendor.jobs",
  resend: "overview.costs.vendor.resend",
  stripe: "overview.costs.vendor.stripe",
} as const satisfies Record<"dataforseo" | "anthropic" | FixedVendor, CopyKey>;

const CAP_KEY = { ok: "overview.costs.cap.ok", warn: "overview.costs.cap.warn", over: "overview.costs.cap.over" } as const;
const CAP_BADGE = { ok: "badge badge-soft badge-success", warn: "badge badge-soft badge-warning", over: "badge badge-soft badge-error" } as const;

const TWO_PLACES = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WHOLE = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const LONG_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const TICK_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

/** A UTC day (`YYYY-MM-DD`) or month (`YYYY-MM-01`) as the format writes it. */
function dayIn(format: Intl.DateTimeFormat, day: string): string {
  return format.format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

/** A euro figure as the constants hold it: whole where it is whole. */
function euros(value: number): string {
  return Number.isInteger(value) ? String(value) : TWO_PLACES.format(value);
}

function days(key: "overview.costs.cap.over-days" | "overview.costs.cap.warn-days", count: number): string {
  return count === 1 ? copy(`${key}.one`) : copy(`${key}.other`, { count: WHOLE.format(count) });
}

function cents(value: number): string {
  return copy("overview.costs.cents", { cents: TWO_PLACES.format(value) });
}

function eur(value: number): string {
  return copy("overview.costs.eur", { eur: TWO_PLACES.format(value) });
}

function billed(cell: Cell): string {
  return cell.billedCents === null ? copy("overview.costs.unbilled") : cents(cell.billedCents);
}

function whoName(who: Who): React.ReactNode {
  return who.kind === "site" ? <span className="font-mono break-all">{who.domain}</span> : copy(SEGMENT_KEY[who.segment]);
}

function whoKey(who: Who): string {
  return who.kind === "site" ? who.siteId : who.segment;
}

/** Columns a phone drops: the site's line says them instead. */
const OPT = "max-sm:hidden";

function Head(p: { cols: readonly string[]; opt?: readonly string[] }): React.JSX.Element {
  return (
    <thead className="text-base-content/70">
      <tr>
        {p.cols.map((label) => (
          <th key={label} scope={COL} className={p.opt?.includes(label) ? OPT : undefined}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Section(p: { title: string; testId: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <div className="card-body min-w-0 gap-3 p-4">
        <h2 className="card-title text-base">{p.title}</h2>
        {p.children}
      </div>
    </section>
  );
}

/** A section the board draws closed: its title, and under it what it holds. */
function Closed(p: { title: string; sub: string; testId: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <details className="collapse collapse-arrow card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <summary className="collapse-title font-semibold">{p.title}</summary>
      <div className="collapse-content flex min-w-0 flex-col gap-3">
        <p className="text-sm text-base-content/70">{p.sub}</p>
        {p.children}
      </div>
    </details>
  );
}

const TABLE = "table table-sm";

/** A table wider than its card scrolls inside its own box, never the page.
 *  It scrolls, so it is reachable from a keyboard: a named region and a tab
 *  stop, named by its card's head (#947). */
function Scroll(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label={p.label}>
      {p.children}
    </div>
  );
}

const NUM = "tabular-nums";

function Figures(p: { page: CostPage }): React.JSX.Element {
  const today = p.page.capDays[0];
  const total = p.page.total;
  const tiles: { key: string; label: string; figure: string; of?: string; meter?: { value: number; max: number }; under: string }[] = [
    {
      key: "today",
      label: copy("overview.costs.stat.today"),
      figure: eur(today?.judgedEur ?? 0),
      of: copy("overview.costs.stat.today.cap", { cap: euros(TEST_DAY_EUR.cap) }),
      meter: { value: Math.min(today?.judgedEur ?? 0, TEST_DAY_EUR.cap), max: TEST_DAY_EUR.cap },
      under: copy("overview.costs.stat.today.of", { warn: euros(TEST_DAY_EUR.warn) }),
    },
    { key: "estimated", label: copy("overview.costs.stat.estimated"), figure: cents(total.estimatedCents), under: copy("overview.costs.stat.estimated.of") },
    {
      key: "billed",
      label: copy("overview.costs.stat.billed"),
      figure: billed(total),
      meter: total.calls === 0 ? undefined : { value: total.billedCalls, max: total.calls },
      under: copy("overview.costs.stat.billed.of", { billed: WHOLE.format(total.billedCalls), calls: WHOLE.format(total.calls) }),
    },
  ];
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3" data-testid="costs-figures">
      {tiles.map((tile) => (
        <div key={tile.key} className="card card-border min-w-0 bg-base-100">
          <div className="card-body gap-2 p-4">
            <span className="min-w-0 text-xs font-semibold uppercase tracking-wide text-base-content/70">{tile.label}</span>
            <span className="figure text-3xl leading-none tabular-nums">
              {tile.figure}
              {tile.of === undefined ? null : <span className="text-base text-base-content/70"> {tile.of}</span>}
            </span>
            {tile.meter === undefined ? null : <progress className="progress progress-primary" value={tile.meter.value} max={tile.meter.max} aria-hidden="true" />}
            <span className="min-w-0 text-sm text-base-content/70">{tile.under}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Cap(p: { page: CostPage }): React.JSX.Element {
  const cap = euros(TEST_DAY_EUR.cap);
  const warn = euros(TEST_DAY_EUR.warn);
  const count = (state: "warn" | "over") => p.page.capDays.filter((day) => day.state === state).length;
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="costs-cap">
      <div className="card-body min-w-0 gap-3 p-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="card-title text-base">{copy("overview.costs.cap.title")}</h2>
          <span className="text-xs text-base-content/70">
            {copy("overview.costs.cap.summary", { over: days("overview.costs.cap.over-days", count("over")), warn: days("overview.costs.cap.warn-days", count("warn")) })}
          </span>
        </div>
        <CapDays
          label={copy("overview.costs.cap.title")}
          cap={{ value: TEST_DAY_EUR.cap, label: copy("overview.costs.cap.line", { cap }) }}
          warn={{ value: TEST_DAY_EUR.warn, label: copy("overview.costs.cap.warn-line", { warn }) }}
          days={[...p.page.capDays].reverse().map((day) => ({ name: dayIn(TICK_DAY, day.day), value: day.judgedEur, figure: eur(day.judgedEur) }))}
        />
        <p className="flex flex-wrap gap-x-3 text-xs text-base-content/70 sm:hidden">
          <span>{copy("overview.costs.cap.key.line", { cap })}</span>
          <span>{copy("overview.costs.cap.key.warn-line", { warn })}</span>
        </p>
        <details className="collapse collapse-arrow min-w-0">
          <summary className="collapse-title px-0 text-sm font-semibold text-primary">{copy("overview.costs.cap.table")}</summary>
          <div className="collapse-content min-w-0 px-0">
            <Scroll label={copy("overview.costs.cap.title")}>
              <table className={TABLE}>
                <Head cols={[copy("overview.costs.col.day"), copy("overview.costs.col.judged"), copy("overview.costs.col.cap")]} />
                <tbody>
                  {p.page.capDays.map((day) => (
                    <tr key={day.day}>
                      <td>{dayIn(SHORT_DAY, day.day)}</td>
                      <td className={NUM}>{eur(day.judgedEur)}</td>
                      <td>
                        <span className={CAP_BADGE[day.state]}>{copy(CAP_KEY[day.state])}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </div>
        </details>
      </div>
    </section>
  );
}

export default async function CostsPage(): Promise<React.JSX.Element> {
  const asking = await appAccount();
  if (!asking.ok || !(await isOwner(asking.account.userId))) notFound();

  const page = await readCostPage(now()).catch(() => null);
  if (page === null) {
    return (
      <div className="flex min-w-0 flex-col gap-6" data-testid="costs">
        <h1 className="text-2xl font-semibold">{copy("overview.costs.title")}</h1>
        <div role="alert" className="alert alert-soft alert-warning">
          {copy("overview.costs.unreadable")}
        </div>
      </div>
    );
  }
  const net = TWO_PLACES.format(PLAN_NET_EUR_CENTS / 100);

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="costs">
      <header className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">{copy("overview.costs.eyebrow")}</span>
        <h1 className="text-2xl font-semibold">{copy("overview.costs.title")}</h1>
        <p className="text-sm text-base-content/70">{copy("overview.costs.lead", { today: page.days[0] === undefined ? "" : dayIn(LONG_DAY, page.days[0]) })}</p>
      </header>

      <Figures page={page} />

      <Cap page={page} />

      <Section title={copy("overview.costs.week.title")} testId="costs-week">
        {page.week.length === 0 ? (
          <p className="text-sm text-base-content/70">{copy("overview.costs.week.empty")}</p>
        ) : (
          <Scroll label={copy("overview.costs.week.title")}>
            <table className={TABLE}>
              <Head
                cols={[copy("overview.costs.col.site"), copy("overview.costs.col.estimated"), copy("overview.costs.col.billed"), copy("overview.costs.col.month", { price: euros(PRICE_EUR_CENTS / 100) })]}
                opt={[copy("overview.costs.col.estimated"), copy("overview.costs.col.billed")]}
              />
              <tbody>
                {page.week.map((line) => (
                  <tr key={whoKey(line.who)}>
                    <td className="min-w-0">
                      <span className="flex flex-col">
                        {whoName(line.who)}
                        <span className="text-xs text-base-content/70 sm:hidden">
                          {line.cell.billedCents === null
                            ? copy("overview.costs.week.sub.unbilled", { estimated: cents(line.cell.estimatedCents) })
                            : copy("overview.costs.week.sub", { estimated: cents(line.cell.estimatedCents), billed: cents(line.cell.billedCents) })}
                        </span>
                      </span>
                    </td>
                    <td className={`${NUM} ${OPT}`}>{cents(line.cell.estimatedCents)}</td>
                    <td className={`${NUM} ${OPT}`}>{billed(line.cell)}</td>
                    <td className={NUM}>
                      {line.monthEurCents === null || line.shareOfNet === null ? null : (
                        <span className="flex min-w-24 flex-col gap-1">
                          <progress className="progress progress-primary" value={Math.min(line.shareOfNet, 1)} max={1} aria-hidden="true" />
                          <span>{copy("overview.costs.share", { eur: TWO_PLACES.format(line.monthEurCents / 100), share: WHOLE.format(line.shareOfNet * 100) })}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
        <p className="text-xs text-base-content/70">{copy("overview.costs.week.note", { net })}</p>
      </Section>

      <Closed title={copy("overview.costs.days.title")} sub={copy("overview.costs.days.sub")} testId="costs-days">
        <Scroll label={copy("overview.costs.days.title")}>
          <table className={TABLE}>
            <Head cols={[copy("overview.costs.col.day"), copy("overview.costs.col.site"), copy("overview.costs.col.estimated"), copy("overview.costs.col.billed")]} />
            <tbody>
              {page.siteDays.map((line) => (
                <tr key={`${line.day}-${whoKey(line.who)}`}>
                  <td className="whitespace-nowrap">{dayIn(SHORT_DAY, line.day)}</td>
                  <td className="min-w-0">{whoName(line.who)}</td>
                  <td className={NUM}>{cents(line.cell.estimatedCents)}</td>
                  <td className={NUM}>{billed(line.cell)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Closed>

      <Closed title={copy("overview.costs.activities.title")} sub={copy("overview.costs.activities.sub")} testId="costs-activities">
        <Scroll label={copy("overview.costs.activities.title")}>
          <table className={TABLE}>
            <Head cols={[copy("overview.costs.col.activity"), copy("overview.costs.col.estimated"), copy("overview.costs.col.billed"), copy("overview.costs.col.failed")]} />
            <tbody>
              {page.activities.map((line) => (
                <tr key={line.activity}>
                  <td className="min-w-0">{copy(ACTIVITY_KEY[line.activity])}</td>
                  <td className={NUM}>{cents(line.cell.estimatedCents)}</td>
                  <td className={NUM}>{billed(line.cell)}</td>
                  <td className={NUM}>{WHOLE.format(line.cell.failedCalls + line.cell.timeoutCalls)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Closed>

      <Closed title={copy("overview.costs.vendors.title")} sub={copy("overview.costs.vendors.sub")} testId="costs-vendors">
        <Scroll label={copy("overview.costs.vendors.title")}>
          <table className={TABLE}>
            <Head cols={[copy("overview.costs.col.day"), copy("overview.costs.col.recorded"), copy("overview.costs.col.vendor-billed"), copy("overview.costs.col.gap")]} />
            <tbody>
              {page.vendors.map((line) => (
                <tr key={`${line.day}-${line.vendor}`}>
                  <td className="min-w-0">
                    <span className="flex flex-col">
                      <span className="whitespace-nowrap">{dayIn(SHORT_DAY, line.day)}</span>
                      <span className="text-xs text-base-content/70">{copy(VENDOR_KEY[line.vendor])}</span>
                    </span>
                  </td>
                  <td className={NUM}>{cents(line.recordedCents)}</td>
                  <td className={NUM}>{line.vendorBilledCents === null ? copy("overview.costs.unreported") : cents(line.vendorBilledCents)}</td>
                  <td className={NUM}>{line.gapCents === null ? null : cents(line.gapCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
        <p className="text-xs text-base-content/70">{copy("overview.costs.vendors.note")}</p>
        {page.aiBilled ? null : <p className="text-xs text-base-content/70">{copy("overview.costs.vendors.no-ai")}</p>}
      </Closed>

      <Closed title={copy("overview.costs.fixed.title", { month: dayIn(MONTH, page.fixedMonth) })} sub={copy("overview.costs.fixed.sub")} testId="costs-fixed">
        <ul className="list min-w-0">
          {page.fixed.map((line) => (
            <li key={line.vendor} className="list-row items-baseline">
              <span className="list-col-grow min-w-0">{copy(VENDOR_KEY[line.vendor])}</span>
              <span className={NUM}>
                {line.cents === null
                  ? copy("overview.costs.unreported")
                  : line.currency === "eur"
                    ? eur(line.cents / 100)
                    : eur(usdCentsToEur(line.cents))}
              </span>
            </li>
          ))}
        </ul>
      </Closed>
    </div>
  );
}
