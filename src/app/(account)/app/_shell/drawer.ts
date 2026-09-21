// SPEC §4 (2026-09-20, #908) — "One button collapses it to an icon rail;
// below the large breakpoint it is a drawer."
//
// Both are the one daisyUI `drawer` toggle, and **nothing here opens or
// closes it**: the checkbox is what the `<label>` buttons drive and what
// daisyUI's `is-drawer-open:` / `is-drawer-close:` variants read, so the
// panel collapses, expands and opens with the page's JavaScript switched
// off entirely.
//
// What the one line of script below does is *remember* the choice — the
// issue's own words, "no script; remember the choice per browser". It is
// the same shape as the theme's before-paint script (`_theme/theme.ts`,
// #681): read this browser's `localStorage`, set the DOM state before the
// first paint, and record it again when it changes. It carries the
// request's CSP nonce, like that one.
//
// **It only ever applies at the large breakpoint**, and that is the whole
// subtlety. One checked box means two different things either side of
// `lg`: at `lg` the side is always on screen (`lg:drawer-open`) and checked
// means *collapsed to the rail*; below `lg` checked means *the drawer is
// open over the screen*. A remembered "collapsed" restored on a phone would
// therefore be a menu covering the screen on every load, so the restore is
// guarded by the same media query the layout is, and leaving the large band
// clears the box rather than leaving it to mean the other thing.

/** The one drawer toggle in an `/app` document. A constant because three
 *  files name it — the input, the top bar's button and the panel's own two
 *  buttons — and a typo in any of them is a control that does nothing. */
export const DRAWER_TOGGLE_ID = "app-drawer";

/** Where this browser keeps the choice. No account field: it is a choice
 *  about this screen, like the theme. */
export const RAIL_STORAGE_KEY = "reachkit-rail";

/** `--breakpoint-lg`. Spelled in `rem`, as Tailwind spells it, so a reader
 *  who has enlarged their default font crosses this line at the same place
 *  the stylesheet does. */
export const RAIL_MEDIA_QUERY = "(min-width: 64rem)";

export const RAIL_SCRIPT = `(function(){try{
var i=document.getElementById(${JSON.stringify(DRAWER_TOGGLE_ID)});
if(!i)return;
var m=window.matchMedia(${JSON.stringify(RAIL_MEDIA_QUERY)});
var K=${JSON.stringify(RAIL_STORAGE_KEY)};
var read=function(){try{return localStorage.getItem(K)==="1"}catch(e){return false}};
var apply=function(){i.checked=m.matches&&read()};
apply();
i.addEventListener("change",function(){if(m.matches){try{localStorage.setItem(K,i.checked?"1":"0")}catch(e){}}});
m.addEventListener("change",apply);
}catch(e){}})()`;
