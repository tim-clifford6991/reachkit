// SPEC §4 (2026-09-20, #908) — "below the large breakpoint it is a drawer
// and the three menu items move to a bottom bar."
//
// A daisyUI `dock`: the same three destinations, from the same tuple, with
// their words under their glyphs and the waiting count where the panel puts
// it (Overview). It is `position: fixed` at the foot of the viewport by
// daisyUI's own rule, which is why the shell's content column reserves room
// for it below `lg` rather than this component trying to push anything.
//
// It disappears at `lg`, where the side panel is always on screen and a
// second copy of the same three links would be a second navigation.
//
// A client component for one reason: the pathname that marks the current
// item. Everything else is a plain `<a href>`.
"use client";

import type React from "react";
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

export function AppDock(p: { waiting: number }): React.JSX.Element {
  const current = destinationOf(usePathname());

  return (
    <nav
      className="dock dock-sm border-base-300 lg:hidden"
      aria-label={copy("shell.workspace")}
      data-testid="shell-dock"
    >
      {DESTINATIONS.map((destination) => {
        const Icon = DESTINATION_ICON[destination];
        const here = destination === current;
        const waiting = destination === WAITING_ON ? p.waiting : 0;
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
              {waiting > 0 ? (
                // REQ-040 c2 in the dock: the number, never a `0`.
                <span
                  className="badge badge-xs badge-primary num absolute end-0 top-0 text-(length:--t-eyebrow)"
                  data-testid="shell-dock-count"
                >
                  {waiting}
                </span>
              ) : null}
            </span>
            <span className="dock-label truncate text-(length:--t-eyebrow)">{copy(DESTINATION_COPY_KEY[destination])}</span>
          </a>
        );
      })}
    </nav>
  );
}
