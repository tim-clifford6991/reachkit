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
// here. They are stylesheets, so they cost a visitor no script at all.
//
// **The document is all this file holds** (#988). An error boundary is a
// Client Component (Next's requirement), and this one sits above both route
// groups, so Next loads it with every route in the product — which through
// `copy()` shipped the whole merged copy registry, 39 kB, to every visitor
// of every screen, for a screen that draws only when the root layout has
// failed. What it draws is `_fallback/GlobalErrorBody.tsx`, one dynamic
// import away.
//
// `fallback={null}`: there is nothing above this to hold a box open, the
// import is one same-origin chunk, and a skeleton of an error screen would
// be a second thing to read on the way to the first.
"use client";

import type React from "react";
import { lazy, Suspense } from "react";

import "@/ui/theme.css";
import "@/ui/tailwind.css";
import "@/ui/type.css";
import "@/ui/layout/layout.css";
import "@/ui/layout/surface.css";
import "@/ui/idiom/idiom.css";
import { fontVariables } from "@/ui/fonts";

const GlobalErrorBody = lazy(() => import("@/app/_fallback/GlobalErrorBody"));

export default function GlobalError(): React.JSX.Element {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <Suspense fallback={null}>
          <GlobalErrorBody />
        </Suspense>
      </body>
    </html>
  );
}
