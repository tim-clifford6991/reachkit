// BUILD §4.5 — the head line, and the badge only a rising series earns.
//
// §4.5 item 1: the head's words are "backed by the chart directly under
// them", which is why this component renders `model.head.key` — the key the
// measured direction selected in `head.ts` — and never a sentence of its
// own. A customer whose gap widened reads the falling line, because that is
// the key their direction chose.
//
// The badge is emitted on `rising` alone, and carries the number of weeks
// actually measured: "every week since you started" is a claim, and the
// weeks it is a claim about are the ones the product took.
//
// **The screen is never headless.** The four head lines are owner-owed
// today, and an unwritten one renders as nothing (`writtenLine`) — never a
// placeholder, never the key. Where none is written the heading falls back
// to the destination's own registry word, `shell.nav.overview`, which is
// what the screen was already headed with inside the shell (issue #9) and
// is a word the owner has written. A heading that vanished would leave the
// document with no `h1` at all, which is a different defect from a sentence
// nobody has written yet.
import type React from "react";
import { Badge } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { formatCount } from "./present";
import type { Tone } from "@/ui/types";
import type { OverviewModel } from "./model";
import { HEAD } from "./style";

/** Bound to a name before it reaches JSX: the copy sweep presumes a string
 *  literal in a JSX attribute is product voice, and a `Tone` is a state
 *  token, not a sentence. §2.5 also fixes which one it may be — the badge
 *  reports the customer's own progress, never an alarm. */
const BADGE_TONE: Tone = "ok";

export function HeadModule(p: { head: OverviewModel["head"] }): React.JSX.Element {
  const line = writtenLine(p.head.key);
  const badge =
    p.head.badgeKey === undefined
      ? null
      : writtenLine(p.head.badgeKey, { weeks: formatCount(p.head.weeksMeasured) });

  return (
    <div style={HEAD} data-testid="overview-head">
      <h1>{line ?? copy("shell.nav.overview")}</h1>
      {badge === null ? null : <Badge tone={BADGE_TONE}>{badge}</Badge>}
    </div>
  );
}
