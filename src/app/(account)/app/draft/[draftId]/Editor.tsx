// BUILD §4.6 — "Edit = Markdown textarea with a live preview pane (owner
// ruling, 28 Aug) — two columns on desktop, tabbed on mobile, autosaved, no
// rich-text editor." DECISIONS 2026-08-28 records the same ruling.
//
// Two panes and one buffer. The textarea holds the Markdown; the pane
// beside it holds the same Markdown through the same renderer the read view
// uses, so what the customer watches appear is what would publish.
//
// **The arrangement is one grid and two visibility rules, never two
// component trees.** At the wide band both panes stand side by side and the
// tab bar is not drawn; below it the tab bar chooses which pane is on
// screen. `xl:` is that boundary — Tailwind's `xl` is 80rem, which is
// `BAND_MIN.wide` and `--breakpoint-xl` (the same coincidence
// `tests/ui/settings-columns.test.ts` pins for §4.7's two columns).
// Switching tabs changes which pane is visible and nothing else: the
// buffer, the autosave, the debounce and the badge drop are identical in
// every band, and a tab switch is not a save boundary.
//
// There is **no save control**, at any band. §4.6 says autosaved, and a
// save button beside an autosave is an invitation to believe the autosave
// is optional.
//
// The textarea is a plain element with daisyUI's own `textarea` class:
// §2.2's component set names `input` and no multi-line control, and
// `src/ui/components/` registers none — the archived WO-173 recorded the
// same gap. Minting one here would put an unregistered widget in the
// design system's namespace; using daisyUI's own class keeps the control
// inside daisyUI, where §2.2 puts every component, and leaves the
// registration to the owner. Flagged in the pull request.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { PREVIEW_DEBOUNCE_MS } from "@/lib/config/constants";
import { Tabs } from "@/ui/components/Tabs";
import { RenderedBody } from "./RenderedBody";
import { useDebounced } from "./useDebounced";

export const EDITOR_PANES = ["markdown", "preview"] as const;
export type EditorPane = (typeof EDITOR_PANES)[number];

export function Editor(p: {
  bodyMd: string;
  onChange: (bodyMd: string) => void;
  /** Criterion 6's "or leaves the view": blur flushes the pending save
   *  immediately rather than waiting out the debounce. */
  onFlush: () => void;
  markFact: string | null;
  pane: EditorPane;
  onPane: (pane: EditorPane) => void;
}): React.JSX.Element {
  // The preview trails the keystroke by at most `PREVIEW_DEBOUNCE_MS` and
  // costs no round trip — the render is this module's own call.
  const previewBody = useDebounced(p.bodyMd, PREVIEW_DEBOUNCE_MS);

  return (
    <div className="flex flex-col gap-3" data-testid="draft-editor">
      <div className="xl:hidden" data-testid="draft-editor-tabs">
        <Tabs
          tabs={[
            { id: "markdown", label: copy("draft.editor.tab.markdown") },
            { id: "preview", label: copy("draft.editor.tab.preview") },
          ]}
          selectedId={p.pane}
          onSelect={(id) => p.onPane(id === "preview" ? "preview" : "markdown")}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div
          className={`min-w-0 ${p.pane === "markdown" ? "block" : "hidden xl:block"}`}
          data-testid="draft-editor-markdown"
        >
          <textarea
            className="textarea num h-96 w-full"
            value={p.bodyMd}
            onChange={(e) => p.onChange(e.target.value)}
            onBlur={p.onFlush}
            data-testid="draft-editor-textarea"
            aria-label={copy("draft.editor.tab.markdown")}
          />
        </div>
        <div
          className={`min-w-0 ${p.pane === "preview" ? "block" : "hidden xl:block"}`}
          data-testid="draft-editor-preview"
        >
          <RenderedBody
            bodyMd={previewBody}
            markFact={p.markFact}
            data-testid="draft-preview-body"
          />
        </div>
      </div>
    </div>
  );
}
