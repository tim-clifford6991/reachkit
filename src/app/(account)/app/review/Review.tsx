// The owner's review screen: the Week tab holds each paying site's committed
// week and what was left out and why; the Pages tab, how each live page
// stands. Read-only.
import type React from "react";
import type { ContentType } from "@/lib/opportunities/content-type";
import type { CommittedRow, NotChosenRow } from "@/lib/opportunities/review/week";
import type { PointPart } from "@/lib/opportunities/types";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { whyLineOf } from "../calendar/card-lines";
import type { LivePage, ReviewSite } from "./store";

const COL = "col";
const NONE = "—";
const SEP = ": ";
const TABS = "review-tab";
const WEEK = "week";
const PAGES = "pages";
const TABLE = "table table-sm";
const NUM = "tabular-nums";
const MUTED = "text-sm text-base-content/70";

const LABEL: Record<Label, { key: CopyKey; badge: string }> = {
  working: { key: "review.label.working", badge: "badge badge-soft badge-success" },
  climbing: { key: "review.label.climbing", badge: "badge badge-soft badge-primary" },
  too_early: { key: "review.label.too_early", badge: "badge badge-soft" },
  not_moving: { key: "review.label.not_moving", badge: "badge badge-soft badge-warning" },
};
const UNMEASURED_BADGE = "badge badge-ghost";

const PAGE: Record<Exclude<ContentType, "update">, CopyKey> = {
  listicle: "review.page.listicle",
  how_to: "review.page.how_to",
  documentation: "review.page.documentation",
  research: "review.page.research",
  qa: "review.page.qa",
  insights: "review.page.insights",
  offering: "review.page.offering",
};

const PART: Record<PointPart, CopyKey> = {
  fit: "review.part.fit",
  demand: "review.part.demand",
  ai_gap: "review.part.ai_gap",
  near_page_one: "review.part.near_page_one",
  linked_by_ai: "review.part.linked_by_ai",
  not_moving: "review.part.not_moving",
};

// A stored day is a calendar date, so it is read in UTC to keep its own weekday.
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const WEEK_OF = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const dateOf = (day: string) => new Date(`${day}T00:00:00.000Z`);

function cell(value: string | number | null): string {
  return value === null ? NONE : String(value);
}

function pageWord(row: CommittedRow): string {
  if (row.page === "update") return copy("review.page.update");
  const type = row.writeAs === "qa" ? "qa" : row.page;
  return type === null ? NONE : copy("review.page.new", { type: copy(PAGE[type]) });
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

/** A table wider than its card scrolls inside its own box, reachable from a keyboard. */
function Scroll(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label={p.label}>
      {p.children}
    </div>
  );
}

function Committed(p: { domain: string; rows: readonly CommittedRow[] }): React.JSX.Element {
  return (
    <Scroll label={p.domain}>
      <table className={TABLE} data-testid="review-week">
        <Head cols={["review.col.day", "review.col.page", "review.col.search", "review.col.points", "review.col.why"]} />
        <tbody>
          {p.rows.map((row) => (
            <tr key={row.place}>
              <td className="whitespace-nowrap">{row.day === null ? copy("review.spare") : WEEKDAY.format(dateOf(row.day))}</td>
              <td>
                <span className="flex flex-col">
                  <strong>{pageWord(row)}</strong>
                  <span className="font-mono text-xs text-base-content/70">{row.type}</span>
                </span>
              </td>
              <td className="font-mono break-words">{cell(row.search)}</td>
              <td>
                <span className="flex flex-col gap-1">
                  <strong className={NUM}>{cell(row.points)}</strong>
                  <span className="flex flex-wrap gap-1">
                    {row.parts.map((part) => (
                      <span key={part.part} className="badge badge-soft badge-primary badge-sm">{`${copy(PART[part.part])} ${part.n}`}</span>
                    ))}
                  </span>
                  <span className="text-xs text-base-content/70">
                    {copy("review.points.measures", { fit: cell(row.fit), volume: cell(row.volume) })}
                  </span>
                </span>
              </td>
              <td>
                <span className="flex flex-col gap-1">
                  <span>{whyLineOf({ points: row.points ?? 0, parts: [...row.parts], rule: null }) ?? NONE}</span>
                  <span className="text-xs text-base-content/70">{copy("review.why.rule", { rule: cell(row.rule) })}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  );
}

function NotChosen(p: { rows: readonly NotChosenRow[] }): React.JSX.Element {
  return (
    <details className="collapse collapse-arrow min-w-0 rounded-none">
      <summary className="collapse-title min-h-0 p-0 pe-10 text-sm font-medium">
        {/* Inline spans keep the board's sentence one run for the parity reading. */}
        <span>{copy("review.rejected.title", { count: String(p.rows.length) })}</span>
        <span className="block text-xs font-normal">{copy("review.rejected.lead")}</span>
      </summary>
      <ul className="collapse-content min-w-0 list-disc px-0 ps-5 pt-2 text-sm">
        {p.rows.map((row, n) => (
          <li key={n} className="break-words">
            <span className="font-mono">{cell(row.search)}</span>
            {SEP}
            {row.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

function SiteCard(p: { domain: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="review-site">
      <div className="card-body min-w-0 gap-3 p-4">
        <h2 className="card-title font-mono text-base break-all">{p.domain}</h2>
        {p.children}
      </div>
    </section>
  );
}

function Week(p: { site: ReviewSite }): React.JSX.Element {
  const { week } = p.site;
  return (
    <SiteCard domain={p.site.domain}>
      {week.committed.length === 0 ? (
        <p className={MUTED}>{copy("review.week.empty")}</p>
      ) : (
        <Committed domain={p.site.domain} rows={week.committed} />
      )}
      {week.rejected.length === 0 ? null : <NotChosen rows={week.rejected} />}
    </SiteCard>
  );
}

function Pages(p: { site: ReviewSite }): React.JSX.Element {
  const pages: readonly LivePage[] = p.site.pages;
  return (
    <SiteCard domain={p.site.domain}>
      {pages.length === 0 ? (
        <p className={MUTED}>{copy("review.pages.empty")}</p>
      ) : (
        <ul className="list min-w-0" data-testid="review-pages">
          {pages.map((page) => {
            const label = page.label === null ? null : LABEL[page.label];
            return (
              <li key={page.id} className="list-row items-baseline">
                <span className="list-col-grow min-w-0 font-mono text-sm break-all">{page.url}</span>
                <span className={label?.badge ?? UNMEASURED_BADGE}>{copy(label?.key ?? "review.label.unmeasured")}</span>
              </li>
            );
          })}
        </ul>
      )}
    </SiteCard>
  );
}

/** The first day any site's committed week starts; `null` where none has one. */
function weekOf(sites: readonly ReviewSite[]): string | null {
  const days = sites.flatMap((site) => site.week.committed.flatMap((row) => (row.day === null ? [] : [row.day]))).sort();
  return days[0] ?? null;
}

// Native radios pick the panel through CSS alone; the panels sit outside the
// tab bar so neither escapes the other's box.
function Tabs(p: { sites: readonly ReviewSite[] }): React.JSX.Element {
  return (
    <div className="group flex min-w-0 flex-col gap-4">
      <div role="radiogroup" aria-label={copy("review.tabs")} className="tabs tabs-border min-w-0">
        <input type="radio" name={TABS} value={WEEK} className="tab" aria-label={copy("review.tab.week")} defaultChecked />
        <input type="radio" name={TABS} value={PAGES} className="tab" aria-label={copy("review.tab.pages")} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 group-has-[[value=pages]:checked]:hidden" data-testid="review-tab-week">
        {p.sites.map((site) => (
          <Week key={site.id} site={site} />
        ))}
      </div>
      <div className="hidden min-w-0 flex-col gap-4 group-has-[[value=pages]:checked]:flex" data-testid="review-tab-pages">
        {p.sites.map((site) => (
          <Pages key={site.id} site={site} />
        ))}
      </div>
    </div>
  );
}

/** `sites` is `null` where they could not be read. */
export function Review(p: { sites: readonly ReviewSite[] | null }): React.JSX.Element {
  const week = p.sites === null ? null : weekOf(p.sites);
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="review">
      <header className="flex min-w-0 flex-col gap-1">
        <span className="eyebrow">{week === null ? copy("review.eyebrow") : copy("review.eyebrow.week", { date: WEEK_OF.format(dateOf(week)) })}</span>
        <h1 className="text-2xl font-semibold">{copy("review.title")}</h1>
      </header>
      {p.sites === null ? (
        <div role="alert" className="alert alert-soft alert-warning">
          {copy("review.unreadable")}
        </div>
      ) : p.sites.length === 0 ? (
        <p className={MUTED}>{copy("review.no-sites")}</p>
      ) : (
        <Tabs sites={p.sites} />
      )}
    </div>
  );
}
