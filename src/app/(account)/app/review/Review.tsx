// The owner's review screen, on one screen: the week's figures across every paying site, then one site's committed
// week with an OK or Flag per row, its live pages, and every row still flagged. A mark changes nothing but itself.
import type React from "react";
import Link from "next/link";
import { ChevronDown, FileText } from "lucide-react";
import type { CommittedRow } from "@/lib/opportunities/review/week";
import type { PlanWriteAs, PointPart } from "@/lib/opportunities/types";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { pageTypeWord } from "@/lib/presentation/page-type";
import { LinkMapPanel } from "../settings/panels/LinkMapPanel";
import { whyLineOf } from "../calendar/card-lines";
import { Answers } from "./Answers";
import type { OpenedAnswer, SiteAnswers } from "./answers";
import { markRow } from "./marks";
import { MarkForm } from "./MarkForm";
import { markKey, type LivePage, type Marks, type Review as ReviewData, type ReviewSite } from "./model";

const COL = "col";
const NONE = "—";
const SEP = ": ";
const TABS = "review-tab";
const WEEK = "week";
const PAGES = "pages";
const FLAGGED = "flagged";
const ANSWERS = "answers";
// Only one section opens at a time, and its content scrolls in its own box, so the week keeps its rows in view.
const SECTIONS = "review-section";
// A topic the commit or a stop rested is set aside; every other held row was not chosen.
const RESTING = "resting";
// From `lg` a tab's rows scroll in their own box, sized so the screen holds them with one section open below; on a
// short screen the box keeps 12rem and the page scrolls instead.
const BOX = "lg:max-h-[max(12rem,calc(100dvh-34rem))] lg:overflow-y-auto";
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

const PART: Record<PointPart, CopyKey> = {
  fit: "review.part.fit",
  demand: "review.part.demand",
  ai_gap: "review.part.ai_gap",
  near_page_one: "review.part.near_page_one",
  linked_by_ai: "review.part.linked_by_ai",
  not_moving: "review.part.not_moving",
  shown_no_visits: "review.part.shown_no_visits",
  new_site: "review.part.new_site",
  outsized: "review.part.outsized",
  no_demand: "review.part.no_demand",
  no_footprint: "review.part.no_footprint",
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
  return pageTypeWord(row.page === "update" ? "update" : ((row.writeAs as PlanWriteAs | null) ?? row.page)) ?? NONE;
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


/** A table wider or taller than its card scrolls inside its own box, reachable from a keyboard. */
function Committed(p: { site: ReviewSite; marks: Marks }): React.JSX.Element {
  return (
    <div className={`min-w-0 overflow-x-auto ${BOX}`} tabIndex={0} role="region" aria-label={p.site.domain}>
      <table className={TABLE} data-testid="review-week">
        <Head cols={["review.col.day", "review.col.page", "review.col.search", "review.col.points", "review.col.why", "review.col.mark"]} />
        <tbody className={STACK}>
          {p.site.committed.map((row) => (
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
                <MarkForm action={markRow} siteId={p.site.id} opportunityId={row.id} row={nameOf(row)} mark={p.marks.get(markKey(p.site.id, row.id))?.mark ?? null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const nameOf = (row: CommittedRow): string => row.title ?? cell(row.search);

function whyOf(row: CommittedRow): string {
  return whyLineOf({ points: row.points ?? 0, parts: [...row.parts], rule: null }) ?? NONE;
}

/** A quiet link that opens in place, as Plan draws it: the chevron leads and turns. */
function Opens(p: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <details name={SECTIONS} className="collapse group w-fit min-w-0 rounded-none open:order-last open:w-full open:basis-full">
      <summary className="collapse-title link link-primary flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 p-0 text-sm font-semibold no-underline [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        {p.title}
      </summary>
      <div className="collapse-content min-w-0 px-0 pt-1 text-sm">
        <div className="max-h-20 min-w-0 overflow-y-auto" tabIndex={0} role="region" aria-label={p.title}>
          {p.children}
        </div>
      </div>
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

/** A site's card; the week's card is titled by the site picker above it. */
function SiteCard(p: { domain: string | null; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="review-site">
      <div className="card-body min-w-0 gap-3 p-3">
        {p.domain === null ? null : <h2 className="card-title font-mono text-base break-all">{p.domain}</h2>}
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
      <SiteCard domain={null}>
        {p.site.committed.length === 0 ? <p className={MUTED}>{copy("review.week.empty")}</p> : <Committed site={p.site} marks={p.marks} />}
      </SiteCard>
      <div className="flex min-w-0 shrink-0 flex-wrap gap-x-6">
        {notChosen.length === 0 ? null : (
          <Opens title={copy("review.rejected.title", { count: String(notChosen.length) })}>
            <Searches rows={notChosen.map((row) => ({ search: row.search, line: row.reason }))} />
          </Opens>
        )}
        {p.site.committed.length === 0 ? null : (
          <Opens title={copy("review.difficulty.title")}>
            <Searches rows={p.site.committed.map((row) => ({ search: row.search, line: String(p.site.difficulty.get(row.id) ?? copy("review.label.unmeasured")) }))} />
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
        <div className={`min-w-0 ${BOX}`} tabIndex={0} role="region" aria-label={p.site.domain}>
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
        </div>
      )}
    </SiteCard>
  );
}

function Flagged(p: { review: ReviewData }): React.JSX.Element {
  const rows = p.review.flagged;
  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body min-w-0 p-4">
        {rows.length === 0 ? (
          <p className={MUTED}>{copy("review.flagged.empty")}</p>
        ) : (
          <div className={`min-w-0 ${BOX}`} tabIndex={0} role="region" aria-label={copy("review.tab.flagged")}>
          <ul className="list min-w-0" data-testid="review-flagged">
            {rows.map(({ site, row, mark }) => (
              <li key={markKey(site.id, row.id)} className="list-row min-w-0 items-start max-sm:flex max-sm:flex-col">
                <span className="list-col-grow flex min-w-0 flex-col">
                  <span className="text-sm text-base-content/70">
                    <span className="font-mono break-all">{site.domain}</span>
                    {` · ${row.day === null ? copy("review.spare") : WEEKDAY.format(dateOf(row.day))}`}
                  </span>
                  <strong>{nameOf(row)}</strong>
                </span>
                <MarkForm action={markRow} siteId={site.id} opportunityId={row.id} row={nameOf(row)} mark={mark.mark} note={mark.note} />
              </li>
            ))}
          </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Figure(p: { kind: CopyKey; value: number; desc?: string }): React.JSX.Element {
  return (
    <div className="stat px-4 py-2">
      <div className="stat-title text-base-content/70">{copy(p.kind)}</div>
      <div className={`stat-value text-2xl ${NUM}`}>{p.value}</div>
      {p.desc === undefined ? null : <div className="stat-desc text-base-content/70">{p.desc}</div>}
    </div>
  );
}

/** Every figure comes from the one model, so all six count the week the header names. */
function Figures(p: { review: ReviewData }): React.JSX.Element {
  const f = p.review.figures;
  return (
    <div className="stats stats-vertical grid-cols-2 card-border min-w-0 bg-base-100 sm:grid-cols-3 lg:stats-horizontal lg:grid-cols-none" data-testid="review-figures">
      <Figure kind="review.fig.sites" value={f.sites} />
      <Figure kind="review.fig.committed" value={f.committed} desc={copy("review.fig.committed.of", { count: String(f.of) })} />
      <Figure kind="review.fig.short" value={f.short} />
      <Figure kind="review.fig.stopped" value={f.stopped} />
      <Figure kind="review.fig.flips" value={f.flips} desc={copy(f.measured ? "review.fig.flips.since" : "review.fig.flips.pending")} />
      <Figure kind="review.fig.flags" value={f.flags} />
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
    for (const row of site.committed) {
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
function Tabs(p: { review: ReviewData; site: ReviewSite; answers?: AnswersRead }): React.JSX.Element {
  const panel = "min-w-0 flex-col gap-3";
  const open = p.answers?.asked === true ? ANSWERS : WEEK;
  return (
    <div className="group flex min-w-0 flex-col gap-3">
      <div role="radiogroup" aria-label={copy("review.tabs")} className="tabs tabs-border min-w-0 shrink-0">
        {([[WEEK, "review.tab.week"], [PAGES, "review.tab.pages"], [FLAGGED, "review.tab.flagged"], [ANSWERS, "review.tab.answers"]] as const).map(([value, key]) => (
          <label key={value} className={TAB}>
            <input type="radio" name={TABS} value={value} className="sr-only" defaultChecked={value === open} />
            {copy(key)}
          </label>
        ))}
      </div>
      <div className={`flex ${panel} group-has-[[value=pages]:checked]:hidden group-has-[[value=flagged]:checked]:hidden group-has-[[value=answers]:checked]:hidden`} data-testid="review-tab-week">
        <Week site={p.site} marks={p.review.marks} />
      </div>
      <div className={`hidden ${panel} group-has-[[value=pages]:checked]:flex`} data-testid="review-tab-pages">
        <Pages site={p.site} />
      </div>
      <div className={`hidden ${panel} group-has-[[value=flagged]:checked]:flex`} data-testid="review-tab-flagged">
        <Flagged review={p.review} />
      </div>
      <div className={`hidden ${panel} group-has-[[value=answers]:checked]:flex`} data-testid="review-tab-answers">
        <Answers read={p.answers?.read ?? null} opened={p.answers?.opened ?? null} href={(n) => `?site=${p.site.id}&answer=${n ?? ""}`} />
      </div>
    </div>
  );
}

/** The site to show, of those read: the one asked for, else the first. */
function SitePick(p: { sites: readonly ReviewSite[]; site: ReviewSite }): React.JSX.Element {
  return (
    <details className="dropdown sm:dropdown-end">
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

/** The shown site's AI answers, the one opened, and whether the address asked for their tab. */
export interface AnswersRead {
  read: SiteAnswers | null;
  opened: OpenedAnswer | null;
  asked: boolean;
}

/** The site to show, of those read: the one asked for, else the first. */
export const shownSite = (review: ReviewData, siteId: string | null): ReviewSite | undefined => review.sites.find((one) => one.id === siteId) ?? review.sites[0];

/** `review` is `null` where it could not be read; `siteId` is the site asked for. */
export function Review(p: { review: ReviewData | null; siteId: string | null; answers?: AnswersRead }): React.JSX.Element {
  const site = p.review === null ? undefined : shownSite(p.review, p.siteId);
  const heading = p.review === null ? null : copy("review.eyebrow.week", { date: WEEK_OF.format(dateOf(p.review.week)) });
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="review">
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
          <Tabs review={p.review} site={site} {...(p.answers === undefined ? {} : { answers: p.answers })} />
        </>
      )}
    </div>
  );
}
