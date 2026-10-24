// SPEC §1 2026-09-24 (#1067) — *Why you should care*: four features.
// src/app/(public)/_landing/Features.tsx
//
// Board `PubLanding`: AI answers, Google, what holds you back, the week's
// pages — each a card with a title, a line and a small drawing of what the
// customer will see. The drawings are daisyUI and CSS grid over
// `specimen.ts`'s figures, never an image and never an SVG chart (DESIGN
// rules 1 and 2). None of the cards opens anything, so none lifts (#1064).
//
// The phone board draws the same four drawings, so every width shows them.
import type React from "react";
import { CircleCheck, CircleX, FileText, Search, Sparkles, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { HOW_FACTS } from "../_how/facts";
import { SPECIMEN_FEATURES, SPECIMEN_HERO, SPECIMEN_HERO_BUSINESS, SPECIMEN_HERO_RIVAL, specimenHeroWeek } from "./specimen";

/** `#2`: a place in the results, a numeric format and not a sentence. */
function place(n: number): string {
  return `#${n}`;
}

/** Each drawing's last line: what it shows is a sample. */
function Example(): React.JSX.Element {
  return <p className="text-base-content/70 text-xs">{copy("landing.feature.example")}</p>;
}

const MARK = { size: 16, strokeWidth: 1.75, className: "shrink-0", "aria-hidden": true } as const;
const NAMED = "flex min-w-0 items-center gap-2";

/** One AI answer: the businesses it mentions, and the example business it leaves out. */
function AnswersDrawing(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="rounded-box bg-base-200 px-3 py-2 font-semibold">{copy("landing.feature.ai.ask")}</p>
      <p className="text-primary flex items-center gap-2 text-xs font-semibold">
        <Sparkles {...MARK} />
        {copy("landing.feature.ai.mentions")}
      </p>
      <ul className="flex flex-col gap-1">
        <li className={NAMED}>
          <CircleCheck {...MARK} className="text-base-content/70 shrink-0" />
          {copy("landing.feature.ai.chain")}
        </li>
        <li className={NAMED}>
          <CircleCheck {...MARK} className="text-base-content/70 shrink-0" />
          <Num>{SPECIMEN_HERO_RIVAL}</Num>
        </li>
        <li className={`${NAMED} text-error font-semibold`}>
          <CircleX {...MARK} />
          {copy("landing.feature.ai.you", { you: SPECIMEN_HERO_BUSINESS })}
        </li>
      </ul>
      <Example />
    </div>
  );
}

/** One search: a rival's page at its place, and the business not on the first two pages. */
function GoogleDrawing(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="rounded-box bg-base-200 px-3 py-2 font-mono text-xs">{copy("landing.feature.google.search")}</p>
      <p className="flex items-center justify-between gap-2">
        <span className="min-w-0">{copy("landing.feature.google.chain")}</span>
        <span className="num font-semibold">{place(SPECIMEN_FEATURES.google.rivalPlace)}</span>
      </p>
      <p className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-primary font-semibold">{copy("landing.feature.google.you")}</span>
        <span className="text-base-content/70">{copy("landing.feature.google.absent")}</span>
      </p>
      <Example />
    </div>
  );
}

/** Problems the free report finds, as found, and who fixes each. */
function FixDrawing(): React.JSX.Element {
  const rows: readonly { label: CopyKey; who: CopyKey; tone: string }[] = [
    { label: "how.read.held.ai", who: "landing.feature.fix.free", tone: "badge-success" },
    { label: "how.read.held.list", who: "landing.feature.fix.free", tone: "badge-success" },
    { label: "landing.feature.fix.titles", who: "landing.feature.fix.ours", tone: "badge-primary" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-base-300 flex flex-col divide-y">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0">{copy(row.label)}</span>
            <span className={`badge badge-soft badge-sm ${row.tone}`}>{copy(row.who)}</span>
          </li>
        ))}
      </ul>
      <Example />
    </div>
  );
}

/** Tuesday to Saturday, a page live on each at the example hour. */
function DailyDrawing(): React.JSX.Element {
  const days = specimenHeroWeek().filter((day) => day.page !== null);
  return (
    <div className="flex flex-col gap-2">
      <ol className="grid grid-cols-5 gap-2">
        {days.map((day) => (
          <li key={day.weekday} className="rounded-field bg-base-200 flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-xs">
            <span className="text-base-content/70">{day.weekday}</span>
            <CircleCheck size={16} strokeWidth={1.75} className="text-success" aria-hidden />
            <span className="num">{SPECIMEN_HERO.liveAt}</span>
          </li>
        ))}
      </ol>
      <p className="text-base-content/70 text-xs">{copy("landing.feature.daily.caption", { time: SPECIMEN_HERO.liveAt })}</p>
    </div>
  );
}

const FEATURES: readonly {
  title: CopyKey;
  body: CopyKey;
  vars?: Record<string, string>;
  Icon: LucideIcon;
  Drawing: () => React.JSX.Element;
}[] = [
  { title: "landing.feature.ai.title", body: "landing.feature.ai.body", Icon: Sparkles, Drawing: AnswersDrawing },
  { title: "landing.feature.google.title", body: "landing.feature.google.body", Icon: Search, Drawing: GoogleDrawing },
  { title: "landing.feature.fix.title", body: "landing.feature.fix.body", Icon: Wrench, Drawing: FixDrawing },
  { title: "landing.feature.daily.title", body: "landing.feature.daily.body", Icon: FileText, Drawing: DailyDrawing,
    vars: { weekPages: String(HOW_FACTS.weekPages), hours: String(HOW_FACTS.windowHours) } },
];

export function Features(): React.JSX.Element {
  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {FEATURES.map(({ title, body, vars, Icon, Drawing }) => (
        <li key={title} className="card card-border bg-base-100 min-w-0">
          <div className="card-body gap-3">
            <h3 className="card-title gap-3">
              <span className="rounded-field bg-primary/10 text-primary grid size-8 shrink-0 place-items-center">
                <Icon size={16} strokeWidth={1.75} aria-hidden />
              </span>
              {copy(title)}
            </h3>
            <p className="text-base-content/70 text-sm">{copy(body, vars)}</p>
            {/* Marked as a demo (issue 1249): the drawing's figures are a
                specimen, and are never read as facts about the business. */}
            <div className="mt-auto pt-2" data-demo>
              <Drawing />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
