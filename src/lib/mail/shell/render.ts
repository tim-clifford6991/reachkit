// BUILD §12 — the React Email document, as the string a send carries.
//
// **`react-email`'s own `render()`, and never `react-dom/server`.** The
// App Router forbids a project file from importing `react-dom/server` at
// all: `next build` fails with "You're importing a component that imports
// react-dom/server", naming the file and the route that reaches it, and
// this seam is reached from an app route through `send.ts`. It is a rule
// about *this* repo's files, so the library's own entry is the way past
// it — `@react-email/render` imports `react-dom/server` inside
// `node_modules`, dynamically, which is the arrangement every React Email
// guide for a Next route handler uses.
//
// Vitest never sees this rule; only the build does (#934, gate report
// 2026-09-23). A local `npm run build` is the check that catches it.
//
// **So rendering is asynchronous.** `render()` returns a promise because
// it imports `react-dom/server` dynamically and reads a stream. That is
// the one thing this port could not keep: `composeMail()` is now `async`.
// It is still pure — no I/O, no clock, no model, no vendor, and the same
// input gives the same two strings — and `composeMailParts()` beside it is
// still synchronous, because choosing the blocks, the whole-mail line and
// the plain-text twin never needed a renderer at all.
import type { ReactNode } from "react";
import { render } from "react-email";

/**
 * The doctype every mail has carried since the shell was written.
 *
 * `render()` writes the XHTML 1.0 Transitional doctype in front of its
 * output. That is a reasonable default for mail and it is not what the
 * owner checked in Gmail and in Apple Mail on 2026-09-22, so it is put
 * back: a document type is the one declaration an inbox's quirks mode
 * turns on, and this port is not the place to find out what it changes.
 */
const DOCTYPE = "<!doctype html>";

/** Everything `render()` may write before the document itself. Matched
 *  rather than assumed so a library that stops emitting one, or emits a
 *  different one, still leaves exactly one doctype on the mail. */
const ANY_DOCTYPE = /^<!DOCTYPE[^>]*>/i;

/**
 * React's own streaming markers, removed.
 *
 * `render()` wraps the document in a `<Suspense>` boundary, so React's
 * server renderer writes `<!--$-->…<!--/$-->` around the body and a
 * `<!--html--><!--head--><!--body-->` preamble inside it. They exist so a
 * browser can hydrate a stream. A mail is never hydrated, nothing in this
 * document suspends, and the mail the owner checked in Gmail and in Apple
 * Mail on 2026-09-22 did not carry them.
 *
 * **Only these exact markers.** Outlook's conditional comments — the
 * `<!--[if mso]>` blocks React Email's own `Button` writes for its padding
 * — are what make a button draw correctly in Word's renderer, and a rule
 * that removed comments in general would delete them.
 * `tests/mail/preview/preview.test.ts` asserts they survive this.
 */
const REACT_STREAM_MARKERS = /<!--(?:\$[?!/]?|\/\$|html|head|body)-->/g;

function stripStreamMarkers(html: string): string {
  return html.replace(REACT_STREAM_MARKERS, "");
}

/** The mail document, rendered. The one place a React tree becomes the
 *  HTML half of a mail. */
export async function renderMailHtml(document: ReactNode): Promise<string> {
  const html = await render(document);
  return `${DOCTYPE}${stripStreamMarkers(html.replace(ANY_DOCTYPE, ""))}`;
}

/** The same renderer, without the document type: a fragment of block rows
 *  rather than a whole mail. `blocks/html.ts` is its one caller — the
 *  block suites assert against a block list on its own, and a doctype in
 *  front of two table rows would be a second, wrong claim about them. */
export async function renderBlocksHtmlFragment(nodes: ReactNode): Promise<string> {
  return stripStreamMarkers((await render(nodes)).replace(ANY_DOCTYPE, ""));
}
