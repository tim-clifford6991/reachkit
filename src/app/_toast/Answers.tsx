// SPEC §4 and §7 (2026-09-20, #908) — where the answers land.
//
// `sonner` keeps one stack per document, so this is mounted **once**, in
// the root layout, and nowhere else: a second one inside a route's own
// layout would draw a second stack and a toast raised from one screen
// would appear twice. It renders nothing at all until something is said.
//
// It is a mount and not a wrapper: it adds no markup and no styling of its
// own. What an answer looks like is decided entirely by the daisyUI
// `alert` classes `./say.tsx` draws inside it — a custom toast is
// `data-styled="false"` by `sonner`'s own rule, so nothing of the
// library's appearance reaches it. The two props below place the stack,
// and each of them is a layout fact rather than a taste.
import type React from "react";
import { Toaster } from "sonner";

/**
 * Where the bottom of the stack sits.
 *
 * Below `lg` the bottom menu is on screen, so the stack stands
 * 80px above the edge (the 68px dock and a 12px gap) — plus the device's
 * own safe area, because on a phone the menu itself sits above the home
 * indicator and an answer that ignored it would sit on the menu. From
 * `lg` up there is no menu and the stack keeps the 24px it has always had,
 * which is `sonner`'s own default and what this shipped with.
 *
 * Both are `!important` because they are overriding `sonner`'s own
 * stylesheet, which places the stack at `[data-sonner-toaster][data-y-
 * position=bottom]` — a two-selector rule a plain utility loses to.
 * Two static classes and not one computed string, because Tailwind only
 * emits a class it finds written out in source. The underscores are Tailwind's spelling of the
 * spaces `calc()` requires around its `+`.
 */
const BOTTOM = [
  "[bottom:calc(80px_+_env(safe-area-inset-bottom,0px))]!",
  "lg:bottom-6!",
].join(" ");

export function Answers(): React.JSX.Element {
  return (
    <Toaster
      className={BOTTOM}
      // Below 600px `sonner` gives the stack `width: 100%` *and* a left and
      // a right inset, which over-constrains the box: the width wins, and
      // the stack hangs its inset past the edge of the screen — 16px of
      // horizontal overflow on every route in the product, at the width
      // most customers read it at. Zeroed on both sides the stack is
      // exactly the screen wide and the answer reads as the full-width
      // note a phone wants.
      //
      // The bottom is `BOTTOM`'s, at every width, so there is one place
      // the stack's distance from the edge is decided; this member is the
      // value `sonner` would use if that class were ever removed, and the
      // desktop offsets are left alone entirely.
      mobileOffset={{ top: 0, right: 0, bottom: 16, left: 0 }}
    />
  );
}
