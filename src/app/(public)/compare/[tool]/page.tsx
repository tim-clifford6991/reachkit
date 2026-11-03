// One comparison, at the address v1 and v2 published: who does each of the
// five jobs, what the other tool does well, what ReachKit does instead, the
// two side by side, when to pick which, where the facts were read, and the one
// call to scan.
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX, Contrast, MessageSquare, Scale, Sparkles, User } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { publicMetadata } from "../../_seo/metadata";
import { JsonLd, articleSchemas, homeCrumb } from "../../_seo/structured";
import { COMPARISONS, COMPARISON_GROUPS, comparisonOf, JOBS, type Cell, type Comparison, type Job } from "../../_library";
import {
  BackLink,
  BAND,
  BODY,
  CARD,
  FIGURES,
  GROUP_ICON,
  LearnClose,
  LibraryPage,
  Pick,
  Tile,
  Trademarks,
  Trail,
  YourPart,
} from "../../_library/parts";
import { Sources } from "../../_library/sources";

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
// The last track never shrinks below the wordmark badge, which stays on one line so the brand reads whole.
const ROW = "grid min-w-0 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(min-content,1fr)] items-center gap-2";
const WELL = "rounded-box flex items-start gap-2 p-3 text-sm";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const SMALL = "text-base-content/70 text-sm";
const PARTLY = /^partly\b/i;
const YES = /^yes\b/i;
const EYEBROW_TEXT = "text-xs font-semibold tracking-wide uppercase";
/** The four grey lines standing for the assistant's answer. */
const ANSWER_LINES = ["w-11/12", "w-4/5", "w-5/6", "w-3/5"] as const;

function CellText(p: { cell: Cell }): React.JSX.Element {
  if (p.cell === true) {
    return (
      <span className="text-success inline-flex items-center gap-1">
        <CircleCheck {...ICON} />
        {copy("compare.item.yes")}
      </span>
    );
  }
  if (p.cell === false) {
    return (
      <span className="text-base-content/70 inline-flex items-center gap-1">
        <CircleX {...ICON} />
        {copy("compare.item.no")}
      </span>
    );
  }
  if (YES.test(p.cell)) {
    return (
      <span className="inline-flex items-start gap-1">
        <CircleCheck {...ICON} className="text-success mt-0.5 shrink-0" />
        {p.cell}
      </span>
    );
  }
  if (PARTLY.test(p.cell)) {
    return (
      <span className="inline-flex items-start gap-1 wrap-anywhere">
        <Contrast {...ICON} className="text-warning mt-0.5 shrink-0" />
        {p.cell}
      </span>
    );
  }
  return <span>{p.cell}</span>;
}

/** A job's words: a tool that does not write leaves the facts to you, with no "it" to give them to. */
function jobKey(c: Comparison, job: Job): CopyKey {
  return `compare.job.${job}${job === "facts" && !c.does.includes("write") ? ".self" : ""}` as CopyKey;
}

/** The five jobs: who does each with the other tool, and with ReachKit. */
function WhoDoesEachJob(p: { c: Comparison; yours: readonly Job[] }): React.JSX.Element {
  const { c } = p;
  const wordmark = copy("chrome.wordmark");
  return (
    <figure className={`${CARD} min-w-0`} data-testid="comparison-jobs">
      <div className={BODY}>
        <p className="text-base-content flex items-center gap-3 font-bold" id={JOBS_ID}>
          <Tile Icon={Scale} />
          {copy("compare.item.jobs")}
        </p>
        <div role="table" aria-labelledby={JOBS_ID} className="flex min-w-0 flex-col gap-2">
          <div role="row" className={`${ROW} text-base-content/70 ${EYEBROW_TEXT}`}>
            <span role="columnheader">{copy("compare.item.jobs.job")}</span>
            <span role="columnheader">{copy("compare.item.jobs.with", { name: c.name })}</span>
            <span role="columnheader" className="text-primary">
              {copy("compare.item.jobs.with", { name: wordmark })}
            </span>
          </div>
          {JOBS.map((job) => (
            <div key={job} role="row" className={`${ROW} border-base-300 border-t pt-2`}>
              <span role="rowheader" className="text-base-content min-w-0 text-sm font-semibold break-words">
                {copy(jobKey(c, job))}
              </span>
              <span role="cell" className="min-w-0">
                <span className={`badge badge-soft badge-sm h-auto max-w-full font-bold whitespace-normal ${p.yours.includes(job) ? "badge-warning" : ""}`}>
                  {p.yours.includes(job) ? copy("compare.item.jobs.you") : c.name}
                </span>
              </span>
              <span role="cell" className="min-w-0">
                <span className="badge badge-primary badge-sm font-bold">{wordmark}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <YouDo count={p.yours.length} />
          <p className={`${WELL} bg-primary/10 text-primary`}>
            <Sparkles {...ICON} className="mt-0.5 shrink-0" />
            <span>
              <strong>{copy("compare.item.jobs.none")}</strong> {copy("compare.item.jobs.none.line")}
            </span>
          </p>
        </div>
      </div>
    </figure>
  );
}

function YouDo(p: { count: number }): React.JSX.Element {
  return (
    <p className={`${WELL} bg-warning/10 text-warning`}>
      <User {...ICON} className="mt-0.5 shrink-0" />
      <span>
        <strong>{copy("compare.item.jobs.count", { count: p.count })}</strong> {copy("compare.item.jobs.every")}
      </span>
    </p>
  );
}

/** What the other tool does well, with the request a reader would type where it is a chat. */
function DoesWell(p: { c: Comparison }): React.JSX.Element {
  const { c } = p;
  return (
    <section className={CARD}>
      <div className={BODY}>
        <div className="flex min-w-0 items-center gap-3">
          <Tile Icon={CircleCheck} tone="success" />
          <h2 className="text-xl">{c.theirs.heading}</h2>
        </div>
        {c.ask === undefined ? null : (
          <div aria-hidden className="rounded-box bg-base-200 flex min-w-0 flex-col gap-2 p-3.5">
            <span className="rounded-box border-base-300 bg-base-100 max-w-4/5 self-end border px-3 py-2 text-sm">{c.ask}</span>
            <span className="rounded-box border-base-300 bg-base-100 flex max-w-[88%] flex-col gap-1.5 border px-3 py-2.5">
              <span className="text-base-content/70 flex items-center gap-1.5 text-xs font-bold">
                <MessageSquare size={14} strokeWidth={1.75} />
                {copy("compare.item.assistant")}
              </span>
              {ANSWER_LINES.map((w) => (
                <span key={w} className={`bg-base-300 block h-1.5 rounded-full ${w}`} />
              ))}
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
      title={c.heading ?? c.title}
      trail={
        <Trail label={copy("compare.item.trail")} href={INDEX} index={copy(EYEBROW)} here={group === undefined ? undefined : copy(group.name)} />
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
      <WhoDoesEachJob c={c} yours={yours} />
      <div className={BAND}>
        <DoesWell c={c} />
      </div>
      <section className="flex min-w-0 flex-col gap-4" aria-labelledby="comparison-instead">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 id="comparison-instead">{copy("compare.item.instead")}</h2>
          <p>{copy("compare.item.instead.lead", FIGURES)}</p>
        </div>
        <YourPart />
      </section>

      <section className={`flex min-w-0 flex-col gap-3 ${BAND}`} aria-labelledby="comparison-side">
        <h2 id="comparison-side">{copy("compare.item.table")}</h2>
        <div className={`${CARD} overflow-hidden`}>
          <table className="table w-full table-fixed">
            <thead>
              <tr className={EYEBROW_TEXT}>
                <th scope="col" className="text-base-content/70 w-[36%] whitespace-normal break-words">
                  {copy("compare.item.feature")}
                </th>
                <th scope="col" className="bg-primary/10 text-primary whitespace-normal break-words">
                  {wordmark}
                </th>
                <th scope="col" className="text-base-content whitespace-normal break-words">
                  {c.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="text-base-content font-semibold break-words">
                    {row.label}
                  </th>
                  <td className="bg-primary/5 break-words">
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
        <p className={`${SMALL} flex flex-wrap gap-x-4`}>
          <span className="inline-flex items-center gap-1">
            <CircleCheck {...ICON} size={14} />
            {copy("compare.item.yes")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Contrast {...ICON} size={14} className="text-warning" />
            {copy("compare.item.partly")}
          </span>
          <span className="inline-flex items-center gap-1">
            <CircleX {...ICON} size={14} />
            {copy("compare.item.no")}
          </span>
        </p>
      </section>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Pick title={<h2 className="text-xl">{copy("compare.item.pick.them", { name: c.name })}</h2>} items={c.pickThem} Icon={GROUP_ICON[c.group]} />
        <Pick title={<h2 className="text-xl">{copy("compare.item.pick.us")}</h2>} items={c.pickUs} Icon={Sparkles} ours />
      </div>

      <Sources checked={c.checked} sources={c.sources} oneLine />
      <LearnClose variant="compare-tool" />
      <Trademarks />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
