// BUILD §12 — the plain-text twin of the same frame.
//
// Same three bands, same order: wordmark, body (blocks then the whole-mail
// line), footer. The opt-out is written out as a labelled URL — never a
// bare URL with nothing saying what it is. Like `frame.ts`, this file
// authors no sentence: every string arrives rendered from `compose.ts`.
import type { FrameParts } from "./frame";

/** The rule between the body and the footer. Layout, not voice — the
 *  plain-text equivalent of the card's bottom edge. */
const FOOTER_RULE = "—".repeat(24);

export interface TextFrameParts extends Omit<FrameParts, "rows"> {
  /** The block body, already rendered by `renderBlocksText`. */
  body: string;
}

/** The separator the imprint band's parts are set between, as `frame.ts`
 *  sets them. Layout, not voice. */
const BAND_SEPARATOR = " · ";

export function frameText(parts: TextFrameParts): string {
  const bands: string[] = [parts.wordmark];

  const body = parts.wholeMailLine === null ? parts.body : [parts.body, parts.wholeMailLine].filter((s) => s !== "").join("\n\n");
  if (body !== "") bands.push(body);

  // S20's footer, the same three things in the same order as the HTML
  // half: why it was sent, how to stop it where it can be stopped, and the
  // imprint band. Under one rule, so a reader of the plain-text twin sees
  // the same footer rather than a bare URL.
  const footer: string[] = [FOOTER_RULE];
  if (parts.reason !== null) footer.push(parts.reason);
  if (parts.optOut !== null) footer.push(`${parts.optOut.label}: ${parts.optOut.href}`);
  footer.push(
    [parts.wordmark, parts.imprint, parts.plainTextNote]
      .filter((piece): piece is string => piece !== null && piece !== "")
      .join(BAND_SEPARATOR)
  );
  bands.push(footer.join("\n"));

  return bands.join("\n\n");
}
