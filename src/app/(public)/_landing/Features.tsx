// SPEC §1 2026-09-24 (#1067) — *Why you should care*: two cards.
// src/app/(public)/_landing/Features.tsx
//
// Board `PubLanding` v34: AI answers and Google, each a card with a title, a
// line and a small drawing of what the customer will see. The drawings are
// daisyUI and CSS grid over `specimen.ts`'s figures, never an image and
// never an SVG chart (DESIGN rules 1 and 2). None of the cards opens
// anything, so none lifts (#1064).
//
// From `lg` the cards share the list's rows (subgrid), so both titles, both
// lines and both drawings start level and the drawings are one height.
import type React from "react";
import { CircleCheck, CircleX, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { SPECIMEN_FEATURES, SPECIMEN_HERO_BUSINESS, SPECIMEN_HERO_RIVAL } from "./specimen";

/** `#2`: a place in the results, a numeric format and not a sentence. */
function place(n: number): string {
  return `#${n}`;
}

const MARK = { size: 16, strokeWidth: 1.75, className: "shrink-0", "aria-hidden": true } as const;
const NAMED = "flex min-w-0 items-center gap-2";
/** The well each drawing sits in: it fills its row and centres what it holds. */
const WELL = "rounded-box bg-base-200 flex flex-1 flex-col justify-center gap-2 p-4 text-sm";
const BAR = "h-2 rounded-full";

/** One AI answer: the businesses it mentions, and the example business it leaves out. */
function AnswersDrawing(): React.JSX.Element {
  return (
    <div className={WELL}>
      <p className="rounded-box bg-primary/10 max-w-[92%] self-end px-3 py-2">{copy("landing.feature.ai.ask")}</p>
      <div className="rounded-box border-base-300 bg-base-100 flex max-w-[96%] flex-col gap-1.5 self-start border px-3 py-2.5">
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
        </ul>
        <p className="border-base-300 text-error flex items-center gap-2 border-t pt-1.5 font-semibold">
          <CircleX {...MARK} />
          {copy("landing.feature.ai.you", { you: SPECIMEN_HERO_BUSINESS })}
        </p>
      </div>
    </div>
  );
}

/** One search: a rival's page at its place, and the business not on the first two pages. */
function GoogleDrawing(): React.JSX.Element {
  return (
    <div className={WELL}>
      <p className="font-mono text-xs [overflow-wrap:anywhere]">{copy("landing.feature.google.search")}</p>
      <div className="flex flex-col gap-1">
        <span>{copy("landing.feature.google.chain")}</span>
        <span className="flex items-center gap-2.5">
          <span aria-hidden className={`${BAR} bg-primary/60 min-w-0 flex-1`} />
          <span className="num font-semibold">{place(SPECIMEN_FEATURES.google.rivalPlace)}</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{copy("landing.feature.google.you")}</span>
        <span className="flex items-center gap-2.5">
          <span aria-hidden className={`${BAR} bg-base-300 w-6 shrink-0`} />
          <span className="text-base-content/70 min-w-0">{copy("landing.feature.google.absent")}</span>
        </span>
      </div>
    </div>
  );
}

const FEATURES: readonly { title: CopyKey; body: CopyKey; Icon: LucideIcon; Drawing: () => React.JSX.Element }[] = [
  { title: "landing.feature.ai.title", body: "landing.feature.ai.body", Icon: Sparkles, Drawing: AnswersDrawing },
  { title: "landing.feature.google.title", body: "landing.feature.google.body", Icon: Search, Drawing: GoogleDrawing },
];

export function Features(): React.JSX.Element {
  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      {FEATURES.map(({ title, body, Icon, Drawing }) => (
        <li key={title} className="card card-border bg-base-100 min-w-0 gap-4 p-6 lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:p-7">
          <h3 className="card-title gap-3">
            <span className="rounded-field bg-primary/10 text-primary grid size-10 shrink-0 place-items-center">
              <Icon size={20} strokeWidth={1.75} aria-hidden />
            </span>
            {copy(title)}
          </h3>
          <p className="text-base-content/70">{copy(body)}</p>
          {/* Marked as a demo (issue 1249): the drawing's figures are a
              specimen, and are never read as facts about the business. */}
          <div className="flex min-w-0" data-demo>
            <Drawing />
          </div>
        </li>
      ))}
    </ul>
  );
}
