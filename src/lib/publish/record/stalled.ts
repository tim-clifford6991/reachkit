// SPEC §7 (issue 1184) — why pages stall, counted.
//
// A week's pages, and how many of them stopped on the way to review, by
// cause. The cause is the one `./needs-you` reads — the page's last move
// into `needs_attention` — so this count and the sentence a stopped page
// states about itself cannot disagree. A page stopped by the writing rules
// counts once as a page and once for each rule that stopped it, which is
// why the causes may add up to more than the pages.
//
// Pure, like `needs-you.ts`: the read is `./stalled-read`.
import { needsYouCauseOf, restedReasonOf } from "./needs-you";

export interface StalledCause {
  /** A writing rule's own handle (`brand_gap`), or the closed name of another
   *  cause: `step/<step>`, `adds`, `elsewhere`, `destination`, `delivery`, `unknown`. */
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
