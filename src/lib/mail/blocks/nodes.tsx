// BUILD §12 · §2.1 · §2.3 — the eight arms, as React Email components.
//
// One component per arm, built from `react-email`'s own elements (#934):
// `Row`/`Column` are the `<tr>`/`<td>` an inbox is relied on to lay out,
// and `Heading`, `Text` and `Button` are the leaves. Nothing here
// writes a tag by hand where the library ships one, and nothing here
// composes a string of markup — the escaping, the attribute quoting and
// the button's Outlook padding are the library's, not ours.
//
// What did not move with the markup: omission is still `omit.ts`'s single
// decision, read once at the top; every row is still `rows.ts`'s, so the
// two bodies cannot state different facts; every sentence is still a
// `copy()` call; every colour, face and rung is still a `tokens.ts` name.
// This file contains no hex, no font stack and no sentence.
//
// Numerals — BUILD §2.3, "every numeral, date, URL, search query and
// code-like string is JetBrains Mono with tabular-nums". A screen gets
// that from `.num` in `type.css`; a mail has no stylesheet, so `<Mono>`
// below is the one place the same two declarations are written inline, and
// every numeral in a mail goes through it.
import type { ReactNode } from "react";
import { Button, Column, Heading, Row, Text } from "react-email";
import { copy } from "@/lib/presentation/copy";
import { generatedLabel } from "@/lib/presentation/generated";
import { token } from "../shell/tokens";
import { formatStat } from "./format";
import { isMeasuredEmpty, omittedIndexes } from "./omit";
import { factRowsOf, rowsOf, statRowsOf, type RenderedRow } from "./rows";
import type { MailBlock } from "./types";

/** Attribute values that are layout tokens rather than voice, bound to a
 *  name because `tests/presentation/copy/string-literal-sweep.test.ts`
 *  presumes a bare literal in a JSX attribute is product voice. */
const RIGHT = "right" as const;
const HALF = "50%" as const;
/** The heading level a mail block draws. `h3` and not `h1`: the card's own
 *  head carries the wordmark, so a section heading is a third-level one —
 *  which is what the shell drew before this port and what S20 draws. */
const HEADING_LEVEL = "h3" as const;

/** The one number up top is the only size in a mail off ruling 10a's
 *  ladder: S20 draws the headline figure larger than `--h2`, and there is
 *  no rung above it to name. */
const HERO_SIZE = "36px";

/** BUILD §2.3's numerals, inline. Every number, date, domain and URL in a
 *  mail is drawn through this and nothing else. */
function Mono({ children }: { children: string }): ReactNode {
  return (
    <span
      style={{ fontFamily: token("--font-mono-mail"), fontVariantNumeric: "tabular-nums" }}
    >
      {children}
    </span>
  );
}

/** One block's own cell: the padding, the face and the ink every arm sits
 *  in. `Row`/`Column` put the styles on the `<td>` itself, which is where
 *  Outlook reads a font from. */
function Block({ children, marker }: { children: ReactNode; marker: string }): ReactNode {
  return (
    <Row data-rk-block={marker}>
      <Column
        style={{
          padding: "0 0 16px 0",
          fontFamily: token("--font-ui-mail"),
          fontSize: token("--t-body"),
          lineHeight: 1.55,
          color: token("--ink"),
        }}
      >
        {children}
      </Column>
    </Row>
  );
}

/** The eyebrow over a stat, a list or a fact table. */
function Eyebrow({ children }: { children: string }): ReactNode {
  return (
    <div
      style={{
        fontSize: token("--t-eyebrow"),
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: token("--ink-3"),
        paddingBottom: "4px",
      }}
    >
      {children}
    </div>
  );
}

/** The line under a number, where one travels with it. */
function Note({ children }: { children: string }): ReactNode {
  return (
    <div style={{ fontSize: token("--t-sm"), color: token("--ink-3"), paddingTop: "4px" }}>
      {children}
    </div>
  );
}

const RULED_CELL = {
  padding: "6px 0",
  borderBottom: `1px solid ${token("--line")}`,
} as const;

const FACT_CELL = {
  padding: "7px 0",
  borderBottom: `1px solid ${token("--line")}`,
  fontSize: token("--t-sm"),
} as const;

function RuledRows({
  label,
  rows,
  emptyLine,
}: {
  label: string;
  rows: readonly RenderedRow[];
  emptyLine: string | null;
}): ReactNode {
  if (emptyLine !== null) {
    return (
      <>
        <Eyebrow>{label}</Eyebrow>
        <Text style={{ margin: 0, fontSize: token("--t-body"), lineHeight: 1.55, color: token("--ink-2") }}>
          {emptyLine}
        </Text>
      </>
    );
  }
  return (
    <>
      <Eyebrow>{label}</Eyebrow>
      {rows.map((item, index) => (
        <Row key={index}>
          <Column style={{ ...RULED_CELL, color: token("--ink") }}>{item.left}</Column>
          {item.right === undefined ? null : (
            <Column align={RIGHT} style={{ ...RULED_CELL, color: token("--ink-2") }}>
              {item.right}
            </Column>
          )}
        </Row>
      ))}
    </>
  );
}

/** The `dl` the approved shell draws (UI-SPEC S20): a label in mono at the
 *  small rung, its value in mono on the same row, hairline-ruled.
 *  `<dl>` is the set's own markup; the rows inside it are `Row`/`Column`,
 *  because a `dl`'s own display is the one an inbox lays out least
 *  predictably. */
function Facts({ rows }: { rows: readonly { label: string; value: string }[] }): ReactNode {
  return (
    <dl style={{ margin: 0 }}>
      {rows.map((item, index) => (
        <Row key={index}>
          <Column style={{ ...FACT_CELL, fontFamily: token("--font-mono-mail"), color: token("--ink-2") }}>
            {item.label}
          </Column>
          <Column align={RIGHT} style={{ ...FACT_CELL, color: token("--ink") }}>
            <Mono>{item.value}</Mono>
          </Column>
        </Row>
      ))}
    </dl>
  );
}

/**
 * SPEC §8 (2026-09-20, #933) — the one number up top.
 *
 * The headline figure, its label above it and its change beside it. The
 * change is a second cell on the same row rather than a line under the
 * number: they are one reading, and an inbox that drops a float still lays
 * out a table row.
 */
function Hero(a: {
  label: string;
  value: string;
  change: string | null;
  note: string | null;
}): ReactNode {
  return (
    <>
      <Eyebrow>{a.label}</Eyebrow>
      <Row>
        <Column
          style={{ fontSize: HERO_SIZE, lineHeight: 1.1, fontWeight: 700, color: token("--ink") }}
        >
          <Mono>{a.value}</Mono>
        </Column>
        {a.change === null ? null : (
          <Column
            align={RIGHT}
            style={{
              verticalAlign: "bottom",
              fontSize: token("--t-body"),
              fontWeight: 700,
              color: token("--ink-2"),
            }}
          >
            <Mono>{a.change}</Mono>
          </Column>
        )}
      </Row>
      {a.note === null ? null : <Note>{a.note}</Note>}
    </>
  );
}

/**
 * SPEC §8 (2026-09-20, #933) — the numbers beside it, two to a row.
 *
 * Rows of two cells: an inbox lays out table cells and nothing else
 * reliably, so the "grid" is `Row`s of two `Column`s and a row with one
 * number left in it simply has one. Each number keeps its own label above
 * it and its own change beside it.
 */
function Stats({
  items,
}: {
  items: readonly { label: string; value: string; change: string | null }[];
}): ReactNode {
  const cell = (item: { label: string; value: string; change: string | null }, key: number): ReactNode => (
    // A gutter between the two cells, on the cell rather than as a gap: a
    // long label in the left one would otherwise run straight into the
    // right one's on a phone, which is what #933's 390 shot caught.
    <Column
      key={key}
      width={HALF}
      style={{ width: HALF, verticalAlign: "top", padding: "0 12px 12px 0" }}
    >
      <div
        style={{
          fontSize: token("--t-eyebrow"),
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: token("--ink-3"),
          paddingBottom: "2px",
        }}
      >
        {item.label}
      </div>
      <div style={{ fontSize: token("--h3"), fontWeight: 700, color: token("--ink") }}>
        <Mono>{item.value}</Mono>
        {item.change === null ? null : (
          <span
            style={{
              fontSize: token("--t-sm"),
              fontWeight: 700,
              color: token("--ink-2"),
              paddingLeft: "6px",
            }}
          >
            <Mono>{item.change}</Mono>
          </span>
        )}
      </div>
    </Column>
  );

  const pairs: ReactNode[] = [];
  for (let index = 0; index < items.length; index += 2) {
    const left = items[index];
    const right = items[index + 1];
    pairs.push(
      <Row key={index}>
        {left === undefined ? null : cell(left, index)}
        {right === undefined ? <Column width={HALF} style={{ width: HALF }} /> : cell(right, index + 1)}
      </Row>
    );
  }
  return <>{pairs}</>;
}

/** A URL is only ever emitted as an `href`, and only when it is one of the
 *  two schemes an inbox should follow. Anything else is rendered as text,
 *  never as a link — a mail is the one surface where a hostile `href`
 *  costs the reader their account. */
function safeHref(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

/**
 * S20's one button, drawn by `react-email`'s own `Button` — which carries
 * the Outlook padding hack this seam used to approximate with a `bgcolor`
 * cell around the link.
 *
 * #933's second variant is the same button with the fill taken off and the
 * line left on: a mail may offer two things to do — read the page, or stop
 * it — and two solid fills would be two primaries.
 */
function Action({
  label,
  href,
  variant,
}: {
  label: string;
  href: string;
  variant: "primary" | "secondary";
}): ReactNode {
  const safe = safeHref(href);
  if (safe === null) {
    return <Text style={{ margin: 0, fontSize: token("--t-body"), lineHeight: 1.55 }}>{label}</Text>;
  }
  const outlined = variant === "secondary";
  return (
    <Button
      href={safe}
      data-rk-action={variant}
      style={{
        background: outlined ? token("--surface") : token("--accent"),
        color: outlined ? token("--ink") : token("--on-accent"),
        ...(outlined ? { border: `1px solid ${token("--line")}` } : {}),
        padding: "11px 18px",
        borderRadius: token("--r-pill"),
        fontFamily: token("--font-ui-mail"),
        fontSize: token("--t-body"),
        fontWeight: 700,
      }}
    >
      {label}
    </Button>
  );
}

function Notice({ children }: { children: string }): ReactNode {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: token("--r-field"),
        background: token("--accent-bg"),
        border: `1px solid ${token("--accent-line")}`,
        color: token("--ink-2"),
      }}
    >
      {children}
    </div>
  );
}

function PageBody({ label, markdown }: { label: string; markdown: string }): ReactNode {
  return (
    <>
      <Eyebrow>{label}</Eyebrow>
      <pre
        style={{
          margin: 0,
          padding: "14px",
          borderRadius: token("--r-field"),
          background: token("--sunk"),
          border: `1px solid ${token("--line")}`,
          fontFamily: token("--font-mono-mail"),
          fontSize: token("--t-sm"),
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          color: token("--ink"),
        }}
      >
        {markdown}
      </pre>
    </>
  );
}

/** One arm, as the node that draws it. Every value it states has already
 *  been kept by `omit.ts`. */
function arm(block: MailBlock): ReactNode {
  switch (block.block) {
    case "heading":
      return (
        <Heading
          as={HEADING_LEVEL}
          style={{
            margin: 0,
            fontSize: token("--h3"),
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: token("--ink"),
          }}
        >
          {copy(block.text, block.vars)}
        </Heading>
      );
    case "paragraph":
      return (
        <Text style={{ margin: 0, fontSize: token("--t-body"), lineHeight: 1.55 }}>
          {copy(block.text, block.vars)}
        </Text>
      );
    case "stat":
      return (
        <>
          <Eyebrow>{copy(block.label)}</Eyebrow>
          <div style={{ fontSize: token("--h2"), fontWeight: 700, color: token("--ink") }}>
            <Mono>{formatStat(block.value, block.format)}</Mono>
          </div>
          {/* The note travels with its value or not at all: this arm is
              only reached when the value was kept. */}
          {block.note === undefined ? null : <Note>{copy(block.note)}</Note>}
        </>
      );
    case "list":
    case "verdicts":
      return isMeasuredEmpty(block) ? (
        <RuledRows label={copy(block.label)} rows={[]} emptyLine={copy(block.emptyLine)} />
      ) : (
        <RuledRows label={copy(block.label)} rows={rowsOf(block)} emptyLine={null} />
      );
    case "facts":
      return <Facts rows={factRowsOf(block)} />;
    case "hero":
      return (
        <Hero
          label={copy(block.label)}
          value={formatStat(block.value, block.format)}
          change={
            block.change === undefined || block.change.kind === "unmeasured"
              ? null
              : formatStat(block.change, "delta")
          }
          note={block.note === undefined ? null : copy(block.note)}
        />
      );
    case "stats":
      return <Stats items={statRowsOf(block)} />;
    case "action":
      return (
        <Action label={copy(block.label)} href={block.href} variant={block.variant ?? "primary"} />
      );
    case "notice":
      return <Notice>{copy(block.text, block.vars)}</Notice>;
    case "pageBody":
      return (
        <PageBody
          label={generatedLabel({ pageTitle: block.pageTitle, written: block.written }).label}
          markdown={block.markdown}
        />
      );
  }
}

/** The block list as the nodes the frame draws, minus the blocks `omit.ts`
 *  drops. Returns the same `omitted` indexes the text renderer returns —
 *  the one decision, read twice. */
export function blockNodes(blocks: readonly MailBlock[]): {
  nodes: ReactNode;
  omitted: readonly number[];
} {
  const omitted = omittedIndexes(blocks);
  const dropped = new Set(omitted);
  const kept: ReactNode[] = [];

  for (const [index, block] of blocks.entries()) {
    if (dropped.has(index)) continue;
    kept.push(
      <Block key={index} marker={block.block}>
        {arm(block)}
      </Block>
    );
  }

  return { nodes: <>{kept}</>, omitted };
}
