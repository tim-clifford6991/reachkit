// BUILD §4.6, UI-SPEC S16 — "full page render", the grounded-fact highlight
// inside it, and the source line under the paragraph that carries it.
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
//
// **The source line is placed, not floated** (issue #355). S16 draws
// REQ-045 criterion 2's "URL it was read from and the date it was read"
// directly beneath the paragraph holding the marked fact, because that is
// the paragraph it is evidence for; a line at the foot of the screen is
// evidence for the page in general, which is not what the criterion says.
// The split is made with the renderer's own public calls — parse once, ask
// `markPassage` block by block which block took the mark — so this file
// still owns no parsing and `markdown.ts` gains no argument for a caller
// that wanted a slice.
import type React from "react";
import { markPassage, parseMarkdown, toHtml, type Block } from "@/lib/publish/render/markdown";
import { BODY_CLASSES } from "./present";

/** The index of the first block the passage was marked in, or `-1`. */
function markedBlockIndex(blocks: readonly Block[], fact: string): number {
  return blocks.findIndex((block) => markPassage([block], fact).marked);
}

export function RenderedBody(p: {
  bodyMd: string;
  /** The verbatim passage to mark. Pass `null` for a page with no
   *  surviving grounding — the body then renders whole and unmarked, which
   *  is REQ-045 criterion 8's "no longer marked". */
  markFact: string | null;
  /** Criterion 2's source line, placed under the marked paragraph. It is
   *  the caller's node because the address and the date are values the
   *  screen already holds, and it is drawn **only** where the mark landed:
   *  a source line with no marked fact above it is a claim about a
   *  paragraph that no longer stands on it. */
  source?: React.ReactNode;
  /** Spelled as the attribute rather than as a `testId` prop: the
   *  copy sweep treats every JSX attribute as presumed voice and clears
   *  `data-testid` by name (ADR-010 point 1's "test ids"), so passing the
   *  hook under its own name keeps a fail-closed list from having to grow
   *  a synonym. */
  "data-testid": string;
}): React.JSX.Element {
  const blocks = parseMarkdown(p.bodyMd);
  const marked = p.markFact === null ? blocks : markPassage(blocks, p.markFact).blocks;
  const at = p.markFact === null || p.source === undefined ? -1 : markedBlockIndex(blocks, p.markFact);

  if (at === -1) {
    return (
      <div
        className="rk-doc"
        data-testid={p["data-testid"]}
        dangerouslySetInnerHTML={{ __html: toHtml(marked, BODY_CLASSES) }}
      />
    );
  }

  return (
    <div className="rk-doc" data-testid={p["data-testid"]}>
      <div dangerouslySetInnerHTML={{ __html: toHtml(marked.slice(0, at + 1), BODY_CLASSES) }} />
      {p.source}
      <div dangerouslySetInnerHTML={{ __html: toHtml(marked.slice(at + 1), BODY_CLASSES) }} />
    </div>
  );
}
