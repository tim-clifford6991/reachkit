// The owner's review screen, on one screen: the week's figures across every paying site, then one site's committed
// week with an OK or Flag per row, its live pages, and every row still flagged. A mark changes nothing but itself.
import type React from "react";
import Link from "next/link";
import { Check, ChevronDown, FileText, Flag } from "lucide-react";
import type { ContentType } from "@/lib/opportunities/content-type";
import type { CommittedRow } from "@/lib/opportunities/review/week";
import type { PlanWriteAs, PointPart } from "@/lib/opportunities/types";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { WEEK_PLAN } from "@/lib/config/constants";
import { LinkMapPanel } from "../settings/panels/LinkMapPanel";
import { whyLineOf } from "../calendar/card-lines";
import { markKey, markRow, type Mark, type MarkValue, type Marks } from "./marks";
import type { LivePage, Review as ReviewData, ReviewSite } from "./store";

const COL = "col";
const NONE = "—";
const SEP = ": ";
const TABS = "review-tab";
const WEEK = "week";
const PAGES = "pages";
const FLAGGED = "flagged";
const MARK = "mark";
const OK: MarkValue = "ok";
const FLAG: MarkValue = "flag";
// A topic the commit or a stop rested is set aside; every other held row was not chosen.
const RESTING = "resting";
// From `lg` the review is no taller than the screen: the week's table scrolls inside its own box instead.
const FIT = "lg:max-h-[calc(100dvh-4rem)] lg:min-h-0";
// Below `sm` each row stacks, as the board draws it at 390; from `sm` the Page column keeps its width.
const TABLE = "table table-sm max-sm:block";
const STACK = "max-sm:block";
const ROW = "max-sm:block max-sm:border-b max-sm:border-base-300 max-sm:py-2";
const CELL = "max-sm:block max-sm:border-0 max-sm:py-1";
const NUM = "tabular-nums";
const MUTED = "text-sm text-base-content/70";
// The checked tab is primary and underlined, as the board draws it. A radio draws no
// daisyUI bar of its own, so the bar is the label's border; `!` outranks the tab's own colours.
const TAB = "tab min-h-11 rounded-none! border-b-3! border-transparent! has-checked:border-current! has-checked:text-primary!";

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
  new_site: "review.part.new_site",
  outsized: "review.part.outsized",
  no_demand: "review.part.no_demand",
  rising: "review.part.rising",
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
  const type = (row.writeAs as PlanWriteAs | null) ?? row.page;
  return type === null ? NONE : copy("review.page.new", { type: copy(PAGE[type]) });
}

function Head(p: { cols: readonly CopyKey[] }): React.JSX.Element {
  return (
    <thead className="text-base-content/70 max-sm:hidden">
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


/** OK and Flag for one row; the pressed one shows the row's latest mark. */
function MarkButtons(p: { siteId: string; row: CommittedRow; mark: Mark | undefined }): React.JSX.Element {
  return (
    <form action={markRow} className="join">
      <input type="hidden" name="site" value={p.siteId} />
      <input type="hidden" name="opportunity" value={p.row.id} />
      <button type="submit" name={MARK} value={OK} aria-pressed={p.mark?.mark === OK} className={`btn btn-sm join-item ${p.mark?.mark === OK ? "btn-success" : ""}`}>
        <Check aria-hidden className="size-4" />
        {copy("review.mark.ok")}
      </button>
      <button type="submit" name={MARK} value={FLAG} aria-pressed={p.mark?.mark === FLAG} className={`btn btn-sm join-item ${p.mark?.mark === FLAG ? "btn-warning" : "btn-ghost"}`}>
        <Flag aria-hidden className="size-4" />
        {copy("review.mark.flag")}
      </button>
    </form>
  );
}

/** A table wider or taller than its card scrolls inside its own box, reachable from a keyboard. */
function Committed(p: { site: ReviewSite; marks: Marks }): React.JSX.Element {
  return (
    <div className="min-w-0 overflow-x-auto lg:min-h-0 lg:overflow-y-auto" tabIndex={0} role="region" aria-label={p.site.domain}>
      <table className={TABLE} data-testid="review-week">
        <Head cols={["review.col.day", "review.col.page", "review.col.search", "review.col.points", "review.col.why", "review.col.mark"]} />
        <tbody className={STACK}>
          {p.site.week.committed.map((row) => (
            <tr key={row.place} className={ROW}>
              <td className={`${CELL} whitespace-nowrap max-sm:text-xs max-sm:font-semibold max-sm:uppercase max-sm:text-base-content/70`}>
                {row.day === null ? copy("review.spare") : WEEKDAY.format(dateOf(row.day))}
              </td>
              <td className={`${CELL} sm:min-w-40`} data-testid="review-page">
                <span className="flex flex-col">
                  {row.title === null ? null : <strong>{row.title}</strong>}
                  <span className="text-sm text-base-content/70">{pageWord(row)}</span>
                </span>
              </td>
              <td className={`${CELL} font-mono break-words`}>{cell(row.search)}</td>
              <td className={CELL}>
                <span className="flex flex-wrap items-center gap-1">
                  <strong className={NUM}>{cell(row.points)}</strong>
                  {row.parts.map((part) => (
                    <span key={part.part} className="badge badge-soft badge-primary badge-sm">{`${copy(PART[part.part])} ${part.n}`}</span>
                  ))}
                </span>
              </td>
              <td className={`${CELL} sm:min-w-50`}>{whyOf(row)}</td>
              <td className={CELL}>
                <MarkButtons siteId={p.site.id} row={row} mark={p.marks.get(markKey(p.site.id, row.id))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function whyOf(row: CommittedRow): string {
  return whyLineOf({ points: row.points ?? 0, parts: [...row.parts], rule: null }) ?? NONE;
}

/** A quiet link that opens in place, as Plan draws it: the chevron leads and turns. */
function Opens(p: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <details className="collapse group min-w-0 rounded-none">
      <summary className="collapse-title link link-primary flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 p-0 text-sm font-semibold no-underline [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        {p.title}
      </summary>
      <div className="collapse-content min-w-0 px-0 pt-2 text-sm">{p.children}</div>
    </details>
  );
}

function Searches(p: { rows: readonly { search: string | null; line: string }[] }): React.JSX.Element {
  return (
    <ul className="min-w-0 list-disc ps-5">
      {p.rows.map((row, n) => (
        <li key={n} className="break-words">
          <span className="font-mono">{cell(row.search)}</span>
          {SEP}
          {row.line}
        </li>
      ))}
    </ul>
  );
}

function SiteCard(p: { domain: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className={`card card-border min-w-0 bg-base-100 ${FIT}`} data-testid="review-site">
      <div className="card-body min-w-0 gap-3 p-4 lg:min-h-0">
        <h2 className="card-title font-mono text-base break-all">{p.domain}</h2>
        {p.children}
      </div>
    </section>
  );
}

function Week(p: { site: ReviewSite; marks: Marks }): React.JSX.Element {
  const { week } = p.site;
  const notChosen = week.rejected.filter((row) => row.reason !== RESTING);
  const setAside = week.rejected.filter((row) => row.reason === RESTING);
  return (
    <>
      <SiteCard domain={p.site.domain}>
        {week.committed.length === 0 ? <p className={MUTED}>{copy("review.week.empty")}</p> : <Committed site={p.site} marks={p.marks} />}
        {notChosen.length === 0 ? null : (
          <Opens title={copy("review.rejected.title", { count: String(notChosen.length) })}>
            <Searches rows={notChosen.map((row) => ({ search: row.search, line: row.reason }))} />
          </Opens>
        )}
      </SiteCard>
      <div className="flex min-w-0 flex-wrap gap-x-6">
        {week.committed.length === 0 ? null : (
          <Opens title={copy("review.difficulty.title")}>
            <Searches rows={week.committed.map((row) => ({ search: row.search, line: String(p.site.difficulty.get(row.id) ?? copy("review.label.unmeasured")) }))} />
          </Opens>
        )}
        <Opens title={copy("review.aside.title")}>
          {setAside.length === 0 ? <p className={MUTED}>{copy("review.aside.empty")}</p> : <Searches rows={setAside.map((row) => ({ search: row.search, line: row.type }))} />}
        </Opens>
        <Opens title={copy("review.links.title")}>
          <LinkMapPanel map={p.site.links} />
        </Opens>
      </div>
    </>
  );
}

function Pages(p: { site: ReviewSite }): React.JSX.Element {
  const pages: readonly LivePage[] = p.site.pages;
  return (
    <SiteCard domain={p.site.domain}>
      {pages.length === 0 ? (
        <p className={MUTED}>{copy("review.pages.empty")}</p>
      ) : (
        <ul className="list min-w-0 lg:min-h-0 lg:overflow-y-auto" data-testid="review-pages">
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

/** Every site's rows whose latest mark this week is a flag. */
function flagged(review: ReviewData): { site: ReviewSite; row: CommittedRow; mark: Mark }[] {
  return review.sites.flatMap((site) =>
    site.week.committed.flatMap((row) => {
      const mark = review.marks.get(markKey(site.id, row.id));
      return mark?.mark === "flag" ? [{ site, row, mark }] : [];
    })
  );
}

function Flagged(p: { review: ReviewData }): React.JSX.Element {
  const rows = flagged(p.review);
  return (
    <section className={`card card-border min-w-0 bg-base-100 ${FIT}`}>
      <div className="card-body min-w-0 p-4 lg:min-h-0">
        {rows.length === 0 ? (
          <p className={MUTED}>{copy("review.flagged.empty")}</p>
        ) : (
          <ul className="list min-w-0 lg:min-h-0 lg:overflow-y-auto" data-testid="review-flagged">
            {rows.map(({ site, row, mark }) => (
              <li key={markKey(site.id, row.id)} className="list-row min-w-0 items-start max-sm:flex max-sm:flex-col">
                <span className="list-col-grow flex min-w-0 flex-col">
                  <span className="text-sm text-base-content/70">
                    <span className="font-mono break-all">{site.domain}</span>
                    {` · ${row.day === null ? copy("review.spare") : WEEKDAY.format(dateOf(row.day))}`}
                  </span>
                  <strong>{row.title ?? cell(row.search)}</strong>
                  {mark.note === null ? null : <span className="text-sm break-words">{mark.note}</span>}
                </span>
                <form action={markRow} className="flex min-w-0 flex-wrap items-center gap-2">
                  <input type="hidden" name="site" value={site.id} />
                  <input type="hidden" name="opportunity" value={row.id} />
                  <input name="note" maxLength={280} defaultValue={mark.note ?? ""} aria-label={copy("review.note")} placeholder={copy("review.note")} className="input input-sm min-w-0" />
                  <button type="submit" name={MARK} value={FLAG} className="btn btn-sm btn-ghost">
                    {copy("review.note.save")}
                  </button>
                  <button type="submit" name={MARK} value={OK} className="btn btn-sm">
                    <Check aria-hidden className="size-4" />
                    {copy("review.mark.ok")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Figure(p: { kind: CopyKey; value: number; desc?: string }): React.JSX.Element {
  return (
    <div className="stat px-4 py-2">
      <div className="stat-title">{copy(p.kind)}</div>
      <div className={`stat-value text-2xl ${NUM}`}>{p.value}</div>
      {p.desc === undefined ? null : <div className="stat-desc">{p.desc}</div>}
    </div>
  );
}

function Figures(p: { review: ReviewData }): React.JSX.Element {
  const { sites } = p.review;
  const sum = (of: (site: ReviewSite) => number) => sites.reduce((total, site) => total + of(site), 0);
  return (
    <div className="stats stats-vertical sm:stats-horizontal card-border min-w-0 shrink-0 bg-base-100 max-sm:w-full" data-testid="review-figures">
      <Figure kind="review.fig.sites" value={sites.length} />
      <Figure
        kind="review.fig.committed"
        value={sum((site) => site.week.committed.filter((row) => row.day !== null).length)}
        desc={copy("review.fig.committed.of", { count: String(WEEK_PLAN.days * sites.length) })}
      />
      <Figure kind="review.fig.short" value={sites.filter((site) => site.week.rejected.some((row) => row.reason === RESTING)).length} />
      <Figure kind="review.fig.stopped" value={sum((site) => site.stopped)} />
      <Figure kind="review.fig.flips" value={sum((site) => site.flips)} desc={copy("review.fig.flips.since")} />
      <Figure kind="review.fig.flags" value={flagged(p.review).length} />
    </div>
  );
}

const md = (value: string | number | null) => cell(value).replace(/\|/g, "\\|").replace(/\s+/g, " ");

/** The week as Markdown, every site, for the owner to keep. */
function markdownOf(review: ReviewData, heading: string): string {
  const cols = (["review.col.day", "review.col.page", "review.col.search", "review.col.points", "review.col.why", "review.col.mark"] as const).map((key) => copy(key));
  const lines = [`# ${heading}`];
  for (const site of review.sites) {
    lines.push("", `## ${site.domain}`, "", `| ${cols.join(" | ")} |`, `|${cols.map(() => " --- |").join("")}`);
    for (const row of site.week.committed) {
      const mark = review.marks.get(markKey(site.id, row.id));
      const marked = mark === undefined ? NONE : `${copy(mark.mark === "ok" ? "review.mark.ok" : "review.mark.flag")}${mark.note === null ? "" : `${SEP}${mark.note}`}`;
      const day = row.day === null ? copy("review.spare") : WEEKDAY.format(dateOf(row.day));
      lines.push(`| ${[day, `${row.title ?? NONE} (${pageWord(row)})`, row.search, row.points, whyOf(row), marked].map(md).join(" | ")} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

// Native radios pick the panel through CSS alone; the panels sit outside the
// tab bar so neither escapes the other's box.
function Tabs(p: { review: ReviewData; site: ReviewSite }): React.JSX.Element {
  const panel = "min-w-0 flex-col gap-3 lg:min-h-0";
  return (
    <div className="group flex min-w-0 flex-col gap-3 lg:min-h-0">
      <div role="radiogroup" aria-label={copy("review.tabs")} className="tabs tabs-border min-w-0 shrink-0">
        {([[WEEK, "review.tab.week"], [PAGES, "review.tab.pages"], [FLAGGED, "review.tab.flagged"]] as const).map(([value, key]) => (
          <label key={value} className={TAB}>
            <input type="radio" name={TABS} value={value} className="sr-only" defaultChecked={value === WEEK} />
            {copy(key)}
          </label>
        ))}
      </div>
      <div className={`flex ${panel} group-has-[[value=pages]:checked]:hidden group-has-[[value=flagged]:checked]:hidden`} data-testid="review-tab-week">
        <Week site={p.site} marks={p.review.marks} />
      </div>
      <div className={`hidden ${panel} group-has-[[value=pages]:checked]:flex`} data-testid="review-tab-pages">
        <Pages site={p.site} />
      </div>
      <div className={`hidden ${panel} group-has-[[value=flagged]:checked]:flex`} data-testid="review-tab-flagged">
        <Flagged review={p.review} />
      </div>
    </div>
  );
}

/** The site to show, of those read: the one asked for, else the first. */
function SitePick(p: { sites: readonly ReviewSite[]; site: ReviewSite }): React.JSX.Element {
  return (
    <details className="dropdown dropdown-end">
      <summary className="btn btn-soft btn-sm max-w-64 font-mono" aria-label={copy("review.site")}>
        <span className="truncate">{p.site.domain}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0" />
      </summary>
      <ul className="menu dropdown-content z-10 mt-1 w-72 rounded-box bg-base-100 p-2 shadow-sm">
        {p.sites.map((site) => (
          <li key={site.id}>
            <Link href={`?site=${site.id}`} aria-current={site.id === p.site.id ? "page" : undefined} className="font-mono break-all">
              {site.domain}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** `review` is `null` where it could not be read; `siteId` is the site asked for. */
export function Review(p: { review: ReviewData | null; siteId: string | null }): React.JSX.Element {
  const site = p.review === null ? undefined : (p.review.sites.find((one) => one.id === p.siteId) ?? p.review.sites[0]);
  const heading = p.review === null ? null : copy("review.eyebrow.week", { date: WEEK_OF.format(dateOf(p.review.week)) });
  return (
    <div className={`flex min-w-0 flex-col gap-4 ${FIT}`} data-testid="review">
      <header className="flex min-w-0 shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {heading === null ? null : <span className="eyebrow">{heading}</span>}
          <h1>{copy("review.title")}</h1>
        </div>
        {p.review === null || site === undefined || heading === null ? null : (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={MUTED}>{copy("review.site")}</span>
            <SitePick key={site.id} sites={p.review.sites} site={site} />
            <a className="btn btn-soft btn-sm" download={`review-${p.review.week}.md`} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdownOf(p.review, heading))}`}>
              <FileText aria-hidden className="size-4" />
              {copy("review.export")}
            </a>
          </div>
        )}
      </header>
      {p.review === null ? (
        <div role="alert" className="alert alert-soft alert-warning">
          {copy("review.unreadable")}
        </div>
      ) : site === undefined ? (
        <p className={MUTED}>{copy("review.no-sites")}</p>
      ) : (
        <>
          <Figures review={p.review} />
          <Tabs review={p.review} site={site} />
        </>
      )}
    </div>
  );
}
