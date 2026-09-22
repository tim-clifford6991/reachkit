// tests/app/shell/settled.ts — the shell, rendered to the end.
//
// **Why a helper rather than `renderToStaticMarkup`.** Since issue 912 the
// `/app` layout returns its frame before its reads answer: the top bar, the
// domain block, the *Waiting for you* card, the onboarding line, the
// shortcuts and the publishing card are each a child of a `<Suspense>`
// boundary, so a synchronous render sees their skeletons and stops.
//
// Every test that reaches for one of those parts wants the **settled**
// screen — what the customer ends up looking at — and that is a stream read
// to completion. `allReady` is React's own name for it.
//
// What arrives *first* is a different question and has its own file
// (`first-response.test.tsx`), which is the only place that reads a stream
// before it settles.
import { renderToReadableStream } from "react-dom/server";
import type React from "react";

/** The whole document for a tree, once every boundary has resolved. */
export async function settledMarkup(tree: React.ReactNode): Promise<string> {
  const stream = await renderToReadableStream(tree, {
    // **A boundary that cannot render keeps its fallback, and that is the
    // behaviour these tests already had.** `renderToStaticMarkup` never
    // executes an async Suspense child at all — it draws the fallback and
    // stops — so a page whose inner component needs a framework adapter
    // this process does not install (a `nuqs` hook, say) was simply never
    // reached. Streaming does reach it; React reports the failure here and
    // leaves the fallback in place, which is the same picture. Swallowed
    // rather than thrown so that a page's own environment does not decide
    // whether the *shell* around it can be asserted on.
    onError: () => undefined,
  });
  await stream.allReady;
  return await new Response(stream).text();
}
