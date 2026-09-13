// Canvas: Dashboard — the head line, and the badge only a rising series
// earns.
//
// The head renders `model.head.key` — the key the measured direction chose —
// and never a sentence of its own. Where none is written the heading falls
// back to the destination's own registry word, so the document is never left
// without an `h1`.
import type React from "react";
import { Badge } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import type { Tone } from "@/ui/types";
import type { OverviewModel } from "./model";
import { HEAD } from "./style";

/** Bound to a name before it reaches JSX: the copy sweep presumes a string
 *  literal in a JSX attribute is product voice, and a `Tone` is a state
 *  token. §2.5 fixes which one — the badge reports the customer's own
 *  progress, never an alarm. */
const BADGE_TONE: Tone = "ok";

export function HeadModule(p: { head: OverviewModel["head"] }): React.JSX.Element {
  const line = writtenLine(p.head.key);
  // No `{weeks}` argument: the approved badge claims every week and names no
  // number, so the key carries no slot.
  const badge = p.head.badgeKey === undefined ? null : writtenLine(p.head.badgeKey);

  return (
    <div className={HEAD} data-testid="overview-head">
      <h1>{line ?? copy("shell.nav.overview")}</h1>
      {badge === null ? null : <Badge tone={BADGE_TONE}>{badge}</Badge>}
    </div>
  );
}
