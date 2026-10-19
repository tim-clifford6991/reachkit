// BUILD §9 — the unknown-or-unmapped-Host response.
//
// The archived plan (WO-028) states the whole of it: "HTTP 404, and **never
// a ReachKit page** — no ReachKit name, no ReachKit link, no ReachKit
// navigation, nothing that identifies the operator of a stranger's domain.
// Renders BP-018's tokens only, no copy from the product's own registry."
//
// **It renders no text at all**, and that is the whole of it. A 404 served
// on a domain that is not ours has no voice of ours to speak in, so there
// is no sentence here and no copy key to read — which is also why this file
// is not a gap in the registry. A word of ours would have to come from
// somewhere: from the registry, which WO-028 forbids on this surface, or
// from a literal, which REQ-093 c1's sweep forbids anywhere. The status is
// the message, and the browser already has it.
//
// It is also what `resolveHost` returns for a `content.` label on a domain
// no `sites` row claims: never another customer's page, never a fallback to
// the only site there is, and never an error screen carrying our brand.
//
// A screen root, so it declares its own three band arms (ADR-093); one
// column at every band, because an empty document is one column at any
// width.
import type React from "react";
import { Surface } from "@/ui/layout";

export default function HostedNotFound(): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto max-w-2xl px-5 py-16" />
    </Surface>
  );
}
