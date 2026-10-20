// SPEC §2 (owner E1, 2026-10-19): every page the report found missing, each
// with its search, the first few open and the rest closed under how many.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../_address/measured";
import type { MissingPage } from "../_problems/model";

/** The pages drawn open; the rest sit in a closed `details` under them. */
const SHOWN_OPEN = 5;

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

/** Every missing page: the first few open, the rest closed under how many. */
export function MissingPagesList(p: { pages: readonly MissingPage[] }): React.JSX.Element | null {
  if (p.pages.length === 0) return null;
  const open = p.pages.slice(0, SHOWN_OPEN);
  const rest = p.pages.slice(SHOWN_OPEN);
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="report-missing-pages">
      <p className="max-w-prose">{copy("report.missing.lead")}</p>
      <ol className="flex list-decimal flex-col gap-3 ps-5">
        {open.map((page, i) => (
          <Page key={`${i}-${page.search}`} page={page} />
        ))}
      </ol>
      {rest.length === 0 ? null : (
        <details className="collapse collapse-arrow border-base-300 border">
          <summary className="collapse-title text-sm font-semibold">
            {copy("report.missing.more", { count: String(rest.length) })}
          </summary>
          <div className="collapse-content min-w-0">
            <ol className="flex list-decimal flex-col gap-3 ps-5" start={SHOWN_OPEN + 1}>
              {rest.map((page, i) => (
                <Page key={`${i}-${page.search}`} page={page} />
              ))}
            </ol>
          </div>
        </details>
      )}
    </div>
  );
}
