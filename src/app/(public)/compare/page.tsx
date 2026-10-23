// The comparisons index, at the address v1 and v2 published: who does each of
// the five jobs by kind of tool, the fork, then one card per comparison under
// its kind. Static: the articles are data in `_library/`.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import {
  cardLines,
  COMPARISONS,
  COMPARISON_GROUPS,
  longDate,
  MATRIX_CHECKED,
  MATRIX_JOBS,
  type Comparison,
  type MatrixJob,
} from "../_library";
import { CARD, LearnClose, LibraryPage, ScanJump, Trademarks } from "../_library/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.compare);

const EYEBROW: CopyKey = "compare.eyebrow";
const PAGE_TEST_ID = "compare";
const JUMP_ID = "compare-jump";
const JOBS_NAME_ID = "compare-jobs-name";
/** The latest day the facts behind the cards were read. */
const READ_ON = COMPARISONS.map((c) => c.checked).sort().at(-1) ?? "";
const TILE =
  "card bg-base-100 shadow-(--shadow-card) motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5";
const GRID = "grid min-w-0 grid-cols-[minmax(0,1.9fr)_repeat(5,minmax(0,1fr))] items-center gap-1.5";
const SMALL = "text-base-content/70 text-sm";

type Mark = "done" | "helps" | "you";
const MARKS: readonly Mark[] = ["done", "helps", "you"];
const SWATCH: Record<Mark, string> = {
  done: "bg-primary",
  helps: "bg-primary/30",
  you: "border-base-content/40 border border-dashed",
};
const MARK_KEY: Record<Mark, CopyKey> = {
  done: "compare.jobs.done",
  helps: "compare.jobs.helps",
  you: "compare.jobs.you",
};

function MatrixRow(p: { name: string; marks: readonly Mark[] }): React.JSX.Element {
  return (
    <div role="row" className={GRID}>
      <span role="rowheader" className="min-w-0 text-sm break-words">
        {p.name}
      </span>
      {p.marks.map((mark, i) => (
        <span key={MATRIX_JOBS[i]} role="cell" className={`block h-3 rounded-sm ${SWATCH[mark]}`}>
          <span className="sr-only">{copy(MARK_KEY[mark])}</span>
        </span>
      ))}
    </div>
  );
}

/** Who does each of the five jobs: each kind of tool, then ReachKit. */
function JobsMatrix(): React.JSX.Element {
  const label = (job: MatrixJob): string => copy(`compare.jobs.${job}` as CopyKey);
  const marksOf = (leaves: readonly MatrixJob[]): Mark[] => MATRIX_JOBS.map((job) => (leaves.includes(job) ? "you" : "helps"));
  return (
    <figure className={`${CARD} min-w-0`} data-testid="compare-jobs">
      <div className="card-body gap-3">
        <p className="font-semibold" id={JOBS_NAME_ID}>
          {copy("compare.jobs.name")}
        </p>
        <div role="table" aria-labelledby={JOBS_NAME_ID} className="flex min-w-0 flex-col gap-2">
          <div role="row" className={GRID}>
            <span role="columnheader" />
            {MATRIX_JOBS.map((job, i) => (
              <span key={job} role="columnheader" className="text-base-content/70 text-center text-xs font-semibold">
                <span className="hidden md:inline">{label(job)}</span> <span className="md:hidden">{i + 1}</span>
              </span>
            ))}
          </div>
          {COMPARISON_GROUPS.map((g) => (
            <MatrixRow key={g.group} name={copy(g.name)} marks={marksOf(g.leaves)} />
          ))}
          <MatrixRow name={copy("chrome.wordmark")} marks={MATRIX_JOBS.map(() => "done")} />
        </div>
        <p className={`${SMALL} md:hidden`}>{MATRIX_JOBS.map((job, i) => `${i + 1} ${label(job)}`).join(" · ")}</p>
        <div className={`${SMALL} flex flex-wrap gap-x-4 gap-y-1`}>
          {MARKS.map((mark) => (
            <span key={mark} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={`inline-block h-2.5 w-4 rounded-sm ${SWATCH[mark]}`} />
              {copy(MARK_KEY[mark])}
            </span>
          ))}
        </div>
        <figcaption className={SMALL} data-testid="compare-caption">
          {copy("compare.caption", { read: longDate(READ_ON), checked: longDate(MATRIX_CHECKED) })}
        </figcaption>
      </div>
    </figure>
  );
}

/** Do the work yourself, or have it done. */
function Fork(): React.JSX.Element {
  return (
    <div className="rounded-box bg-base-200 flex min-w-0 flex-col gap-2 p-4" data-testid="compare-fork">
      <p className="font-semibold">{copy("compare.fork.ask")}</p>
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="badge badge-ghost badge-sm">{copy("compare.fork.yes")}</span>
        <span>{copy("compare.fork.yes.line")}</span>
      </p>
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="badge badge-soft badge-primary badge-sm">{copy("compare.fork.no")}</span>
        <span>
          <strong>{copy("compare.fork.no.pick")}</strong> {copy("compare.fork.no.line")}
        </span>
      </p>
    </div>
  );
}

function ComparisonCard(p: { c: Comparison }): React.JSX.Element {
  const { c } = p;
  const lines = cardLines(c.summary);
  return (
    <Link href={`/compare/${c.slug}`} className={`${TILE} w-full min-w-0`}>
      <span className="card-body gap-2">
        <span className="flex min-w-0 items-center gap-3">
          <span className="avatar avatar-placeholder" aria-hidden>
            <span className="bg-base-200 w-9 rounded-full font-semibold">{c.name.charAt(0)}</span>
          </span>
          <h3 className="card-title min-w-0 text-base break-words">{c.title}</h3>
        </span>
        {c.badge === undefined ? null : <span className="badge badge-ghost badge-sm">{c.badge}</span>}
        <span className="flex min-w-0 flex-col items-start gap-1 text-sm">
          <span className="badge badge-ghost badge-sm h-auto max-w-full whitespace-normal">{c.name}</span>
          <span className="text-base-content/70">{lines.them}</span>
        </span>
        <span className="flex min-w-0 flex-col items-start gap-1 text-sm">
          <span className="badge badge-soft badge-primary badge-sm">{copy("chrome.wordmark")}</span>
          <span>{lines.us}</span>
        </span>
        <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-semibold">
          {copy("compare.read")}
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

export default function ComparePage(): React.JSX.Element {
  const groups = COMPARISON_GROUPS.map((g) => ({ ...g, entries: COMPARISONS.filter((c) => c.group === g.group) })).filter(
    (g) => g.entries.length > 0
  );
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("compare.title")} wide>
      <p className="max-w-(--w-read)">{copy("compare.lead")}</p>
      <ScanJump />
      <JobsMatrix />
      <Fork />
      <nav aria-labelledby={JUMP_ID} className="flex min-w-0 flex-col gap-2" data-testid="compare-jump">
        <p id={JUMP_ID} className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
          {copy("compare.jump", { count: COMPARISONS.length })}
        </p>
        <div className="flex min-w-0 flex-wrap gap-2">
          {groups.map((g) => (
            <a key={g.group} href={`#${g.group}`} className="btn btn-sm btn-outline">
              {copy(g.name)} <span className="text-base-content/70">{g.entries.length}</span>
            </a>
          ))}
        </div>
      </nav>
      {groups.map((g) => (
        <section key={g.group} id={g.group} aria-labelledby={`${g.group}-h`} className="flex min-w-0 scroll-mt-20 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={`${g.group}-h`}>
              {copy(g.name)} <span className="text-base-content/70">{g.entries.length}</span>
            </h2>
            <p className={SMALL}>{copy(g.line)}</p>
          </div>
          <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.entries.map((c) => (
              <li key={c.slug} className="flex min-w-0">
                <ComparisonCard c={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <LearnClose variant="compare" />
      <Trademarks />
    </LibraryPage>
  );
}
