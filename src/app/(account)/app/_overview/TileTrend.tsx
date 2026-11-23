// SPEC §4 *Overview's four tiles* — a tile's trend, drawn from `md` up only. Below `md` the
// client unmounts it, so no chart waits unseen at no size.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { GrowthLine, type GrowthWeek } from "@/ui/charts/GrowthLine";

/** Tailwind's `md`, as `hidden md:block` reads it. */
const MD = "(min-width: 48rem)";
const subscribe = (change: () => void): (() => void) => {
  const query = window.matchMedia(MD);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};
// The server draws it (the page's own HTML holds the trend); the client drops it below `md` once it knows the width.
const useAtLeastMd = (): boolean => useSyncExternalStore(subscribe, () => window.matchMedia(MD).matches, () => true);

export function TileTrend(p: { weeks: readonly [GrowthWeek, ...GrowthWeek[]] }): React.JSX.Element {
  const shown = useAtLeastMd();
  return <span className="hidden h-9 md:block">{shown ? <GrowthLine weeks={p.weeks} compact /> : null}</span>;
}
