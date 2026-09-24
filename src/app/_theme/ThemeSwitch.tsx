// docs/DESIGN.md (calm layer, 2026-09-24, #1066) — the public header's
// theme control: two states, light and dark, the first visit following the
// system. The `/app` shell keeps the three-way `ThemeToggle` dropdown.
//
// A daisyUI `join` of two ghost buttons, lucide glyphs at 1.75, the current
// one pressed. It writes the same choice `ThemeToggle` does (`./theme.ts`),
// so the two controls never disagree about what is stored. Like that
// control it holds no copy key: its three names arrive written.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import type { ThemeNames } from "./names";
import { applyThemeChoice, readThemeChoice, subscribeThemeChoice } from "./theme";

type Shown = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** What the page is showing: the stored choice, or — while it is still
 *  `system` — what the system asks for. */
function readShown(): Shown {
  const choice = readThemeChoice();
  if (choice !== "system") return choice;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function subscribeShown(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  const unsubscribe = subscribeThemeChoice(onChange);
  return () => {
    media.removeEventListener("change", onChange);
    unsubscribe();
  };
}

/** The server cannot know; neither half is pressed until hydration. The
 *  ground is already right — the before-paint script set it. */
const SERVER_SHOWN = null;

const OPTIONS: readonly { value: Shown; Icon: typeof Sun }[] = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
];

export function ThemeSwitch(p: { names: Pick<ThemeNames, "control" | "light" | "dark"> }): React.JSX.Element {
  const shown = useSyncExternalStore<Shown | null>(subscribeShown, readShown, () => SERVER_SHOWN);
  return (
    <div role="group" aria-label={p.names.control} className="join" data-testid="theme-switch">
      {OPTIONS.map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          className={`btn btn-sm btn-square join-item ${shown === value ? "btn-soft btn-primary" : "btn-ghost"}`}
          aria-label={p.names[value]}
          aria-pressed={shown === value}
          data-theme-choice={value}
          onClick={() => applyThemeChoice(value)}
        >
          <Icon aria-hidden size={16} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
