// SPEC §4 (board AppGoogle) — each live page in Google: its search, its place
// line and its label, six at first. A page no reading reached says "not measured".
import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { formatCount } from "../_shell/format";
import { shortDay } from "./Figures";
import { LabelBadge } from "../_shell/verdict";
import { searchKey, type Planned } from "./search-model";
import type { GooglePageRow, GooglePages as Model, PlaceLine } from "./google-pages";

const SHOWN = 6;
const INK = "text-base-content/70";

function lineText(line: PlaceLine, timeZone: string): string {
  switch (line.kind) {
    case "up":
      return copy("overview.search.place.up", {
        n: formatCount(line.place),
        gain: formatCount(line.gain),
        date: shortDay(new Date(line.since), timeZone),
      });
    case "flat":
      return copy("overview.search.place.flat", { n: formatCount(line.place), weeks: formatCount(line.weeks) });
    case "now":
      return copy("overview.search.place.now", { n: formatCount(line.place) });
    case "found":
      return copy("overview.search.place.found", { date: shortDay(new Date(line.at), timeZone) });
    case "unseen":
      return copy("overview.search.place.unseen");
    case "unread":
      return copy("draft.ladder.unmeasured");
  }
}

function Row(p: { row: GooglePageRow; planned: ReadonlyMap<string, Planned>; timeZone: string }): React.JSX.Element {
  const { row } = p;
  const update = row.search === null ? undefined : p.planned.get(searchKey(row.search));
  const line = lineText(row.line, p.timeZone);
  return (
    <li className="list-row items-center px-0" data-testid="search-page">
      <div className="list-col-grow flex min-w-0 flex-col gap-0.5">
        {row.href === null ? (
          <span className="font-semibold" data-testid="search-page-title">
            {row.title}
          </span>
        ) : (
          <Link className="link link-hover font-semibold" href={row.href} prefetch={false} data-testid="search-page-title">
            {row.title}
          </Link>
        )}
        {row.search === null ? null : <p className={`font-mono text-xs break-words ${INK}`}>{row.search}</p>}
        <p className="text-sm" data-testid="search-page-line">
          {update?.update === true ? `${line} ${copy("overview.search.place.update", { day: update.day })}` : line}
        </p>
        {row.estimate ? <p className={`text-xs ${INK}`}>{copy("overview.search.place.estimate")}</p> : null}
      </div>
      {row.label === null ? null : <LabelBadge label={row.label} testId="search-page-label" />}
    </li>
  );
}

export function GooglePages(p: {
  pages: Model | null;
  planned: ReadonlyMap<string, Planned>;
  timeZone: string;
}): React.JSX.Element {
  const rows = p.pages?.rows ?? [];
  const list = (part: readonly GooglePageRow[]) => (
    <ul className="list min-w-0">
      {part.map((row) => (
        <Row key={row.id} row={row} planned={p.planned} timeZone={p.timeZone} />
      ))}
    </ul>
  );
  return (
    <section className="card card-border min-w-0 bg-base-100" aria-labelledby="search-pages-title" data-testid="search-pages">
      <div className="card-body min-w-0 gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="search-pages-title" className="text-lg font-semibold">
            {copy("overview.search.pages.title")}
          </h2>
          <span className={`text-xs ${INK}`}>{copy("overview.search.pages.caption")}</span>
        </div>
        {rows.length === 0 ? (
          <p className={`text-sm ${INK}`} data-testid="search-pages-none">
            {copy("overview.search.pages.none")}
          </p>
        ) : (
          <>
            {list(rows.slice(0, SHOWN))}
            {rows.length <= SHOWN ? null : (
              // daisyUI's collapse keeps the closed rows inside its own box.
              <details className="collapse min-w-0">
                <summary className="collapse-title flex min-h-11 items-center p-0 text-sm font-semibold text-primary" data-testid="search-pages-all">
                  {copy("overview.search.pages.all", { total: formatCount(rows.length) })}
                </summary>
                <div className="collapse-content min-w-0 px-0">{list(rows.slice(SHOWN))}</div>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  );
}
