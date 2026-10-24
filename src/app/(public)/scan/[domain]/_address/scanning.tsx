// BUILD §4.1 — the scanning screen (board PubScanning): the head, the
// stages with what each finds out, what the report will hold, and the
// report's own cards beside them, each held by a skeleton until it arrives.
//
// SPEC §2, 2026-09-20: named stages with elapsed times, no spinner, %, or
// countdown, and each report section in place from the first frame, a
// daisyUI `skeleton` holding it. No full-page wait.
//
// A card's badge says whether the stage that produces it has finished, is
// running, or has not been reached, read from the stream's stored stage log.
// A finished stage's summary fills its card; a card with nothing to show,
// and the competitors, score and AI cards always, stay a skeleton until the
// report replaces this screen. A missing value is never drawn as 0.
//
// One stream, one reading: `useScanStages` is subscribed once here and
// handed to the stages and the cards. The ending event is `ScanProgress`'s
// to act on: it refreshes the router and the report arm replaces this one.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Ban, Check, Search, Sparkles } from "lucide-react";
import { Surface } from "@/ui/layout";
import { SKELETON_EXIT, ViewTransition } from "@/ui/motion";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { StageName, StageSummary } from "@/lib/scan/stages";
import type { CanonicalDomain } from "@/lib/scan/domain";
import { ScanProgress, SEARCHES, stageState, useScanStages, type StageState } from "./progress";

const CARD = "card bg-base-100 min-w-0 shadow-(--shadow-card)";

/** The report's cards in the board's order, each against the stage that
 *  produces it: the profile is read with the market, the searches and their
 *  AI answers are asked together, and competitors are concluded in scoring. */
type Fill = (found: StageSummary) => React.ReactNode;

const FILLING: readonly { readonly title: CopyKey; readonly stage: StageName; readonly lines: number; readonly fill?: Fill }[] = [
  { title: "report.read.title", stage: "reading_your_market", lines: 3, fill: whatWeRead },
  { title: "scan.filling.readers", stage: "reading_access_rules", lines: 2, fill: whoMayRead },
  { title: "scan.filling.competitors", stage: "scoring", lines: 2 },
  { title: "scan.get.score", stage: "scoring", lines: 1 },
  { title: "scan.filling.searches", stage: "asking_the_twelve", lines: 5, fill: theSearches },
  { title: "scan.filling.ai", stage: "asking_the_twelve", lines: 2 },
];

function whatWeRead(found: StageSummary): React.ReactNode {
  if (found.pagesRead === undefined && found.category === undefined) return null;
  return (
    <div className="flex flex-col gap-2">
      {found.pagesRead === undefined ? null : <p className="text-sm">{copy("scan.filling.pages", { pages: String(found.pagesRead) })}</p>}
      {found.category === undefined ? null : (
        <ul className="flex flex-wrap gap-2">
          <li className="badge badge-soft">{found.category}</li>
        </ul>
      )}
    </div>
  );
}

function reader(Icon: typeof Search, name: CopyKey, state: "in" | "out"): React.ReactNode {
  const State = state === "in" ? Check : Ban;
  return (
    <span className="flex items-center gap-1 rounded-box bg-base-200 px-3 py-1 text-sm">
      <Icon size={14} strokeWidth={1.75} aria-hidden />
      <span>{copy(name)}</span>
      <span className={`flex items-center gap-1 ${state === "in" ? "text-success" : "text-error"}`}>
        <State size={14} strokeWidth={1.75} aria-hidden />
        {copy(state === "in" ? "scan.filling.reader.in" : "scan.filling.reader.out")}
      </span>
    </span>
  );
}

function whoMayRead(found: StageSummary): React.ReactNode {
  if (found.readers === undefined) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {reader(Search, "scan.filling.reader.google", found.readers.google)}
        {reader(Sparkles, "scan.filling.reader.ai", found.readers.ai)}
      </div>
      {found.readers.ai === "out" ? <p className="text-base-content/70 text-sm">{copy("scan.filling.reader.fix")}</p> : null}
    </div>
  );
}

function theSearches(found: StageSummary): React.ReactNode {
  if (found.searches === undefined) return null;
  return (
    <ol className="flex flex-col gap-2">
      {found.searches.map((search, i) => (
        <li key={i} className="flex items-start justify-between gap-2 text-sm">
          <span className="min-w-0 break-words">{search.words}</span>
          <span className={`badge badge-sm shrink-0 ${search.onPageOne ? "badge-success badge-soft" : "badge-ghost"}`}>
            {copy(search.onPageOne ? "scan.filling.search.in" : "scan.filling.search.out")}
          </span>
        </li>
      ))}
    </ol>
  );
}

const GET_STEPS: readonly CopyKey[] = ["scan.get.step.1", "scan.get.step.2", "scan.get.step.3"];

const GET_ITEMS: readonly (readonly [CopyKey, CopyKey])[] = [
  ["scan.get.score", "scan.get.score.line"],
  ["scan.get.rivals", "scan.get.rivals.line"],
  ["scan.get.held", "scan.get.held.line"],
  ["scan.get.first-page", "scan.get.first-page.line"],
];

const CARD_BADGE: Record<StageState, { key: CopyKey; className: string }> = {
  done: { key: "scan.filling.found", className: "badge-success badge-soft" },
  active: { key: "stage.status.working", className: "badge-primary badge-soft" },
  pending: { key: "stage.status.next", className: "badge-ghost" },
};

const subscribeNever = (): (() => void) => () => undefined;

/** One card's place: its title, its stage's state in words, and a skeleton
 *  where its content will be. */
function FillingCard(p: { title: CopyKey; state: StageState; lines: number; filled: React.ReactNode | null }): React.JSX.Element {
  const badge = CARD_BADGE[p.state];
  return (
    <section className={CARD} data-testid="scan-section" data-state={p.state} data-done={p.state === "done"}>
      <div className="card-body gap-3">
        <h3 className="card-title flex-wrap text-base">
          {copy(p.title, SEARCHES)}
          <span className={`badge badge-sm ${badge.className}`}>{copy(badge.key)}</span>
        </h3>
        {/* No information a reader could use; the stages are the accessible
            account of the wait. The skeleton leaves when the report arrives. */}
        {p.filled ?? (
          <ViewTransition {...SKELETON_EXIT}>
            <div className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: p.lines }, (_unused, line) => (
                <div key={line} className={`skeleton h-4 ${line === p.lines - 1 ? "w-2/3" : "w-full"}`} />
              ))}
            </div>
          </ViewTransition>
        )}
      </div>
    </section>
  );
}

export function ScanningView(p: {
  domain: CanonicalDomain;
  /** Present when the address already knew which scan is running. Absent
   *  on the `starting` arm, where the stream's own hook claims one. */
  scanId?: string;
}): React.JSX.Element {
  const stages = useScanStages({ domain: p.domain, scanId: p.scanId });
  // The start is the visitor's own clock, so it is drawn only in the browser.
  const inBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);
  const started = inBrowser
    ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(stages.startedAt)
    : null;

  return (
    // One column on a phone, two from medium: the stages and what you'll get
    // on the left, the report filling in on the right (ADR-093 decision 6).
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "columns", count: 2 },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="col-span-full grid grid-cols-subgrid items-start gap-4">
        <header className="col-span-full flex min-w-0 flex-col gap-1">
          <p className="eyebrow">{copy("scan.eyebrow")}</p>
          {/* The domain is what this report is about, so it is the page's h1 (#328). */}
          <h1 className="min-w-0 break-words">{copy("scan.head", { domain: p.domain })}</h1>
          <p className="text-base-content/70">{copy("scan.waiting.line")}</p>
        </header>

        <div className="flex min-w-0 flex-col gap-4">
          <section className={CARD} aria-labelledby="scan-progress">
            <div className="card-body gap-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 id="scan-progress" className="eyebrow">
                  {copy("scan.progress.title")}
                </h2>
                {started === null ? null : (
                  <span className="text-base-content/70 text-xs">{copy("stage.started", { time: started })}</span>
                )}
              </div>
              <ScanProgress domain={p.domain} scanId={p.scanId} stages={stages} />
              <p className="text-base-content/70 text-sm">{copy("scan.progress.caption")}</p>
            </div>
          </section>

          <section className={CARD} aria-labelledby="scan-get">
            <div className="card-body gap-4">
              <h2 id="scan-get" className="card-title">
                {copy("scan.get.title")}
              </h2>
              <ol className="flex flex-wrap gap-2">
                {GET_STEPS.map((step) => (
                  <li key={step} className="badge badge-soft">
                    {copy(step)}
                  </li>
                ))}
              </ol>
              <ul className="flex flex-col gap-3">
                {GET_ITEMS.map(([name, line]) => (
                  <li key={name} className="flex gap-3">
                    <Check className="mt-1 shrink-0 text-success" size={16} strokeWidth={1.75} aria-hidden />
                    <span className="flex flex-col">
                      <span className="font-semibold">{copy(name)}</span>
                      <span className="text-base-content/70 text-sm">{copy(line)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="flex flex-wrap gap-x-1 text-base-content/70 text-sm">
                {copy("scan.get.after")}
                <Link href="/how-it-works" className="link link-primary inline-flex items-center gap-1">
                  {copy("chrome.nav.works")}
                  <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
                </Link>
              </p>
            </div>
          </section>
        </div>

        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="scan-filling">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 id="scan-filling" className="eyebrow">
              {copy("scan.filling.title")}
            </h2>
            <span className="text-base-content/70 text-xs">{copy("scan.filling.grey")}</span>
          </div>
          {FILLING.map((card) => (
            <FillingCard
              key={card.title}
              title={card.title}
              lines={card.lines}
              state={stageState(stages, card.stage)}
              filled={stageState(stages, card.stage) === "done" ? (card.fill?.(stages.found) ?? null) : null}
            />
          ))}
        </section>
      </main>
    </Surface>
  );
}
