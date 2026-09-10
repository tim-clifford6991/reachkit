// UI-SPEC §4 rule 3 — the app's screens, while their reads are in flight.
// src/app/(account)/app/loading.tsx
//
// **One boundary, and it covers the three addresses issue #327 names.**
// `loading.js` "will automatically wrap the `page.js` file and any children
// below in a `<Suspense>` boundary" (`loading.md`), so this one file is the
// fallback for `/app`, `/app/calendar`, `/app/settings` — and the draft
// view under them, which awaits a read of its own on the same terms. Three
// more copies of one written line would be three places to change it and no
// second behaviour: a sibling navigation suspends at the nearest boundary
// above the segment that changed, which is this one whichever of them the
// customer is going to.
//
// Every one of those screens awaits the database before it can draw:
// `readOverview`, `readMonth`, `readSettings` and `readDraft` are all
// server reads on the render path, each bounded (issue #186) and none of
// them instant.
//
// **The shell stays on the screen.** This file sits under
// `(account)/app/layout.tsx`, and `loading.js` is nested *inside* the
// layout of its own segment — so the sidebar, the domain block and the
// publishing card are drawn and stay drawn while the content well waits,
// which is the difference between a screen that is loading and a screen
// that is gone. It follows that this file declares no `Surface` (the
// shell's layout owns the route's screen root, issue #83) and no `<main>`
// (the shell already renders one, and `<main>` does not nest).
//
// **What it does not cover, and why that is Next's rule rather than a
// choice:** the shell's own read. "If the layout accesses uncached or
// runtime data … `loading.js` will not show a fallback for it … Navigation
// blocks until the layout finishes rendering" (`loading.md`). The shell
// reads a session and a request header, so a *cold* arrival at `/app` waits
// on the shell with nothing drawn, exactly as it does today; what this
// boundary buys is every navigation after it, where the shell is already
// rendered and only the well below it is waiting.
//
// A Server Component: it reads nothing at all.
import type React from "react";
import { WaitingScreen } from "@/app/_fallback/Waiting";

const TEST_ID = "app-waiting";

export default function AppLoading(): React.JSX.Element {
  return <WaitingScreen testId={TEST_ID} />;
}
