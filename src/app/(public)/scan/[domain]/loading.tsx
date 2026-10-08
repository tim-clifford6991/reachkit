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
// **It is the shape of the report's first screen** (SPEC §2, owner
// 2026-10-07, issue 1328): the score card, the two result cards and the
// offer, as daisyUI `skeleton` boxes on the report's own grid — one column
// on a phone, the two results side by side from medium. It was one written
// line. Boxes only: no words, each `aria-hidden`, and the region announces
// the wait once. The address may resolve to one of the six short arms
// instead; the report is the arm a shared address most often is.
//
// **It is a screen root, and declares its arms.** The route's seven arms
// each declare their own `Surface` in `_address/view.tsx` rather than
// sharing one from the page, so the fallback that stands in for them must
// bring its own or the document would have none (ADR-093 decision 6; the
// sweep asserts exactly one `[data-surface]` per document). The arms are
// the report's own.
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
import { SKELETON_EXIT, ViewTransition } from "@/ui/motion";

const ARMS = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "columns", count: 2 },
  wide: { kind: "same-as-below" },
} as const satisfies Record<Band, Arm>;

const TEST_ID = "report-waiting";

const CARD = "card bg-base-100 min-w-0 shadow-(--shadow-card)";

function Box(p: { className: string }): React.JSX.Element {
  return <div className={`skeleton ${p.className}`} aria-hidden />;
}

/** One result card: its name and source, its finding, its drawing, and
 *  the closed row its list opens from. */
function ResultCard(): React.JSX.Element {
  return (
    <div className={CARD}>
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Box className="h-4 w-28" />
          <Box className="h-6 w-32" />
        </div>
        <Box className="h-14 w-full" />
        <Box className="h-40 w-full" />
        <Box className="h-14 w-full" />
      </div>
    </div>
  );
}

export default function ReportLoading(): React.JSX.Element {
  return (
    <Surface arms={ARMS}>
      <main className="col-span-full grid grid-cols-subgrid">
        {/* The Suspense reveal (#1065): when the address resolves, the
            boxes leave and the page cross-fades to the arm that arrived. */}
        <ViewTransition {...SKELETON_EXIT}>
          <div
            className="col-span-full grid grid-cols-subgrid gap-y-5"
            role="status"
            aria-busy="true"
            data-waiting=""
            data-testid={TEST_ID}
          >
            {/* The score card: what it says on the left and the ring on the
                right; on a phone the ring comes first. */}
            <div className={`${CARD} col-span-full`}>
              <div className="card-body grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8">
                <div className="flex min-w-0 flex-col gap-4 max-md:order-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Box className="h-4 w-28" />
                    <Box className="h-9 w-56 max-w-full" />
                    <Box className="h-5 w-72 max-w-full" />
                  </div>
                  <Box className="h-7 w-full max-w-2xl" />
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <Box className="h-9 w-full" />
                    <Box className="h-9 w-full" />
                    <Box className="h-9 w-full" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2.5 max-md:order-1">
                  <Box className="size-40 rounded-full" />
                  <Box className="h-6 w-20" />
                  <Box className="h-4 w-32" />
                </div>
              </div>
            </div>

            <ResultCard />
            <ResultCard />

            {/* The offer: its heading and four terms beside the price and
                Start from `lg`, stacked below it. */}
            <div className={`${CARD} col-span-full`}>
              <div className="card-body gap-8 p-6 md:p-10 lg:flex-row lg:items-center lg:gap-12">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <Box className="h-9 w-80 max-w-full" />
                  <Box className="h-6 w-full" />
                  <Box className="h-6 w-full" />
                  <Box className="h-6 w-full" />
                  <Box className="h-6 w-full" />
                </div>
                <Box className="h-56 w-full shrink-0 lg:w-96" />
              </div>
            </div>
          </div>
        </ViewTransition>
      </main>
    </Surface>
  );
}
