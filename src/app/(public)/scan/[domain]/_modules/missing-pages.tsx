// SPEC §2 (owner E1, Q3): every page the report found missing, each with its
// search, all of them open.
import type React from "react";
import { Gift } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../_address/measured";
import { FIRST_PAGE_ANCHOR } from "../_problems/cards";
import type { MissingPage } from "../_problems/model";

function Page(p: { page: MissingPage; free: boolean }): React.JSX.Element {
  const facts = [
    p.page.volume === null ? null : copy("report.missing.volume", { volume: p.page.volume.toLocaleString("en-US") }),
    p.page.holder === null ? null : copy("report.missing.holder", { holder: p.page.holder }),
  ].filter((fact) => fact !== null);
  return (
    <li className="flex min-w-0 flex-col gap-0.5">
      <Num phrase>{p.page.search}</Num>
      {facts.length === 0 ? null : <span className="text-base-content/70 text-xs">{facts.join(" · ")}</span>}
      {p.free ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <span className="badge badge-soft badge-success badge-sm">
            <Gift aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.75} />
            {copy("report.missing.free")}
          </span>
          <a href={`#${FIRST_PAGE_ANCHOR}`} className="link link-primary text-sm font-semibold">
            {copy("report.missing.free.read")}
          </a>
        </span>
      ) : null}
    </li>
  );
}

/** Every missing page, open, under the line that says none is hidden. The
 *  page the report writes free comes first, so a reader sees which one it is
 *  without scrolling to it. */
export function MissingPagesList(p: { pages: readonly MissingPage[]; freeSearch: string | null }): React.JSX.Element | null {
  if (p.pages.length === 0) return null;
  const free = p.freeSearch === null ? -1 : p.pages.findIndex((page) => page.search === p.freeSearch);
  const pages = free <= 0 ? p.pages : [p.pages[free]!, ...p.pages.slice(0, free), ...p.pages.slice(free + 1)];
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="report-missing-pages">
      <p className="max-w-prose">{copy("report.missing.lead")}</p>
      <ol className="flex list-decimal flex-col gap-3 ps-5">
        {pages.map((page, i) => (
          <Page key={`${i}-${page.search}`} page={page} free={free !== -1 && i === 0} />
        ))}
      </ol>
      {/* "All 1" reads as a miscount, so a single page carries no tally line. */}
      {p.pages.length < 2 ? null : (
        <p className="text-base-content/70 text-sm">{copy("report.missing.all", { count: String(p.pages.length) })}</p>
      )}
    </div>
  );
}
