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
// **The body's headings are levelled** (issue #493; owner ruling
// 2026-09-23, #328). The page prints its own title as the `<h1>`, so a
// heading in the body is a heading *within* the document and has to sit
// under it. Restyling an `<h2>` to 20px is what broke the heading-scale
// sweep once the owner's bodies arrived with headings in them: every `h2`
// in the product computes 25px or it is not the ladder. So the level is
// shifted instead, and each level keeps the size the ladder gives its
// element.
//
// The shift is `headingsUnderTitle`, not `demoteHeadings`: a fixed `+1`
// levelled a `#`-rooted body correctly and left the owner's own bodies —
// which open at `##` — arriving as `<h3>` directly under the `<h1>`, with
// `h2` skipped. `heading-order` reported exactly that on `/privacy` and
// `/terms` (#328). The shallowest heading in a body now becomes the
// `<h2>`, whatever depth it was written at, and the rest keep their
// distance from it.
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
import Link from "next/link";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { NURTURE_H } from "@/lib/config/constants";
import {
  headingsUnderTitle,
  inlineText,
  parseMarkdown,
  toHtml,
  type Block,
  type HtmlClasses,
} from "@/lib/publish/render/markdown";
import { legalBodyWithIds, legalHeadings, legalSections, type LegalHeading, type LegalSection } from "./sections";
import { LEGAL_DOCUMENTS, type LegalDocument, type LegalFigure } from "./documents";

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
  blockquote: "mb-3 border-l border-base-300 ps-4 text-base-content/70",
  pre: "mb-3 overflow-x-auto rounded-field bg-base-200 p-3",
  code: "font-mono text-sm",
  hr: "my-6 border-base-300",
  a: "link link-primary",
  strong: "font-bold text-base-content",
  em: "italic",
});

/** A legal body, Markdown in, HTML out: the one renderer's parse and
 *  serialiser with the headings levelled under the page's own `<h1>`, and
 *  since #936 an `id` on each section heading for the contents list to
 *  link to. Still one renderer and still one call site — the ids are put
 *  on by `legalBodyWithIds`, which calls it block by block. */
export function legalBodyHtml(md: string): string {
  return legalBodyWithIds(headingsUnderTitle(parseMarkdown(md)), LEGAL_BODY_CLASSES);
}

/** The contents list, from the document's own headings (#936).
 *
 *  Two shapes and one list: a daisyUI `collapse` above the text below
 *  `lg`, where a 220px column beside a 704px measure does not fit on a
 *  phone, and a column beside it from `lg`. The `<nav>` and its links are
 *  written once — the two shapes are which wrapper is displayed, never two
 *  lists that could come to name different sections. */
export function OnThisPage(p: { headings: readonly Pick<LegalHeading, "id" | "number" | "title">[] }): React.JSX.Element | null {
  const headings = p.headings;
  // A body with no headings of its own gets no list and no room kept for
  // one — an imprint that is four lines of address has no sections, and a
  // contents list naming one would be the product inventing structure the
  // owner's document does not have.
  if (headings.length === 0) return null;

  const list = (
    <ol className="menu w-full p-0">
      {headings.map((h) => (
        <li key={h.id}>
          <a href={`#${h.id}`}>
            {h.number === null ? null : (
              <span className="text-base-content/70 font-mono text-xs">{h.number.padStart(2, "0")}</span>
            )}
            <span>{h.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <details className="collapse-arrow bg-base-100 collapse shadow-(--shadow-card) lg:hidden" data-testid="legal-toc-phone">
        <summary className="collapse-title text-sm font-semibold">{copy("chrome.on-this-page")}</summary>
        <nav className="collapse-content" aria-label={copy("chrome.on-this-page")}>
          {list}
        </nav>
      </details>
      <nav
        className="hidden w-56 shrink-0 lg:block"
        aria-label={copy("chrome.on-this-page")}
        data-testid="legal-toc"
      >
        <p className="text-base-content/70 px-4 pb-1 text-xs font-semibold tracking-wide uppercase">
          {copy("chrome.on-this-page")}
        </p>
        {list}
      </nav>
    </>
  );
}

/** A dot, not daisyUI's step counter: the counter would number Start as 1 and Follow-up 1 as 2. */
const DOT = "";

/** The follow-up mails as the board's timeline: Start, then one mark per hour the schedule sends at. */
function FollowUps(): React.JSX.Element {
  const marks = [
    { at: copy("legal.follow-ups.start"), what: copy("legal.follow-ups.asked") },
    ...NURTURE_H.map((hours, i) => ({
      at: copy("legal.follow-ups.at", { hours: String(hours) }),
      what: copy("legal.follow-ups.step", { n: String(i + 1) }),
    })),
  ];
  return (
    <figure className="flex flex-col gap-2" data-testid="legal-follow-ups">
      <ul className="steps w-full">
        {marks.map((m, i) => (
          <li key={m.at} className={i === 0 ? "step step-primary text-xs" : "step text-xs"} data-content={DOT}>
            <span className="flex flex-col">
              <span className="font-mono font-semibold">{m.at}</span> <span>{m.what}</span>
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="text-base-content/70 text-xs">{copy("legal.follow-ups.note")}</figcaption>
    </figure>
  );
}

function Rights(): React.JSX.Element {
  const list = parseMarkdown(copy("legal.privacy.rights")).find((b) => b.kind === "list");
  return (
    <p className="flex flex-wrap gap-2" data-testid="legal-rights">
      {(list?.kind === "list" ? list.items : []).map((item) => {
        const right = inlineText(item);
        return (
          <span key={right} className="badge badge-soft badge-primary">
            {right}
          </span>
        );
      })}
    </p>
  );
}

/** A provider list as the board's table: each item's bold name is the row, the rest its one job. */
function Providers(p: { list: Extract<Block, { kind: "list" }> }): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="table" data-testid="legal-providers">
        <caption className="text-base-content/70 pb-2 text-left text-xs">{copy("legal.providers.caption")}</caption>
        <tbody>
          {p.list.items.map((item) => {
            const [first, ...rest] = item;
            const named = first?.kind === "strong";
            const name = named ? inlineText(first.children) : "";
            const job = inlineText(named ? rest : item).replace(/^\s*—\s*/, "");
            return (
              <tr key={name || job}>
                <th scope="row" className="align-top whitespace-nowrap">
                  {name}
                </th>
                <td>{job}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Html(p: { blocks: readonly Block[] }): React.JSX.Element | null {
  return p.blocks.length === 0 ? null : (
    <div dangerouslySetInnerHTML={{ __html: toHtml(p.blocks, LEGAL_BODY_CLASSES) }} />
  );
}

/** The follow-up timeline sits under the bullet that names the schedule it draws. */
function withFollowUps(blocks: readonly Block[]): React.JSX.Element {
  const at = blocks.findIndex((b) => b.kind === "list");
  const list = blocks[at];
  const k =
    list?.kind === "list"
      ? list.items.findIndex((item) => NURTURE_H.every((h) => inlineText(item).includes(String(h))))
      : -1;
  if (list?.kind !== "list" || k < 0) {
    return (
      <>
        <Html blocks={blocks} />
        <FollowUps />
      </>
    );
  }
  return (
    <>
      <Html blocks={[...blocks.slice(0, at), { ...list, items: list.items.slice(0, k + 1) }]} />
      <FollowUps />
      <Html blocks={[{ ...list, items: list.items.slice(k + 1) }, ...blocks.slice(at + 1)].filter((b) => b.kind !== "list" || b.items.length > 0)} />
    </>
  );
}

function Section(p: { section: LegalSection; figure: LegalFigure | undefined }): React.JSX.Element {
  const { section, figure } = p;
  const at = figure === "providers" ? section.blocks.findIndex((b) => b.kind === "list") : -1;
  const list = section.blocks[at];
  return (
    <section className="mt-6 flex flex-col gap-3 first:mt-0">
      {section.headingHtml === "" ? null : <div dangerouslySetInnerHTML={{ __html: section.headingHtml }} />}
      {figure === "rights" ? <Rights /> : null}
      {figure === "follow-ups" ? (
        withFollowUps(section.blocks)
      ) : list?.kind === "list" ? (
        <>
          <Html blocks={section.blocks.slice(0, at)} />
          <Providers list={list} />
          <Html blocks={section.blocks.slice(at + 1)} />
        </>
      ) : (
        <Html blocks={section.blocks} />
      )}
    </section>
  );
}

export function LegalPage(p: { document: LegalDocument }): React.JSX.Element {
  const blocks = headingsUnderTitle(parseMarkdown(copy(p.document.body)));
  const headings = legalHeadings(blocks);

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      {/* The board's two columns from `lg`, one below it — and the article
          held to the **ruled reading measure** (`--w-read`, 704px) rather
          than to `max-w-3xl`'s 768. The token is the one `surface.css`
          already selects for a read arm; this is not a second measure. */}
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-4 px-4 py-12">
        <div className="flex flex-col gap-3">
          <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
            {copy("legal.eyebrow")}
          </span>
          <h1>{copy(p.document.title)}</h1>
          {/* The whole line is a date with one word in front of it, so the
              whole line is in the mono face. */}
          <p className="text-base-content/70 font-mono text-xs">
            {copy("legal.updated", { date: copy(p.document.updated) })}
          </p>
          <nav aria-label={copy("legal.tabs.label")}>
            <div className="tabs tabs-box w-fit">
              {LEGAL_DOCUMENTS.map((d) => (
                <Link
                  key={d.path}
                  href={d.path}
                  className={d === p.document ? "tab tab-active" : "tab"}
                  aria-current={d === p.document ? "page" : undefined}
                >
                  {copy(d.title)}
                </Link>
              ))}
            </div>
          </nav>
        </div>
        {p.document.summary === undefined ? null : (
          <section className="rounded-box bg-base-200 flex flex-col gap-2 p-4" data-testid="legal-summary">
            <p className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
              {copy("legal.summary.title")}
            </p>
            <div dangerouslySetInnerHTML={{ __html: legalBodyHtml(copy(p.document.summary)) }} />
            <p className="text-base-content/70 text-xs">{copy("legal.summary.note")}</p>
          </section>
        )}
        {/* The board's two columns from `lg`, one below it, with the card held
            to the ruled reading measure (`--w-read`). */}
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
          <OnThisPage headings={headings} />
          {/* One card, no head: the page's own h1 already names the document. */}
          <div className="card bg-base-100 w-full min-w-0 max-w-(--w-read) shadow-(--shadow-card)">
            <div className="card-body">
              <div className="text-base-content/80 min-w-0 leading-relaxed" data-testid="legal-document">
                {legalSections(blocks, LEGAL_BODY_CLASSES).map((section, i) => (
                  <Section
                    key={section.heading?.id ?? i}
                    section={section}
                    figure={section.heading === null ? undefined : p.document.figures?.[section.heading.id]}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </Surface>
  );
}
