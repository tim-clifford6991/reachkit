// BUILD §12 · §2.1 — the one branded shell every mail wears; a template supplies blocks only, so no kind grows its own frame.
// Layout is `react-email`'s (padding on cells, a `width:100%` card with `max-width`); colours and fonts are `tokens.ts` names and
// every sentence arrives rendered from `compose.ts`, so this file holds no hex, font stack or `copy()` call.
import type { ReactNode } from "react";
import { Body, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from "react-email";
import { token } from "./tokens";

export interface DocumentParts {
  /** The product's name, rendered from its copy key by `compose.ts`. */
  wordmark: string;
  /** The inbox line after the subject, or `null` on a kind that names none. */
  preheader: string | null;
  /** The blocks before the first action, as `blockNodes` built them. */
  rows: ReactNode;
  /** The blocks from the first action on; the whole-mail line stands before them, with the sections it is about. */
  actions: ReactNode;
  /** The line for a mail with nothing to report or an unmeasured week; `null` otherwise. */
  wholeMailLine: string | null;
  /** S20's footer: the reason, the stop control, then wordmark · imprint.
   *  `reason` is `null` on the kinds `tests/mail/shell/footer.test.ts` names; `imprint` until it is written. */
  reason: string | null;
  imprint: string | null;
  /** The stop control, labelled by its mechanism in `compose.ts`, never by a template. */
  optOut: { href: string; label: string } | null;
  /** Footer links set before the stop control, on its line. */
  links: readonly { href: string; label: string }[];
}

/** The card's own width, and the page inset around it. Lengths, not voice. */
const CARD_WIDTH = "600px";
const PAGE_INSET = "24px 12px";

/** `Text` ships its own size and leading, so each footer line restates the band's. */
const FOOTER_LINE = { margin: 0, fontSize: token("--t-xs"), lineHeight: 1.5 } as const;

/** The separator between the imprint band's parts. */
const BAND_SEPARATOR = " · ";

/** An empty cell collapses in several inboxes, so the gap holds a named no-break space (a bare JSX literal reads as voice). */
const SPACER = "\u00a0";

/** The 96px render, so a 3× screen gets a sharp mark. */
const MAIL_MARK_PX = 28;

/** Written by `scripts/brand/render.mjs`. Absolute on the production host: a mail has no origin and outlives a preview. */
const MAIL_MARK_SRC = "https://reachkit.app/brand/mark-96.png";

/** The card's head inside the card, as S20 draws it. A PNG with nothing behind it: most inboxes strip `<svg>`,
 *  and one that blocks images shows the alt text, never a coloured square. */
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
  const footerLinks = parts.optOut === null ? parts.links : [...parts.links, parts.optOut];
  const band = [parts.wordmark, parts.imprint].filter((piece): piece is string => piece !== null && piece !== "").join(BAND_SEPARATOR);
  return (
    // S20 sets the whole footer in mono, the reason line included.
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
        {footerLinks.length === 0 ? null : (
          <Text style={{ ...FOOTER_LINE, paddingTop: "8px" }}>
            {footerLinks.map((link, at) => (
              <span key={at}>
                {at === 0 ? null : BAND_SEPARATOR}
                <Link href={link.href} style={{ color: token("--ink-3"), textDecoration: "underline" }}>
                  {link.label}
                </Link>
              </span>
            ))}
          </Text>
        )}
        <Text style={{ ...FOOTER_LINE, paddingTop: "8px" }}>{band}</Text>
      </Column>
    </Row>
  );
}

/** One 600px column, one card with the brand in its head, the footer below: the bands `text-frame.ts` writes, in order. */
export function MailDocument(parts: DocumentParts): ReactNode {
  return (
    <Html>
      <Head />
      {parts.preheader === null ? null : <Preview>{parts.preheader}</Preview>}
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
