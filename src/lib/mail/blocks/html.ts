// BUILD §12 — the block list as the HTML an inbox receives.
//
// Since #934 the rendering itself is React Email (`nodes.tsx`) inside the
// one document (`shell/document.tsx`); this module is the seam that draws
// a block list *on its own*, which is what the block suites assert
// against. It holds no markup and no second omission rule: it renders the
// same nodes `composeMail()` nests in the frame, through the same
// renderer, and returns the same `omitted` indexes.
import { createElement, Fragment } from "react";
import { blockNodes } from "./nodes";
import { renderBlocksHtmlFragment } from "../shell/render";
import type { MailBlock } from "./types";

const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
});

/**
 * A sentence as it appears in the HTML body.
 *
 * React is what escapes a mail now, so this is no longer the renderer's
 * own escape — it is the *reader* of it: the five characters React's
 * server renderer replaces, replaced the way React replaces them (`'`
 * becomes `&#x27;`, not `&#39;`). It exists so a suite can ask whether an
 * approved sentence reached the body without knowing how the body was
 * built.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** The blocks, rendered as the rows of the frame's one column — minus the
 *  blocks `omit.ts` drops. The `omitted` indexes are that single
 *  decision, returned so a caller can assert the choice. */
export async function renderBlocksHtml(blocks: readonly MailBlock[]): Promise<{
  html: string;
  omitted: readonly number[];
}> {
  const { nodes, omitted } = blockNodes(blocks);
  return { html: await renderBlocksHtmlFragment(createElement(Fragment, null, nodes)), omitted };
}
