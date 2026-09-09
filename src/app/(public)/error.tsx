// UI-SPEC S8 — the public error screen (issue #372).
// src/app/(public)/error.tsx
//
// "The error page is the same shape with one written line." Same shape,
// same chrome: this boundary wraps every `(public)` page and the nested
// layouts under it, but not `(public)/layout.tsx` itself (Next's own rule
// for `error.js`), so the header and the footer stay on the screen when a
// page beneath them throws — which is the difference between a failed page
// and a lost visitor.
//
// **An error boundary is a Client Component**, and that is Next's
// requirement rather than this screen's: nothing here is interactive except
// the field, which is a client leaf in its own right.
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
import { ScanForm } from "./_landing/ScanForm";

/** Owner-owed (12a): S8 draws no line for the error page, so this renders
 *  the `TODO(copy)` marker until the owner writes it. */
const LINE: CopyKey = "chrome.error.line";

const TEST_ID = "public-error";

export default function PublicError(): React.JSX.Element {
  return (
    <ErrorScreen
      line={<p>{copy(LINE)}</p>}
      action={<ScanForm submitLabel={copy("chrome.notfound.cta")} />}
      testId={TEST_ID}
    />
  );
}
