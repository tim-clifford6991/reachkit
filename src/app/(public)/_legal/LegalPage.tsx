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
// rule, now the renderer's — and `.rk-doc-levelled` gives each level its
// own step. A `##` renders as an `<h3>` at `--h3`: the size the set draws,
// reached by the step and not against it.
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
import { demoteHeadings, parseMarkdown, toHtml } from "@/lib/publish/render/markdown";
import type { LegalDocument } from "./documents";

/** A legal body, Markdown in, HTML out: the one renderer's parse and
 *  serialiser with the headings levelled under the page's own `<h1>`, and
 *  no class map — the document's typography is `.rk-doc`'s. */
export function legalBodyHtml(md: string): string {
  return toHtml(demoteHeadings(parseMarkdown(md)));
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
        {/* One card, no head: the page's own h1 already names the document.
            `rk-doc` styles the rendered Markdown, which no daisyUI class covers. */}
        <div className="card mt-3 border border-base-300 bg-base-100">
          <div className="card-body">
            <div
              className="rk-doc rk-doc-levelled"
              dangerouslySetInnerHTML={{ __html: legalBodyHtml(copy(p.document.body)) }}
            />
          </div>
        </div>
      </main>
    </Surface>
  );
}
