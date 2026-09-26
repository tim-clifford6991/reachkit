// BUILD §12 · §2.1 — the one branded shell, as a React Email document.
//
// Header, body slot, the whole-mail line slot, footer, and the opt-out
// slot rendered when one is supplied. There is one document and every mail
// wears it; a template supplies blocks and nothing else, so no kind can
// grow a frame of its own.
//
// `Html`, `Head`, `Body`, `Container`, `Section`, `Row`, `Column`, `Text`
// and `Link` are `react-email`'s (#934). What this file used to do by
// hand — the doctype, the charset meta, the centred full-width table, the
// 600-pixel column, the escaping — the library does, and the two
// long-standing inbox fixes #933's render proof found are now the
// library's own defaults rather than comments on a template literal:
// padding sits on a cell and never on a full-width table, and the card is
// `width:100%` with a `max-width`, never a fixed width a `max-width` is
// asked to pull back.
//
// Every colour, radius and font stack is still named through `tokens.ts` —
// no hex and no font stack is written in this file
// (`tests/mail/shell/shell-tokens.test.ts` reads the source and holds it
// to that). Every sentence arrives already rendered from `compose.ts`;
// this file contains no `copy()` call and authors no string.
import type { ReactNode } from "react";
import { Body, Column, Container, Head, Html, Img, Link, Row, Section, Text } from "react-email";
import { token } from "./tokens";

export interface DocumentParts {
  /** The product's name, rendered from its copy key by `compose.ts`. */
  wordmark: string;
  /** The blocks before the first action, as `blockNodes` built them. */
  rows: ReactNode;
  /** The blocks from the first action on. The whole-mail line stands
   *  between the two, so it is read with the sections it is about and not
   *  under the button. */
  actions: ReactNode;
  /** The one line a mail carries when its conditional sections said
   *  nothing — or when the week behind it could not be measured. `null`
   *  on a mail that has something to say. */
  wholeMailLine: string | null;
  /**
   * UI-SPEC S20's footer, in the order the set draws it: the reason this
   * mail was sent, the way to stop it where it can be stopped, then the
   * imprint band — wordmark · imprint · the note that a plain-text twin
   * travels with it.
   *
   * `reason` is `null` only on the three kinds the approved set does not
   * draw, whose line the owner has not written
   * (`tests/mail/shell/footer.test.ts` names them); `imprint` is `null`
   * until the owner writes the imprint itself, which the set brackets.
   */
  reason: string | null;
  imprint: string | null;
  plainTextNote: string;
  /** Rendered when the caller supplies a stop control. Its label is
   *  chosen by the mechanism, in `compose.ts`, never by a template. */
  optOut: { href: string; label: string } | null;
}

/** The card's own width, and the page inset around it. Lengths, not voice. */
const CARD_WIDTH = "600px";
const PAGE_INSET = "24px 12px";

/** A footer line's own type. The band the lines sit in already carries the
 *  mono face and the ink; `Text` ships a size and a leading of its own, so
 *  each line states the two it inherited rather than taking the
 *  component's defaults. */
const FOOTER_LINE = { margin: 0, fontSize: token("--t-xs"), lineHeight: 1.5 } as const;

/** The middle dot the imprint band's parts are set between. Layout, not
 *  voice — the set draws the three as one line, and a joiner is a
 *  separator rather than a sentence this file authored. */
const BAND_SEPARATOR = " · ";

/** The one character in the gap under the brand head. A cell with nothing
 *  in it collapses in several inboxes, so the gap is a no-break space —
 *  the `&nbsp;` this row carried before the port — bound to a name because
 *  a bare literal in a JSX child is presumed voice
 *  (`tests/presentation/copy/string-literal-sweep.test.ts`), and this one
 *  is a spacer. */
const SPACER = "\u00a0";

/** The mark, at the size the mail head draws it: the 96px render, so a
 *  3× screen still gets a sharp one. */
const MAIL_MARK_PX = 28;

/** The mark's one stable address (#1121): `scripts/brand/render.mjs`
 *  writes it into `public/brand/` from `src/lib/brand/mark.ts`. Absolute,
 *  because a mail has no origin of its own to resolve a path against; the
 *  production host, because a mail outlives any preview deployment. */
const MAIL_MARK_SRC = "https://reachkit.app/brand/mark-96.png";

/**
 * The card's own head: the brand mark and the wordmark, over a hairline.
 *
 * **Inside the card, not above it** — S20 draws it that way, and the owner's
 * render caught this sitting outside on the page ground (2026-09-09).
 *
 * **An image, not inline SVG** (#1121). Gmail, Outlook and most webmail
 * strip `<svg>`, so the inline mark #982 drew left only the violet cell it
 * sat on — a plain square. The mark is now the PNG at its public address,
 * with nothing painted behind it: an inbox that blocks images shows the
 * alt text and the wordmark beside it, never a coloured square.
 */
function BrandHead({ wordmark }: { wordmark: string }): ReactNode {
  return (
    <>
      <Row>
        <Column style={{ padding: "0 0 14px 0", borderBottom: `1px solid ${token("--color-base-300")}` }}>
          <Row>
            <Column width={MAIL_MARK_PX} style={{ width: `${MAIL_MARK_PX}px`, padding: "0 8px 0 0" }}>
              <Img
                src={MAIL_MARK_SRC}
                width={MAIL_MARK_PX}
                height={MAIL_MARK_PX}
                alt={wordmark}
                style={{ display: "block", border: 0 }}
              />
            </Column>
            <Column
              style={{
                fontFamily: token("--font-ui-mail"),
                fontSize: token("--t-body"),
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: token("--color-base-content"),
              }}
            >
              {wordmark}
            </Column>
          </Row>
        </Column>
      </Row>
      <Row>
        <Column style={{ height: "18px", lineHeight: "18px", fontSize: 0 }}>{SPACER}</Column>
      </Row>
    </>
  );
}

function WholeMailLine({ line }: { line: string }): ReactNode {
  return (
    <Row>
      <Column
        style={{
          padding: "0 0 16px 0",
          fontFamily: token("--font-ui-mail"),
          fontSize: token("--t-body"),
          lineHeight: 1.55,
          color: token("--ink-2"),
        }}
      >
        {line}
      </Column>
    </Row>
  );
}

function Footer(parts: DocumentParts): ReactNode {
  const band = [parts.wordmark, parts.imprint, parts.plainTextNote]
    .filter((piece): piece is string => piece !== null && piece !== "")
    .join(BAND_SEPARATOR);
  return (
    // The whole footer is mono, as S20 draws it — the reason line included,
    // not only the imprint band.
    <Row>
      <Column
        style={{
          padding: "14px 0 0 0",
          fontFamily: token("--font-mono-mail"),
          fontSize: token("--t-xs"),
          lineHeight: 1.5,
          color: token("--ink-3"),
        }}
      >
        {parts.reason === null ? null : <Text style={FOOTER_LINE}>{parts.reason}</Text>}
        {parts.optOut === null ? null : (
          <Text style={{ ...FOOTER_LINE, paddingTop: "8px" }}>
            <Link
              href={parts.optOut.href}
              style={{ color: token("--ink-3"), textDecoration: "underline" }}
            >
              {parts.optOut.label}
            </Link>
          </Text>
        )}
        <Text style={{ ...FOOTER_LINE, paddingTop: "8px" }}>{band}</Text>
      </Column>
    </Row>
  );
}

/** The document. One 600px column on the page background, one card on the
 *  surface colour with the brand in its head, and the footer below — the
 *  same bands `text-frame.ts` writes, in the same order. */
export function MailDocument(parts: DocumentParts): ReactNode {
  return (
    <Html>
      <Head />
      <Body style={{ background: token("--bg"), margin: 0, padding: PAGE_INSET }}>
        <Container style={{ maxWidth: CARD_WIDTH }}>
          <Section
            style={{
              background: token("--color-base-100"),
              border: `1px solid ${token("--color-base-300")}`,
              borderRadius: token("--r-box"),
              padding: "22px",
            }}
          >
            <BrandHead wordmark={parts.wordmark} />
            {parts.rows}
            {parts.wholeMailLine === null ? null : <WholeMailLine line={parts.wholeMailLine} />}
            {parts.actions}
          </Section>
          <Footer {...parts} />
        </Container>
      </Body>
    </Html>
  );
}
