// UI-SPEC S8 — what the root error screen draws (issues #372, #988).
//
// Everything `src/app/global-error.tsx` used to hold below its `<html>` and
// `<body>`, moved here whole and unchanged: the document's title, the one
// written line, the plain anchor home, the same test id.
//
// **The way out is the product's front door.** Every other mount offers a
// control that belongs to where the reader was — the scan field on a public
// address, the Overview inside the app — and this one cannot: it renders
// outside both groups, with no chrome, and it is reached when the root
// layout itself could not be rendered, so it must assume nothing about what
// still works. `chrome.back-to-reachkit` is a plain link to `/`, and a plain
// anchor because there may be no router.
//
// **Why it is a file of its own** (#988). `global-error` is a Client
// Component — Next's requirement — and it sits above both route groups, so
// Next loads it with *every* route in the product. Through `copy()` that
// put the whole merged copy registry, 39 kB over the wire, into the first
// download of every visitor to every screen, for a screen that renders only
// when the root layout itself has failed. `global-error.tsx` keeps the
// document it is required to carry and imports this one dynamically.
//
// `metadata` is not supported in an error boundary, so the document's title
// is React's own `<title>`, which Next's `error.md` recommends; React hoists
// it into `<head>` from wherever it is rendered.
"use client";

import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { ErrorScreen } from "@/app/_fallback/Fallback";

/** Owner-owed (12a): S8 draws no line for the error page. */
const LINE: CopyKey = "chrome.error.line";

/** The document's own title, which is the page's own heading — the same
 *  sentence, so the same key. */
const TITLE: CopyKey = "chrome.error.heading";

const HOME = "/";

const TEST_ID = "global-error";

export default function GlobalErrorBody(): React.JSX.Element {
  return (
    <>
      <title>{copy(TITLE)}</title>
      <ErrorScreen
        line={<p>{copy(LINE)}</p>}
        action={
          <a href={HOME} className="btn btn-ghost">
            {copy("chrome.back-to-reachkit")}
          </a>
        }
        testId={TEST_ID}
      />
    </>
  );
}
