// SPEC §7 — "one serialiser for screen, copy-as-HTML and copy-as-Markdown".
//
// Two controls, always rendered: for a draft and for a published page, on
// every destination. The customer's words are theirs whatever they are
// bound for.
//
// The Markdown handed over is the body **verbatim**; the HTML is the same
// body through `markdown.ts`, unclassed — the bytes the hosted template
// publishes. One renderer, so what is copied and what goes live cannot
// differ.
//
// The clipboard is the browser's and may not be there (an insecure origin, a
// browser that withholds it). Nothing is claimed either way: this screen
// states no outcome for a copy, so there is no outcome to be wrong about.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { renderMarkdownHtml } from "@/lib/publish/render/markdown";

function writeClipboard(text: string): void {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard) return;
  void clipboard.writeText(text).catch(() => undefined);
}

export function CopyOut(p: { bodyMd: string }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2" data-testid="draft-copy-out">
      <button
        type="button"
        className="btn btn-sm btn-outline"
        data-testid="draft-copy-markdown"
        onClick={() => writeClipboard(p.bodyMd)}
      >
        {copy("draft.copy.markdown")}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline"
        data-testid="draft-copy-html"
        onClick={() => writeClipboard(renderMarkdownHtml(p.bodyMd))}
      >
        {copy("draft.copy.html")}
      </button>
    </div>
  );
}
