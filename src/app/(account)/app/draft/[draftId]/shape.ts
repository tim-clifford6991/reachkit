// SPEC §7 *A page's screen* — where its regions stand, spelled once so the screen and its waiting state cannot differ.
//
// The head, the rail, then the tabs, in that order in the document, which is the order a phone draws them in. From
// `lg` the screen fits the viewport as This Week's does: the head and the tabs make one column of about two thirds,
// the rail the other, and only the tab's panel scrolls.
import { PLAN } from "../../calendar/frame";

export const SHAPE = Object.freeze({
  // Below `md` the controls are a bar at the foot, so the last line is not under it.
  screen: `${PLAN} max-md:pb-32`,
  grid: "grid min-w-0 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]",
  head: "flex min-w-0 flex-col gap-2 lg:col-start-1 lg:row-start-1",
  rail: "card card-border bg-base-100 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start",
  tabs: "card card-border bg-base-100 min-w-0 lg:col-start-1 lg:row-start-2 lg:min-h-0",
  // Back to This week is a link, not a button, at a 44px target.
  back: "link link-primary link-hover inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold no-underline",
  // One set of controls: in the rail from `md`, fixed above the shell's dock below it, at the dock's own height.
  foot: "flex min-w-0 flex-col gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:z-[2] max-md:border-t max-md:border-base-300 max-md:bg-base-100 max-md:px-4 max-md:py-2",
});
