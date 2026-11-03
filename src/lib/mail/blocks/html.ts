// BUILD §12 — a block list drawn on its own, through the same React Email nodes and omission `composeMail()` uses.
import { createElement, Fragment } from "react";
import { blockNodes } from "./nodes";
import { renderBlocksHtmlFragment } from "../shell/render";
import type { MailBlock } from "./types";

/** The kept blocks as the frame's column rows, with `omit.ts`'s `omitted` indexes for the caller to assert. */
export async function renderBlocksHtml(blocks: readonly MailBlock[]): Promise<{
  html: string;
  omitted: readonly number[];
}> {
  const { nodes, omitted } = blockNodes(blocks);
  return { html: await renderBlocksHtmlFragment(createElement(Fragment, null, nodes)), omitted };
}
