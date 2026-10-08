// SPEC §4 (2026-10-08, issue 1339) — below the large breakpoint the top bar
// sticks to the top of the viewport, and Overview's and Settings' tab bars
// stick directly under it.
//
// "Directly under" needs the bar's height in two places, so the bar is one
// fixed height and both classes are spelled here, side by side: change one
// and the other is on the next line. `rem`, so enlarged text moves the bar
// and what sticks under it together.
//
// No copy key and no component: the tab bars are client components, and a
// module that reached `copy()` would put the registry in their bundle.

/** The sticky bar: 4.5rem, above the page and above what sticks under it. */
export const TOP_BAR = "sticky top-0 z-20 h-18 lg:hidden";

/** A tab bar under it. It takes the page's ground so the screen scrolls
 *  behind it rather than through it. From `lg` the panel is the navigation
 *  and the content is its own scroller, so nothing sticks there. */
export const UNDER_TOP_BAR = "sticky top-18 z-10 bg-(--bg) lg:static lg:z-auto lg:bg-transparent";
