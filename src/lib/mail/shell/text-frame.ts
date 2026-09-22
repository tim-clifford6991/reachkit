// BUILD §12 — the plain-text twin of the same frame.
//
// Same three bands, same order: wordmark, body (blocks then the whole-mail
// line), footer. The opt-out is written out as a labelled URL — never a
// bare URL with nothing saying what it is. Like `document.tsx`, this file
// authors no sentence: every string arrives rendered from `compose.ts`.
//
// **#934 left this half alone.** React Email converts a rendered mail to
// plain text by running its HTML back through `html-to-text`, which cannot
// reproduce these bands: the rule under the body exists only here, a stat
// reads `label: value` rather than as two stacked cells, and an action
// writes its URL out beside its label instead of appending it. The owner
// checked all sixteen kinds in Gmail and in Apple Mail on 2026-09-22, so
// the twin they approved is the twin that still ships, byte for byte.


/** The rule between the body and the footer. Layout, not voice — the
 *  plain-text equivalent of the card's bottom edge. */
const FOOTER_RULE = "—".repeat(24);

/** The same bands `document.tsx` draws, as the strings this half writes.
 *  Declared here rather than derived from the HTML half's props: since
 *  #934 those are React nodes, and the twin's body is text — two shapes
 *  for two bodies, holding the same named bands in the same order. */
export interface TextFrameParts {
  /** The product's name, rendered from its copy key by `compose.ts`. */
  wordmark: string;
  /** The blocks before the first action, rendered by `renderBlocksText`. */
  body: string;
  /** The blocks from the first action on; the whole-mail line stands
   *  between the two, as it does in the HTML half. */
  actions: string;
  /** The one line a mail carries when its conditional sections said
   *  nothing, or the week behind it could not be measured. */
  wholeMailLine: string | null;
  /** Why this mail arrived — `null` on the three kinds whose line the
   *  owner has not written (`tests/mail/shell/footer.test.ts`). */
  reason: string | null;
  /** `null` until the owner writes the imprint the approved set brackets. */
  imprint: string | null;
  plainTextNote: string;
  /** The stop control, where this kind carries one. */
  optOut: { href: string; label: string } | null;
}

/** The separator the imprint band’s parts are set between, as `document.tsx`
 *  sets them. Layout, not voice. */
const BAND_SEPARATOR = " · ";

export function frameText(parts: TextFrameParts): string {
  const bands: string[] = [parts.wordmark];

  const body = [parts.body, parts.wholeMailLine ?? "", parts.actions].filter((s) => s !== "").join("\n\n");
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
