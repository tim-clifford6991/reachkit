// SPEC §4 (2026-09-20, #908) — "a *Waiting for you* card for the page in
// review".
//
// One link to `/app/draft/{id}` carrying three things and no more: that
// something is waiting, what it is called, and when it goes live if the
// customer does nothing. The title is a page's own title and can be any
// length, so it is clamped to two lines (`docs/DESIGN.md`, 2026-09-20: "A
// label that can grow … is clamped to one or two lines with an ellipsis");
// the time is never clamped, because a cut-off time is a wrong time.
//
// With nothing waiting the card is not drawn at all — SPEC §4 of the same
// date: "a control that cannot act is not drawn". The same is true of the
// go-live line where no time is set: the shell states the day it read, not
// a word it worked out.
import type React from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDateTime } from "./format";
import type { WaitingPage } from "./model";

export function WaitingCard(p: {
  review: WaitingPage | null;
  timeZone: string;
}): React.JSX.Element | null {
  const { review } = p;
  if (review === null) return null;

  return (
    <Link
      href={`/app/draft/${review.draftId}`}
      prefetch={true}
      // `alert-vertical` is what stacks the three lines: daisyUI's `alert`
      // is a grid with `grid-auto-flow: column`, so a flex direction would
      // be ignored and all three would land in one cell on top of each
      // other. `justify-items-start` and `text-start` undo that modifier's
      // centring, which this card does not want.
      className="alert alert-warning alert-soft alert-vertical w-full justify-items-start gap-1 text-start"
      data-testid="shell-waiting"
    >
      <span className="flex w-full min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <Clock size={16} strokeWidth={1.75} aria-hidden />
        {copy("shell.waiting.head")}
      </span>
      <span className="line-clamp-2 w-full min-w-0 font-semibold" data-testid="shell-waiting-title">
        {review.title}
      </span>
      {review.goesLiveAt === null ? null : (
        // #946 (and #986's standing rule): no text spends `opacity-` on a
        // coloured or grey ground. This line takes the quiet *colour* the
        // rest of the product's secondary text takes — a colour, resolved
        // at paint, rather than an element opacity that thins the ground
        // under it as well.
        <span className="w-full text-xs text-base-content/70" data-testid="shell-waiting-when">
          {copy("shell.waiting.goes-live", {
            when: formatDateTime(review.goesLiveAt, p.timeZone),
          })}
        </span>
      )}
    </Link>
  );
}
