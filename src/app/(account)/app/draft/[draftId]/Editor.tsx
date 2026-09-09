// BUILD §4.6 — "Edit = Markdown textarea with a live preview pane (owner
// ruling, 28 Aug) — two columns on desktop, tabbed on mobile, autosaved, no
// rich-text editor." DECISIONS 2026-08-28 records the same ruling.
//
// Two panes and one buffer. The textarea holds the Markdown; the pane
// beside it holds the same Markdown through the same renderer the read view
// uses, so what the customer watches appear is what would publish.
//
// **The arrangement is one grid and two visibility rules, never two
// component trees.** At and above the boundary both panes stand side by
// side and the tab bar is not drawn; below it the tab bar chooses which
// pane is on screen. Switching tabs changes which pane is visible and
// nothing else: the buffer, the autosave, the debounce and the badge drop
// are identical in every band, and a tab switch is not a save boundary.
//
// **The boundary is 1024, not 1280** (issue #355). §4.6 says "two columns
// on desktop, tabbed on mobile" and this build read that as `xl:` —
// `BAND_MIN.wide`. UI-SPEC S17 is specific where §4.6 is not: "two columns
// ≥1024, tabbed below", and §1 of that document rules that where it and
// BUILD §4 differ, it wins until the §4 amendment lands. So the switch is
// `lg:` — Tailwind's `lg` is 64rem, which is `BAND_MIN.medium` and
// `--breakpoint-lg`. It is also where the sidebar returns, which is the
// objection the old note recorded; the answer the set gives is that a
// Markdown pane and its preview are each narrower than a card and read
// perfectly well at half of a 1024 band, and that a customer editing at
// 1024 should not have to tab between what they type and what it becomes.
//
// There is **no save control**, at any band. §4.6 says autosaved, and a
// save button beside an autosave is an invitation to believe the autosave
// is optional.
//
// **The textarea is a native element, styled with stock utilities, and
// that is a recorded gap rather than a shortcut.** §2.2's component set
// names `input` and no multi-line control; `src/ui/components/` registers
// none, and the archived WO-173 found the same thing ("the draft editor
// cannot be built from the registered set"). Three things this build will
// not do about it: mint a bespoke widget (§2.2 forbids it), reach for
// daisyUI's own `textarea` class (that is a sixteenth daisyUI component,
// which `tests/ui/design/component-registry.test.ts` closes), or edit
// §2.2 (the owner's file). What is left is the browser's own multi-line
// control wearing the same theme tokens `Card` wears — a form element on
// the footing `<p>` and `<a>` are on, not a component. The registration is
// the owner's; flagged in the pull request.
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
      <div className="lg:hidden" data-testid="draft-editor-tabs">
        <Tabs
          tabs={[
            { id: "markdown", label: copy("draft.editor.tab.markdown") },
            { id: "preview", label: copy("draft.editor.tab.preview") },
          ]}
          selectedId={p.pane}
          onSelect={(id) => p.onPane(id === "preview" ? "preview" : "markdown")}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div
          className={`min-w-0 ${p.pane === "markdown" ? "block" : "hidden lg:block"}`}
          data-testid="draft-editor-markdown"
        >
          <p className="eyebrow rk-daypanel-eyebrow mb-2 hidden lg:block">
            {copy("draft.editor.tab.markdown")}
          </p>
          <textarea
            className="num t-sm border-base-300 bg-base-100 rounded-box h-96 w-full border p-3"
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
          <p className="eyebrow rk-daypanel-eyebrow mb-2 hidden lg:block">
            {copy("draft.editor.tab.preview")}
          </p>
          <div className="bg-base-200 rounded-box p-4">
            <RenderedBody
              bodyMd={previewBody}
              markFact={p.markFact}
              data-testid="draft-preview-body"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
