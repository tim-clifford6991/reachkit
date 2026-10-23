// Board Plan — "Live pages": every page published and standing, the rows
// Overview's Content tile counts, each with how far it got on Google and in
// AI answers as step dots, its label, and *Stop this page* (R9).
//
// The rows are Overview's ladder (`../_overview/ladder.ts`), so a step is
// read the one way on both screens; a step nothing read is "not measured",
// never an empty dot. The first few show; the rest open under *Show all*.
import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { formatCount, formatDate } from "../_shell/format";
import type { ContentModel, PublishedPage } from "../_overview/content";
import { pageLadderOf, type LadderRow, type StepDot } from "../_overview/ladder";
import { LABEL } from "../_overview/PageLadder";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import type { AnswerEngine } from "@/lib/opportunities/types";
import { TakeDownControl, type ControlWords } from "./TakeDown";
import { stopWords } from "./take-down-words";

/** The anchor Overview's Content tile opens. */
export const PUBLISHED_ID = "published";

/** How many live pages show before *Show all*, as the board draws them. */
const SHOWN = 4;

const MS_PER_WEEK = 7 * 86_400_000;

/** Where the page stands on its own search, or when Google found it; then
 *  which answer engines linked it. Each part only where a reading holds it. */
function standingLines(row: LadderRow, page: PublishedPage | undefined, timeZone: string, now: Date): string[] {
  const reading = page?.reading;
  if (reading == null) return [];
  const out: string[] = [];
  if (reading.place !== null) {
    const n = formatCount(Math.round(reading.place.value));
    const up = reading.first === null ? 0 : reading.first.place - Math.round(reading.place.value);
    if (row.label === "not_moving" && reading.best !== null) {
      const weeks = Math.round((now.getTime() - Date.parse(reading.best.at)) / MS_PER_WEEK);
      out.push(copy("calendar.live.no-gain", { n, weeks: formatCount(weeks) }));
    } else if (up > 0) {
      out.push(copy("calendar.live.place-up", { n, search: reading.place.query, up: formatCount(up), date: formatDate(new Date(reading.first!.at), timeZone) }));
    } else {
      out.push(copy("calendar.live.place", { n, search: reading.place.query }));
    }
  } else if (reading.reached.found !== undefined) {
    out.push(copy("calendar.live.found", { date: formatDate(new Date(reading.reached.found), timeZone) }));
  }
  const engines = (reading.linkedBy ?? []).flatMap((engine) => {
    const key = ENGINE_LABEL[engine as AnswerEngine];
    return key === undefined ? [] : [copy(key)];
  });
  if (engines.length > 0) out.push(copy("calendar.live.linked", { engines: engines.join(", ") }));
  return out;
}

function Dots(p: { dots: readonly StepDot[]; measured: boolean; caption: string; testId: string }): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-2" data-testid={p.testId}>
      <span className="flex shrink-0 gap-1" aria-hidden>
        {p.dots.map((dot) => (
          <span
            key={dot.name}
            aria-hidden
            className={p.measured ? `status ${dot.reached ? "status-primary" : ""}` : "status border border-base-content/40 bg-transparent"}
            data-reached={p.measured ? (dot.reached ? "yes" : "not-yet") : "unmeasured"}
          />
        ))}
      </span>
      <span className="min-w-0">{p.caption}</span>
    </span>
  );
}

function Row(p: {
  row: LadderRow;
  page: PublishedPage | undefined;
  recent: boolean;
  timeZone: string;
  now: Date;
  words: ControlWords;
}): React.JSX.Element {
  const { row, page } = p;
  const lines = standingLines(row, page, p.timeZone, p.now);
  const stop = page?.draftId === undefined || page.url === null ? null : page.draftId;
  // No AI step yet: "not read yet" where AI reads are seen; a WordPress page has no read step.
  const none = page?.wordpress === true ? "draft.ladder.not-yet" : "calendar.live.ai-unread";
  const ai = row.measured ? copy(row.ai ?? none) : copy("draft.ladder.unmeasured");
  return (
    <li className="list-row min-w-0 items-start px-0" data-testid="plan-published-row" data-recent={p.recent ? "" : undefined}>
      <div className="list-col-grow flex min-w-0 flex-col gap-1">
        {row.href === null ? (
          <span className="min-w-0 font-semibold break-words">{row.title}</span>
        ) : (
          <Link href={row.href} className="link link-hover min-w-0 font-semibold break-words">
            {row.title}
          </Link>
        )}
        {lines.length === 0 ? null : <p className="min-w-0 text-sm text-base-content/70">{lines.join(" ")}</p>}
        <span className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/70">
          <Dots dots={row.dots.google} measured caption={copy("calendar.live.google", { step: copy(row.google) })} testId="plan-live-google" />
          <Dots dots={row.dots.ai} measured={row.measured} caption={copy("calendar.live.ai", { step: ai })} testId="plan-live-ai" />
        </span>
      </div>
      {row.label === null && stop === null ? null : (
        <span className="flex shrink-0 flex-col items-end gap-2">
          {row.label === null ? null : <span className={LABEL[row.label].badge}>{copy(LABEL[row.label].key)}</span>}
          {stop === null ? null : <TakeDownControl draftId={stop} mode="stop" words={p.words} />}
        </span>
      )}
    </li>
  );
}

export function PublishedList(p: { content: ContentModel | null; timeZone: string; now: Date }): React.JSX.Element | null {
  if (p.content === null) return null;
  const pages = new Map(p.content.pages.map((page) => [page.id, page]));
  const recent = new Set(p.content.recent.map((page) => page.id));
  const rows = pageLadderOf(p.content.pages, p.now)?.rows ?? [];
  const words = stopWords();
  const row = (r: LadderRow): React.JSX.Element => (
    <Row key={r.id} row={r} page={pages.get(r.id)} recent={recent.has(r.id)} timeZone={p.timeZone} now={p.now} words={words} />
  );
  return (
    <section id={PUBLISHED_ID} className="card card-border min-w-0 scroll-mt-32 bg-base-100" aria-labelledby="plan-live-heading" data-testid="plan-published">
      <div className="card-body gap-3 p-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="plan-live-heading" className="card-title text-base!">
            {copy("calendar.live.title")}
          </h2>
          <span className="text-xs text-base-content/70">{copy("calendar.live.dots")}</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-base-content/70">{copy("calendar.live.none")}</p>
        ) : (
          <>
            <ul className="list min-w-0">{rows.slice(0, SHOWN).map(row)}</ul>
            {rows.length <= SHOWN ? null : (
              <details className="min-w-0" data-testid="plan-live-more">
                <summary className="flex min-w-0 cursor-pointer flex-wrap justify-between gap-x-3 text-sm">
                  <span className="text-base-content/70">
                    {copy("calendar.live.count", { n: formatCount(SHOWN), m: formatCount(rows.length) })}
                  </span>
                  <span className="link link-primary">{copy("calendar.live.all", { m: formatCount(rows.length) })}</span>
                </summary>
                <ul className="list min-w-0">{rows.slice(SHOWN).map(row)}</ul>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  );
}
