// Canvas: Dashboard — what a headline number carries beside it.
//
// Every headline carries its delta or its goal, never bare: `Stat`'s own type
// enforces it — the two are mutually exclusive and one is required — and
// `carriedBy` decides which. Only badges ride on the figure's row; the
// sentence saying what a goal means is a line under it, because a whole
// sentence inside the row sets the row's min-content width and wraps the
// pill onto its own line.
import type React from "react";
import { Badge } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import type { Carried } from "./present";
import type { Tone } from "@/ui/types";
import { CARRY } from "./style";

/** §2.5: movement the customer made is a success state; a goal is a target,
 *  which is not a state at all. */
const DELTA_TONE: Tone = "ok";
const GOAL_TONE: Tone = "neutral";

/** The one place a delta or a goal becomes a node. `beside` is what the
 *  artboard draws on the same row after the carried value — the score's
 *  band, the pages' "already ranking". */
export function statCarrier(
  carried: Carried,
  beside: React.ReactNode = null
): { delta: React.ReactNode } | { goal: React.ReactNode } {
  if (carried.kind === "delta") {
    return {
      delta: (
        <span className={CARRY}>
          <Badge tone={DELTA_TONE}>
            <span className={CARRY}>
              <span className="num">{copy(carried.markKey)}</span>
              <span className="num">{carried.text}</span>
            </span>
          </Badge>
          {beside}
        </span>
      ),
    };
  }
  return {
    goal: (
      <span className={CARRY}>
        <Badge tone={GOAL_TONE}>
          <span className="num">{carried.text}</span>
        </Badge>
        {beside}
      </span>
    ),
  };
}

/** The pages tile's row: the standing beside the figure and nothing else.
 *  It rides in `Stat`'s `goal` slot because that slot is the artboard's row
 *  position, never as a goal — this arm is precisely the absence of one. */
export function besideOnly(beside: React.ReactNode): { goal: React.ReactNode } {
  return { goal: beside };
}
