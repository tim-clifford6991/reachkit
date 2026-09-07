// BUILD §2.2 — daisyUI `tabs`.
// src/ui/components/Tabs.tsx
//
// `components.md` §1, verbatim: "`tabs`, boxed + bordered. Every tab label
// required" | "default · selected".
//
// Each tab's `label` is a required field of its own array entry, so a tab
// with no label cannot be constructed. `selectedId` is required (no default
// selection is invented by this component).
//
// 2026-09-06, issue #12: the boxed half was written `tabs-boxed`, which is
// daisyUI 4's spelling. daisyUI 5 renamed it `tabs-box`, ships no rule for
// the old name, and so the bar had been bordered only since it was
// written — the same failure mode as the 2026-09-05 ruling under #93
// ("until #93 no utility or daisyUI class had ever applied"): a class the
// stylesheet does not define styles nothing and says nothing about it.
// `tests/ui/design/component-registry.test.ts` reads the installed
// daisyUI's own selectors, so a fourth-major spelling cannot come back.
"use client";

import type React from "react";

export interface TabItem {
  id: string;
  /** Required — no default tab wording exists. */
  label: string;
}

export function Tabs(p: {
  tabs: TabItem[];
  selectedId: string;
  onSelect?: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="tabs tabs-box tabs-border" role="tablist">
      {p.tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={`tab${tab.id === p.selectedId ? " tab-active" : ""}`}
          aria-selected={tab.id === p.selectedId}
          onClick={() => p.onSelect?.(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
