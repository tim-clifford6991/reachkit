// SPEC §4 and §7 (2026-09-20, #908) — where the answers land.
//
// `sonner` keeps one stack per document, so this is mounted **once**, in
// the root layout, and nowhere else: a second one inside a route's own
// layout would draw a second stack and a toast raised from one screen
// would appear twice. It renders nothing at all until something is said.
//
// It is a mount and not a wrapper: it adds no markup, no class and no
// styling of its own. What an answer looks like is decided entirely by the
// daisyUI `alert` classes `./say.tsx` draws inside it — a custom toast is
// `data-styled="false"` by `sonner`'s own rule, so nothing of the
// library's appearance reaches it.
//
// **The one prop is a layout fact, not a taste.** Below 600px `sonner`
// gives the stack `width: 100%` *and* a left and a right inset, which
// over-constrains the box: the width wins, and the stack hangs its inset
// past the edge of the screen — 16px of horizontal overflow on every route
// in the product, at the width most customers read it at. Zeroed on both
// sides the stack is exactly the screen wide and the answer reads as the
// full-width note a phone wants. The bottom inset stays, so it does not
// sit flush against the edge.
//
// Declared here rather than inline in the layout so that the one mount has
// one spelling: the no-overflow proof renders the same component, and a
// stack measured with different offsets from the one that ships would
// prove nothing.
import type React from "react";
import { Toaster } from "sonner";

export function Answers(): React.JSX.Element {
  return <Toaster mobileOffset={{ top: 0, right: 0, bottom: 16, left: 0 }} />;
}
