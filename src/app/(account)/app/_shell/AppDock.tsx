// SPEC §4 (2026-10-08, owner, issue 1339) — "On a phone the bottom bar is
// the navigation." Below the large breakpoint there is no side panel and
// this is the only menu.
//
// A daisyUI `dock`: the same three destinations, from the same tuple, with
// their words under their glyphs and the waiting count where the panel puts
// it (Overview). It is `position: fixed` at the foot of the viewport by
// daisyUI's own rule, which is why the shell's content column reserves room
// for it below `lg` rather than this component trying to push anything.
//
// **It floats** (the calm layer, SPEC §4 2026-09-24, #1070, board R12-7):
// 12px off the viewport's sides and foot, rounded, on a frosted ground. The
// ground stays near-opaque so the words keep their contrast over whatever
// scrolls beneath it.
//
// It disappears at `lg`, where the side panel is always on screen and a
// second copy of the same three links would be a second navigation.
//
// A client component for one reason: the pathname that marks the current
// item. Everything else is a plain `<a href>`.
"use client";

import type React from "react";
import { Suspense, use } from "react";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/presentation/copy";
import {
  DESTINATIONS,
  DESTINATION_COPY_KEY,
  DESTINATION_HREF,
  WAITING_ON,
  destinationOf,
} from "./destinations";
import { DESTINATION_ICON } from "./SidebarNav";

/** The count, once it is known — the dock's own copy of the panel's rule
 *  (issue 912). The three links are the phone's menu and have no read
 *  behind them; only this badge waits. */
function DockCount(p: { waiting: Promise<number> }): React.JSX.Element | null {
  const waiting = use(p.waiting);
  if (waiting <= 0) return null;
  return (
    // REQ-040 c2 in the dock: the number, never a `0`.
    <span
      className="badge badge-xs badge-primary num absolute end-0 top-0 text-(length:--t-eyebrow)"
      data-testid="shell-dock-count"
    >
      {waiting}
    </span>
  );
}

export function AppDock(p: {
  /** The count, as a promise: the dock does not wait for it (issue 912). */
  waiting: Promise<number>;
}): React.JSX.Element {
  const current = destinationOf(usePathname());

  return (
    <nav
      className="dock dock-sm inset-x-3 bottom-3 w-auto rounded-box border border-base-300 bg-base-100/90 shadow-sm backdrop-blur-md lg:hidden"
      aria-label={copy("shell.workspace")}
      data-testid="shell-dock"
    >
      {DESTINATIONS.map((destination) => {
        const Icon = DESTINATION_ICON[destination];
        const here = destination === current;
        const carries = destination === WAITING_ON;
        return (
          <a
            key={destination}
            href={DESTINATION_HREF[destination]}
            className={here ? "dock-active text-primary" : ""}
            aria-current={here ? "page" : undefined}
            data-testid={`shell-docklink-${destination}`}
          >
            {/* A glyph box wide enough to hold the count beside the
                glyph rather than on it — a badge on the corner of a 20px
                glyph covers it, and a badge hung outside the box is an
                element wider than its container. The box is the same
                width on all three items and the glyph is centred in it,
                so the one carrying a count keeps the others' centre line;
                a dock item is a third of the bar, with room to spare. */}
            <span className="relative flex h-5 w-16 items-center justify-center">
              <Icon size={20} strokeWidth={1.75} aria-hidden />
              {!carries ? null : (
                <Suspense fallback={null}>
                  <DockCount waiting={p.waiting} />
                </Suspense>
              )}
            </span>
            <span className="dock-label truncate text-(length:--t-eyebrow)">{copy(DESTINATION_COPY_KEY[destination])}</span>
          </a>
        );
      })}
    </nav>
  );
}
