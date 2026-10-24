// SPEC §7 — a live page's own screen (board `PageDetail`): back to Plan, the
// title with when it went live and its label, this week in Google, how far
// it has got on Google and in AI answers, what happens next, why this page,
// the page as it stands, and Stop. After a Stop (R9) the controls leave and
// one line stays, with Put it back while a hosted page's window is open.
//
// Every value is the weekly pass's stored reading (`search_reading`); a step
// nothing has read says so and is never drawn as reached or as 0. On
// WordPress there are no server logs, so the steps only they can see are
// not drawn.
import type React from "react";
import Link from "next/link";
import { ArrowLeft, Lightbulb, Pencil } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FIRST_PAGE_PLACES } from "@/lib/measure/page-reading";
import { SEARCH_READING_WINDOW_D } from "@/lib/config/constants";
import type { Label } from "@/lib/opportunities/verdicts/types";
import type { AnswerEngine } from "@/lib/opportunities/types";
import { PlaceLine } from "@/ui/charts/PlaceLine";
import { formatCount, formatDate } from "../../_shell/format";
import { LabelBadge } from "../../_shell/verdict";
import { ENGINE_LABEL } from "../../_shell/page-target-words";
import { TakeDownControl } from "../../calendar/TakeDown";
import { putBackWords, stopWords } from "../../calendar/take-down-words";
import type { DraftView, LiveFacts } from "./model";
import { PublishedPageView } from "./PublishedPageView";
import { NOTE } from "./ReviewCards";
import { WhyThisPage } from "./TargetBlock";

const NEXT: Readonly<Record<Label, CopyKey>> = {
  working: "draft.next.working",
  climbing: "draft.next.climbing",
  too_early: "draft.next.too_early",
  not_moving: "draft.next.not_moving",
};

const PAUSE_HREF = "/app/settings/publishing";
const LADDER = {
  google: { title: "draft.ladder.google", testId: "live-ladder-google" },
  ai: { title: "draft.ladder.ai", testId: "live-ladder-ai" },
} as const satisfies Record<string, { title: CopyKey; testId: string }>;
const STOP_NOTE_ID = "live-stop-note";
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
    key: "draft.ladder.showing",
    at: dateOf(reached.showing, timeZone),
    detail: moved ? copy("draft.ladder.places", { from: formatCount(reading.first!.place), to: formatCount(reading.place!.value) }) : null,
  });
  steps.push({ key: "draft.ladder.first-page", at: dateOf(reached.firstPage, timeZone), detail: null });
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

function Ladder(p: { title: CopyKey; steps: readonly Step[]; measured: boolean; testId: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={p.testId}>
      <h3 className="text-base font-semibold">{copy(p.title)}</h3>
      <ul className="steps steps-vertical md:steps-horizontal min-w-0 text-sm">
        {p.steps.map((step) => {
          const reached = step.at !== null;
          return (
            <li key={step.key} className={`step${reached ? " step-primary" : ""}`} data-reached={reached ? "yes" : "not-yet"}>
              <span className="block font-semibold">{copy(step.key)}</span>
              <span className="num num-phrase block text-xs text-base-content/70">
                {step.detail ?? step.at ?? copy(p.measured ? "draft.ladder.not-yet" : "draft.ladder.unmeasured")}
              </span>
            </li>
          );
        })}
      </ul>
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
        {reading === null || reading.google === null || live.wordpress ? null : (
          <p className="text-sm text-base-content/70" data-testid="live-visits">
            {copy("draft.live.visits", {
              n: formatCount(reading.google.clicks),
              days: formatCount(SEARCH_READING_WINDOW_D),
              date: formatDate(new Date(reading.at), timeZone),
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
    <Link href={`/app/draft/${p.edit.draftId}`} className="btn btn-sm btn-soft" data-testid="live-edit">
      {inner}
    </Link>
  ) : (
    <button type="button" className="btn btn-sm btn-soft" data-testid="live-edit" onClick={p.onEdit}>
      {inner}
    </button>
  );
}

export function LivePage(p: { view: DraftView; live: LiveFacts; onEdit: () => void }): React.JSX.Element {
  const { view, live } = p;
  const standing = view.takeDown;
  const stopped = standing?.kind === "stopped";
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="draft-view">
      <nav data-testid="draft-back">
        <Link href="/app/calendar" prefetch={true} className="btn btn-sm btn-ghost">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {copy("draft.back")}
        </Link>
      </nav>

      <header className="flex min-w-0 flex-col gap-2" data-testid="draft-head">
        <h1 className="min-w-0 wrap-anywhere" data-testid="draft-title">
          {view.title}
        </h1>
        <p className="flex min-w-0 flex-wrap items-center gap-2" data-testid="live-badges">
          {stopped ? (
            <span className="badge badge-soft badge-warning" data-testid="live-stopped">
              {copy("draft.stopped.badge")}
            </span>
          ) : (
            <span className="badge badge-soft badge-success">{copy("draft.live.since", { date: formatDate(live.since, view.timeZone) })}</span>
          )}
          {live.label === null ? <span className="badge badge-ghost">{copy("review.label.unmeasured")}</span> : <LabelBadge label={live.label} />}
        </p>
        {stopped ? null : (
          <a href={live.url} target="_blank" rel="noopener" className="link link-hover num min-w-0 wrap-anywhere" data-testid="live-address">
            {live.url}
            <span className="sr-only"> {copy("draft.live.new-tab")}</span>
          </a>
        )}
      </header>

      <section className={NOTE.card} aria-labelledby={WEEK_ID} data-testid="live-week">
        <div className="card-body min-w-0 gap-5 p-6">
          <ThisWeek live={live} timeZone={view.timeZone} />
          <Ladder {...LADDER.google} steps={googleSteps(live, view.timeZone)} measured={live.reading !== null} />
          <div className="border-base-300 border-t pt-4">
            <Ladder {...LADDER.ai} steps={aiSteps(live, view.timeZone)} measured={live.reading !== null} />
          </div>
          {stopped ? null : (
            <p className="rounded-box bg-base-200 flex min-w-0 items-start gap-2.5 p-3 text-sm" data-testid="live-next">
              <Lightbulb size={16} strokeWidth={1.75} className="text-primary mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0 wrap-anywhere">
                <strong>{copy("draft.next.title")}</strong> {copy(live.label === null ? "draft.next.unmeasured" : NEXT[live.label])}
              </span>
            </p>
          )}
        </div>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <WhyThisPage target={view.target} />
        <div className="flex min-w-0 flex-col gap-2" data-testid="live-preview">
          <PublishedPageView title={view.title} bodyMd={view.bodyMd} grounded={view.grounded} publisher={view.publisher} />
          {stopped ? null : (
            <a href={live.url} target="_blank" rel="noopener" className="link link-primary text-sm font-semibold" data-testid="live-open">
              {copy("draft.live.open")}
              <span className="sr-only"> {copy("draft.live.new-tab")}</span>
            </a>
          )}
        </div>
      </div>

      {standing?.kind === "stopped" ? (
        <section className={NOTE.card} aria-label={copy("draft.live.controls")} data-testid="live-stopped-state">
          <div className="card-body min-w-0 items-start gap-3 p-6 text-sm">
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
        </section>
      ) : (
        <section className={NOTE.card} aria-label={copy("draft.live.controls")} data-testid="live-controls">
          <div className="card-body min-w-0 items-start gap-3 p-6">
            <p className="text-sm text-base-content/70">{copy("draft.live.runs")}</p>
            <div className="flex flex-wrap gap-3">
              <EditControl edit={live.edit} onEdit={p.onEdit} />
              <TakeDownControl draftId={view.draftId} mode="stop" words={stopWords()} describedBy={STOP_NOTE_ID} />
            </div>
            <p id={STOP_NOTE_ID} className="text-xs text-base-content/70" data-testid="live-stop-note">
              {copy("draft.live.stop-note")}
              <Link href={PAUSE_HREF} className="link ms-1">
                {copy("draft.live.pause-link")}
              </Link>
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
