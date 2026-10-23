// SPEC §7 (2026-09-20, #908, issue 930) — **one** projection of what a page
// is for, and one renderer of it (`TargetRows.tsx`).
//
// Two screens stated these facts and worded them twice. `calendar/
// WhyThisPage.tsx` drew a definition list of seven rows; `draft/[draftId]/
// TargetBlock.tsx` drew a definition list of seven rows, with a different
// subset, a different order and its own opinion about which values are
// phrases. Issue 867 had already merged the *facts* into `_shell/
// page-target.ts`; what was still doubled was the projection on top of it
// and the rendering of it — so a row added to one screen was absent from
// the other, and a row's unmeasured arm could be drawn one way here and
// another way there.
//
// This module is that projection. `PageTarget` stays where it is — the
// shared, engine-side fact set — and this adds the two members that are
// about the *market around* the page rather than about the page's own
// target, both of which only the calendar's store can read:
//
//   bestRival   who holds the answer today, and where they stand
//   youStand    where the site itself stands for that search
//
// Both are **nullable and required**: the draft screen reads a draft's own
// opportunity and has neither, and a missing field and an unmeasured one
// are different facts (REQ-004). A `null` here means "this screen does not
// read that", and the renderer draws no row; an `unmeasured` inside one
// means "nobody could measure it", and the renderer draws the dash and its
// own written line.
//
// **No sentence lives here.** This file emits handles and `Measured`
// values; every word is the registry's, read by the renderer.
import type { Measured } from "@/lib/measure/measured";
import type { PageTarget } from "../_shell/page-target";

/** Who answers this search today, and where they stand. A Write or an Earn
 *  target records the rival it is written to overtake; an Improve target is
 *  the customer's own page, so nobody else holds it and this is `null`. */
export interface BestRival {
  domain: string;
  /** The rival's own place, as the pass measured it. `Measured`, not a
   *  number: a rival nobody could place renders the dash beside its
   *  domain, never a `#0`. */
  position: Measured<number>;
}

/**
 * The facts both screens state about one page's target.
 *
 * It **extends** `PageTarget` rather than copying its members, so a member
 * added there reaches both screens on the next build and cannot be added to
 * one of them only.
 */
export interface TargetFacts extends PageTarget {
  /** `null` where the screen does not read it (the draft view) or where the
   *  target has no rival (an Improve page). */
  bestRival: BestRival | null;
  /** Where the site stands for this search. `null` where the screen does
   *  not read it; `unmeasured` where nobody could; a measured **zero** is
   *  §6.6's cold-start law — the site holds no place, which the renderer
   *  says in words. */
  youStand: Measured<number> | null;
}
