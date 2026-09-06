// BUILD §9 — "Everything else = copy as Markdown/HTML (always shown)."
//
// Two controls, always rendered: for a draft and for a published page, on
// every destination, whether or not ReachKit serves it. That is the whole
// point of the clause — the customer's words are theirs whatever they are
// bound for, and a customer on a destination ReachKit does not publish to
// must never be locked out of their own content.
//
// The Markdown handed over is the body **verbatim**; the HTML is the same
// body through `markdown.ts`, unclassed — the bytes the hosted template
// publishes. One renderer, so what is copied and what goes live cannot
// differ (the archived BP-044 decision 3).
//
// They are `Btn`. No copy-out component is registered and none should be —
// §2.2's set has `btn` and that is what this is.
//
// The clipboard is the browser's and may not be there (an insecure origin,
// a browser that withholds it). Nothing is claimed either way: this
// screen states no outcome for a copy, so there is no outcome to be wrong
// about, and the customer still has the Markdown in the editor beside them.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { Btn } from "@/ui/components/Btn";
import { renderMarkdownHtml } from "./markdown";

function writeClipboard(text: string): void {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard) return;
  void clipboard.writeText(text).catch(() => undefined);
}

export function CopyOut(p: { bodyMd: string }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2" data-testid="draft-copy-out">
      <span data-testid="draft-copy-markdown">
        <Btn
          label={copy("draft.copy.markdown")}
          variant="ghost"
          size="sm"
          onClick={() => writeClipboard(p.bodyMd)}
        />
      </span>
      <span data-testid="draft-copy-html">
        <Btn
          label={copy("draft.copy.html")}
          variant="ghost"
          size="sm"
          onClick={() => writeClipboard(renderMarkdownHtml(p.bodyMd))}
        />
      </span>
    </div>
  );
}
