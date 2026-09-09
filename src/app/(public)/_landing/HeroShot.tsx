// BUILD §3, UI-SPEC S1 — the hero's product component (issue #351).
// src/app/(public)/_landing/HeroShot.tsx
//
// **REQ-099 c4's component, as the approved set draws it**: the Overview's
// own cards inside a browser frame addressed `reachkit.app/app` — the
// headline and its badge, the growth card, and the three tiles. c4 asks for
// "the product's own running interface — the screens a customer actually
// uses — rather than a stock illustration, a photograph, or a mock-up of a
// product that does not exist", and it is met literally: the chart is the
// registered `GrowthLine`, the boxes are the registered card idiom, and
// every word inside the frame is a key the Overview itself renders
// (`overview.head.rising`, `overview.tile.*`), so nothing is written for
// the illustration alone.
//
// **The figures come from `specimen.ts` under ruling 5c**, which settles
// REQ-099 c8 for this surface: they render "as drawn on `example.com`,
// without a source date or an example line". Nothing here is measured about
// the visitor, and nothing is invented at the call site.
//
// **The tiles are not the registered `Stat`, and that is deliberate.**
// `Stat` prints its figure at `--t-num-big` (44px) and requires a delta or
// a goal beside every value. The set's miniature prints them at the
// browser-frame rung and draws neither on two of the three tiles — because
// this is a picture of the Overview at a third of its size, not the
// Overview. Rendering `Stat` here would either blow the frame apart or
// force a delta the set does not draw onto a tile that has none, and a
// figure invented to satisfy a component's type is exactly what rule 1.2
// refuses. The label, the value and the mono face are all still the
// product's own.
import type React from "react";
import { TrendingUp } from "lucide-react";
import { GrowthLine } from "@/ui/charts";
import { Badge } from "@/ui/components/Badge";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { SPECIMEN_TILES, SPECIMEN_WEEKS } from "./specimen";

/** One tile of the miniature: the Overview's own label, and its figure. */
function ShotTile(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rk-shot-tile">
      <p className="rk-shot-tile-l">{p.label}</p>
      <p className="rk-shot-tile-v">{p.children}</p>
    </div>
  );
}

export function HeroShot(): React.JSX.Element {
  return (
    <div className="rk-shot" data-testid="landing-shot">
      {/* The frame's own chrome. The three dots are a browser's, drawn and
          not written — they carry no meaning and no name, which is why they
          are `aria-hidden` and the address beside them is not: the address
          is what says which screen this is. */}
      <div className="rk-shot-bar">
        <span className="rk-shot-dot" aria-hidden />
        <span className="rk-shot-dot" aria-hidden />
        <span className="rk-shot-dot" aria-hidden />
        <span className="rk-shot-url">
          <Num>{copy("landing.shot.address")}</Num>
        </span>
      </div>

      <div className="rk-shot-body">
        <div className="rk-shot-head">
          <p className="rk-shot-h">{copy("overview.head.rising")}</p>
          <Badge tone="ok">
            <Num>{copy("overview.delta.up")}</Num>
            {copy("landing.shot.badge")}
          </Badge>
        </div>

        <IdiomCard
          head={
            <CardHead
              icon={<TrendingUp size={15} strokeWidth={1.8} aria-hidden />}
              eyebrow={copy("overview.tile.searches.label")}
            />
          }
        >
          <GrowthLine weeks={SPECIMEN_WEEKS} label={copy("overview.tile.searches.label")} />
        </IdiomCard>

        <div className="rk-shot-tiles">
          <ShotTile label={copy("overview.tile.score.label")}>
            <Num>{SPECIMEN_TILES.score}</Num>
            <Badge tone="ok">
              <Num>{copy("overview.delta.up")}</Num>
              <Num>{SPECIMEN_TILES.scoreDelta}</Num>
            </Badge>
          </ShotTile>
          <ShotTile label={copy("overview.tile.ai-answers.label")}>
            <Num>{SPECIMEN_TILES.aiAnswers}</Num>
            <span className="rk-shot-of">
              <Num>{`/${SPECIMEN_TILES.aiAnswersOf}`}</Num>
            </span>
          </ShotTile>
          <ShotTile label={copy("overview.tile.pages.label")}>
            <Num>{SPECIMEN_TILES.published}</Num>
          </ShotTile>
        </div>
      </div>
    </div>
  );
}
