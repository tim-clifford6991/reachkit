// SPEC §7 — why pages stall, counted: a week's pages and how many stopped on the way to review, by cause.
// The cause is `./needs-you`'s (the last move into `needs_attention`), so this count and the page's own sentence agree.
// A page stopped by rules counts once per rule, so causes may add up to more than the pages. Pure; the read is `./stalled-read`.
import { needsYouCauseOf, restedReasonOf } from "./needs-you";

export interface StalledCause {
  /** A writing rule's own handle (`brand_gap`), or the closed name of another
   *  cause: `step/<step>`, `adds`, `elsewhere`, `pack`, `destination`, `delivery`, `unknown`. */
  cause: string;
  /** Whether the cause is a writing rule. */
  rule: boolean;
  count: number;
}

export interface StalledCount {
  /** Pages the window holds, stopped or not. */
  written: number;
  /** Pages that rested in `needs_attention` at least once. */
  stopped: number;
  /** Most frequent first; a tie is settled by name so the order is stable. */
  causes: readonly StalledCause[];
}

function causesOf(reason: string | null): readonly { cause: string; rule: boolean }[] {
  const cause = needsYouCauseOf(reason);
  if (cause.kind === "rules") return [...new Set(cause.rules)].map((rule) => ({ cause: rule, rule: true }));
  if (cause.kind === "step") return [{ cause: `step/${cause.step}`, rule: false }];
  return [{ cause: cause.kind, rule: false }];
}

export function stalledCount(pages: readonly { state: unknown; transitions: unknown }[]): StalledCount {
  const counts = new Map<string, StalledCause>();
  let stopped = 0;
  for (const page of pages) {
    const reason = restedReasonOf(page.transitions);
    if (reason === null && page.state !== "needs_attention") continue;
    stopped += 1;
    for (const { cause, rule } of causesOf(reason)) {
      const seen = counts.get(cause);
      counts.set(cause, { cause, rule, count: (seen?.count ?? 0) + 1 });
    }
  }
  const causes = [...counts.values()].sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause));
  return { written: pages.length, stopped, causes };
}
