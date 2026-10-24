// BUILD §12 — the plain-text twin of the same frame.
// The same three bands in order, every string rendered by `compose.ts`, and the opt-out as a labelled URL.
// Written by hand because React Email's `html-to-text` cannot reproduce the body rule, `label: value` stats or URLs beside their labels.


/** The rule between body and footer: the card's bottom edge in text. */
const FOOTER_RULE = "—".repeat(24);

/** `document.tsx`'s bands as strings; its props are React nodes, so the twin declares its own shape. */
export interface TextFrameParts {
  /** The product's name, rendered from its copy key by `compose.ts`. */
  wordmark: string;
  /** The blocks before the first action, rendered by `renderBlocksText`. */
  body: string;
  /** The blocks from the first action on; the whole-mail line stands before them. */
  actions: string;
  /** The line for a mail with nothing to report or an unmeasured week. */
  wholeMailLine: string | null;
  /** Why this mail arrived; `null` on the kinds `tests/mail/shell/footer.test.ts` names. */
  reason: string | null;
  /** `null` until the imprint is written. */
  imprint: string | null;
  plainTextNote: string;
  /** The stop control, where this kind carries one. */
  optOut: { href: string; label: string } | null;
  /** Footer links written before the stop control. */
  links: readonly { href: string; label: string }[];
}

/** The imprint band's separator, as `document.tsx` sets it. */
const BAND_SEPARATOR = " · ";

export function frameText(parts: TextFrameParts): string {
  const bands: string[] = [parts.wordmark];

  const body = [parts.body, parts.wholeMailLine ?? "", parts.actions].filter((s) => s !== "").join("\n\n");
  if (body !== "") bands.push(body);

  // S20's footer as in the HTML half: the reason, the stop control, the imprint band.
  const footer: string[] = [FOOTER_RULE];
  if (parts.reason !== null) footer.push(parts.reason);
  for (const link of parts.links) footer.push(`${link.label}: ${link.href}`);
  if (parts.optOut !== null) footer.push(`${parts.optOut.label}: ${parts.optOut.href}`);
  footer.push(
    [parts.wordmark, parts.imprint, parts.plainTextNote]
      .filter((piece): piece is string => piece !== null && piece !== "")
      .join(BAND_SEPARATOR)
  );
  bands.push(footer.join("\n"));

  return bands.join("\n\n");
}
