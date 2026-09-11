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
// **The tiles are the registered `Stat`** (issue #488), in its `specimen`
// arm: UI-SPEC §2 draws a tile as `.stat-l` + `.stat-v` + `.stat-row`, and
// the set's miniature spends exactly those classes (artifact L578-584), so
// a second stat vocabulary on the landing was a twin of the component. The
// arm is the Overview's tile at the frame's rung — the figure at `--h1`,
// not `--t-num-big` — with the carrier optional, because the set draws the
// score's delta and nothing beside the other two, and a figure invented to
// satisfy a component's type is exactly what rule 1.2 refuses. The box
// around each is the frame's own (`.rk-shot-tile`).
import type React from "react";
import { TrendingUp } from "lucide-react";
import { GrowthLine } from "@/ui/charts";
import { Badge } from "@/ui/components/Badge";
import { Stat } from "@/ui/components/Stat";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { SPECIMEN_TILES, SPECIMEN_WEEKS } from "./specimen";

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
          <div className="rk-shot-tile">
            <Stat
              state="specimen"
              label={copy("overview.tile.score.label")}
              value={<Num>{SPECIMEN_TILES.score}</Num>}
              delta={
                <Badge tone="ok">
                  <Num>{copy("overview.delta.up")}</Num>
                  <Num>{SPECIMEN_TILES.scoreDelta}</Num>
                </Badge>
              }
            />
          </div>
          <div className="rk-shot-tile">
            <Stat
              state="specimen"
              label={copy("overview.tile.ai-answers.label")}
              value={
                <>
                  <Num>{SPECIMEN_TILES.aiAnswers}</Num>
                  <span className="rk-shot-of">
                    <Num>{`/${SPECIMEN_TILES.aiAnswersOf}`}</Num>
                  </span>
                </>
              }
            />
          </div>
          <div className="rk-shot-tile">
            <Stat
              state="specimen"
              label={copy("overview.tile.pages.label")}
              value={<Num>{SPECIMEN_TILES.published}</Num>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
