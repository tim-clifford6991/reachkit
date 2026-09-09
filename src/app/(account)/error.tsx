// UI-SPEC S8 — the account error screen (issue #372).
// src/app/(account)/error.tsx
//
// "The error page is the same shape with one written line", inside the app.
// The control is the Overview, for `not-found.tsx`'s reason beside it: a
// signed-in customer whose screen failed is going back to one place, and it
// is not a scan field.
//
// **This boundary is above the app shell.** `error.js` wraps its own
// segment's children, so a throw anywhere under `(account)` — including
// inside `(account)/app/layout.tsx`, which is where the sidebar, the domain
// block and the publishing card are read — lands here with no shell around
// it. That is the honest rendering: the shell states the publishing state
// (REQ-040), and a shell that could not be read must not be drawn from
// nothing.
//
// **An error boundary is a Client Component** (Next's requirement). It
// takes no props: the thrown `error` is not ours to print, and a retry
// control is one S8 does not draw and no approved string names.
"use client";

import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { Btn } from "@/ui/components/Btn";
import { ErrorScreen } from "@/app/_fallback/Fallback";

/** Owner-owed (12a): S8 draws no line for the error page. */
const LINE: CopyKey = "chrome.error.line";

const OVERVIEW = "/app";

const TEST_ID = "account-error";

export default function AccountError(): React.JSX.Element {
  return (
    <ErrorScreen
      line={<p>{copy(LINE)}</p>}
      action={
        <Btn href={OVERVIEW} label={copy("chrome.back-to-overview")} variant="tertiary" pill />
      }
      testId={TEST_ID}
    />
  );
}
