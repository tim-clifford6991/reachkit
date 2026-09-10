// UI-SPEC §4 rule 3 — the report address, while the server is still reading.
// src/app/(public)/scan/[domain]/loading.tsx
//
// `/scan/{domain}` resolves an address before it can draw anything: it
// reads the stored report, the scan in flight, the cooldown and the removal
// list (`_address/resolve.ts`), and until that read returns the visitor has
// a blank document. This is the Suspense fallback Next mounts in its place
// (`loading.md`: "an instant loading state from the server while the
// content of a route segment streams in").
//
// It renders inside `(public)/layout.tsx`, so ruling 3a's header and footer
// are already around it and this file adds none of its own — the same
// arrangement `not-found.tsx` beside it relies on.
//
// **It is a screen root, and declares its arms.** The route's seven arms
// each declare their own `Surface` in `_address/view.tsx` rather than
// sharing one from the page, so the fallback that stands in for them must
// bring its own or the document would have none (ADR-093 decision 6; the
// sweep asserts exactly one `[data-surface]` per document). One column at
// every band: the screen is one written line, and there is nothing to put
// beside it.
//
// **What this costs, stated rather than discovered.** A `loading.tsx`
// makes the response stream, and a streamed response has already sent its
// headers — "the status code of the response cannot be updated"
// (`loading.md`, "Status Codes"). Nothing on this route sets one: the two
// statuses it owes are set before the page is ever entered — a removed
// domain's `410` is `src/middleware.ts`'s rewrite to a route handler
// (issue #104, because a `page.tsx` cannot set a status), and the canonical
// `308` is a `permanentRedirect` that runs before the first `await`. So the
// stream costs this route no status it was setting.
//
// A Server Component: it reads no session, no cookie and no store.
import type React from "react";
import { Surface } from "@/ui/layout";
import type { Arm, Band } from "@/ui/layout";
import { WaitingScreen } from "@/app/_fallback/Waiting";

const ARMS = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "same-as-below" },
  wide: { kind: "same-as-below" },
} as const satisfies Record<Band, Arm>;

const TEST_ID = "report-waiting";

export default function ReportLoading(): React.JSX.Element {
  return (
    <Surface arms={ARMS}>
      <main>
        <WaitingScreen testId={TEST_ID} />
      </main>
    </Surface>
  );
}
