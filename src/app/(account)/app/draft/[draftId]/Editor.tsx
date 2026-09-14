// SPEC §7 — "Markdown edit with live preview … Edits save with no save
// button."
//
// Two panes and one buffer. The textarea holds the Markdown; the pane beside
// it holds the same Markdown through the same renderer the read view uses,
// so what the customer watches appear is what would publish.
//
// **One grid and two visibility rules, never two component trees.** At and
// above `lg` both panes stand side by side and the daisyUI tab bar is not
// drawn; below it the tab bar chooses which pane is on screen. Switching
// tabs changes which pane is visible and nothing else: the buffer, the
// autosave, the debounce and the badge drop are identical in every band.
//
// There is **no save control**, at any band. A save button beside an
// autosave is an invitation to believe the autosave is optional.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { PREVIEW_DEBOUNCE_MS } from "@/lib/config/constants";
import { RenderedBody } from "./RenderedBody";
import { useDebounced } from "./useDebounced";

export const EDITOR_PANES = ["markdown", "preview"] as const;
export type EditorPane = (typeof EDITOR_PANES)[number];

const PANE_LABEL = {
  markdown: "draft.editor.tab.markdown",
  preview: "draft.editor.tab.preview",
} as const;

export function Editor(p: {
  bodyMd: string;
  onChange: (bodyMd: string) => void;
  /** "or leaves the view": blur flushes the pending save immediately rather
   *  than waiting out the debounce. */
  onFlush: () => void;
  markFact: string | null;
  pane: EditorPane;
  onPane: (pane: EditorPane) => void;
}): React.JSX.Element {
  // The preview trails the keystroke by at most `PREVIEW_DEBOUNCE_MS` and
  // costs no round trip — the render is this module's own call.
  const previewBody = useDebounced(p.bodyMd, PREVIEW_DEBOUNCE_MS);

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="draft-editor">
      <div role="tablist" className="tabs tabs-border lg:hidden" data-testid="draft-editor-tabs">
        {EDITOR_PANES.map((pane) => (
          <button
            key={pane}
            type="button"
            role="tab"
            aria-selected={p.pane === pane}
            className={`tab ${p.pane === pane ? "tab-active" : ""}`}
            onClick={() => p.onPane(pane)}
          >
            {copy(PANE_LABEL[pane])}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div
          className={`min-w-0 ${p.pane === "markdown" ? "block" : "hidden lg:block"}`}
          data-testid="draft-editor-markdown"
        >
          <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide opacity-70 lg:block">
            {copy("draft.editor.tab.markdown")}
          </p>
          <textarea
            className="textarea num num-phrase h-96 w-full text-sm"
            value={p.bodyMd}
            onChange={(e) => p.onChange(e.target.value)}
            onBlur={p.onFlush}
            data-testid="draft-editor-textarea"
            aria-label={copy("draft.editor.tab.markdown")}
          />
        </div>
        <div
          className={`min-w-0 ${p.pane === "preview" ? "block" : "hidden lg:block"}`}
          data-testid="draft-editor-preview"
        >
          <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide opacity-70 lg:block">
            {copy("draft.editor.tab.preview")}
          </p>
          <div className="bg-base-200 rounded-box p-4">
            <RenderedBody bodyMd={previewBody} markFact={p.markFact} data-testid="draft-preview-body" />
          </div>
        </div>
      </div>
    </div>
  );
}
