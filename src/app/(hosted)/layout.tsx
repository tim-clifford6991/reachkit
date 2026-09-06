// BUILD §9 — the hosted edge's shell.
//
// §9: published pages "render through **one** clean typographic template
// (the §2 design system, light-only is acceptable), customisable later —
// never per-customer templates in MVP." This is that template's outer
// frame: a measure, a rhythm, and nothing else.
//
// **It speaks no sentence.** There is no heading, no navigation, no
// footer, no link and no ReachKit name anywhere on this surface — every
// response it wraps is served on a domain that is not ours, and the one
// thing a stranger's domain must never carry is the operator's branding.
// That is also why it reads no copy key: there is no string here to read
// one for. The page body is the customer's own content, and it is the one
// place in the product generated prose is rendered (REQ-093 c2).
//
// **No client JavaScript.** No `"use client"` here or anywhere in this
// group's module graph: the whole document is in the HTML at first byte,
// which is the property REQ-062 c1's crawler check exists to verify in the
// world.
//
// Tokens and type come from the root layout (`src/ui/theme.css`,
// `type.css`, `tailwind.css`, `layout/layout.css`); this file introduces no
// stylesheet — §2.2 allows custom CSS for five surfaces and a published
// page is none of them — and no colour or size of its own.
//
// The archived plan is WO-230.
import type React from "react";

export default function HostedLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="bg-base-100 text-base-content min-h-screen">{children}</div>;
}
