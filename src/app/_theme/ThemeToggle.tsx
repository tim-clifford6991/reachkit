// docs/DESIGN.md (2026-09-14) — the Light / Dark / System control (#681),
// the one module the public header and the /app shell both import. A daisyUI
// `dropdown` with a `menu`, lucide glyphs at 1.75. Never on hosted pages:
// those are the customer's domain, not ReachKit chrome.
//
// **Its four sentences arrive written** (#988). This is a Client Component,
// and a `copy()` call in one puts the whole merged registry in the bundle —
// 39 kB a stranger downloads before reading the landing page. `./names.ts`
// holds the keys and resolves them on the server; this file holds the
// glyphs and the state, and no copy key at all.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { ThemeNames } from "./names";
import {
  applyThemeChoice,
  readThemeChoice,
  subscribeThemeChoice,
  THEME_CHOICES,
  type ThemeChoice,
} from "./theme";

const ICON: Record<ThemeChoice, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

const TEST_ID = "theme-toggle";
const SERVER_CHOICE: ThemeChoice = "system";

export function ThemeToggle(p: {
  /** What the control and its three choices are called, resolved by the
   *  Server Component that renders it — `themeNames()` in `./names.ts`. */
  names: ThemeNames;
  /** The menu opens above the control — the foot of the sidebar — rather
   *  than under it. */
  up?: boolean;
  /** Show the control's own name beside the glyph, rather than only as its
   *  accessible name (#936, owner 2026-09-21).
   *
   *  In a bar the glyph is enough — it sits among other icon-square
   *  controls and its current state *is* the icon. Inside the public
   *  header's phone menu it does not: it is a bare monitor glyph under two
   *  worded links, and nobody can tell what it is. The word is
   *  `chrome.theme.label`'s, the same string the control already carries
   *  as its accessible name, so nothing new is said — and when it is
   *  shown, it *is* the accessible name and the `aria-label` comes off,
   *  because a control named twice is announced twice. */
  labelled?: boolean;
}): React.JSX.Element {
  // The server cannot know the stored choice, so it renders `system` and
  // the client reads the real one on hydration. The page's ground is
  // already right: the root layout's script set it before paint.
  const choice = useSyncExternalStore(subscribeThemeChoice, readThemeChoice, () => SERVER_CHOICE);

  function choose(next: ThemeChoice): void {
    applyThemeChoice(next);
    // daisyUI's CSS dropdown stays open while focus is inside it.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  const Current = ICON[choice];
  const labelled = p.labelled === true;

  return (
    <div className={`dropdown dropdown-end ${p.up === true ? "dropdown-top" : ""}`} data-testid={TEST_ID}>
      <div
        tabIndex={0}
        role="button"
        className={labelled ? "btn btn-ghost btn-sm w-full justify-start gap-2" : "btn btn-ghost btn-square btn-sm"}
        aria-label={labelled ? undefined : p.names.control}
      >
        <Current aria-hidden size={20} strokeWidth={1.75} />
        {labelled ? <span>{p.names.control}</span> : null}
      </div>
      <ul tabIndex={-1} className="dropdown-content menu z-20 w-40 rounded-box bg-base-100 p-2 shadow-sm">
        {THEME_CHOICES.map((option) => {
          const Icon = ICON[option];
          return (
            <li key={option}>
              <button
                type="button"
                className={option === choice ? "menu-active" : undefined}
                aria-pressed={option === choice}
                data-theme-choice={option}
                onClick={() => choose(option)}
              >
                <Icon aria-hidden size={16} strokeWidth={1.75} />
                {p.names[option]}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
