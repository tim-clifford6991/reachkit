// SPEC §2 (owner E1, Q3): every page the report found missing, each with its
// search, all of them open.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../_address/measured";
import type { MissingPage } from "../_problems/model";

function Page(p: { page: MissingPage }): React.JSX.Element {
  const facts = [
    p.page.volume === null ? null : copy("report.missing.volume", { volume: p.page.volume.toLocaleString("en-US") }),
    p.page.holder === null ? null : copy("report.missing.holder", { holder: p.page.holder }),
  ].filter((fact) => fact !== null);
  return (
    <li className="flex min-w-0 flex-col gap-0.5">
      <Num phrase>{p.page.search}</Num>
      {facts.length === 0 ? null : <span className="text-base-content/70 text-xs">{facts.join(" · ")}</span>}
    </li>
  );
}

/** Every missing page, open, under the line that says none is hidden. */
export function MissingPagesList(p: { pages: readonly MissingPage[] }): React.JSX.Element | null {
  if (p.pages.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="report-missing-pages">
      <p className="max-w-prose">{copy("report.missing.lead")}</p>
      <ol className="flex list-decimal flex-col gap-3 ps-5">
        {p.pages.map((page, i) => (
          <Page key={`${i}-${page.search}`} page={page} />
        ))}
      </ol>
      {/* "All 1" reads as a miscount, so a single page carries no tally line. */}
      {p.pages.length < 2 ? null : (
        <p className="text-base-content/70 text-sm">{copy("report.missing.all", { count: String(p.pages.length) })}</p>
      )}
    </div>
  );
}
