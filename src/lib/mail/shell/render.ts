// BUILD §12 — the React Email document as the string a send carries.
// `react-email`'s `render()`, never `react-dom/server`: `next build` refuses that import in a project file, and Vitest cannot see the rule.
// So rendering is async; `composeMailParts()` stays synchronous.
import type { ReactNode } from "react";
import { render } from "react-email";

/** Replaces `render()`'s XHTML doctype: the doctype switches an inbox's quirks mode, and this is the one checked in Gmail and Apple Mail. */
const DOCTYPE = "<!doctype html>";

/** Matched, not assumed, so the mail keeps exactly one doctype whatever the library emits. */
const ANY_DOCTYPE = /^<!DOCTYPE[^>]*>/i;

/** React's hydration markers, which a mail never needs. Only these: the `<!--[if mso]>` comments `Button` writes draw it in Outlook. */
const REACT_STREAM_MARKERS = /<!--(?:\$[?!/]?|\/\$|html|head|body)-->/g;

function stripStreamMarkers(html: string): string {
  return html.replace(REACT_STREAM_MARKERS, "");
}

/** The one place a React tree becomes a mail's HTML half. */
export async function renderMailHtml(document: ReactNode): Promise<string> {
  const html = await render(document);
  return `${DOCTYPE}${stripStreamMarkers(html.replace(ANY_DOCTYPE, ""))}`;
}

/** The same renderer without a doctype, for `blocks/html.ts`'s fragment of block rows. */
export async function renderBlocksHtmlFragment(nodes: ReactNode): Promise<string> {
  return stripStreamMarkers((await render(nodes)).replace(ANY_DOCTYPE, ""));
}
