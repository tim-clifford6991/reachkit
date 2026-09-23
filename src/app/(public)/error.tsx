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
// **This file is the boundary and nothing else** (#988). Next loads a
// route's error boundary with the page it guards, so what this module
// imports, every visitor downloads — and the screen it draws imports the
// `ErrorScreen` frame, the scan field and `copy()`'s whole merged registry.
// That is 39 kB of the 130 kB the landing page was over its script budget
// by, carried for a screen almost nobody is shown. The screen itself is
// `_fallback/PublicErrorBody.tsx`, one dynamic import away: its chunk is
// fetched when a page beneath this boundary has actually thrown.
//
// `fallback={null}` and not a waiting state: the import is one same-origin
// chunk, there is no box to hold open beneath the header, and a skeleton of
// an error screen would be a second thing to read on the way to the first.
"use client";

import type React from "react";
import { lazy, Suspense } from "react";

const PublicErrorBody = lazy(() => import("./_fallback/PublicErrorBody"));

export default function PublicError(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <PublicErrorBody />
    </Suspense>
  );
}
