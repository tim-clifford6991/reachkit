// SPEC §1 2026-09-24 (#1066) — the banner's dismissal, remembered.
// src/app/(public)/_chrome/banner.ts
//
// Kept in this browser's `localStorage`, in try/catch, and applied before
// the first paint the way the theme is (`_theme/theme.ts`): the root
// layout's head script sets `data-banner="off"` on `<html>`, and the banner
// hides itself under that attribute. A dismissed banner is therefore never
// drawn and then pulled away, and the server renders the same markup for
// everyone.

export const BANNER_STORAGE_KEY = "reachkit-banner";
export const BANNER_OFF = "off";

/** Runs in `<head>` before first paint, beside `THEME_SCRIPT`. */
export const BANNER_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  BANNER_STORAGE_KEY,
)})===${JSON.stringify(BANNER_OFF)})document.documentElement.setAttribute("data-banner",${JSON.stringify(BANNER_OFF)})}catch(e){}})()`;

/** Hides the banner now and on every later visit from this browser. */
export function dismissBanner(): void {
  document.documentElement.setAttribute("data-banner", BANNER_OFF);
  try {
    window.localStorage.setItem(BANNER_STORAGE_KEY, BANNER_OFF);
  } catch {
    // Storage refused (private mode): dismissed for this page only.
  }
}
