// UI-SPEC S8 — the error screen for a root layout that itself failed.
// src/app/global-error.tsx
//
// The fifth mount of S8's shape, and the only one Next allows to exist:
// `global-error` is a **root-only** convention (`error.md`, "Global Error":
// "located in the root app directory"), so it is written once here and
// covers both route groups rather than once per group, where the framework
// would never reach it.
//
// **It replaces the root layout, so it carries the root layout's document.**
// `<html>` and `<body>` are required of this file, and with the layout gone
// so are its stylesheets and its font class — a `global-error` that
// imported neither would render the product's one written line in the
// browser's default face on a white ground, in a product where the theme is
// three blocks of `src/ui/theme.css` and every numeral is JetBrains Mono.
// The six imports below are `src/app/layout.tsx`'s own, in its order and
// for its reasons; `shell.css` is not among them, because no shell is drawn
// here.
//
// **The way out is the product's front door.** Every other mount offers a
// control that belongs to where the reader was — the scan field on a public
// address, the Overview inside the app — and this one cannot: it renders
// outside both groups, with no chrome, and it is reached when the root
// layout itself could not be rendered, so it must assume nothing about what
// still works. `chrome.back-to-reachkit` is a plain link to `/`.
//
// An error boundary is a Client Component (Next's requirement), and
// `metadata` is not supported in one — the document's title is React's own
// `<title>`, which the same note in `error.md` recommends.
"use client";

import type React from "react";

import "@/ui/theme.css";
import "@/ui/tailwind.css";
import "@/ui/type.css";
import "@/ui/layout/layout.css";
import "@/ui/layout/surface.css";
import "@/ui/idiom/idiom.css";
import { fontVariables } from "@/ui/fonts";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { Btn } from "@/ui/components/Btn";
import { ErrorScreen } from "@/app/_fallback/Fallback";

/** Owner-owed (12a): S8 draws no line for the error page. */
const LINE: CopyKey = "chrome.error.line";

/** The document's own title, which is the page's own heading — the same
 *  sentence, so the same key. */
const TITLE: CopyKey = "chrome.error.heading";

const HOME = "/";

const TEST_ID = "global-error";

export default function GlobalError(): React.JSX.Element {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <title>{copy(TITLE)}</title>
        <ErrorScreen
          line={<p>{copy(LINE)}</p>}
          action={
            <Btn href={HOME} label={copy("chrome.back-to-reachkit")} variant="tertiary" pill />
          }
          testId={TEST_ID}
        />
      </body>
    </html>
  );
}
