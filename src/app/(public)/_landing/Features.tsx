// SPEC §1 2026-09-24 (#1067) — *Why you should care*: four features.
// src/app/(public)/_landing/Features.tsx
//
// Board `R12-1-Landing`: AI answers, Google, what holds you back, one page
// a day — each a card with a title, a line and a small drawing of what the
// customer will see. The drawings are daisyUI and CSS grid over
// `specimen.ts`'s figures, never an image and never an SVG chart (DESIGN
// rules 1 and 2). None of the cards opens anything, so none lifts (#1064).
//
// On a phone (`R12-8-Phone-landing`) the cards keep their title and line
// and drop the drawing.
import type React from "react";
import { Bot, Check, FileText, Search, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { HOW_FACTS } from "../_how/facts";
import { SPECIMEN_FEATURES, SPECIMEN_HERO_BUSINESS, SPECIMEN_HERO_RIVAL, specimenWeek, type WeekDay } from "./specimen";

/** `10/12`: a numeric format, not a sentence. */
function ofTotal(n: number, total: number): string {
  return `${n}/${total}`;
}

/** One AI answer: the businesses it mentions, and the example business it leaves out. */
function AnswersDrawing(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="rounded-box bg-base-200 px-3 py-2 font-semibold">{copy("landing.feature.ai.ask")}</p>
      <p className="text-base-content/70 text-xs">{copy("landing.feature.ai.mentions")}</p>
      <ul className="flex flex-col gap-1">
        <li>{copy("landing.feature.ai.chain")}</li>
        <li>
          <Num>{SPECIMEN_HERO_RIVAL}</Num>
        </li>
        <li>
          <span className="badge badge-soft badge-warning">{copy("landing.feature.ai.you", { you: SPECIMEN_HERO_BUSINESS })}</span>
        </li>
      </ul>
    </div>
  );
}

/** The top rival's share of the searches against the business's own. */
function GoogleDrawing(): React.JSX.Element {
  const { rival, you, total } = SPECIMEN_FEATURES.google;
  const rows = [
    { key: "landing.feature.google.rival", n: rival, bar: "progress-neutral", ink: "text-base-content/70" },
    { key: "landing.feature.google.you", n: you, bar: "progress-primary", ink: "text-primary" },
  ] as const;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-xs">
          <span className={`font-mono ${row.ink}`}>{copy(row.key)}</span>
          <progress className={`progress ${row.bar}`} value={row.n} max={total} aria-label={copy(row.key)} />
          <span className={`font-semibold ${row.ink}`}>
            <Num>{ofTotal(row.n, total)}</Num>
          </span>
        </div>
      ))}
      <p className="text-base-content/70 flex items-center gap-2 text-xs font-semibold">
        <span className="bg-success size-1.5 shrink-0 rounded-full" aria-hidden />
        {copy("landing.feature.google.open")}
      </p>
    </div>
  );
}

/** Three problems the report finds, and who fixes each. */
function FixDrawing(): React.JSX.Element {
  const rows: readonly { label: CopyKey; who: CopyKey; tone: string }[] = [
    { label: "landing.feature.fix.readers", who: "landing.feature.fix.free", tone: "badge-success" },
    { label: "landing.feature.fix.titles", who: "landing.feature.fix.ours", tone: "badge-primary" },
    { label: "landing.feature.fix.sitemap", who: "landing.feature.fix.free", tone: "badge-success" },
  ];
  return (
    <ul className="divide-base-300 flex flex-col divide-y">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Check size={16} strokeWidth={1.75} className="text-success shrink-0" aria-hidden />
            {copy(row.label)}
          </span>
          <span className={`badge badge-soft badge-sm ${row.tone}`}>{copy(row.who)}</span>
        </li>
      ))}
    </ul>
  );
}

const DAY_RULE: Readonly<Record<WeekDay["state"], string>> = Object.freeze({
  done: "bg-success",
  today: "bg-primary",
  "to-come": "bg-base-300",
  "nothing-measured": "bg-warning",
});

/** A week of the calendar: done, today, to come — each named in words. */
function DailyDrawing(): React.JSX.Element {
  return (
    <ol className="grid grid-cols-7 gap-2" aria-label={copy("overview.week.title")}>
      {specimenWeek().map((day) => (
        <li
          key={day.date}
          className={`rounded-field min-w-0 px-1 py-2 text-center ${day.state === "today" ? "bg-primary/10 text-primary" : "bg-base-200"}`}
        >
          <span className="num block text-sm font-semibold" role="img" aria-label={`${day.date} · ${day.mark}`}>
            {day.date}
          </span>
          <span className={`mt-2 block h-1 w-full rounded-full ${DAY_RULE[day.state]}`} aria-hidden />
        </li>
      ))}
    </ol>
  );
}

const FEATURES: readonly {
  title: CopyKey;
  body: CopyKey;
  vars?: Record<string, string>;
  Icon: LucideIcon;
  Drawing: () => React.JSX.Element;
}[] = [
  { title: "landing.feature.ai.title", body: "landing.feature.ai.body", Icon: Bot, Drawing: AnswersDrawing },
  { title: "landing.feature.google.title", body: "landing.feature.google.body", Icon: Search, Drawing: GoogleDrawing },
  { title: "landing.feature.fix.title", body: "landing.feature.fix.body", Icon: ShieldCheck, Drawing: FixDrawing },
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
            <div className="mt-auto hidden pt-2 sm:block" data-demo>
              <Drawing />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
