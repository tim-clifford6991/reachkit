// One comparison, at the address v1 and v2 published: who does each of the
// five jobs, what the other tool does well and what it leaves to you, what
// ReachKit does instead, the two side by side, when to pick which, where the
// facts were read, and the one call to scan.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Minus, X } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { publicMetadata } from "../../_seo/metadata";
import { JsonLd, articleSchemas, homeCrumb } from "../../_seo/structured";
import { COMPARISONS, COMPARISON_GROUPS, comparisonOf, JOBS, type Cell, type Comparison, type Job } from "../../_library";
import {
  BackLink,
  BODY,
  CARD,
  FIGURES,
  LIST,
  LearnClose,
  LibraryPage,
  ScanJump,
  Sources,
  Trademarks,
  WeeklyLoop,
} from "../../_library/parts";

/** Every comparison is known at build; any other address is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): { tool: string }[] {
  return COMPARISONS.map((c) => ({ tool: c.slug }));
}

type Params = { params: Promise<{ tool: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tool } = await params;
  const c = comparisonOf(tool);
  if (c === undefined) return {};
  return publicMetadata({
    seo: PUBLIC_ROUTE_SEO.comparison,
    path: `/compare/${c.slug}`,
    vars: { title: c.title, description: c.description },
  });
}

const EYEBROW: CopyKey = "compare.eyebrow";
const MORE: CopyKey = "compare.item.more";
const PAGE_TEST_ID = "comparison";
const INDEX = "/compare";
const JOBS_ID = "comparison-jobs";
const ROW = "grid min-w-0 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2";
const WELL = "rounded-box bg-base-200 p-3 text-sm";
const SMALL = "text-base-content/70 text-sm";
const PARTLY = /^partly\b/i;

function CellText(p: { cell: Cell }): React.JSX.Element {
  if (p.cell === true) {
    return (
      <span className="text-success inline-flex items-center gap-1">
        <Check size={16} strokeWidth={1.75} aria-hidden />
        {copy("compare.item.yes")}
      </span>
    );
  }
  if (p.cell === false) {
    return (
      <span className="text-base-content/70 inline-flex items-center gap-1">
        <X size={16} strokeWidth={1.75} aria-hidden />
        {copy("compare.item.no")}
      </span>
    );
  }
  if (PARTLY.test(p.cell)) {
    return (
      <span className="inline-flex items-start gap-1">
        <Minus size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
        {p.cell}
      </span>
    );
  }
  return <span>{p.cell}</span>;
}

/** A job's words: a tool that does not write leaves the facts to you, with no "it" to give them to. */
function jobKey(c: Comparison, job: Job, form: "" | ".still" | ".you" | ".us"): CopyKey {
  const self = job === "facts" && form !== ".us" && !c.does.includes("write") ? ".self" : "";
  return `compare.job.${job}${self}${form}` as CopyKey;
}

/** The five jobs: who does each with the other tool, and with ReachKit. */
function WhoDoesEachJob(p: { c: Comparison; yours: readonly Job[] }): React.JSX.Element {
  const { c } = p;
  const wordmark = copy("chrome.wordmark");
  return (
    <figure className={`${CARD} min-w-0`} data-testid="comparison-jobs">
      <div className={BODY}>
        <p className="font-semibold" id={JOBS_ID}>
          {copy("compare.item.jobs")}
        </p>
        <div role="table" aria-labelledby={JOBS_ID} className="flex min-w-0 flex-col gap-2">
          <div role="row" className={`${ROW} text-base-content/70 text-xs font-semibold tracking-wide uppercase`}>
            <span role="columnheader">{copy("compare.item.jobs.job")}</span>
            <span role="columnheader">{copy("compare.item.jobs.with", { name: c.name })}</span>
            <span role="columnheader">{copy("compare.item.jobs.with", { name: wordmark })}</span>
          </div>
          {JOBS.map((job) => (
            <div key={job} role="row" className={`${ROW} border-base-300 border-t pt-2`}>
              <span role="rowheader" className="min-w-0 text-sm break-words">
                {copy(jobKey(c, job, ""))}
              </span>
              <span role="cell" className="min-w-0">
                <span className={`badge badge-sm h-auto max-w-full whitespace-normal ${p.yours.includes(job) ? "badge-ghost" : "badge-outline"}`}>
                  {p.yours.includes(job) ? copy("compare.item.jobs.you") : c.name}
                </span>
              </span>
              <span role="cell" className="min-w-0">
                <span className="badge badge-soft badge-primary badge-sm">{wordmark}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <YouDo count={p.yours.length} />
          <p className={WELL}>
            <strong>{copy("compare.item.jobs.none")}</strong> {copy("compare.item.jobs.none.line")}
          </p>
        </div>
      </div>
    </figure>
  );
}

function YouDo(p: { count: number }): React.JSX.Element {
  return (
    <p className={WELL}>
      <strong>{copy("compare.item.jobs.count", { count: p.count })}</strong> {copy("compare.item.jobs.every")}
    </p>
  );
}

/** What the other tool does well, with the request a reader would type where it is a chat. */
function DoesWell(p: { c: Comparison }): React.JSX.Element {
  const { c } = p;
  return (
    <section className={CARD}>
      <div className={BODY}>
        <h2>{c.theirs.heading}</h2>
        {c.ask === undefined ? null : (
          <div aria-hidden className="rounded-box bg-base-200 flex min-w-0 flex-col p-3">
            <span className="chat chat-end">
              <span className="chat-bubble chat-bubble-primary">{c.ask}</span>
            </span>
            <span className="chat chat-start">
              <span className="chat-header">{copy("compare.item.assistant")}</span>
              <span className="chat-bubble w-14" />
            </span>
          </div>
        )}
        {c.theirs.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
    </section>
  );
}

/** The jobs the other tool leaves to the reader, for every page. */
function StillYours(p: { c: Comparison; yours: readonly Job[] }): React.JSX.Element {
  const { c } = p;
  return (
    <section className={CARD} data-testid="comparison-still">
      <div className={BODY}>
        <h2>{copy("compare.item.still", { name: c.name })}</h2>
        <p className={SMALL}>{copy("compare.item.still.line")}</p>
        <ul className="divide-base-300 flex min-w-0 flex-col divide-y">
          {p.yours.map((job) => (
            <li key={job} className="flex min-w-0 items-center justify-between gap-3 py-2">
              <span className="min-w-0">{copy(jobKey(c, job, ".still"))}</span>
              <span className="badge badge-ghost badge-sm shrink-0">{copy("compare.item.jobs.you")}</span>
            </li>
          ))}
        </ul>
        <YouDo count={p.yours.length} />
      </div>
    </section>
  );
}

export default async function ComparisonPage({ params }: Params): Promise<React.JSX.Element> {
  const { tool } = await params;
  const c = comparisonOf(tool);
  if (c === undefined) notFound();
  const group = COMPARISON_GROUPS.find((g) => g.group === c.group);
  const yours = JOBS.filter((job) => !c.does.includes(job));
  const wordmark = copy("chrome.wordmark");

  return (
    <LibraryPage
      testId={PAGE_TEST_ID}
      eyebrow={EYEBROW}
      title={c.heading ?? c.title}
      trail={
        <nav aria-label={copy("compare.item.trail")} className="breadcrumbs text-base-content/70 py-0 text-sm">
          <ul>
            <li>
              <Link href={INDEX} className="link">
                {copy(EYEBROW)}
              </Link>
            </li>
            {group === undefined ? null : <li>{copy(group.name)}</li>}
          </ul>
        </nav>
      }
    >
      {/* The date the page prints, and the links it draws. */}
      <JsonLd
        blocks={articleSchemas({
          path: `${INDEX}/${c.slug}`,
          headline: c.heading ?? c.title,
          modified: c.checked,
          trail: [homeCrumb(), { name: copy("chrome.nav.compare"), path: INDEX }],
        })}
      />
      <p className="text-lg">{c.intro}</p>
      <ScanJump />
      <WhoDoesEachJob c={c} yours={yours} />
      <DoesWell c={c} />
      {yours.length === 0 ? null : <StillYours c={c} yours={yours} />}
      <WeeklyLoop
        w={{
          eyebrow: copy("compare.item.instead.eyebrow"),
          title: copy("compare.item.instead"),
          lead: copy("compare.item.instead.lead", FIGURES),
          them: copy("compare.item.instead.them", { name: c.name }),
          us: copy("compare.item.instead.us"),
          rows: yours.map((job) => [copy(jobKey(c, job, ".you")), copy(jobKey(c, job, ".us"), FIGURES)] as const),
          detail: { summary: copy("compare.item.detail"), body: copy("compare.item.detail.body", FIGURES) },
        }}
      />

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="comparison-side">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
            {copy("compare.item.side", { name: c.name })}
          </span>
          <h2 id="comparison-side">{copy("compare.item.table")}</h2>
        </div>
        <div className={CARD}>
          <div className={BODY}>
            <table className="table table-sm w-full table-fixed">
              <thead className="text-base-content/70">
                <tr>
                  <th scope="col" className="w-2/5 whitespace-normal break-words">
                    {copy("compare.item.feature")}
                  </th>
                  <th scope="col" className="whitespace-normal break-words">
                    {wordmark}
                  </th>
                  <th scope="col" className="whitespace-normal break-words">
                    {c.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="font-normal break-words">
                      {row.label}
                    </th>
                    <td className="break-words">
                      <CellText cell={row.reachkit} />
                    </td>
                    <td className="break-words">
                      <CellText cell={row.them} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className={`${SMALL} flex flex-wrap gap-x-4`}>
          <span className="inline-flex items-center gap-1">
            <Check size={14} strokeWidth={1.75} aria-hidden />
            {copy("compare.item.yes")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Minus size={14} strokeWidth={1.75} aria-hidden />
            {copy("compare.item.partly")}
          </span>
          <span className="inline-flex items-center gap-1">
            <X size={14} strokeWidth={1.75} aria-hidden />
            {copy("compare.item.no")}
          </span>
        </p>
      </section>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <section className={CARD}>
          <div className={BODY}>
            <h2>{copy("compare.item.pick.them", { name: c.name })}</h2>
            <ul className={LIST}>
              {c.pickThem.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>
        <section className={CARD}>
          <div className={BODY}>
            <h2>{copy("compare.item.pick.us")}</h2>
            <ul className={LIST}>
              {c.pickUs.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <Sources checked={c.checked} sources={c.sources} />
      <LearnClose variant="compare-tool" />
      <Trademarks />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
