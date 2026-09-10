// UI-SPEC §4 rule 3 — the waiting state, one written line.
// src/app/_fallback/Waiting.tsx
//
// **What a route shows while the server is still answering.** Next's
// `loading.tsx` is a Suspense fallback (`loading.md`: "`loading.js` wraps
// `not-found.js`, `page.js`, and nested `layout.js` files in a `<Suspense>`
// boundary"), so what it draws is a *screen state* like any other, and the
// set rules on screen states: "Every empty, degraded or waiting state is
// one written line; never a spinner, never a blank card" (UI-SPEC §4 rule
// 3). That is the whole of this file — one line, from the registry, and
// nothing else on the screen.
//
// **Why there is no bar here.** Issue #327 asks for the registered
// `Progress`, and the registry refuses it in this position, twice over:
// `Progress` is *determinate only* — `value` and `max` are both required
// and non-optional precisely "so an indeterminate bar has no call shape a
// caller can reach" (`src/ui/components/Progress.tsx`) — and a route that
// has not answered yet has no measured value to put in one. Drawing it at
// zero would be a figure the product invented; REQ-003 c1 forbids "an
// unlabelled spinner or an indeterminate bar alone", §4.1 of BUILD writes "no
// spinner" into the report's own states, and `verdict.tsx` already sets the
// precedent for the same choice — its unmeasured driver renders no bar at
// all rather than an empty one. Where this product does have stages to
// name it names them (`Steps`, on S3 and S11); a server render that has not
// returned has none, so it gets the line the rule asks for and no
// furniture. The reasoning is in the PR body under *Owner owes*.
//
// **One line, one key, both mounts.** The 404's line is split public/app
// because the two say different things — a stranger is sent to a report
// address, a customer is not. A waiting line states the same fact on either
// side of the door, so it is one key; if the owner wants two sentences the
// split is theirs to make and this file gains a second constant, not a
// second component.
//
// It declares no `Surface`: a screen root is the *mount's* to decide, and
// the two mounts differ — the report's arm is its own screen root, while
// under `/app` the shell's layout owns the route's `Surface` and pages
// under it declare none (ruling of issue #83).
//
// `role="status"` and `aria-busy`: a line that appears without a reload is
// one a screen reader is otherwise never told about. Neither is a sentence
// and neither is copy.
//
// **`data-waiting` is the layout suite's hook, and it is one attribute for
// both mounts on purpose.** A screen that is still waiting is not a screen
// to measure: the sweep photographs and reads the settled document, so
// `browser.ts` waits for this attribute to leave the DOM after every
// navigation. Keyed on the state rather than on either mount's test id, so
// a third `loading.tsx` is covered by writing none of it.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";

/** Owner-owed (12a): no approved screen draws a waiting state, so the one
 *  line renders its marker until the owner writes it. */
const LINE: CopyKey = "chrome.loading.line";

export function WaitingScreen(p: {
  /** A test hook, never a sentence — bound to a name by its caller for the
   *  same reason every other test id in `src/app/**` is (ADR-010 point 1). */
  testId: string;
}): React.JSX.Element {
  return (
    // The centred reading column S8's two screens already stand in: a
    // screen that is one written line is the shape that class draws, and a
    // second class carrying the same six declarations would be a second
    // place to change them.
    <div
      className="rk-fallback"
      role="status"
      aria-busy="true"
      data-waiting=""
      data-testid={p.testId}
    >
      <p className="rk-quiet">{copy(LINE)}</p>
    </div>
  );
}
