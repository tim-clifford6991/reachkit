// BUILD §2.2 — daisyUI `collapse`.
// src/ui/components/Collapse.tsx
//
// `components.md` §1, verbatim: "`collapse`. Summary text required.
// Server-rendered body, not a lazy fetch (REQ-009 c6 is readable without
// JavaScript)" | "collapsed · expanded".
//
// `summary` is required (BP-018 decision 2). Native `<details>`/`<summary>`
// is the carrier: `children` is always in the markup, never mounted only on
// expand, so the body is readable without JavaScript (REQ-009 c6) and is
// never a lazy fetch by construction — there is no fetch call this
// component could make even if a caller wanted one.
import type React from "react";

export function Collapse(p: {
  /** Required — no default summary text exists. */
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}): React.JSX.Element {
  return (
    <details className="collapse collapse-arrow bg-base-100 border-base-300 border" open={p.defaultOpen}>
      <summary className="collapse-title">{p.summary}</summary>
      <div className="collapse-content">{p.children}</div>
    </details>
  );
}
