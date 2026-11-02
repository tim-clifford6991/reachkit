// BUILD §4.1 — the scanning screen (board PubScanning): the head with the
// site's mark, the stages with what each finds out, and the report's own
// cards beside them, each held by a skeleton until it arrives.
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
import { useEffect, useState, useSyncExternalStore } from "react";
import { Ban, Check, CircleCheck, Globe, MapPin, Search, ShieldCheck, Sparkles, Tag, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { Surface } from "@/ui/layout";
import { SiteMark, siteLogoSrc } from "@/ui/SiteMark";
import { SKELETON_EXIT, ViewTransition } from "@/ui/motion";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { StageName, StageSummary } from "@/lib/scan/stages";
import type { CanonicalDomain } from "@/lib/scan/domain";
import { ScanProgress, SEARCHES, stageState, useScanStages, type StageState } from "./progress";
import { whereLine } from "@/app/_business/WhatWeRead";
import { kindAndIndustry } from "./read-as";

const CARD = "card bg-base-100 min-w-0 shadow-(--shadow-card)";

/** The report's cards in the board's order, each against the stage that
 *  produces it: the profile is read with the market, the searches and their
 *  AI answers are asked together, and competitors are concluded in scoring. */
type Fill = (found: StageSummary) => React.ReactNode;

const FILLING: readonly { readonly title: CopyKey; readonly Icon: LucideIcon; readonly stage: StageName; readonly lines: number; readonly fill?: Fill }[] = [
  { title: "report.read.title", Icon: Globe, stage: "reading_your_market", lines: 3, fill: whatWeRead },
  { title: "scan.filling.readers", Icon: ShieldCheck, stage: "reading_access_rules", lines: 2, fill: whoMayRead },
  { title: "scan.filling.competitors", Icon: Users, stage: "scoring", lines: 2 },
  { title: "scan.get.score", Icon: TrendingUp, stage: "scoring", lines: 1 },
  { title: "scan.filling.searches", Icon: Search, stage: "asking_the_twelve", lines: 5, fill: theSearches },
  { title: "scan.filling.ai", Icon: Sparkles, stage: "asking_the_twelve", lines: 2 },
];

/** Where it sells, as the report's chip words it; nothing where the read named neither a town nor a reach. */
function whereOf(found: StageSummary): string | null {
  if (found.place !== undefined) return copy("report.read.where.local", { place: found.place });
  if (found.reach === undefined || found.country === undefined) return null;
  return whereLine({ place: null, reach: found.reach, country: found.country });
}

function whatWeRead(found: StageSummary): React.ReactNode {
  const what = kindAndIndustry(found.kind, found.category);
  const where = whereOf(found);
  if (found.pagesRead === undefined && what === null && found.buyer === undefined && where === null) return null;
  // The report's read-as chips, in its words: a chip that would hold nothing is not drawn.
  const chips = [
    ...(what === null ? [] : [{ Icon: Tag, text: what }]),
    ...(where === null ? [] : [{ Icon: MapPin, text: where }]),
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {found.pagesRead === undefined ? null : <p className="text-sm font-semibold">{copy("scan.filling.pages", { pages: String(found.pagesRead) })}</p>}
      {chips.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map(({ Icon, text }) => (
            <li key={text} className="badge badge-outline border-base-300 bg-base-100 h-auto min-h-7 px-3 py-0.5 font-semibold whitespace-normal">
              <Icon size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      )}
      {found.buyer === undefined ? null : <p className="text-sm wrap-anywhere">{copy("scan.filling.buyer", { buyer: found.buyer })}</p>}
    </div>
  );
}

function reader(Icon: typeof Search, name: CopyKey, state: "in" | "out"): React.ReactNode {
  const State = state === "in" ? Check : Ban;
  return (
    <span className={`rounded-field flex items-center gap-2 px-3 py-2 text-sm ${state === "in" ? "bg-base-200" : "bg-warning/10"}`}>
      <Icon size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <span className="flex-1">{copy(name)}</span>
      <span className={`flex items-center gap-1 font-bold ${state === "in" ? "text-success" : "text-warning"}`}>
        <State size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
        {copy(state === "in" ? "scan.filling.reader.in" : "scan.filling.reader.out")}
      </span>
    </span>
  );
}

function whoMayRead(found: StageSummary): React.ReactNode {
  if (found.readers === undefined) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-2">
        {reader(Search, "scan.filling.reader.google", found.readers.google)}
        {reader(Sparkles, "scan.filling.reader.ai", found.readers.ai)}
      </div>
      {found.readers.ai === "out" ? <p className="text-base-content/70 text-xs">{copy("scan.filling.reader.fix")}</p> : null}
    </div>
  );
}

function theSearches(found: StageSummary): React.ReactNode {
  if (found.searches === undefined) return null;
  return (
    <ol className="flex flex-col">
      {found.searches.map((search, i) => (
        <li key={i} className="border-base-300 flex items-center gap-2.5 border-t py-1.5">
          <Check size={14} strokeWidth={1.75} className="text-success shrink-0" aria-hidden />
          <span className="num min-w-0 flex-1 text-xs break-words">{search.words}</span>
          <span className={`badge badge-sm shrink-0 ${search.onPageOne ? "badge-success badge-soft" : "badge-ghost"}`}>
            {copy(search.onPageOne ? "scan.filling.search.in" : "scan.filling.search.out")}
          </span>
        </li>
      ))}
    </ol>
  );
}

const CARD_BADGE: Record<StageState, { key: CopyKey; className: string }> = {
  done: { key: "scan.filling.found", className: "badge-success badge-soft" },
  active: { key: "stage.status.working", className: "badge-primary badge-soft" },
  pending: { key: "stage.status.next", className: "badge-ghost" },
};
/** A card not reached yet is drawn quiet; the running one is outlined. */
const CARD_LOOK: Record<StageState, { card: string; tile: string; title: string }> = {
  done: { card: CARD, tile: "badge-soft badge-success", title: "" },
  active: { card: `${CARD} border-primary border-[1.5px]`, tile: "bg-primary text-primary-content border-primary", title: "" },
  pending: { card: "card bg-base-200/60 min-w-0", tile: "bg-base-200 text-base-content/70 border-transparent", title: "text-base-content/70" },
};

const subscribeNever = (): (() => void) => () => undefined;
/** Where the domain sits in the head's sentence; never a character a domain holds. */
const DOMAIN_SLOT = "\u0000";

/** The letter tile until the logo route answers: asked on the first frame and
 *  again as each stage finishes, since the scan stores the logo as it reads the site. */
function useStoredLogo(domain: CanonicalDomain, finished: number): boolean {
  const [found, setFound] = useState(false);
  useEffect(() => {
    if (found) return;
    const probe = new Image();
    probe.onload = () => setFound(true);
    probe.src = siteLogoSrc(domain);
    return () => {
      probe.onload = null;
    };
  }, [domain, found, finished]);
  return found;
}

/** One card's place: its title, its stage's state in words, and a skeleton
 *  where its content will be. */
function FillingCard(p: { title: CopyKey; Icon: LucideIcon; state: StageState; lines: number; filled: React.ReactNode | null }): React.JSX.Element {
  const badge = CARD_BADGE[p.state];
  const look = CARD_LOOK[p.state];
  return (
    <section className={look.card} data-testid="scan-section" data-state={p.state} data-done={p.state === "done"}>
      <div className="card-body gap-3 px-4.5 py-4">
        <h3 className={`flex flex-wrap items-center gap-2 text-sm font-bold ${look.title}`}>
          <span aria-hidden className={`badge rounded-field size-7 flex-none p-0 ${look.tile}`}>
            <p.Icon size={16} strokeWidth={1.75} />
          </span>
          {copy(p.title, SEARCHES)}
          <span className={`badge badge-sm ms-auto ${badge.className}`}>
            {p.state === "done" ? <CircleCheck size={14} strokeWidth={1.75} aria-hidden /> : null}
            {copy(badge.key)}
          </span>
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
  const hasLogo = useStoredLogo(p.domain, stages.done.size);
  // The domain is a value, drawn in the mono face inside the sentence that carries it.
  const [before = "", after = ""] = copy("scan.head", { domain: DOMAIN_SLOT }).split(DOMAIN_SLOT);
  const head = { before, after };
  // The start is the visitor's own clock, so it is drawn only in the browser.
  const inBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);
  const started = inBrowser
    ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(stages.startedAt)
    : null;

  return (
    // One column on a phone, two from medium: the stages on the left, the
    // report filling in on the right (ADR-093 decision 6).
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
          <div className="flex min-w-0 items-center gap-3">
            <SiteMark domain={p.domain} hasLogo={hasLogo} size={48} />
            <h1 className="min-w-0 break-words">
              {head.before}
              <span className="num inline-block font-medium wrap-anywhere">{p.domain}</span>
              {head.after}
            </h1>
          </div>
          <p className="text-base-content/70">{copy("scan.waiting.line")}</p>
        </header>

        <div className="flex min-w-0 flex-col gap-4">
          <section className={CARD} aria-labelledby="scan-progress">
            <div className="card-body gap-1 px-5.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="scan-progress" className="eyebrow">
                  {copy("scan.progress.title")}
                </h2>
                {started === null ? null : (
                  <span className="num text-base-content/70 text-xs">{copy("stage.started", { time: started })}</span>
                )}
              </div>
              <ScanProgress domain={p.domain} scanId={p.scanId} stages={stages} />
            </div>
          </section>
        </div>

        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="scan-filling">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="scan-filling" className="eyebrow">
              {copy("scan.filling.title")}
            </h2>
            <span className="text-base-content/70 text-xs">{copy("scan.filling.grey")}</span>
          </div>
          {FILLING.map((card) => (
            <FillingCard
              key={card.title}
              title={card.title}
              Icon={card.Icon}
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
