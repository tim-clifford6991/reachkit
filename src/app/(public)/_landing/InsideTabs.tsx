"use client";
// SPEC §1 2026-09-24 (#1067) — the *Inside ReachKit* preview's four tabs.
// src/app/(public)/_landing/InsideTabs.tsx
//
// The panels are server-rendered and arrive as props; this leaf only picks
// which one shows. It moves to the next tab every five seconds with a
// progress line under the current one, and stops for good once someone
// picks a tab. Under `prefers-reduced-motion` it never turns and draws no
// line (DESIGN, the calm layer: nothing moves, the final state is drawn),
// and the server renders it that way too, so the first paint is the still
// one.
//
// Every panel sits in the same grid cell, so the card is as tall as its
// tallest panel and does not jump as it turns; the ones not shown are
// `invisible`, which also takes them out of the accessibility tree.
// `PanelShown` tells a panel's own client leaf (`HeroLine`) whether it is
// on screen, so the score's chart code is fetched only once that tab is.

import type React from "react";
import { createContext, useEffect, useId, useState, useSyncExternalStore } from "react";

/** Whether the panel this leaf sits in is the one on screen. */
export const PanelShown = createContext(true);

const ROTATE_MS = 5_000;
const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export interface InsideTab {
  readonly label: string;
  readonly panel: React.ReactNode;
}

export function InsideTabs(p: {
  /** The card's name, drawn beside the tabs and naming the tab list. */
  title: string;
  tabs: readonly InsideTab[];
}): React.JSX.Element {
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => true
  );
  const rotating = !picked && !reduced;
  const id = useId();
  const count = p.tabs.length;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setActive((at) => (at + 1) % count), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, active, count]);

  function pick(index: number): void {
    setPicked(true);
    setActive(index);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (active + step + count) % count;
    pick(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-primary text-xs font-semibold">{p.title}</p>
        <div role="tablist" aria-label={p.title} className="tabs tabs-box tabs-sm" onKeyDown={onKeyDown}>
        {p.tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === active ? 0 : -1}
            className={`tab relative ${index === active ? "tab-active" : ""}`}
            onClick={() => pick(index)}
          >
            {tab.label}
            {rotating && index === active ? (
              <span
                key={active}
                aria-hidden
                className="bg-primary absolute inset-x-3 bottom-0.5 h-0.5 origin-left rounded-full transition-transform duration-[5000ms] ease-linear starting:scale-x-0"
              />
            ) : null}
          </button>
        ))}
        </div>
      </div>
      <div className="grid min-w-0 *:[grid-area:1/1]">
        {p.tabs.map((tab, index) => (
          <div
            key={tab.label}
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            className={`min-w-0 ${index === active ? "" : "invisible"}`}
          >
            <PanelShown.Provider value={index === active}>{tab.panel}</PanelShown.Provider>
          </div>
        ))}
      </div>
    </>
  );
}
