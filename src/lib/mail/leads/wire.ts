// BUILD §4.2 — fills the send seam's `'opt-out'` port; unfilled, the seam sends no such kind, since "cannot tell" must not mail.
// The only filler, idempotent and called from every entry that reaches the seam, so no import order leaves the nurture mail unsendable.
import { registerSuppressionReader } from "../send";
import { suppressionState } from "./suppress";

let wired = false;

export function wireSuppressionReader(): void {
  if (wired) return;
  registerSuppressionReader(suppressionState);
  wired = true;
}

/** The suites' way back to the seam's fail-closed default, so wiring cannot leak between tests. */
export function unwireSuppressionReader(): void {
  registerSuppressionReader(null);
  wired = false;
}
