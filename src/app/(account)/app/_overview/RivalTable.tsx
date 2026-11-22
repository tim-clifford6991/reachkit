// SPEC §4 *Competitors tab* (plate O5) — the twelve main searches with the site's place beside each
// competitor's: a table from `md`, one line per search on a phone. Competitors are read to place 10, the site to 100.
import type React from "react";
import { Fragment, Suspense } from "react";
import { copy } from "@/lib/presentation/copy";
import { rowClass } from "./frame";
import { formatCount } from "./present";
import type { PresenceRow, RivalSearchRow, RivalsModel } from "./rivals-model";
import { RIVAL_STATUS_COPY_KEY } from "./rivals-words";
import { searchKey, type Planned } from "./search-model";
import { ShowAll } from "./ShowAll";

const INK = "text-base-content/70";
const FIRST_PAGE = 10;

function Dash(p: { sr: string }): React.JSX.Element {
  return (
    <span className={INK}>
      <span aria-hidden>{copy("unmeasured.dash")}</span>
      <span className="sr-only">{p.sr}</span>
    </span>
  );
}

/** Bold is Google's first page: a weight, never a colour. */
function You(p: { place: number | null }): React.JSX.Element {
  if (p.place === null) return <Dash sr={copy("overview.rivals.off-top.sr")} />;
  return <span className={p.place <= FIRST_PAGE ? "font-semibold" : ""}>{formatCount(p.place)}</span>;
}

function Theirs(p: { place: number | undefined }): React.JSX.Element {
  return p.place === undefined ? <Dash sr={copy("overview.rivals.off-page.sr")} /> : <span className="font-semibold">{formatCount(p.place)}</span>;
}

function doing(row: RivalSearchRow, planned: ReadonlyMap<string, Planned>): string {
  const week = planned.get(searchKey(row.search));
  if (week === undefined) return copy(RIVAL_STATUS_COPY_KEY[row.status]);
  if (week.today) return copy("overview.search.doing.today");
  return copy(week.update ? "overview.search.doing.update" : "overview.search.doing.page", { day: week.day });
}

/** One wrapping line whose parts never break inside themselves. */
function Line(p: { parts: readonly { key: string; name: string; value: React.ReactNode }[] }): React.JSX.Element {
  return (
    <p className="text-sm">
      {p.parts.map((part, i) => (
        <Fragment key={part.key}>
          {i === 0 ? null : " · "}
          <span className="whitespace-nowrap">
            {part.name} {part.value}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

export function RivalTable(p: {
  model: RivalsModel;
  /** Competitors with a first-page place, most first; empty where none was counted. */
  columns: readonly PresenceRow[];
  planned: ReadonlyMap<string, Planned>;
  all: boolean;
  /** "You started at {k}", where an earlier week was read. */
  started: string | null;
  /** The sentence under the table: who holds those first pages where no competitor does. */
  holders: string | null;
  /** The AI answers line, where the window held answers. */
  ai: string | null;
}): React.JSX.Element {
  const { model, columns, all } = p;
  const { firstPage, rows } = model;
  const you = copy("overview.rivals.col.you");
  const ofYou = copy("overview.rivals.first.you", { n: formatCount(firstPage.you.count), m: formatCount(firstPage.of) });
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="rivals-table">
      <div className="hidden min-w-0 overflow-x-auto md:block">
        <table className="table">
          <caption className="sr-only">{copy("overview.tab.rivals")}</caption>
          <thead className={INK}>
            <tr>
              <th scope="col">{copy("overview.rivals.col.search")}</th>
              <th scope="col">{copy("overview.rivals.col.volume")}</th>
              <th scope="col">{you}</th>
              {columns.map((rival) => (
                <th key={rival.domain} scope="col" title={rival.domain}>
                  <span className="line-clamp-2 break-words">{rival.domain}</span>
                </th>
              ))}
              <th scope="col">{copy("overview.rivals.col.doing")}</th>
            </tr>
          </thead>
          <tbody>
            <tr data-testid="rivals-first">
              <th scope="row" colSpan={2}>
                {copy("overview.rivals.first")}
              </th>
              <td className="font-semibold whitespace-nowrap">{ofYou}</td>
              {columns.map((rival) => (
                <td key={rival.domain} className="font-semibold">
                  {formatCount(rival.count)}
                </td>
              ))}
              <td className={INK}>{p.started}</td>
            </tr>
            {rows.map((row, i) => (
              <tr key={row.search} className={rowClass(i, all, true)} data-testid="rivals-row">
                <td>
                  <span className="line-clamp-1 max-w-[16rem] font-mono text-sm break-words" title={row.search}>
                    {row.search}
                  </span>
                </td>
                <td className="whitespace-nowrap">{formatCount(row.volume)}</td>
                <td>
                  <You place={row.you} />
                </td>
                {columns.map((rival) => (
                  <td key={rival.domain}>
                    <Theirs place={row.places[rival.domain]} />
                  </td>
                ))}
                <td>{doing(row, p.planned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list min-w-0 md:hidden" aria-label={copy("overview.tab.rivals")}>
        <li className="list-row min-w-0" data-testid="rivals-first-card">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold">{copy("overview.rivals.first")}</span>
            <Line
              parts={[
                { key: "you", name: you, value: ofYou },
                ...columns.map((rival) => ({ key: rival.domain, name: rival.domain, value: formatCount(rival.count) })),
              ]}
            />
            {p.started === null ? null : <span className={`text-sm ${INK}`}>{p.started}</span>}
          </div>
        </li>
        {rows.map((row, i) => (
          <li key={row.search} className={`list-row min-w-0 ${rowClass(i, all)}`} data-testid="rivals-card">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-sm break-words">{row.search}</span>
              <Line
                parts={[
                  { key: "you", name: you, value: <You place={row.you} /> },
                  ...columns.map((rival) => ({ key: rival.domain, name: rival.domain, value: <Theirs place={row.places[rival.domain]} /> })),
                ]}
              />
              <span className={`text-sm ${INK}`}>{doing(row, p.planned)}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex min-w-0 flex-col gap-2 p-3">
        <p className={`text-xs ${INK}`}>{copy("overview.rivals.caption")}</p>
        {p.holders === null ? null : <p className={`text-sm ${INK}`} data-testid="rivals-holders">{p.holders}</p>}
        <div className="flex min-w-0 flex-col items-center gap-2 sm:flex-row sm:justify-between">
          {p.ai === null ? null : (
            <p className="min-w-0 text-sm" data-testid="rivals-ai">
              {p.ai}
            </p>
          )}
          <Suspense fallback={null}>
            <ShowAll total={rows.length} label={copy("overview.detail.show-all.searches", { n: formatCount(rows.length) })} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
