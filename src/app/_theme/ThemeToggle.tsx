// docs/DESIGN.md (2026-09-14) — the Light / Dark / System control (#681),
// the one module the public header and the /app shell both import. A daisyUI
// `dropdown` with a `menu`, lucide glyphs at 1.75. Never on hosted pages:
// those are the customer's domain, not ReachKit chrome.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import {
  applyThemeChoice,
  readThemeChoice,
  subscribeThemeChoice,
  THEME_CHOICES,
  type ThemeChoice,
} from "./theme";

const CHOICE: Record<ThemeChoice, { icon: LucideIcon; label: CopyKey }> = {
  light: { icon: Sun, label: "chrome.theme.light" },
  dark: { icon: Moon, label: "chrome.theme.dark" },
  system: { icon: Monitor, label: "chrome.theme.system" },
};

const TEST_ID = "theme-toggle";
const SERVER_CHOICE: ThemeChoice = "system";

export function ThemeToggle(p: {
  /** The menu opens above the control — the foot of the sidebar — rather
   *  than under it. */
  up?: boolean;
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

  const Current = CHOICE[choice].icon;

  return (
    <div className={`dropdown dropdown-end ${p.up === true ? "dropdown-top" : ""}`} data-testid={TEST_ID}>
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-square btn-sm"
        aria-label={copy("chrome.theme.label")}
      >
        <Current aria-hidden size={20} strokeWidth={1.75} />
      </div>
      <ul tabIndex={-1} className="dropdown-content menu z-20 w-40 rounded-box bg-base-100 p-2 shadow-sm">
        {THEME_CHOICES.map((option) => {
          const Icon = CHOICE[option].icon;
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
                {copy(CHOICE[option].label)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
