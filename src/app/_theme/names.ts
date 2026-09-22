// docs/DESIGN.md (2026-09-14) — the theme control's four sentences, resolved
// on the server (#988).
//
// `ThemeToggle` is a Client Component: it reads the stored choice and writes
// a new one, which is what a control is. What it is *not* is a reader of the
// copy registry — a `copy()` call inside a client module puts `COPY` in the
// client graph, and `COPY` is every sentence in the product merged into one
// frozen map (39 kB over the wire, #988's third row). So the control's own
// four sentences are resolved here, by whichever Server Component renders
// it, and arrive already written.
//
// The same convention `GrowthLine` already states for a chart's label:
// "`label` is already a written string when it arrives — this module holds
// no copy key". This file is where the keys live instead, so there is still
// exactly one place that says which sentence names which choice.
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { THEME_CHOICES, type ThemeChoice } from "./theme";

/** What the control is called, and what each of its three choices is
 *  called. One object rather than four props, so a caller cannot pass
 *  three of them. */
export type ThemeNames = Readonly<{ control: string } & Record<ThemeChoice, string>>;

/** The key per choice, and the control's own name. The one place the
 *  mapping lives. */
const CHOICE_KEY: Readonly<Record<ThemeChoice, CopyKey>> = {
  light: "chrome.theme.light",
  dark: "chrome.theme.dark",
  system: "chrome.theme.system",
};
const CONTROL_KEY: CopyKey = "chrome.theme.label";

/** Server-side only: it reads the registry, which is the whole point. */
export function themeNames(): ThemeNames {
  const choices = {} as Record<ThemeChoice, string>;
  for (const choice of THEME_CHOICES) choices[choice] = copy(CHOICE_KEY[choice]);
  return { control: copy(CONTROL_KEY), ...choices };
}
