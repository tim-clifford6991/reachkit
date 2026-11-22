// SPEC §7 *A page's screen* — the page's notes as daisyUI tabs above the article (WAI-ARIA tabs: arrows, Home and
// End move; the tab is in `?tab=`, so a link or Back opens the same one). Every panel stays in the document so each
// tab's `aria-controls` names a real element; only the chosen one is shown.
"use client";

import type React from "react";
import { useRef } from "react";
import { parseAsString, useQueryState } from "nuqs";

export interface PageTab {
  id: string;
  label: string;
  /** The tab's accessible name where its label is a count. */
  name?: string;
  panel: React.ReactNode;
}

// The bars above and below the scroller never cover what takes the focus (WCAG 2.4.11).
const CLEAR = "scroll-mt-20 max-md:scroll-mb-52";

export function PageTabs(p: { label: string; tabs: readonly PageTab[] }): React.JSX.Element {
  const [asked, setAsked] = useQueryState("tab", parseAsString.withOptions({ history: "replace", scroll: false }));
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const at = Math.max(0, p.tabs.findIndex((tab) => tab.id === asked));
  const on = p.tabs[at]?.id;

  function pick(index: number): void {
    const id = p.tabs[index]!.id;
    void setAsked(index === 0 ? null : id);
    tabs.current[id]?.focus();
  }

  function move(event: React.KeyboardEvent<HTMLDivElement>): void {
    const last = p.tabs.length - 1;
    const to = { ArrowRight: at === last ? 0 : at + 1, ArrowLeft: at === 0 ? last : at - 1, Home: 0, End: last }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    pick(to);
  }

  return (
    <>
      <div role="tablist" aria-label={p.label} className="tabs tabs-border min-w-0 shrink-0 flex-wrap border-b border-base-300 px-2" onKeyDown={move}>
        {p.tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(button) => {
              tabs.current[tab.id] = button;
            }}
            id={`draft-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === on}
            aria-controls={`draft-panel-${tab.id}`}
            aria-label={tab.name}
            tabIndex={tab.id === on ? 0 : -1}
            className={`tab min-h-11 ${CLEAR} ${tab.id === on ? "tab-active" : ""}`}
            onClick={() => pick(index)}
            data-testid={`draft-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {p.tabs.map((tab) => (
        <div
          key={tab.id}
          id={`draft-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`draft-tab-${tab.id}`}
          tabIndex={0}
          className={tab.id === on ? `flex min-w-0 flex-col gap-4 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto max-md:[&_*]:scroll-mb-52 ${CLEAR}` : "hidden"}
        >
          {tab.panel}
        </div>
      ))}
    </>
  );
}
