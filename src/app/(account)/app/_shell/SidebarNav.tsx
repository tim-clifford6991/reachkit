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
// Links are `next/link` with `prefetch` (SPEC §4, 2026-10-08, issue 1341):
// the destination is loaded before the tap and the shell stays mounted. It
// is a client component to read the pathname that marks the current
// destination.
//
// SPEC §4 (2026-09-20) moves the waiting count from Plan to Overview
// (`WAITING_ON`). The rule under it is REQ-040 c2's and is unchanged: when
// none are waiting it shows no count — not a `0`, not an empty badge.
"use client";

import type React from "react";
import { Suspense, use } from "react";
import Link from "next/link";
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

/**
 * How the current destination is marked, in both arms.
 *
 * **Not daisyUI's `menu-active`.** That class paints
 * `background-color: var(--menu-active-bg)`, which daisyUI defines as
 * `var(--color-neutral)` — and the one `reachkit` theme declares no
 * `neutral` slot (`src/ui/theme.css`: ground, ink, accent, meaning and the
 * chart tokens, and `theme-slots.test.ts` records the omission). An
 * undeclared custom property makes the declaration invalid at computed-value
 * time, so `menu-active` painted **nothing at all** and the current
 * destination was unmarked on every screen — measured in Chromium at
 * `rgba(0, 0, 0, 0)` in the panel and in the rail alike.
 *
 * So the mark is the accent, stated: a daisyUI class plus a theme colour,
 * which is the second rung of `docs/DESIGN.md`'s own admission ladder.
 * `aria-current="page"` carries it to a screen reader either way.
 */
const HERE = "bg-primary/10 text-primary font-semibold";

/** The count, once it is known.
 *
 *  **`use()` rather than a prop, since issue 912.** The three menu items
 *  are the shell and have no read behind them: they are in the first
 *  server response, and only this badge waits. Reading the promise here
 *  suspends this element alone at the boundary below it — one nav, one
 *  DOM, and the number lands on the item that is already on screen.
 *
 *  A `0` and a count nobody could read both draw nothing, which is REQ-040
 *  c2's rule either way: no `0`, no empty badge. */
function WaitingBadge(p: { waiting: Promise<number>; className: string }): React.JSX.Element | null {
  const waiting = use(p.waiting);
  if (waiting <= 0) return null;
  return (
    <span className={p.className} data-testid="shell-waiting-count">
      {waiting}
    </span>
  );
}

export function SidebarNav(p: {
  /** The count, as a promise: the nav does not wait for it (issue 912). */
  waiting: Promise<number>;
  /** The collapsed icon rail's arm: the same three links, icon only. */
  rail?: boolean;
}): React.JSX.Element {
  const current = destinationOf(usePathname());
  const rail = p.rail === true;

  // Any arrival closes it — the panel's *Waiting for you* card and the
  // screen's own links navigate too. The press handler below covers the one
  // case with no arrival: a tap on the destination already on screen.
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
          const carries = destination === WAITING_ON;
          return (
            <li key={destination}>
              <Link
                href={DESTINATION_HREF[destination]}
                prefetch={true}
                // The rail's link is a 48px square — the same box for all
                // three, so none of them reads as the odd one — with the
                // word as its accessible name and its tooltip; the panel's
                // carries the word itself and needs neither.
                className={[
                  here ? HERE : "",
                  rail ? "tooltip tooltip-right relative size-12 content-center items-center justify-center p-0" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                {...(rail ? { "aria-label": word, "data-tip": word } : {})}
                data-testid={`shell-navlink-${destination}`}
                aria-current={here ? "page" : undefined}
              >
                {/* Decoration in the panel — the word beside it is the
                    link's name; in the rail the `aria-label` is. */}
                <Icon size={rail ? 22 : 20} strokeWidth={1.75} aria-hidden />
                {rail ? null : <span className="truncate">{word}</span>}
                {!carries ? null : (
                  // No fallback: a badge that is not there yet is a badge
                  // that may never be there — a count of none draws nothing
                  // either way, so an empty box would be a promise the
                  // product often cannot keep.
                  <Suspense fallback={null}>
                    <WaitingBadge
                      waiting={p.waiting}
                      className={
                        rail
                          // Flush in the box's top-right corner. The glyph
                          // is 22px centred in 48, so it starts 13px in on
                          // both axes and the badge's 16px band clears its
                          // ink entirely; inset by a step (the old `end-1
                          // top-1`) it sat squarely over the glyph instead.
                          ? "badge badge-xs badge-primary num absolute end-0 top-0 text-(length:--t-eyebrow)"
                          : "badge badge-sm badge-primary num ms-auto"
                      }
                    />
                  </Suspense>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
