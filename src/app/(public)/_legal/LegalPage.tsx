// UI-SPEC S5 — the legal screen: "Header · eyebrow Legal · title (owed) ·
// 'updated [date]' · one card with the Markdown body (owed) · footer. One
// renderer for the three routes."
// src/app/(public)/_legal/LegalPage.tsx
//
// **One renderer, and this is it.** `/privacy`, `/terms` and `/imprint` are
// the same screen reading three different documents, so each `page.tsx` is
// four lines that name its `LegalDocument` and nothing else. Three copies of
// this file — which is what the routes held before — is three places a
// change to the legal screen has to be remembered, and the set draws one
// screen.
//
// The header and footer are the group layout's (ruling 3a); this file draws
// what sits between them and never its own chrome.
//
// **The body goes through the product's one Markdown renderer.** S5 calls it
// "the Markdown body", and `src/lib/publish/render/markdown.ts` is the one
// place Markdown becomes HTML in this product — the owner ruled it on
// 2026-09-06 (`DECISIONS.md`, #119: "a declared subset rendered by one
// in-repo renderer … No Markdown dependency until fidelity demands one").
// Rendering it here rather than printing the string means the day the owner
// writes a privacy statement with headings and a list, the page draws
// headings and a list — with no second renderer, no dependency and no edit
// to this file.
//
// **The body's headings are levelled** (issue #493). The page prints its
// own title as the `<h1>`, so a `##` in the body is a heading *within* the
// document, and the approved set draws it one rung under the title
// (`.doc h2` at `--h3`). Restyling an `<h2>` to 20px is what broke the
// heading-scale sweep once the owner's bodies arrived with headings in
// them: every `h2` in the product computes 25px or it is not the ladder.
// So the level is shifted instead — `demoteHeadings`, the draft screen's
// rule, now the renderer's — and each level keeps the size the type ladder
// gives its element. A `##` renders as an `<h3>`.
//
// **The body's typography is Tailwind classes on the renderer's own class
// map** (issue 731), the way the draft screen's `DRAFT_BODY_CLASSES` is:
// spacing, weight, lists, links and code, and never a heading size, which
// the element's own ladder step decides. No stylesheet.
//
// Setting HTML is safe by construction, not by review, and for exactly the
// reason `RenderedBody` gives: that module escapes every text node and every
// attribute it emits and never passes source HTML through, so the string
// below cannot carry markup the key contained. Today every body key holds
// the `TODO(copy)` marker, which renders as one paragraph saying so.
//
// Server Components that read nothing: no session, no cookie, no store.
import type React from "react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { demoteHeadings, parseMarkdown, toHtml, type HtmlClasses } from "@/lib/publish/render/markdown";
import type { LegalDocument } from "./documents";

/** Heading margins and weight only: the size is the element's ladder step. */
const HEADING = "mt-6 mb-3 font-bold text-base-content first:mt-0";

/** The legal document's typography, element by element. */
export const LEGAL_BODY_CLASSES: HtmlClasses = Object.freeze({
  h2: HEADING,
  h3: HEADING,
  h4: HEADING,
  h5: HEADING,
  h6: HEADING,
  p: "mb-3 last:mb-0",
  ul: "mb-3 list-disc ps-6",
  ol: "mb-3 list-decimal ps-6",
  li: "mb-1",
  blockquote: "mb-3 border-l border-base-300 ps-4 text-base-content/60",
  pre: "mb-3 overflow-x-auto rounded-field bg-base-200 p-3",
  code: "font-mono text-sm",
  hr: "my-6 border-base-300",
  a: "link link-primary",
  strong: "font-bold text-base-content",
  em: "italic",
});

/** A legal body, Markdown in, HTML out: the one renderer's parse and
 *  serialiser with the headings levelled under the page's own `<h1>`. */
export function legalBodyHtml(md: string): string {
  return toHtml(demoteHeadings(parseMarkdown(md)), LEGAL_BODY_CLASSES);
}

export function LegalPage(p: { document: LegalDocument }): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-3 px-4 py-12">
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          {copy("legal.eyebrow")}
        </span>
        <h1>{copy(p.document.title)}</h1>
        {/* The whole line is a date with one word in front of it, so the
            whole line is in the mono face. */}
        <p className="font-mono text-xs text-base-content/60">
          {copy("legal.updated", { date: copy(p.document.updated) })}
        </p>
        {/* One card, no head: the page's own h1 already names the document. */}
        <div className="card mt-3 border border-base-300 bg-base-100">
          <div className="card-body">
            <div
              className="min-w-0 leading-relaxed text-base-content/80"
              data-testid="legal-document"
              dangerouslySetInnerHTML={{ __html: legalBodyHtml(copy(p.document.body)) }}
            />
          </div>
        </div>
      </main>
    </Surface>
  );
}
