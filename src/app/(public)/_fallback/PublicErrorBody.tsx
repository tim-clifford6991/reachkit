// UI-SPEC S8 — what the public error screen draws (issue #372, #988).
//
// Everything `(public)/error.tsx` used to hold, moved here whole and
// unchanged: the same one written line, the same scan field, the same test
// id. What changed is *when it is downloaded*.
//
// **An error boundary is a Client Component** — Next's requirement, not this
// screen's — and Next loads a route's error boundary eagerly, with the page
// it guards. So every stranger who successfully read the landing page was
// downloading this screen, and through it the `ErrorScreen` frame, the scan
// field and `copy()`'s whole merged registry: the largest of #988's own
// rows, carried for a screen almost nobody is shown. `error.tsx` is now the
// boundary and nothing else, and imports this file dynamically — so the code
// arrives when a page beneath the boundary has actually thrown.
//
// It stays a Client Component, because it is rendered from one: a dynamic
// import does not cross back to the server.
//
// **It takes no props, and adds no control.** Next hands an error boundary
// the thrown `error` and a `retry`; neither is drawn. The message is not
// ours to print — Next redacts a Server Component's message in production
// on purpose — and a "try again" control is one S8 does not draw and no
// approved string names. What the screen offers instead is the way forward
// it can keep: the scan field, which is what a public visitor came for.
"use client";

import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { ErrorScreen } from "@/app/_fallback/Fallback";
import { ScanForm } from "../_landing/ScanForm";
import { scanFormWords } from "../_landing/scan-form-words";

/** Owner-owed (12a): S8 draws no line for the error page, so this renders
 *  the `TODO(copy)` marker until the owner writes it. */
const LINE: CopyKey = "chrome.error.line";

const TEST_ID = "public-error";

export default function PublicErrorBody(): React.JSX.Element {
  return (
    <ErrorScreen
      line={<p>{copy(LINE)}</p>}
      action={<ScanForm words={scanFormWords(copy("chrome.notfound.cta"))} />}
      testId={TEST_ID}
    />
  );
}
