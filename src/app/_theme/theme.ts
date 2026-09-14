// docs/DESIGN.md (2026-09-14) — the Light / Dark / System choice (#681).
//
// One `reachkit` daisyUI theme; `src/ui/theme.css` flips its tokens three
// ways: no `data-theme` on `<html>` follows the OS, `data-theme="light"`
// blocks the media dark, `data-theme="dark"` forces it. The choice is kept
// in this browser's `localStorage` — no account field.
//
// Shared by the root layout (the before-paint script) and the toggle, so the
// key and the rule cannot drift between the first frame and a click.

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const THEME_STORAGE_KEY = "reachkit-theme";

/** Runs in `<head>` before first paint. `system` and anything unreadable
 *  set nothing, which is the media-query default. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_CHOICES.find((choice) => choice === stored) ?? "system";
  } catch {
    return "system";
  }
}

/** Told when the choice changes — here, or in another tab of this site. */
const CHANGED = "reachkit-theme-change";

export function subscribeThemeChoice(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage refused (private mode): the choice holds for this page only.
  }
  window.dispatchEvent(new Event(CHANGED));
}
