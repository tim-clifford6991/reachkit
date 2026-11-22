// SPEC §4 (plates O4, O8) — On Google's detail below its head: one row per live page, with its own search,
// that search's demand, its place, the best competitor there and what we are doing. A table from `md`,
// one line per page on a phone. Visits from Google are not stored, so they are not drawn.
import type React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { formatCount, formatShortDay } from "../_shell/format";
import type { GoogleSearchRow } from "./google-pages";
import { placeWords } from "./place-words";
import { rowClass } from "./frame";
import { searchKey, type Planned } from "./search-model";
import { ShowAll } from "./ShowAll";

const INK = "text-base-content/70";

function Dash(p: { sr: string }): React.JSX.Element {
  return (
    <span>
      <span aria-hidden>{copy("unmeasured.dash")}</span>
      <span className="sr-only">{p.sr}</span>
    </span>
  );
}

function Search(p: { row: GoogleSearchRow }): React.JSX.Element {
  const text = p.row.search ?? p.row.page.title;
  const { href } = p.row.page;
  return href === null ? (
    <span className="font-mono text-sm break-words">{text}</span>
  ) : (
    <Link className="link link-hover font-mono text-sm break-words" href={href} prefetch={false}>
      {text}
    </Link>
  );
}

/** The place words every Overview detail says; a page not read yet says when it will be. */
function place(row: GoogleSearchRow, first: string): string {
  const { page } = row;
  if (page.bucket === "unread") return first;
  if (page.place === null) return copy("overview.place.none");
  const source = page.bucket === "console" ? "gsc" : page.estimate ? "labs" : "serp";
  const weeks = page.line.kind === "flat" ? page.line.weeks : 0;
  return placeWords({ place: { value: page.place, source, query: page.search ?? "" }, prev: page.before }, weeks);
}

function doing(row: GoogleSearchRow, planned: ReadonlyMap<string, Planned>): string {
  const update = row.search === null ? undefined : planned.get(searchKey(row.search));
  if (update?.update === true) return copy("overview.search.doing.update", { day: update.day });
  return row.page.label === "climbing" ? copy("overview.search.doing.climbing") : copy("overview.search.status.live");
}

export function GoogleTable(p: {
  rows: readonly GoogleSearchRow[];
  all: boolean;
  /** "First reading {date}", for a page no pass has read yet. */
  first: string;
  planned: ReadonlyMap<string, Planned>;
  empty: string;
  /** "Checked {date}", where a pass read the places. */
  checked: string | null;
}): React.JSX.Element {
  const { rows, all } = p;
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="google-pages">
      {rows.length === 0 ? (
        <p className={`p-4 ${INK}`} data-testid="google-pages-empty">
          {p.empty}
        </p>
      ) : (
        <>
          <div className="hidden min-w-0 overflow-x-auto md:block">
            <table className="table">
              <caption className="sr-only">{copy("overview.google.title")}</caption>
              <thead className={INK}>
                <tr>
                  <th scope="col" className="w-[30%]">{copy("overview.google.col.search")}</th>
                  <th scope="col">{copy("overview.google.col.volume")}</th>
                  <th scope="col">{copy("overview.google.col.place")}</th>
                  <th scope="col">{copy("overview.google.col.rival")}</th>
                  <th scope="col">{copy("overview.google.col.doing")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.page.id} className={rowClass(i, all, true)} data-testid="google-page">
                    <td>
                      <Search row={row} />
                    </td>
                    <td className="whitespace-nowrap">{row.volume === null ? <Dash sr={copy("overview.google.unmeasured.sr")} /> : formatCount(row.volume)}</td>
                    <td>{place(row, p.first)}</td>
                    <td className="break-words">
                      {row.rival === null ? <Dash sr={copy("overview.google.unread.sr")} /> : copy("overview.google.rival", { name: row.rival.name, n: formatCount(row.rival.place) })}
                    </td>
                    <td>{doing(row, p.planned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list min-w-0 md:hidden" aria-label={copy("overview.google.title")}>
            {rows.map((row, i) => (
              <li key={row.page.id} className={`list-row min-w-0 ${rowClass(i, all)}`} data-testid="google-page-card">
                <div className="flex min-w-0 flex-col gap-1">
                  <Search row={row} />
                  <span className="font-semibold">{place(row, p.first)}</span>
                  <span className={`text-sm ${INK}`}>{doing(row, p.planned)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex min-w-0 flex-col items-center gap-2 p-3 text-center">
        <Suspense fallback={null}>
          <ShowAll total={rows.length} label={copy("overview.google.show-all", { n: formatCount(rows.length) })} />
        </Suspense>
        <p className={`text-xs ${INK}`}>{copy("overview.google.caption")}</p>
        {p.checked === null ? null : <p className={`text-xs ${INK}`} data-testid="search-measured">{p.checked}</p>}
      </div>
    </section>
  );
}

/** "First reading Mon 24": the next pass, for pages none has read. */
export const firstReading = (due: Date, timeZone: string): string => copy("overview.google.first", { date: formatShortDay(due, timeZone) });
