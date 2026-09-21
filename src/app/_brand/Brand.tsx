// The product's mark, in one place.
// src/app/_brand/Brand.tsx — issue #936
//
// The public header, the public footer, the app shell's sidebar and the
// app shell's phone bar all drew the same mark, each from its own copy of
// the same eleven-class span. This is that markup, written once.
//
// **It is one file because the mark is still being chosen.** The owner's
// logo round (`R7-L1`, `R8-*`, `R9-*` on the 2026-09-20 canvas) has not
// been decided, so what this draws today is deliberately unchanged — the
// lucide `TrendingUp` in a `--primary` tile beside the wordmark, exactly
// as the app shell has drawn it. What changes is that swapping it is one
// edit here rather than four edits that have to be found first.
//
// It lives outside the three route groups because it belongs to all of
// them. A `_`-prefixed directory is private to the router (Next's own
// convention), so nothing here is a route — the same footing
// `src/app/_fallback/` and `src/app/_theme/` already stand on.
//
// daisyUI in the route (DESIGN rule 1) and lucide at stroke 1.75: this is
// not a wrapper around either, and it takes no variant, tone or size prop.
// A mark that can be drawn four ways is four marks.
import type React from "react";
import { TrendingUp } from "lucide-react";
import { copy } from "@/lib/presentation/copy";

/**
 * The mark and the wordmark, as a link home.
 *
 * `href` is the caller's because home is not the same address on both
 * sides of the session: the public frame goes to `/`, the app shell to
 * `/app`. Nothing else varies.
 *
 * A plain `<a>` and not `next/link`: the app shell has always used one
 * here (a full load is wanted when leaving the shell), and the public
 * header's own use is a same-page anchor on the landing. One element, no
 * per-caller branch.
 */
export function Brand(p: { href: string; testId?: string }): React.JSX.Element {
  return (
    <a
      href={p.href}
      className="flex min-w-0 items-center gap-2 text-lg font-extrabold tracking-tight"
      data-testid={p.testId}
    >
      <BrandMark />
      <span className="truncate">{copy("chrome.wordmark")}</span>
    </a>
  );
}

/**
 * The mark alone, with no wordmark beside it and no link around it.
 *
 * Two places need it: the app shell's 72px icon rail, which has no room
 * for the word, and the sign-in card, which states the brand without
 * offering it as a way off the screen. Both drew their own copy of the
 * tile before #936 — which is three copies of the glyph the owner is
 * about to replace, in a product whose whole reason for this file is that
 * there should be one.
 *
 * `size` is the tile's, in Tailwind's own scale: the rail draws it one
 * step up. It is not a variant system — there are two sizes because there
 * are two rooms, and a third caller should ask whether it wants `Brand`.
 */
export function BrandMark(p: { size?: "md" | "lg" } = {}): React.JSX.Element {
  const lg = p.size === "lg";
  return (
    <span
      className={`rounded-field bg-primary text-primary-content grid shrink-0 place-items-center ${lg ? "size-9" : "size-7"}`}
      aria-hidden
    >
      <TrendingUp size={lg ? 18 : 16} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
