// SPEC §4 — "Nav: Overview, Calendar, Settings only."
//
// A daisyUI `menu` mapped over `DESTINATIONS` — the one tuple — so a fourth
// destination cannot appear on one breakpoint only. The sidebar renders it as
// a column; the compact header renders the same component with `row` as a
// `menu-horizontal`, so the two cannot disagree about a destination, its word,
// its count or which one is current. Links are `<a href>`: navigation that
// works without a client runtime. It is a client component only to read the
// pathname that marks the current destination.
//
// REQ-040 c2: Calendar shows how many items are waiting; when none are, it
// shows no count — not a `0`, not an empty badge.
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
  /** The compact header's arm: the same three items as one horizontal row. */
  row?: boolean;
}): React.JSX.Element {
  const current = destinationOf(usePathname());
  const row = p.row === true;

  return (
    <nav className="min-w-0" data-testid={row ? "shell-compact-nav" : "shell-sidebar-nav"}>
      <ul
        className={
          row
            ? "menu menu-horizontal w-full flex-nowrap justify-between gap-1 p-0"
            : "menu w-full gap-1 p-0"
        }
      >
        {DESTINATIONS.map((destination) => {
          const Icon = DESTINATION_ICON[destination];
          const here = destination === current;
          return (
            <li key={destination}>
              <a
                href={DESTINATION_HREF[destination]}
                className={`${here ? "menu-active" : ""} ${row ? "whitespace-nowrap px-3" : ""}`}
                data-testid={`shell-navlink-${destination}`}
                aria-current={here ? "page" : undefined}
              >
                {/* Decoration: the word beside it is the link's name. */}
                <Icon className={row ? "hidden sm:inline" : undefined} size={20} strokeWidth={1.75} aria-hidden />
                <span>{copy(DESTINATION_COPY_KEY[destination])}</span>
                {destination === "calendar" && p.waiting > 0 ? (
                  <span className="badge badge-sm badge-primary num" data-testid="shell-calendar-count">
                    {p.waiting}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
