// SPEC §4 (2026-09-20, #908) — "Menu: **Overview · Plan · Settings**".
//
// One component, two arms, one tuple. The side panel draws it as a daisyUI
// `menu` with the words; the collapsed icon rail draws the same three links
// as 48px squares with an `aria-label` and a daisyUI `tooltip` in place of
// the word (SPEC §4: "Icon-only controls carry `aria-label` and a
// `tooltip`"). Keeping both arms here is what makes a fourth destination
// impossible on one arm only — and what makes the current mark, the
// addresses and the waiting count the same answer in both.
//
// The dock the phone gets is `AppDock.tsx`: a different daisyUI component
// with a different contract (fixed to the foot of the viewport), reading
// the same tuple.
//
// Links are `<a href>`: navigation that works with no client runtime. It is
// a client component only to read the pathname that marks the current
// destination.
//
// SPEC §4 (2026-09-20) moves the waiting count from Plan to Overview
// (`WAITING_ON`). The rule under it is REQ-040 c2's and is unchanged: when
// none are waiting it shows no count — not a `0`, not an empty badge.
"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { Calendar, Settings, TrendingUp, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import {
  DESTINATIONS,
  DESTINATION_COPY_KEY,
  DESTINATION_HREF,
  WAITING_ON,
  destinationOf,
  type Destination,
} from "./destinations";

/** Each destination's glyph. A `Record` over the one tuple, so a fourth
 *  destination without a glyph is a compile error. */
export const DESTINATION_ICON: Record<Destination, LucideIcon> = {
  overview: TrendingUp,
  calendar: Calendar,
  settings: Settings,
};

/** The waiting count, or nothing at all. REQ-040 c2's rule lives here once
 *  so the panel and the rail cannot disagree about zero. */
function WaitingBadge(p: { waiting: number; className: string }): React.JSX.Element | null {
  if (p.waiting <= 0) return null;
  return (
    <span className={p.className} data-testid="shell-waiting-count">
      {p.waiting}
    </span>
  );
}

export function SidebarNav(p: {
  waiting: number;
  /** The collapsed icon rail's arm: the same three links, icon only. */
  rail?: boolean;
}): React.JSX.Element {
  const current = destinationOf(usePathname());
  const rail = p.rail === true;

  return (
    <nav
      className="min-w-0"
      aria-label={copy("shell.workspace")}
      data-testid={rail ? "shell-rail-nav" : "shell-sidebar-nav"}
    >
      <ul className={rail ? "menu gap-1 p-0" : "menu w-full gap-1 p-0"}>
        {DESTINATIONS.map((destination) => {
          const Icon = DESTINATION_ICON[destination];
          const here = destination === current;
          const word = copy(DESTINATION_COPY_KEY[destination]);
          const waiting = destination === WAITING_ON ? p.waiting : 0;
          return (
            <li key={destination}>
              <a
                href={DESTINATION_HREF[destination]}
                // The rail's link is a 48px square with the word as its
                // accessible name and its tooltip; the panel's carries the
                // word itself and needs neither.
                className={[
                  here ? "menu-active" : "",
                  rail ? "tooltip tooltip-right relative size-12 justify-center p-0" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                {...(rail ? { "aria-label": word, "data-tip": word } : {})}
                data-testid={`shell-navlink-${destination}`}
                aria-current={here ? "page" : undefined}
              >
                {/* Decoration in the panel — the word beside it is the
                    link's name; in the rail the `aria-label` is. */}
                <Icon size={20} strokeWidth={1.75} aria-hidden />
                {rail ? null : <span className="truncate">{word}</span>}
                <WaitingBadge
                  waiting={waiting}
                  className={
                    rail
                      ? "badge badge-xs badge-primary num absolute end-1 top-1"
                      : "badge badge-sm badge-primary num ms-auto"
                  }
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
