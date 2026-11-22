// SPEC §7 — a live page's two parts on its screen (board `PageDetail`, plates F4b/F8): *How It's Doing* — this week
// in Google, how far it has got on Google and in AI answers, what happens next — and the rail, with when it went
// live, Edit and Stop. After a Stop (R9) the controls leave and one line stays, with Put it back while a hosted
// page's window is open.
//
// Every value is the weekly pass's stored reading (`search_reading`); a step
// nothing has read says so and is never drawn as reached or as 0. On
// WordPress there are no server logs, so the steps only they can see are
// not drawn.
import type React from "react";
import Link from "next/link";
import { Check, ExternalLink, Pencil, RefreshCw, Sparkles, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FIRST_PAGE_PLACES, googleRead } from "@/lib/measure/page-reading";
import { SEARCH_READING_WINDOW_D } from "@/lib/config/constants";
import type { Label } from "@/lib/opportunities/verdicts/types";
import type { AnswerEngine } from "@/lib/opportunities/types";
import { PlaceLine } from "@/ui/charts/PlaceLine";
import { formatCount, formatDate, formatShortDay } from "../../_shell/format";
import { LabelBadge } from "../../_shell/verdict";
import { ENGINE_LABEL } from "../../_shell/page-target-words";
import { TakeDownControl } from "../../calendar/TakeDown";
import { putBackWords, stopWords } from "../../calendar/take-down-words";
import type { DraftView, LiveFacts } from "./model";
import { SHAPE } from "./shape";

const NEXT: Readonly<Record<Label, CopyKey>> = {
  working: "draft.next.working",
  climbing: "draft.next.climbing",
  too_early: "draft.next.too_early",
  not_moving: "draft.next.not_moving",
};

const PAUSE_HREF = "/app/settings/pages";
const LADDER = {
  google: { title: "draft.ladder.google", testId: "live-ladder-google", icon: Check, reached: "bg-success text-success-content" },
  ai: { title: "draft.ladder.ai", testId: "live-ladder-ai", icon: Sparkles, reached: "bg-primary text-primary-content" },
} as const satisfies Record<string, { title: CopyKey; testId: string; icon: LucideIcon; reached: string }>;
const STOP_NOTE_ID = "live-stop-note";
// A 44px target, as wide as the rail.
const EDIT = "btn btn-soft btn-primary min-h-11";
const WEEK_ID = "live-week";

/** One step of the ladder: reached on a date, not yet, or not measured. */
interface Step {
  key: CopyKey;
  at: string | null;
  detail: string | null;
}

function dateOf(iso: string | undefined, timeZone: string): string | null {
  return iso === undefined ? null : formatDate(new Date(iso), timeZone);
}

function placesWord(n: number): string {
  return n === 1 ? copy("draft.live.places.one") : copy("draft.live.places", { n: formatCount(n) });
}

function engines(linkedBy: readonly string[] | null): string | null {
  const names = (linkedBy ?? []).flatMap((engine) => {
    const key = ENGINE_LABEL[engine as AnswerEngine];
    return key === undefined ? [] : [copy(key)];
  });
  return names.length === 0 ? null : names.join(", ");
}

function googleSteps(live: LiveFacts, timeZone: string): Step[] {
  const { reading } = live;
  const reached = reading?.reached ?? {};
  const moved = reading?.first != null && reading.place !== null && reading.first.at !== reading.at;
  const steps: Step[] = [{ key: "draft.ladder.live", at: formatDate(live.since, timeZone), detail: null }];
  if (!live.wordpress) steps.push({ key: "draft.ladder.found", at: dateOf(reached.found, timeZone), detail: null });
  steps.push({
    key: "calendar.live.showing",
    at: dateOf(reached.showing, timeZone),
    detail: moved ? copy("draft.ladder.places", { from: formatCount(reading.first!.place), to: formatCount(reading.place!.value) }) : null,
  });
  steps.push({ key: "draft.live.first-page", at: dateOf(reached.firstPage, timeZone), detail: null });
  return steps;
}

function aiSteps(live: LiveFacts, timeZone: string): Step[] {
  const reached = live.reading?.reached ?? {};
  const linked = dateOf(reached.linkedByAi, timeZone);
  const by = engines(live.reading?.linkedBy ?? null);
  const steps: Step[] = [];
  if (!live.wordpress) steps.push({ key: "draft.ladder.read", at: dateOf(reached.readByAi, timeZone), detail: null });
  steps.push({ key: "draft.ladder.linked", at: linked === null || by === null ? linked : `${linked} · ${by}`, detail: null });
  if (!live.wordpress) steps.push({ key: "draft.ladder.visit", at: dateOf(reached.aiVisit, timeZone), detail: null });
  return steps;
}

function Ladder(p: { title: CopyKey; steps: readonly Step[]; measured: boolean; testId: string; icon: LucideIcon; reached: string }): React.JSX.Element {
  const Icon = p.icon;
  return (
    <div className="flex min-w-0 flex-col gap-2.5" data-testid={p.testId}>
      <h3 className="text-base font-semibold">{copy(p.title)}</h3>
      {/* No rail: a reached step is a filled circle with its icon, a step not reached its number in a dashed ring. */}
      <ol className="flex min-w-0 flex-col gap-2.5 text-sm md:flex-row md:gap-1">
        {p.steps.map((step, at) => {
          const reached = step.at !== null;
          return (
            <li
              key={step.key}
              className="flex min-w-0 items-center gap-3 md:flex-1 md:flex-col md:gap-1.5 md:text-center"
              data-reached={reached ? "yes" : "not-yet"}
            >
              {reached ? (
                <span className={`grid size-7.5 shrink-0 place-items-center rounded-full ${p.reached}`} data-testid="live-step-icon">
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                </span>
              ) : (
                <span
                  className="border-base-content/40 text-base-content/70 grid size-7.5 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed text-xs font-bold"
                  aria-hidden
                >
                  {at + 1}
                </span>
              )}
              <span className="min-w-0 font-semibold" data-testid="live-step-name">{copy(step.key)}</span>
              <span className="ms-auto text-end text-xs text-base-content/70 md:ms-0 md:text-center" data-testid="live-step-at">
                {step.detail ?? step.at ?? copy(p.measured ? "draft.ladder.not-yet" : "draft.ladder.unmeasured")}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The week's figure: its place and how far it moved, or the furthest step
 *  reached while it is not in results yet. */
function ThisWeek(p: { live: LiveFacts; timeZone: string }): React.JSX.Element {
  const { live, timeZone } = p;
  const { reading } = live;
  const place = reading?.place ?? null;
  const first = reading?.first ?? null;
  const moved = place !== null && first !== null && first.at !== reading!.at;
  const since = moved ? formatDate(new Date(first.at), timeZone) : "";
  const gain = moved ? first.place - place.value : 0;
  const line = !moved
    ? null
    : gain < 0
      ? copy("draft.live.down", { places: placesWord(-gain), date: since })
      : gain === 0
        ? copy("draft.live.same", { date: since })
        : place.value > FIRST_PAGE_PLACES
          ? copy("draft.live.up.near", { places: placesWord(gain), date: since, gap: placesWord(place.value - FIRST_PAGE_PLACES) })
          : copy("draft.live.up", { places: placesWord(gain), date: since });
  const found = live.wordpress ? undefined : reading?.reached.found;
  const google = live.wordpress ? null : googleRead(reading?.google);
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-5" data-testid="live-week-figure">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
        <h2 id={WEEK_ID} className="eyebrow">
          {copy("draft.live.week")}
        </h2>
        {place === null ? (
          <p className="min-w-0 wrap-anywhere" data-testid="live-furthest">
            {copy("draft.live.furthest", {
              step: copy(found === undefined ? "draft.ladder.live" : "draft.ladder.found"),
              date: formatDate(found === undefined ? live.since : new Date(found), timeZone),
            })}
          </p>
        ) : (
          <>
            <p className="flex min-w-0 flex-wrap items-baseline gap-2.5">
              <span className="num text-4xl font-semibold">{formatCount(place.value)}</span>
              <span className="text-sm text-base-content/70">
                {copy("draft.live.place", { search: place.query })}
              </span>
            </p>
            {line === null ? null : <p className="min-w-0 font-semibold wrap-anywhere" data-testid="live-moved">{line}</p>}
          </>
        )}
        {google === null ? null : (
          <p className="text-sm text-base-content/70" data-testid="live-visits">
            {copy("draft.live.visits", {
              n: formatCount(google.clicks),
              days: formatCount(SEARCH_READING_WINDOW_D),
            })}
          </p>
        )}
      </div>
      {moved ? (
        <div className="flex w-full max-w-xs min-w-0 flex-col gap-1" data-testid="live-chart">
          <PlaceLine
            label={copy("draft.live.chart")}
            firstPage={FIRST_PAGE_PLACES}
            readings={[
              { name: formatDate(new Date(first.at), timeZone), place: first.place },
              { name: formatDate(new Date(reading!.at), timeZone), place: place.value },
            ]}
          />
          <p className="text-xs text-base-content/70">{copy("draft.live.band")}</p>
        </div>
      ) : null}
    </div>
  );
}

/** *Edit this page* (R19): the editor on this version, or the version of
 *  this address already waiting. */
function EditControl(p: { edit: LiveFacts["edit"]; onEdit: () => void }): React.JSX.Element | null {
  if (p.edit === null) return null;
  const inner = (
    <>
      <Pencil size={14} strokeWidth={1.75} aria-hidden />
      {copy("draft.action.edit")}
    </>
  );
  return p.edit.kind === "version" ? (
    <Link href={`/app/draft/${p.edit.draftId}`} className={EDIT} data-testid="live-edit">
      {inner}
    </Link>
  ) : (
    <button type="button" className={EDIT} data-testid="live-edit" onClick={p.onEdit}>
      {inner}
    </button>
  );
}

/** *How It's Doing*: the week's figure, the two ladders and what happens next. */
export function HowItsDoing(p: { live: LiveFacts; stopped: boolean; timeZone: string }): React.JSX.Element {
  const { live, timeZone } = p;
  return (
    <section className="flex min-w-0 flex-col gap-5" aria-labelledby={WEEK_ID} data-testid="live-week">
      {live.label === null ? <span className="badge badge-ghost">{copy("review.label.unmeasured")}</span> : <LabelBadge label={live.label} />}
      <ThisWeek live={live} timeZone={timeZone} />
      <Ladder {...LADDER.google} steps={googleSteps(live, timeZone)} measured={live.reading !== null} />
      <div className="border-base-300 border-t pt-4">
        <Ladder {...LADDER.ai} steps={aiSteps(live, timeZone)} measured={live.reading !== null} />
      </div>
      {p.stopped ? null : (
        <p className="rounded-box bg-base-200 flex min-w-0 items-start gap-2.5 p-3 text-sm" data-testid="live-next">
          <RefreshCw size={16} strokeWidth={1.75} className="text-primary mt-0.5 shrink-0" aria-hidden />
          <span className="min-w-0 wrap-anywhere">
            <strong>{copy("draft.next.title")}</strong> {copy(live.label === null ? "draft.next.unmeasured" : NEXT[live.label])}
          </span>
        </p>
      )}
    </section>
  );
}

/** The page's own address, which opens it; a stopped page has none. */
export function LiveAddress(p: { url: string }): React.JSX.Element {
  return (
    <a href={p.url} target="_blank" rel="noopener" className="link link-primary link-hover min-w-0 font-mono text-sm break-all" data-testid="live-address">
      {p.url}
      <ExternalLink size={14} strokeWidth={1.75} className="ms-1 inline align-baseline" aria-hidden />
      <span className="sr-only"> {copy("draft.live.new-tab")}</span>
    </a>
  );
}

/** The live page's rail: since when, Edit and Stop with Stop's line, or the stopped page's line and Put it back. */
export function LiveRail(p: { view: DraftView; live: LiveFacts; onEdit: () => void }): React.JSX.Element {
  const { view, live } = p;
  const standing = view.takeDown;
  return (
    <aside className={SHAPE.rail} aria-label={copy("draft.decide.title")} data-testid="live-rail">
      <div className="card-body min-w-0 gap-4 p-5">
        {standing?.kind === "stopped" ? (
          <div className="flex min-w-0 flex-col items-start gap-3 text-sm" data-testid="live-stopped-state">
            <p>{copy("draft.stopped.line")}</p>
            {standing.wordpress ? <p data-testid="live-stopped-wordpress">{copy("draft.stopped.wordpress")}</p> : null}
            {standing.putBackUntil === null ? null : (
              <>
                <p data-testid="live-put-back-until">
                  {copy("draft.put-back.until", { date: formatDate(standing.putBackUntil, view.timeZone) })}
                </p>
                <TakeDownControl draftId={view.draftId} mode="put_back" words={putBackWords()} />
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-lg font-bold" data-testid="live-since">
              {copy("draft.live.since", { date: formatShortDay(live.since, view.timeZone).split(" ").slice(1).join(" ") })}
            </p>
            <div className={SHAPE.foot} role="group" aria-label={copy("draft.decide.title")} data-testid="live-controls">
              <div className="grid grid-cols-1 gap-2 max-lg:auto-cols-fr max-lg:grid-flow-col max-lg:grid-cols-none">
                <EditControl edit={live.edit} onEdit={p.onEdit} />
                <TakeDownControl draftId={view.draftId} mode="stop" words={stopWords()} describedBy={STOP_NOTE_ID} />
              </div>
              <p id={STOP_NOTE_ID} className="text-xs text-base-content/70 max-md:order-first" data-testid="live-stop-note">
                {copy("draft.live.stop-note")} {copy("draft.live.pause-lead")}
                {/* Underlined because it sits in a sentence: colour alone does not mark a link (WCAG 1.4.1, axe link-in-text-block). */}
                <Link href={PAUSE_HREF} className="link link-primary ms-1 decoration-1 underline-offset-2">
                  {copy("draft.live.pause-link")}
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
