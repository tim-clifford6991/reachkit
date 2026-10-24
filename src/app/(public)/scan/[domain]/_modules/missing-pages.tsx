// SPEC §2 (owner E1, Q3): every page the report found missing, each with its
// search, all of them open.
import type React from "react";
import { FileText, Gift } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { renderQuestion } from "@/lib/presentation/generated";
import { PageSketch } from "@/ui/PageSketch";
import { Num } from "../_address/measured";
import { FIRST_PAGE_ANCHOR } from "../_problems/cards";
import type { MissingPage } from "../_problems/model";

/** Ruling 2026-10-24 E16: the first five pages are cards, the rest rows. */
const CARDS = 5;
const SENTINEL = "\u0000";

function Card(p: { page: MissingPage; n: number; free: boolean }): React.JSX.Element {
  const { page } = p;
  const asked = page.question === null ? null : renderQuestion({ wording: page.question, provenance: page.search });
  const [before = "", after = ""] = copy("report.missing.holder", { holder: SENTINEL }).split(SENTINEL);
  return (
    <li className={`card card-border card-sm bg-base-100 min-w-0 ${p.free ? "border-primary" : ""}`}>
      <div className="card-body gap-2">
        <span className="num text-base-content/70 text-xs">{copy("report.missing.page", { n: String(p.n) })}</span>
        <PageSketch primary={p.free} />
        <span className="font-semibold">{asked === null ? page.search : asked[0].text}</span>
        {asked === null ? null : <Num phrase>{asked[1].text}</Num>}
        {page.volume === null ? null : (
          <span className="text-base-content/70 text-xs">{copy("report.missing.volume", { volume: page.volume.toLocaleString("en-US") })}</span>
        )}
        {page.holder === null ? null : (
          <span className="text-base-content/70 text-xs">
            {before}
            <span className="font-mono break-all">{page.holder}</span>
            {after}
          </span>
        )}
        {p.free ? (
          <span className="mt-auto flex flex-col items-start gap-2 pt-1">
            <span className="badge badge-soft badge-success badge-sm">
              <Gift aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.75} />
              {copy("report.missing.free")}
            </span>
            <a href={`#${FIRST_PAGE_ANCHOR}`} className="link link-primary text-sm font-semibold">
              {copy("report.missing.free.read")}
            </a>
          </span>
        ) : null}
      </div>
    </li>
  );
}

function Row(p: { page: MissingPage; n: number }): React.JSX.Element {
  return (
    <li className="rounded-box border-base-300 bg-base-100 flex min-w-0 items-center gap-2 border border-dashed px-3 py-2">
      <span className="num text-base-content/70 shrink-0 text-xs">{p.n}</span>
      <FileText aria-hidden="true" className="text-base-content/70 size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 font-mono text-sm break-words">{p.page.search}</span>
    </li>
  );
}

function tally(count: number): string | null {
  // "All 1" reads as a miscount, so a single page carries no tally line.
  if (count < 2) return null;
  if (count <= CARDS) return copy("report.missing.all", { count: String(count) });
  if (count === CARDS + 1) return copy("report.missing.all.six");
  return copy("report.missing.all.rest", { count: String(count) });
}

/** Every missing page, open, under the line that says none is hidden. The
 *  page the report writes free comes first, so a reader sees which one it is
 *  without scrolling to it. */
export function MissingPagesList(p: { pages: readonly MissingPage[]; freeSearch: string | null }): React.JSX.Element | null {
  if (p.pages.length === 0) return null;
  const free = p.freeSearch === null ? -1 : p.pages.findIndex((page) => page.search === p.freeSearch);
  const pages = free <= 0 ? p.pages : [p.pages[free]!, ...p.pages.slice(0, free), ...p.pages.slice(free + 1)];
  const line = tally(pages.length);
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="report-missing-pages">
      <p className="max-w-prose">{copy("report.missing.lead")}</p>
      <ol role="list" className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {pages.slice(0, CARDS).map((page, i) => (
          <Card key={`${i}-${page.search}`} page={page} n={i + 1} free={free !== -1 && i === 0} />
        ))}
      </ol>
      {pages.length <= CARDS ? null : (
        <ol role="list" start={CARDS + 1} className="grid list-none grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {pages.slice(CARDS).map((page, i) => (
            <Row key={`${i}-${page.search}`} page={page} n={CARDS + 1 + i} />
          ))}
        </ol>
      )}
      {line === null ? null : <p className="text-base-content/70 text-sm">{line}</p>}
    </div>
  );
}
