// Board Plan — "Live pages": every page published and standing, the rows
// Overview's Content tile counts, each with how far it got on Google and in
// AI answers as step dots, its label under it, and *Stop this page* (R9).
//
// The rows are Overview's ladder (`@/lib/measure/page-ladder`), so a step is
// read the one way on both screens. A page nothing has read yet says when it
// went live and is too early to judge, never empty dots. The first few show;
// the rest open under *Show all*.
import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { formatCount, formatDate } from "../_shell/format";
import type { ContentModel, PublishedPage } from "@/lib/measure/published";
import type { CopyKey } from "@/lib/presentation/copy";
import { pageLadderOf, type LadderRow, type StepDot } from "@/lib/measure/page-ladder";
import { LabelBadge } from "../_shell/verdict";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import type { AnswerEngine } from "@/lib/opportunities/types";
import { TakeDownControl, type ControlWords } from "./TakeDown";
import { stopWords } from "./take-down-words";
import { dayKeyOf, dayNumber, weekdayShort } from "./dates";
import { promisesGoLive } from "./WeekCard";
import type { DayWhen, PageOnDay, WeekModel } from "./month";

/** The anchor Overview's Content tile opens. */
export const PUBLISHED_ID = "published";

/** The stages whose page is still on its way out; a skipped, stopped, live or held-for-you page names no day. */
const ON_ITS_WAY: ReadonlySet<PageOnDay["stage"]> = new Set(["planned", "your_review", "scheduled"]);

function addressKey(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** The day ("Tue 20") each live address's update goes live this week, from the stored row; empty where no moment is promised. */
export function updateDays(week: Pick<WeekModel, "destination" | "held" | "stopped" | "timeZone"> & {
  cells: readonly { when: DayWhen; page: Pick<PageOnDay, "stage" | "replaces" | "publishAt" | "scheduledFor"> | null }[];
}): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  if (!promisesGoLive(week)) return out;
  for (const { when, page } of week.cells) {
    if (when === "past" || page?.replaces === undefined || !ON_ITS_WAY.has(page.stage)) continue;
    const day = page.publishAt === null ? page.scheduledFor : dayKeyOf(page.publishAt, week.timeZone);
    out.set(addressKey(page.replaces), `${weekdayShort(day)} ${dayNumber(day)}`);
  }
  return out;
}

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
      out.push(copy("calendar.live.place-up", { n, up: formatCount(up), date: formatDate(new Date(reading.first!.at), timeZone) }));
    } else {
      out.push(copy("calendar.live.place", { n }));
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

/** Board Plan names the Google step a page shows in by where it shows: "in results". */
function googleStep(step: CopyKey): CopyKey {
  return step === "draft.ladder.showing" ? "calendar.live.showing" : step;
}

function Dots(p: { dots: readonly StepDot[]; caption: string; testId: string }): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-2" data-testid={p.testId}>
      <span className="flex shrink-0 gap-1" aria-hidden>
        {p.dots.map((dot) => (
          <span
            key={dot.name}
            aria-hidden
            className={`status ${dot.reached ? "status-primary" : ""}`}
            data-reached={dot.reached ? "yes" : "not-yet"}
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
  update: string | undefined;
}): React.JSX.Element {
  const { row, page } = p;
  const lines = row.measured || page === undefined
    ? standingLines(row, page, p.timeZone, p.now)
    : [copy("calendar.live.unread", { date: formatDate(page.publishedAt, p.timeZone) })];
  if (p.update !== undefined) lines.push(copy("calendar.live.update", { day: p.update }));
  const stop = page?.draftId === undefined || page.url === null ? null : page.draftId;
  // No AI step yet: "not read yet" where AI reads are seen; a WordPress page has no read step.
  const none = page?.wordpress === true ? "draft.ladder.not-yet" : "calendar.live.ai-unread";
  const ai = copy(row.ai ?? none);
  return (
    <li className="list-row min-w-0 items-start px-0" data-testid="plan-published-row" data-recent={p.recent ? "" : undefined}>
      <div className="list-col-grow flex min-w-0 flex-col gap-1">
        {row.href === null ? (
          <span className="min-w-0 font-semibold break-words">{row.title}</span>
        ) : (
          <Link href={row.href} className="link link-primary link-hover min-w-0 font-semibold break-words">
            {row.title}
          </Link>
        )}
        {lines.length === 0 ? null : <p className="min-w-0 text-sm text-base-content/70">{lines.join(" ")}</p>}
        {row.measured ? (
          <span className="flex min-w-0 flex-col gap-1 text-xs text-base-content/70">
            <Dots dots={row.dots.google} caption={copy("calendar.live.google", { step: copy(googleStep(row.google)) })} testId="plan-live-google" />
            <Dots dots={row.dots.ai} caption={copy("calendar.live.ai", { step: ai })} testId="plan-live-ai" />
          </span>
        ) : null}
        {/* Unread, a page is too early to judge. */}
        <LabelBadge label={row.label ?? "too_early"} className="mt-1 self-start" testId="plan-live-label" />
      </div>
      {stop === null ? null : (
        <span className="flex shrink-0 flex-col items-end gap-2">
          <TakeDownControl draftId={stop} mode="stop" words={p.words} />
        </span>
      )}
    </li>
  );
}

export function PublishedList(p: {
  content: ContentModel | null;
  timeZone: string;
  now: Date;
  /** `updateDays` of the week shown. */
  updates?: ReadonlyMap<string, string>;
}): React.JSX.Element | null {
  if (p.content === null) return null;
  const pages = new Map(p.content.pages.map((page) => [page.id, page]));
  const recent = new Set(p.content.recent.map((page) => page.id));
  const rows = pageLadderOf(p.content.pages, p.now)?.rows ?? [];
  const words = stopWords();
  const row = (r: LadderRow): React.JSX.Element => {
    const page = pages.get(r.id);
    const update = page?.url == null ? undefined : p.updates?.get(addressKey(page.url));
    return <Row key={r.id} row={r} page={page} recent={recent.has(r.id)} timeZone={p.timeZone} now={p.now} words={words} update={update} />;
  };
  return (
    <section id={PUBLISHED_ID} className="card card-border min-w-0 scroll-mt-32 bg-base-100" aria-labelledby="plan-live-heading" data-testid="plan-published">
      <div className="card-body gap-3 p-4">
        <h2 id="plan-live-heading" className="card-title text-base!">
          {copy("calendar.live.title")}
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-base-content/70">{copy("calendar.live.none")}</p>
        ) : (
          <>
            <ul className="list min-w-0">{rows.slice(0, SHOWN).map(row)}</ul>
            {rows.length <= SHOWN ? null : (
              <details className="collapse min-w-0" data-testid="plan-live-more">
                <summary className="collapse-title flex min-h-11 min-w-0 items-center px-0 text-sm">
                  <span className="link link-primary font-semibold">{copy("calendar.live.all", { m: formatCount(rows.length) })}</span>
                </summary>
                <ul className="collapse-content list min-w-0 px-0">{rows.slice(SHOWN).map(row)}</ul>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  );
}
