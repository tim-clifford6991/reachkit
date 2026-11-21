// SPEC §4 *Overview's four tiles* — a tile's trend, drawn from `md` up only. Below `md` the
// client unmounts it, so no chart waits unseen at no size.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { GrowthLine, type GrowthWeek } from "@/ui/charts/GrowthLine";
import { PresenceBars, type PresenceBar } from "@/ui/charts/PresenceBars";

/** Tailwind's `md`, as `hidden md:block` reads it. */
const MD = "(min-width: 48rem)";
const subscribe = (change: () => void): (() => void) => {
  const query = window.matchMedia(MD);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};
// The server draws it (the page's own HTML holds the trend); the client drops it below `md` once it knows the width.
const useAtLeastMd = (): boolean => useSyncExternalStore(subscribe, () => window.matchMedia(MD).matches, () => true);

/** One bar's label line (20px), its gap (4px) and its bar (10px), with 12px between rows: `PresenceBars`' own sizes. */
const barsHeight = (rows: number): number => rows * 34 + (rows - 1) * 12;

export function TileTrend(
  p: { weeks: readonly [GrowthWeek, ...GrowthWeek[]] } | { you: PresenceBar; rivals: readonly PresenceBar[]; measured: number; label: string }
): React.JSX.Element {
  const shown = useAtLeastMd();
  if ("weeks" in p) {
    return <span className="hidden h-9 md:block">{shown ? <GrowthLine weeks={p.weeks} compact /> : null}</span>;
  }
  return (
    <span className="hidden md:block" style={{ height: barsHeight(p.rivals.length + 1) }} aria-hidden>
      {shown ? <PresenceBars you={p.you} rivals={p.rivals} measured={p.measured} label={p.label} decorative /> : null}
    </span>
  );
}
