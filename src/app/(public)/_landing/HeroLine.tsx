// BUILD §3 — the hero week's line, fetched when it is about to be read
// (#935 for the line, #988 for the when).
//
// **The line is the board's and does not change.** Round 11 `R11-H4-Week`
// draws the week rising to the `findable` boundary, and this still draws it
// with the Overview's own `GrowthLine` — Recharts, `ResponsiveContainer`
// (Recharts 3's `responsive`), the band boundary as its target. DESIGN rule
// 2 is untouched: no second chart library, no hand-rolled SVG.
//
// **What changed is when its code arrives.** Recharts carries
// `@reduxjs/toolkit`, `react-redux`, `immer`, `es-toolkit` and
// `victory-vendor`, and it reaches the landing page as 119 865 B of script —
// 36% of `/`, against a 200 kB budget whose floor (react-dom, the app-router
// runtime, the two React runtimes, Turbopack's) is already 131 kB. There is
// no arrangement of this page that loads Recharts in the first view and
// meets that budget, and #988 states the arithmetic.
//
// So the chart's chunk is fetched when the chart is about to enter the
// viewport, which on every real screen is at once: measured in the sweep's
// own 480px-tall window the line's box starts 580px down at 320 and 65px
// down at 1280, and a laptop is twice that tall. Nobody scrolls to a gap.
//
// **The box is held open before the chart is in it.** A daisyUI `skeleton`
// of exactly the aspect ratio `GrowthLine` draws at (300 × 80, Tailwind's
// own `aspect-[15/4]`), so the card is the same height throughout and the
// page's CLS stays at zero. Never a spinner.
//
// **It holds no copy key.** The label and the target's word arrive written,
// the convention `GrowthLine` itself states.
"use client";

import type React from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
// The module, not `@/ui/charts`: that barrel re-exports four `"use client"`
// chart modules and importing one of them through it pulls the client graph
// of all four into this chunk. The hero draws one line.
import type { GrowthTarget, GrowthWeek } from "@/ui/charts/GrowthLine";

const GrowthLine = lazy(async () => ({
  default: (await import("@/ui/charts/GrowthLine")).GrowthLine,
}));

/** The chart's own shape, held by the skeleton while the chunk is in
 *  flight — `GrowthLine` draws at `aspectRatio: 300 / 80`. */
const BOX = "w-full aspect-[15/4]";

export function HeroLine(p: {
  weeks: readonly [GrowthWeek, ...GrowthWeek[]];
  label: string;
  target: GrowthTarget;
}): React.JSX.Element {
  const [wanted, setWanted] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = box.current;
    // No observer (a browser too old to have one) is no reason to withhold
    // the chart: it is drawn straight away instead.
    if (node === null || typeof IntersectionObserver === "undefined") {
      setWanted(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setWanted(true);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={box} className={BOX}>
      {wanted ? (
        <Suspense fallback={<span className="skeleton block size-full" aria-hidden />}>
          <GrowthLine weeks={p.weeks} label={p.label} target={p.target} />
        </Suspense>
      ) : (
        <span className="skeleton block size-full" aria-hidden />
      )}
    </div>
  );
}
