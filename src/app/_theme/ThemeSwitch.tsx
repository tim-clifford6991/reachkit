// docs/DESIGN.md (calm layer) — the public header's theme control: one
// button that switches between light and dark, the first visit following the
// system (board `PubLanding`). The `/app` shell keeps the three-way
// `ThemeToggle` dropdown.
//
// It writes the same choice `ThemeToggle` does (`./theme.ts`), so the two
// controls never disagree about what is stored. Like that control it holds no
// copy key: its two names arrive written.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
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

/** The server cannot know, so it names the press to dark; the ground is
 *  already right because the before-paint script set it. */
const SERVER_SHOWN = null;

export function ThemeSwitch(p: { names: { toDark: string; toLight: string } }): React.JSX.Element {
  const shown = useSyncExternalStore<Shown | null>(subscribeShown, readShown, () => SERVER_SHOWN);
  const next: Shown = shown === "dark" ? "light" : "dark";
  const Icon = next === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-square"
      aria-label={next === "dark" ? p.names.toDark : p.names.toLight}
      data-testid="theme-switch"
      data-theme-choice={next}
      onClick={() => applyThemeChoice(next)}
    >
      <Icon aria-hidden size={16} strokeWidth={1.75} />
    </button>
  );
}
