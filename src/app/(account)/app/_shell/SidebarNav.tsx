// Canvas: Dashboard — the Workspace nav: Overview, Calendar, Settings.
//
// Maps over `DESTINATIONS` — the one tuple — so a fourth destination cannot
// appear on one breakpoint only, and renders `<a href>`: navigation that
// works without a client runtime.
//
// One component at both bands. Below the medium band the three items stay as
// one horizontal row inside the collapsed header, labels and counts kept —
// so the row and the column cannot disagree about a destination, its word,
// its count or which one is current. At the 320 floor the row drops the
// glyphs rather than cut a word.
//
// The Calendar destination shows how many are waiting; when none are, it
// shows no count at all — not a `0`, not an empty badge.
"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { Calendar, Settings, TrendingUp, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { DESTINATIONS, DESTINATION_COPY_KEY, DESTINATION_HREF, destinationOf } from "./destinations";

/** Each destination's glyph. A `Record` over the one tuple, so a fourth
 *  destination without a glyph is a compile error. */
const DESTINATION_ICON: Record<(typeof DESTINATIONS)[number], LucideIcon> = {
  overview: TrendingUp,
  calendar: Calendar,
  settings: Settings,
};

export function SidebarNav(p: {
  waiting: number;
  /** The compact band's arm: the same three items as one horizontal row. */
  row?: boolean;
}): React.JSX.Element {
  const current = destinationOf(usePathname());
  const isRow = p.row === true;

  return (
    <nav
      className={isRow ? NAV_ROW : NAV}
      data-testid={isRow ? "shell-compact-nav" : "shell-sidebar-nav"}
    >
      {DESTINATIONS.map((destination) => {
        const Icon = DESTINATION_ICON[destination];
        return (
          <a
            key={destination}
            href={DESTINATION_HREF[destination]}
            className={isRow ? `${LINK} ${LINK_ROW}` : LINK}
            data-testid={`shell-navlink-${destination}`}
            aria-current={destination === current ? "page" : undefined}
          >
            {/* Decoration: the word beside it is the link's name. */}
            <Icon size={15} strokeWidth={1.8} aria-hidden />
            <span>{copy(DESTINATION_COPY_KEY[destination])}</span>
            {destination === "calendar" && p.waiting > 0 ? (
              <span className={COUNT} data-testid="shell-calendar-count">
                {p.waiting}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

const NAV = "flex min-w-0 flex-col gap-(--s-1)";
/** Each item is as wide as the word it carries, and the three sit apart
 *  across the row: an equal share at the 320 floor is narrower than
 *  "Calendar" and its count, and would cut one of them. The glyphs go, so
 *  the three words and the count fit inside the band's gutters. */
const NAV_ROW = "flex min-w-0 flex-row justify-between gap-(--s-1) [&_svg]:hidden";
const LINK =
  "flex min-w-0 items-center gap-(--s-2) rounded-(--r-field) px-(--s-3) py-(--s-2) text-(length:--t-sm) font-medium text-(color:--ink-3) no-underline [&>svg]:flex-none aria-[current=page]:bg-(--accent-bg) aria-[current=page]:font-semibold aria-[current=page]:text-primary";
const LINK_ROW = "flex-initial justify-center whitespace-nowrap px-(--s-2)";
const COUNT = "num ms-auto flex-none text-(color:--ink-3)";
