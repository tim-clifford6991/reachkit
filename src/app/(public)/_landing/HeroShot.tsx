// BUILD §3 — the hero's product component.
// src/app/(public)/_landing/HeroShot.tsx
//
// The Overview's own pieces inside a daisyUI `mockup-browser` addressed
// `reachkit.app/app`: the headline and its badge, the growth chart, and the
// three stats. Every word is a key the Overview itself renders, and the
// chart is the Overview's `GrowthLine`, so nothing is written for the
// illustration alone. The figures come from `specimen.ts`, as drawn on
// `example.com`, with no source date and no example line.
import type React from "react";
import { TrendingUp } from "lucide-react";
import { GrowthLine } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { SPECIMEN_TILES, SPECIMEN_WEEKS } from "./specimen";

export function HeroShot(): React.JSX.Element {
  return (
    <div className="mockup-browser min-w-0 border border-base-300 bg-base-100" data-testid="landing-shot">
      <div className="mockup-browser-toolbar">
        <div className="input">
          <Num>{copy("landing.shot.address")}</Num>
        </div>
      </div>
      <div className="grid gap-4 border-t border-base-300 bg-base-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-bold">{copy("overview.head.rising")}</p>
          <span className="badge badge-success">
            <Num>{copy("overview.delta.up")}</Num>
            {copy("landing.shot.badge")}
          </span>
        </div>

        <div className="card border border-base-300 bg-base-100">
          <div className="card-body gap-3 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
              <TrendingUp size={16} strokeWidth={1.75} aria-hidden />
              {copy("overview.tile.searches.label")}
            </p>
            <GrowthLine weeks={SPECIMEN_WEEKS} label={copy("overview.tile.searches.label")} />
          </div>
        </div>

        <div className="stats stats-vertical w-full border border-base-300 bg-base-100 sm:stats-horizontal">
          <div className="stat min-w-0">
            <div className="stat-title whitespace-normal">{copy("overview.tile.score.label")}</div>
            <div className="stat-value font-mono text-2xl">
              <Num>{SPECIMEN_TILES.score}</Num>
            </div>
            <div className="stat-desc">
              <span className="badge badge-success badge-sm">
                <Num>{copy("overview.delta.up")}</Num>
                <Num>{SPECIMEN_TILES.scoreDelta}</Num>
              </span>
            </div>
          </div>
          <div className="stat min-w-0">
            <div className="stat-title whitespace-normal">{copy("overview.tile.ai-answers.label")}</div>
            <div className="stat-value font-mono text-2xl">
              <Num>{SPECIMEN_TILES.aiAnswers}</Num>
              <span className="text-base text-base-content/60">
                <Num>{`/${SPECIMEN_TILES.aiAnswersOf}`}</Num>
              </span>
            </div>
          </div>
          <div className="stat min-w-0">
            <div className="stat-title whitespace-normal">{copy("overview.tile.pages.label")}</div>
            <div className="stat-value font-mono text-2xl">
              <Num>{SPECIMEN_TILES.published}</Num>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
