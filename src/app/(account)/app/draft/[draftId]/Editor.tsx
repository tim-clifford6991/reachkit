// SPEC §7 (2026-09-20, #908) — "**Editor.** Text on the left, the live page
// on the right, a desktop/phone switch, a formatting bar, title and
// search-result description with a length count. A sentence that breaks a
// hard rule or matches the never-claim list is marked where it stands as it
// is typed; the save-and-hold behaviour of 2026-09-16 (#789) is unchanged.
// On a phone: Text / Preview tabs."
//
// Two panes and one buffer, as before. What changed with issue 932 is what
// each pane is:
//
//   left   CodeMirror 6 (`@uiw/react-codemirror`, `docs/DESIGN.md`'s
//          allow-list), with the Markdown language and a formatting bar.
//          The rule breaks are `@codemirror/lint` diagnostics on the text
//          itself, so a founder reads *where* a page is held rather than
//          only *that* it is.
//   right  the live page, through the **same three calls the hosted route
//          makes** — `parseMarkdown → markPassage → toHtml` with
//          `HOSTED_BODY_CLASSES` — inside a daisyUI `mockup-browser` or
//          `mockup-phone`. It is not a rendering *like* the page; it is the
//          page's own bytes.
//
// **One grid and three visibility rules, never two component trees.** At
// and above `lg` the two panes stand side by side and the tab bar is not
// drawn; below it the tab bar chooses which of the three panes is on
// screen. Switching tabs changes which pane is visible and nothing else:
// the buffer, the autosave, the debounce, the lint and the preview are
// identical in every band.
//
// **There is still no save control, at any band** — a save button beside an
// autosave is an invitation to believe the autosave is optional.
//
// **Why the preview is not a second renderer.** `markdown.ts` escapes every
// text node and every attribute it emits and never passes source HTML
// through, so the string set here cannot carry markup a body contained. A
// JSX tree built beside it would be a second serialiser and would let the
// page the founder watches drift from the bytes that publish — which is the
// one thing this pane exists to rule out.
//
// **The mark inside the preview.** `HOSTED_BODY_CLASSES` dresses `mark` in
// the grounded fact's mint (`MARK_CLASS`), and while a page is held the
// thing the founder is here to find is the break, not the fact. So the
// preview marks **the break where there is one**, in the warn family, and
// the grounded fact otherwise — one `mark` slot, one serialiser, one call.
// The read arm still marks the fact, which is the screen the founder
// returns to once the break is gone.
"use client";

import type React from "react";
import { useCallback, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorView, ViewPlugin } from "@codemirror/view";
import {
  Bold,
  Heading,
  Italic,
  Link as LinkIcon,
  List,
  Quote,
  Table,
} from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { PREVIEW_DEBOUNCE_MS } from "@/lib/config/constants";
import { HOSTED_BODY_CLASSES } from "@/app/(hosted)/hosted-page/body-classes";
import { markPassage, parseMarkdown, toHtml } from "@/lib/publish/render/markdown";
import { BREAK_COPY_KEY, isPlaced, liveBreaks, type Break, type MarkInputs } from "./marks";
import { useDebounced } from "./useDebounced";

/** §7's panes. The third is a phone's only: from `lg` up the search result
 *  stands under the page, where there is room for both. */
export const EDITOR_PANES = ["markdown", "preview", "search"] as const;
export type EditorPane = (typeof EDITOR_PANES)[number];

const PANE_LABEL = {
  markdown: "draft.editor.tab.markdown",
  preview: "draft.editor.tab.preview",
  search: "draft.editor.tab.search",
} as const;

/** §7's desktop/phone switch. The two frames daisyUI ships, named by the
 *  two words the ruling uses. */
export const PREVIEW_FRAMES = ["desktop", "phone"] as const;
export type PreviewFrame = (typeof PREVIEW_FRAMES)[number];

const FRAME_LABEL = {
  desktop: "draft.editor.frame.desktop",
  phone: "draft.editor.frame.phone",
} as const;

/**
 * The break's mark, in the warn family.
 *
 * The same shape as `MARK_CLASS` — a tint, a hairline of its own family and
 * stated ink — because it is the same kind of object: a run of body text
 * the product is pointing at. The family is `--warn` rather than `--ok`
 * because this one is a problem being shown to its owner, which §2.5 makes
 * the warn family's job, and it is never red: a held page is not a broken
 * one, and the founder's words are saved.
 */
const BREAK_MARK_CLASS =
  "bg-[var(--warn-bg)] text-base-content ring-1 ring-[var(--warn-line)] rounded px-1";


/**
 * CodeMirror, in the product's own colours (issue 932).
 *
 * **Why the library's theming API and not a stylesheet.** `docs/DESIGN.md`
 * forbids a new sheet under `src/ui/`, and rightly: a second place that
 * decides what things look like is a second palette. `EditorView.theme` is
 * CodeMirror's own way of being told, and every value below is a
 * `reachkit` token read by name — there is no colour here, only a
 * reference to one, so the editor flips with the theme because the theme
 * flipped.
 *
 * `@uiw/react-codemirror` ships a light theme by default, which paints
 * near-black on white whatever the page is doing around it. This is handed
 * to its `theme` prop, so it replaces that default rather than layering on
 * it.
 */
const EDITOR_THEME = EditorView.theme({
  "&": {
    backgroundColor: "var(--color-base-100)",
    color: "var(--color-base-content)",
    fontSize: "inherit",
    // The field's height lives here rather than on the element, with the
    // rest of what the field looks like — and because a `height="24rem"`
    // attribute is a string literal in JSX, which the copy sweep reads as
    // a sentence the screen might be speaking.
    height: "24rem",
  },
  ".cm-content": { fontFamily: "inherit", padding: "0.75rem" },
  ".cm-gutters": {
    backgroundColor: "var(--color-base-200)",
    color: "var(--color-base-content)",
    border: "none",
  },
  "&.cm-focused": { outline: "2px solid var(--color-primary)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-base-content)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-primary-content)",
  },
});

/**
 * The scroll box, reachable from a keyboard.
 *
 * `.cm-scroller` is a scroll container CodeMirror owns and exposes no
 * attribute facet for, and a scroller a mouse can reach and a keyboard
 * cannot is an axe failure of its own (`scrollable-region-focusable`) —
 * the same finding #962 fixed everywhere else in the product, answered the
 * same way. A `ViewPlugin` is the library's own door to its DOM.
 */
const REACHABLE_SCROLLER = ViewPlugin.define((view) => {
  view.scrollDOM.setAttribute("tabindex", "0");
  return {};
});

const EYEBROW = "text-xs font-semibold uppercase tracking-wide opacity-70";

/** One formatting control: the word it is called, its glyph, and what it
 *  writes around the selection. `around` is the pair; `line` is written at
 *  the head of the line instead. */
interface Format {
  key: (typeof FORMATS)[number]["key"];
}

const FORMATS = [
  { key: "heading", label: "draft.editor.format.heading", Icon: Heading, line: "## ", placeholder: "draft.editor.format.placeholder.heading" },
  { key: "bold", label: "draft.editor.format.bold", Icon: Bold, wrap: ["**", "**"], placeholder: "draft.editor.format.placeholder.text" },
  { key: "italic", label: "draft.editor.format.italic", Icon: Italic, wrap: ["_", "_"], placeholder: "draft.editor.format.placeholder.text" },
  { key: "link", label: "draft.editor.format.link", Icon: LinkIcon, wrap: ["[", "](https://)"], placeholder: "draft.editor.format.placeholder.label" },
  { key: "list", label: "draft.editor.format.list", Icon: List, line: "- ", placeholder: "draft.editor.format.placeholder.text" },
  { key: "quote", label: "draft.editor.format.quote", Icon: Quote, line: "> ", placeholder: "draft.editor.format.placeholder.text" },
  { key: "table", label: "draft.editor.format.table", Icon: Table, block: true, placeholder: "draft.editor.format.placeholder.text" },
] as const;

/** The table a founder gets: two columns and one row, the smallest thing
 *  the GFM extension parses, for them to type into. */
const TABLE_SKELETON = "\n|  |  |\n| --- | --- |\n|  |  |\n";

/**
 * What a formatting control does to the buffer.
 *
 * Pure — text and a selection in, text and a caret out — so the bar is
 * testable with no editor mounted and the editor keeps no second notion of
 * what "bold" means.
 */
export function applyFormat(
  text: string,
  selection: { from: number; to: number },
  key: Format["key"],
  placeholder: string
): { text: string; from: number; to: number } {
  const format = FORMATS.find((entry) => entry.key === key);
  if (format === undefined) return { text, ...selection };
  const chosen = text.slice(selection.from, selection.to);
  const subject = chosen === "" ? placeholder : chosen;

  if ("block" in format && format.block) {
    const next = text.slice(0, selection.to) + TABLE_SKELETON + text.slice(selection.to);
    const at = selection.to + TABLE_SKELETON.length;
    return { text: next, from: at, to: at };
  }

  if ("line" in format) {
    // At the head of the line the selection begins on: a heading, a list
    // item and a quote are line-level Markdown, and wrapping a phrase in
    // one would produce text no parser reads as either.
    const lineStart = text.lastIndexOf("\n", Math.max(0, selection.from - 1)) + 1;
    const marker = format.line;
    const next = text.slice(0, lineStart) + marker + text.slice(lineStart);
    return chosen === "" && text.slice(lineStart).trimStart() === ""
      ? {
          text: next.slice(0, lineStart + marker.length) + subject + next.slice(lineStart + marker.length),
          from: lineStart + marker.length,
          to: lineStart + marker.length + subject.length,
        }
      : { text: next, from: selection.from + marker.length, to: selection.to + marker.length };
  }

  // The remaining arm wraps a phrase. Spelled as a narrowing rather than
  // assumed: `FORMATS` is a union of three shapes, and a control that grew
  // a fourth should be a compile error here rather than an `undefined`
  // destructured into the buffer.
  if (!("wrap" in format)) return { text, ...selection };
  const [open, close] = format.wrap;
  const next = text.slice(0, selection.from) + open + subject + close + text.slice(selection.to);
  return {
    text: next,
    from: selection.from + open.length,
    to: selection.from + open.length + subject.length,
  };
}

/** A break, as `@codemirror/lint` states one. A break the product could not
 *  place stands at the head of the document rather than nowhere: the
 *  founder is owed the sentence either way, and the gutter is where a
 *  diagnostic with no span belongs. */
function diagnosticOf(found: Break, length: number): Diagnostic {
  const message =
    found.rule === "do_not_claim"
      ? copy(BREAK_COPY_KEY.do_not_claim, { entry: found.entry ?? "" })
      : copy(BREAK_COPY_KEY[found.rule]);
  const from = Math.min(found.from, length);
  const to = Math.min(Math.max(found.to, from), length);
  return { from, to, severity: "warning", message };
}

export function Editor(p: {
  bodyMd: string;
  onChange: (bodyMd: string) => void;
  /** "or leaves the view": blur flushes the pending save immediately rather
   *  than waiting out the debounce. */
  onFlush: () => void;
  markFact: string | null;
  pane: EditorPane;
  onPane: (pane: EditorPane) => void;
  frame: PreviewFrame;
  onFrame: (frame: PreviewFrame) => void;
  /** The facts the live rules read. `marks.ts` says why these and no more. */
  inputs: MarkInputs;
  /** The page's address and the search-result pane's two lines. */
  searchResult: React.ReactNode;
}): React.JSX.Element {
  // The preview trails the keystroke by at most `PREVIEW_DEBOUNCE_MS` and
  // costs no round trip — the render is this module's own call. The lint
  // rides the same pause, which is what makes "within a second" true of
  // both the underline and the page beside it.
  const previewBody = useDebounced(p.bodyMd, PREVIEW_DEBOUNCE_MS);

  const breaks = useMemo(() => liveBreaks(previewBody, p.inputs), [previewBody, p.inputs]);

  const lint = useMemo(
    () =>
      linter((view) =>
        liveBreaks(view.state.doc.toString(), p.inputs).map((found) =>
          diagnosticOf(found, view.state.doc.length)
        )
      ),
    [p.inputs]
  );

  const extensions = useMemo(
    () => [
      markdownLanguage(),
      lintGutter(),
      lint,
      EditorView.lineWrapping,
      REACHABLE_SCROLLER,
      // The field's own accessible name, on the element that carries the
      // `textbox` role. An `aria-label` on the React wrapper names a `div`
      // nobody focuses; this names the box the founder types into.
      EditorView.contentAttributes.of({ "aria-label": copy("draft.editor.tab.markdown") }),
    ],
    [lint]
  );

  /** The one run the preview marks. The first break that could be placed —
   *  breaks are produced in the battery's own order, so "the first" is the
   *  earliest rule to object, not the earliest offset. */
  const marked = breaks.find(isPlaced) ?? null;

  const html = useMemo(() => {
    const blocks = parseMarkdown(previewBody);
    if (marked !== null) {
      const passage = previewBody.slice(marked.from, marked.to);
      return toHtml(markPassage(blocks, passage).blocks, {
        ...HOSTED_BODY_CLASSES,
        mark: BREAK_MARK_CLASS,
      });
    }
    return toHtml(
      p.markFact === null ? blocks : markPassage(blocks, p.markFact).blocks,
      HOSTED_BODY_CLASSES
    );
  }, [previewBody, marked, p.markFact]);

  const format = useCallback(
    (view: EditorView | null, key: Format["key"], placeholder: string): void => {
      if (view === null) return;
      const { from, to } = view.state.selection.main;
      const next = applyFormat(view.state.doc.toString(), { from, to }, key, placeholder);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next.text },
        selection: { anchor: next.from, head: next.to },
      });
      view.focus();
      p.onChange(next.text);
    },
    [p]
  );

  // The editor's own view, captured on create so the formatting bar can
  // dispatch into it. A ref rather than state: nothing renders from it, and
  // a re-render on every mount would remount the editor it came from.
  const viewRef = useRef<EditorView | null>(null);

  const page = (
    <div className="min-w-0" data-testid="draft-preview-page">
      {/* The body, dressed exactly as the hosted route dresses it. */}
      <div
        className="prose prose-sm min-w-0 max-w-none"
        data-testid="draft-preview-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );

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
            data-testid={`draft-editor-tab-${pane}`}
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
          <p className={`mb-2 hidden lg:block ${EYEBROW}`}>{copy("draft.editor.tab.markdown")}</p>

          {/* The formatting bar. daisyUI `join` of ghost buttons, each with
              its own word as its accessible name — a glyph alone is not a
              label (#962), and `tooltip` gives the same word to a mouse. */}
          <div
            className="join join-horizontal mb-2 flex flex-wrap"
            role="toolbar"
            aria-label={copy("draft.editor.format.title")}
            data-testid="draft-editor-format"
          >
            {FORMATS.map(({ key, label, Icon, placeholder }) => (
              <button
                key={key}
                type="button"
                className="btn btn-sm btn-ghost join-item"
                aria-label={copy(label)}
                title={copy(label)}
                data-testid={`draft-editor-format-${key}`}
                onClick={() => format(viewRef.current, key, copy(placeholder))}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden />
              </button>
            ))}
          </div>

          {/* `border-base-300` and the theme's own faces: CodeMirror draws
              no chrome of its own here, so the field reads as the product's
              other fields do. `.num` is the mono face — Markdown is
              code-like, which is what §2.3 gives that face for. */}
          <div
            className="border-base-300 rounded-box num overflow-hidden border text-sm"
            data-testid="draft-editor-field"
          >
            <CodeMirror
              value={p.bodyMd}
              extensions={extensions}
              // **The theme is ours**, handed over as the extension it is:
              // the library's own default paints a light theme whatever the
              // page around it is doing, and passing `EDITOR_THEME` here
              // replaces it rather than layering on it. Its syntax colours
              // are a second palette and are **off** below — a founder here
              // is writing prose, and the marks that matter on this screen
              // are the lint ones.
              theme={EDITOR_THEME}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                syntaxHighlighting: false,
              }}
              onChange={p.onChange}
              onBlur={p.onFlush}
              onCreateEditor={(view) => {
                viewRef.current = view;
              }}
              data-testid="draft-editor-textarea"
            />
          </div>
        </div>

        <div
          className={`min-w-0 ${p.pane === "preview" ? "block" : "hidden lg:block"}`}
          data-testid="draft-editor-preview"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className={`hidden lg:block ${EYEBROW}`}>{copy("draft.editor.tab.preview")}</p>
            {/* §7's desktop/phone switch. daisyUI `join` of two small
                buttons, the one in force marked by the primary tint rather
                than by a `neutral` slot this theme does not define. */}
            <div
              className="join join-horizontal"
              role="group"
              aria-label={copy("draft.editor.tab.preview")}
              data-testid="draft-editor-frames"
            >
              {PREVIEW_FRAMES.map((frame) => (
                <button
                  key={frame}
                  type="button"
                  className={`btn btn-xs join-item ${p.frame === frame ? "bg-primary/10 text-primary" : "btn-ghost"}`}
                  aria-pressed={p.frame === frame}
                  onClick={() => p.onFrame(frame)}
                  data-testid={`draft-editor-frame-${frame}`}
                >
                  {copy(FRAME_LABEL[frame])}
                </button>
              ))}
            </div>
          </div>

          <p className="mb-2 text-xs text-base-content/70" data-testid="draft-preview-lead">
            {copy("draft.editor.preview.lead")}
          </p>

          {p.frame === "desktop" ? (
            <div
              className="mockup-browser border-base-300 bg-base-200 min-w-0 border"
              data-testid="draft-preview-frame-desktop"
            >
              <div className="mockup-browser-toolbar min-w-0" />
              <div className="bg-base-100 min-w-0 px-4 py-6">{page}</div>
            </div>
          ) : (
            // `mockup-phone` is a fixed-width frame by construction, so it
            // is centred rather than stretched: a phone is the width a
            // phone is, and that is the point of looking at one.
            <div className="flex min-w-0 justify-center" data-testid="draft-preview-frame-phone">
              <div className="mockup-phone border-base-300">
                <div className="mockup-phone-camera" />
                {/* `tabIndex`: the display is a scroll box with a phone's
                    height, so a page taller than it scrolls inside — and a
                    scroller a mouse can reach and a keyboard cannot is an
                    axe failure (`scrollable-region-focusable`), the same
                    one #962 answered this way everywhere else. */}
                <div
                  className="mockup-phone-display bg-base-100 overflow-y-auto px-4 py-6"
                  tabIndex={0}
                >
                  {page}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* The search result. Its own pane on a phone, and under the page
            from `lg` up, where there is room for both. */}
        <div
          className={`min-w-0 lg:col-span-2 ${p.pane === "search" ? "block" : "hidden lg:block"}`}
          data-testid="draft-editor-search"
        >
          {p.searchResult}
        </div>
      </div>
    </div>
  );
}
