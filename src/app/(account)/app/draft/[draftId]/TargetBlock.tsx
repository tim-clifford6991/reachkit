// SPEC §4, §6, §7 (issue 867; merged in issue 930) — what this page is for,
// on the screen the founder edits it on.
//
// The owner, 2026-09-17: the customer was never shown what their content is
// optimising for. Every value here was measured by the pass that chose the
// page and copied onto its opportunity at creation: the search, how it is
// asked, its demand, its difficulty against the ceiling this site is judged
// by (§6, issue 858), the band, where the AI engines stood, and what "done"
// means for it.
//
// **The rows are no longer this file's** (issue 930). Issue 867 merged the
// *facts* into `_shell/page-target.ts`; what stayed doubled was the list
// that renders them — this screen drew seven rows and the day panel drew
// seven others, in a different order, with different opinions about which
// values fold. `calendar/TargetRows.tsx` is now the one renderer and
// `calendar/target.ts` the one projection, and this file is the card around
// them plus the two states a draft's target can be in that have no rows at
// all.
//
// The two members the day panel reads and this screen does not — the best
// rival and where the site stands — are `null` here, stated rather than
// implied: a screen that does not read a fact says so, and the renderer
// draws no row for it (`TargetFacts`).
//
// daisyUI `card` in the route (docs/DESIGN.md rule 1): no new component, no
// CSS of its own.
import type React from "react";
import { Target } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { TargetRows } from "../../calendar/TargetRows";
import { targetFactsOf } from "../../calendar/target";
import type { DraftTarget } from "./model";

const EYEBROW = "card-title text-xs font-semibold uppercase tracking-wide text-base-content/60";

function Card(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="card card-border bg-base-100 min-w-0" data-testid="draft-target">
      <div className="card-body min-w-0 gap-3">
        <h2 className={`flex items-center gap-2 ${EYEBROW}`}>
          <Target size={20} strokeWidth={1.75} aria-hidden />
          {copy("draft.target.title")}
        </h2>
        {p.children}
      </div>
    </section>
  );
}

/** The block, in each of the three states a draft's target can be in. A Fix
 *  page and an unreadable opportunity each say what is true of them; neither
 *  is drawn as an empty list. */
export function TargetBlock(p: { target: DraftTarget }): React.JSX.Element {
  if (p.target.kind === "target") {
    return (
      <Card>
        <TargetRows facts={targetFactsOf(p.target.target)} />
      </Card>
    );
  }
  return (
    <Card>
      <p className="text-sm opacity-70">
        {copy(p.target.kind === "fix" ? "draft.target.fix" : "draft.target.unknown")}
      </p>
    </Card>
  );
}
