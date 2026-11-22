// SPEC §4 *Pages Live detail* (plate O2) — every page the Pages Live tile counts, newest first: when it went
// live, its place on Google, its AI mark over the window, and a link to its own screen. Every row is the tile's.
import type React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { addressOf } from "@/lib/measure/page-reading";
import type { PublishedPage } from "@/lib/measure/published";
import { formatCount, formatDate, formatShortDay } from "../_shell/format";
import type { AiMark } from "./ai-mark";
import { Mark } from "./AiTab";
import { rowClass } from "./frame";
import { placeWords } from "./place-words";
import { ShowAll } from "./ShowAll";
import type { TilesView } from "./tiles-build";
import { AI_WINDOW_WEEKS } from "./tiles";

const INK = "text-base-content/70";

interface LiveRow {
  page: PublishedPage;
  href: string | null;
  google: { text: string; sub: string | null; dash: boolean };
  mark: AiMark;
}

/** The tile's own rows; a page no question was asked for in the window is "Not checked", never "none". */
export function liveRowsOf(view: TilesView, due: Date, timeZone: string): LiveRow[] {
  const google = new Map(view.google.rows.map((row) => [row.id, row]));
  const unread = view.tiles.find((tile) => tile.key === "google")?.change?.kind === "unread";
  const byId = new Map(view.pages.pages.map((page) => [page.id, page]));
  const marks = new Map<string, AiMark>();
  for (const row of view.ai?.rows ?? []) {
    const url = byId.get(row.id)?.url ?? null;
    if (url !== null) marks.set(addressOf(url), row.mark);
  }
  return view.pages.pages.map((page): LiveRow => {
    const reading = page.reading ?? null;
    const line = google.get(page.id)?.line;
    const found = reading?.reached.found;
    const words = unread
      ? { text: copy("overview.tile.change.unread", { what: copy("overview.tile.short.google") }), sub: null, dash: false }
      : reading === null
        ? { text: copy("unmeasured.dash"), sub: copy("overview.pages.first-reading", { date: formatShortDay(due, timeZone) }), dash: true }
        : reading.place === null && page.wordpress !== true && found !== undefined
          ? { text: copy("overview.pages.crawled", { date: formatShortDay(new Date(found), timeZone) }), sub: null, dash: false }
          : { text: placeWords(reading, line?.kind === "flat" ? line.weeks : 2), sub: null, dash: false };
    return {
      page,
      href: page.draftId === undefined ? null : `/app/draft/${page.draftId}`,
      google: words,
      mark: (page.url === null ? undefined : marks.get(addressOf(page.url))) ?? "unchecked",
    };
  });
}

/** The day the latest weekly reading reached a live page. */
export function checkedOf(view: TilesView): Date | null {
  const at = view.pages.pages.flatMap((page) => (page.reading == null ? [] : [Date.parse(page.reading.at)]));
  return at.length === 0 ? null : new Date(Math.max(...at));
}

function Google(p: { google: LiveRow["google"] }): React.JSX.Element {
  return (
    <span className="flex min-w-0 flex-col">
      <span aria-hidden={p.google.dash || undefined}>{p.google.text}</span>
      {p.google.sub === null ? null : <span className={`text-sm ${INK}`}>{p.google.sub}</span>}
    </span>
  );
}

function Title(p: { page: PublishedPage }): React.JSX.Element {
  return (
    <>
      <span className="line-clamp-2 font-semibold" title={p.page.title}>
        {p.page.title}
      </span>
      {p.page.url === null ? null : <span className={`font-mono text-sm break-all ${INK}`}>{p.page.url}</span>}
    </>
  );
}

export function LivePages(p: { rows: readonly LiveRow[]; all: boolean; timeZone: string }): React.JSX.Element {
  const { rows, all, timeZone } = p;
  const scroll = all ? { tabIndex: 0, "aria-label": copy("overview.pages.all.label") } : {};
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="live-pages">
      <div className={`hidden min-w-0 overflow-x-auto md:block ${all ? "lg:max-h-[60vh] lg:overflow-y-auto" : ""}`} {...scroll}>
        <table className="table table-sm">
          <caption className="sr-only">{copy("overview.pages.caption")}</caption>
          <thead className={INK}>
            <tr>
              <th scope="col" className="w-[44%]">{copy("overview.pages.col.page")}</th>
              <th scope="col">{copy("overview.pages.col.live")}</th>
              <th scope="col">{copy("overview.pages.col.google")}</th>
              <th scope="col">{copy("overview.pages.col.ai", { weeks: formatCount(AI_WINDOW_WEEKS) })}</th>
              <th scope="col">
                <span className="sr-only">{copy("overview.pages.open")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.page.id} className={rowClass(i, all, true)} data-testid="live-page">
                <td>
                  <span className="flex min-w-0 flex-col">
                    <Title page={row.page} />
                  </span>
                </td>
                <td className="font-mono whitespace-nowrap">{formatDate(row.page.publishedAt, timeZone)}</td>
                <td>
                  <Google google={row.google} />
                </td>
                <td>
                  <Mark mark={row.mark} />
                </td>
                <td>
                  {row.href === null ? null : (
                    <Link
                      className="btn btn-ghost btn-sm min-h-11"
                      href={row.href}
                      aria-label={copy("overview.pages.open.name", { title: row.page.title })}
                    >
                      {copy("overview.pages.open")}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list min-w-0 md:hidden" aria-label={copy("overview.pages.caption")}>
        {rows.map((row, i) => {
          const body = (
            <>
              <Title page={row.page} />
              <span className="text-sm">
                {copy("overview.pages.live", { date: formatDate(row.page.publishedAt, timeZone), place: (row.google.dash ? row.google.sub : null) ?? row.google.text })}
              </span>
              <Mark mark={row.mark} />
            </>
          );
          return (
            <li key={row.page.id} className={`list-row min-w-0 p-0 ${rowClass(i, all)}`} data-testid="live-page-card">
              {row.href === null ? (
                <div className="list-col-grow flex min-w-0 flex-col gap-1 p-4">{body}</div>
              ) : (
                <Link className="list-col-grow flex min-h-11 min-w-0 flex-col gap-1 p-4" href={row.href}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex min-w-0 flex-col items-center gap-2 p-3 text-center">
        <Suspense fallback={null}>
          <ShowAll total={rows.length} label={copy("overview.detail.show-all.pages", { n: formatCount(rows.length) })} />
        </Suspense>
        <p className={`text-sm ${INK}`}>{copy("overview.pages.foot")}</p>
      </div>
    </section>
  );
}
