// BUILD §4.6 — "full page render", and the grounded-fact highlight inside it.
//
// One component, two callers: the read view's body and the editor's live
// preview pane. Both hand it the Markdown as it now stands and the passage
// the page is grounded in, and both get the same render — which is what
// makes the preview a preview rather than a second opinion.
//
// **Nothing here truncates.** REQ-045 criterion 1 is "every word that would
// publish … with nothing withheld or summarised": there is no character
// budget, no "show more", and no `max-height` on the body. The whole
// Markdown goes through the renderer and the whole result is placed.
//
// It sets HTML directly, and that is the point rather than a shortcut: the
// alternative is a second element tree built in JSX, which would be a
// second renderer and would let the page a customer reads drift from the
// HTML they copy (the archived BP-044 decision 3). It is safe by
// construction, not by review: `markdown.ts` escapes every text node and
// every attribute value it emits and never passes source HTML through, so
// the string handed here cannot carry markup a body contained.
import type React from "react";
import { markPassage, parseMarkdown, toHtml } from "./markdown";
import { BODY_CLASSES } from "./present";

export function RenderedBody(p: {
  bodyMd: string;
  /** The verbatim passage to mark. Pass `null` for a page with no
   *  surviving grounding — the body then renders whole and unmarked, which
   *  is REQ-045 criterion 8's "no longer marked". */
  markFact: string | null;
  /** Spelled as the attribute rather than as a `testId` prop: the
   *  copy sweep treats every JSX attribute as presumed voice and clears
   *  `data-testid` by name (ADR-010 point 1's "test ids"), so passing the
   *  hook under its own name keeps a fail-closed list from having to grow
   *  a synonym. */
  "data-testid": string;
}): React.JSX.Element {
  const blocks = parseMarkdown(p.bodyMd);
  const shown = p.markFact === null ? blocks : markPassage(blocks, p.markFact).blocks;
  return (
    <div
      className="min-w-0"
      data-testid={p["data-testid"]}
      dangerouslySetInnerHTML={{ __html: toHtml(shown, BODY_CLASSES) }}
    />
  );
}
