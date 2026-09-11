// BUILD §4.4 — "nav **Overview / Calendar / Settings** (Calendar shows item
// count)".
//
// Maps over `DESTINATIONS` — the one tuple — so a fourth destination
// cannot appear on one breakpoint only (WO-155 decision 3). Renders
// `<a href>`: navigation that works without a client runtime.
//
// **One component at both bands** (UI-SPEC §0 11, 2026-09-11): "Below 1024
// the three Workspace items (Overview · Calendar · Settings) stay as one
// horizontal row inside the collapsed sidebar, labels and counts kept … No
// drawer and no bottom bar." The compact header renders this same nav with
// `row`, so the row and the column cannot disagree about a destination, its
// word, its count or which one is current — they are one renderer. The
// `TabBar` that stood in the compact band dropped the count and is gone.
//
// REQ-040 c2: "the Calendar destination shows how many are waiting; when
// none are, it shows no count." Zero renders no count at all — not a `0`,
// not an empty badge. The count is `waiting` from the model and belongs to
// Calendar alone: `waiting` counts calendar items awaiting the customer.
"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { Calendar, Settings, TrendingUp, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { DESTINATIONS, DESTINATION_COPY_KEY, DESTINATION_HREF, destinationOf } from "./destinations";

/** Each destination's glyph, from UI-SPEC §2.6's table: `trend`, `cal` and
 *  `gear` — the set's `sideNav()` (L518). A `Record` over the one tuple, so
 *  a fourth destination without a glyph is a compile error (issue #506). */
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

  return (
    <nav
      className={p.row === true ? "rk-nav rk-nav-row" : "rk-nav"}
      data-testid={p.row === true ? "shell-compact-nav" : "shell-sidebar-nav"}
    >
      {DESTINATIONS.map((destination) => {
        const Icon = DESTINATION_ICON[destination];
        return (
        <a
          key={destination}
          href={DESTINATION_HREF[destination]}
          className="rk-navlink"
          data-testid={`shell-navlink-${destination}`}
          aria-current={destination === current ? "page" : undefined}
        >
          {/* Decoration: the word beside it is the link's name. */}
          <Icon size={15} strokeWidth={1.8} aria-hidden />
          <span>{copy(DESTINATION_COPY_KEY[destination])}</span>
          {destination === "calendar" && p.waiting > 0 ? (
            <span className="num rk-count" data-testid="shell-calendar-count">
              {p.waiting}
            </span>
          ) : null}
        </a>
        );
      })}
    </nav>
  );
}
