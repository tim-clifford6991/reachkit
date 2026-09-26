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
// **One line of head, and it is the visitor's own host** (owner ruling
// 2026-09-22, #980). A response on this surface that states no title of its
// own — the 404 for a host with nothing published, and the empty index
// behind it — had no `<title>` at all, which axe reports as a serious
// `document-title` finding. The title is the host the request arrived on,
// exactly as it was sent: `content.example.com`. It is not copy, it is not
// a name of ours, and it is not in any language — it is the address the
// visitor typed, which is the one string on this surface that is already
// theirs. Option A of the three the ruling weighed; "Not found" in a
// visitor's language would be product copy on a customer's domain, which
// WO-028 forbids.
//
// It is a *fallback*, not a title this layout imposes: a published page
// returns its own from `generateMetadata` and that one wins, which is the
// property `tests/hosted/indexing/head.test.tsx` has held since #697.
//
// The archived plan is WO-230.
import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { normaliseHost } from "./resolve-host";

// **No icon of ours** (#1121). The favicon set sits at the root of
// `src/app/` so every ReachKit route names it, and Next hands a root icon
// to every layout beneath — this one included. Next adds the file icons
// only when no segment set `icons` itself (`accumulateMetadata` in
// `next/dist/lib/metadata/resolve-metadata.js`), so an empty list here
// means a customer's page names no ReachKit mark.
const NO_ICONS: Metadata["icons"] = [];

export async function generateMetadata(): Promise<Metadata> {
  const host = normaliseHost((await headers()).get("host") ?? "");
  // A request with no `Host` at all states no title rather than an empty
  // one — there is nothing of the visitor's to put there.
  return host === "" ? { icons: NO_ICONS } : { title: host, icons: NO_ICONS };
}

export default function HostedLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="bg-base-100 text-base-content min-h-screen">{children}</div>;
}
