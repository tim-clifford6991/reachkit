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
import { PLAN_NET_EUR_CENTS } from "@/lib/config/constants";
import { now } from "@/lib/config/now";
import { readCostPage, usdCentsToEur, type Activity, type Cell, type CostPage, type Who } from "@/lib/costs/site-day";
import type { FixedVendor } from "@/lib/costs/vendor-days";
import { copy, type CopyKey } from "@/lib/presentation/copy";
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

function Head(p: { cols: readonly CopyKey[] }): React.JSX.Element {
  return (
    <thead className="text-base-content/70">
      <tr>
        {p.cols.map((key) => (
          <th key={key} scope={COL}>
            {copy(key)}
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
  const tiles: { key: string; label: string; figure: string; under: string }[] = [
    { key: "estimated", label: copy("overview.costs.stat.estimated"), figure: cents(p.page.total.estimatedCents), under: "" },
    {
      key: "billed",
      label: copy("overview.costs.stat.billed"),
      figure: billed(p.page.total),
      under: copy("overview.costs.stat.billed.of", { billed: WHOLE.format(p.page.total.billedCalls), calls: WHOLE.format(p.page.total.calls) }),
    },
    { key: "today", label: copy("overview.costs.stat.today"), figure: eur(today?.judgedEur ?? 0), under: copy("overview.costs.stat.today.of") },
  ];
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3" data-testid="costs-figures">
      {tiles.map((tile) => (
        <div key={tile.key} className="card card-border min-w-0 bg-base-100">
          <div className="card-body gap-2 p-4">
            <span className="min-w-0 text-xs font-semibold uppercase tracking-wide text-base-content/70">{tile.label}</span>
            <span className="figure text-3xl leading-none tabular-nums">{tile.figure}</span>
            {tile.under === "" ? null : <span className="min-w-0 text-sm text-base-content/70">{tile.under}</span>}
          </div>
        </div>
      ))}
    </div>
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
        <h1 className="text-2xl font-semibold">{copy("overview.costs.title")}</h1>
        <p className="text-sm text-base-content/70">{copy("overview.costs.lead", { today: page.days[0] ?? "" })}</p>
      </header>

      <Figures page={page} />

      <Section title={copy("overview.costs.week.title")} testId="costs-week">
        {page.week.length === 0 ? (
          <p className="text-sm text-base-content/70">{copy("overview.costs.week.empty")}</p>
        ) : (
          <Scroll label={copy("overview.costs.week.title")}>
            <table className={TABLE}>
              <Head cols={["overview.costs.col.site", "overview.costs.col.estimated", "overview.costs.col.billed", "overview.costs.col.month"]} />
              <tbody>
                {page.week.map((line) => (
                  <tr key={whoKey(line.who)}>
                    <td className="min-w-0">{whoName(line.who)}</td>
                    <td className={NUM}>{cents(line.cell.estimatedCents)}</td>
                    <td className={NUM}>{billed(line.cell)}</td>
                    <td className={NUM}>
                      {line.monthEurCents === null || line.shareOfNet === null ? null : (
                        <span className="flex flex-col">
                          <span>{eur(line.monthEurCents / 100)}</span>
                          <span className="text-xs text-base-content/70">
                            {copy("overview.costs.share", { share: WHOLE.format(line.shareOfNet * 100), net })}
                          </span>
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

      <Section title={copy("overview.costs.days.title")} testId="costs-days">
        <Scroll label={copy("overview.costs.days.title")}>
          <table className={TABLE}>
            <Head cols={["overview.costs.col.day", "overview.costs.col.site", "overview.costs.col.estimated", "overview.costs.col.billed"]} />
            <tbody>
              {page.siteDays.map((line) => (
                <tr key={`${line.day}-${whoKey(line.who)}`}>
                  <td className="font-mono break-all">{line.day}</td>
                  <td className="min-w-0">{whoName(line.who)}</td>
                  <td className={NUM}>{cents(line.cell.estimatedCents)}</td>
                  <td className={NUM}>{billed(line.cell)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Section>

      <Section title={copy("overview.costs.activities.title")} testId="costs-activities">
        <Scroll label={copy("overview.costs.activities.title")}>
          <table className={TABLE}>
            <Head cols={["overview.costs.col.activity", "overview.costs.col.estimated", "overview.costs.col.billed", "overview.costs.col.failed"]} />
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
      </Section>

      <Section title={copy("overview.costs.vendors.title")} testId="costs-vendors">
        <Scroll label={copy("overview.costs.vendors.title")}>
          <table className={TABLE}>
            <Head cols={["overview.costs.col.day", "overview.costs.col.recorded", "overview.costs.col.vendor-billed", "overview.costs.col.gap"]} />
            <tbody>
              {page.vendors.map((line) => (
                <tr key={`${line.day}-${line.vendor}`}>
                  <td className="min-w-0">
                    <span className="flex flex-col">
                      <span className="font-mono break-all">{line.day}</span>
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
      </Section>

      <Section title={copy("overview.costs.cap.title")} testId="costs-cap">
        <Scroll label={copy("overview.costs.cap.title")}>
          <table className={TABLE}>
            <Head cols={["overview.costs.col.day", "overview.costs.col.judged", "overview.costs.col.cap"]} />
            <tbody>
              {page.capDays.map((day) => (
                <tr key={day.day}>
                  <td className="font-mono break-all">{day.day}</td>
                  <td className={NUM}>{eur(day.judgedEur)}</td>
                  <td>
                    <span className={CAP_BADGE[day.state]}>{copy(CAP_KEY[day.state])}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Section>

      <Section title={copy("overview.costs.fixed.title", { month: page.fixedMonth.slice(0, 7) })} testId="costs-fixed">
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
      </Section>
    </div>
  );
}
