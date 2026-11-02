// A gallery score as board PubScans draws it: the figure large in its band's
// ring, "of 100" small beside it and the band's badge under it.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { bandOf } from "@/lib/measure/bands";
import { BAND_TONE, RING_TONE } from "@/ui/bands";
import { BADGE } from "@/app/(account)/app/_overview/badges";
import { RING_TRACK } from "../_how/visuals";

/** Where the score sits in "{score} of {max}", so the figure is drawn large and the rest small. */
const SCORE_SLOT = "\u0000";
export const SCORE_MAX = 100;

/** A score in its band's ring, the figure large over its band, or "Not scored": a report with no score never reads 0 and draws no ring. */
export function ScoreLine(p: { score: number | null }): React.JSX.Element {
  if (p.score === null) {
    return <p className="text-base-content/70 text-sm">{copy("gallery.card.no-score")}</p>;
  }
  return <ScoreFigure score={p.score} />;
}

export function ScoreFigure(p: { score: number }): React.JSX.Element {
  const band = bandOf(p.score);
  const max = String(SCORE_MAX);
  const [, rest = ""] = copy("gallery.card.score", { score: SCORE_SLOT, max }).split(SCORE_SLOT);
  return (
    <div className="flex items-center gap-3">
      <div
        role="img"
        aria-label={copy("gallery.card.score", { score: String(p.score), max })}
        className={`${RING_TRACK} ${RING_TONE[BAND_TONE[band]]} flex-none [--size:3rem]`}
        style={{ "--value": p.score } as React.CSSProperties}
      />
      <p className="flex flex-col items-start gap-0.5">
        <span>
          <span className="text-2xl font-extrabold">{p.score}</span>
          <span className="text-base-content/70 text-xs font-semibold">{rest}</span>
        </span>
        <span className={`${BADGE[BAND_TONE[band]]} badge-sm`}>{copy(SCORE_BANDS[band])}</span>
      </p>
    </div>
  );
}
