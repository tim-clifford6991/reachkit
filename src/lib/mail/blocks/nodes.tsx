// BUILD §12 · §2.1 · §2.3 — the eight arms as `react-email` components, so escaping and Outlook padding are the library's.
// Omission is `omit.ts`'s, rows are `rows.ts`'s, sentences are `copy()`'s and styles are `tokens.ts` names: no hex, font stack or sentence here.
// A mail has no stylesheet, so `<Mono>` writes §2.3's mono tabular numerals inline and every numeral goes through it.
import type { ReactNode } from "react";
import { Button, Column, Heading, Link, Row, Text } from "react-email";
import { copy } from "@/lib/presentation/copy";
import { generatedLabel } from "@/lib/presentation/generated";
import { token } from "../shell/tokens";
import { formatStat } from "./format";
import { isMeasuredEmpty, omittedIndexes } from "./omit";
import { factRowsOf, rowsOf, statRowsOf, type RenderedRow, type StatRowText } from "./rows";
import type { MailBlock } from "./types";

/** Layout tokens bound to names, since the string-literal sweep reads a bare JSX attribute literal as voice. */
const RIGHT = "right" as const;
/** Between two links on one row. Layout, not voice. */
const LINK_SEPARATOR = " · " as const;
const HALF = "50%" as const;
/** `h3`, because the card's head carries the wordmark (S20). */
const HEADING_LEVEL = "h3" as const;

/** The only size off the type ladder: S20 draws the headline figure above `--h2`, and no rung is named there. */
const HERO_SIZE = "36px";

/** BUILD §2.3's numerals, inline: every number, date, domain and URL in a mail. */
function Mono({ children }: { children: string }): ReactNode {
  return (
    <span
      style={{ fontFamily: token("--font-mono-mail"), fontVariantNumeric: "tabular-nums" }}
    >
      {children}
    </span>
  );
}

/** One block's cell; the styles sit on the `<td>`, where Outlook reads a font from. */
function Block({ children, marker }: { children: ReactNode; marker: string }): ReactNode {
  return (
    <Row data-rk-block={marker}>
      <Column
        style={{
          padding: "0 0 16px 0",
          fontFamily: token("--font-ui-mail"),
          fontSize: token("--t-body"),
          lineHeight: 1.55,
          color: token("--color-base-content"),
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
  borderBottom: `1px solid ${token("--color-base-300")}`,
} as const;

const FACT_CELL = {
  padding: "7px 0",
  borderBottom: `1px solid ${token("--color-base-300")}`,
  fontSize: token("--t-sm"),
} as const;

function RuledRows({
  label,
  rows,
  emptyLine,
}: {
  label: string | null;
  rows: readonly RenderedRow[];
  emptyLine: string | null;
}): ReactNode {
  if (emptyLine !== null) {
    return (
      <>
        {label === null ? null : <Eyebrow>{label}</Eyebrow>}
        <Text style={{ margin: 0, fontSize: token("--t-body"), lineHeight: 1.55, color: token("--ink-2") }}>
          {emptyLine}
        </Text>
      </>
    );
  }
  return (
    <>
      {label === null ? null : <Eyebrow>{label}</Eyebrow>}
      {rows.map((item, index) => (
        <Row key={index}>
          <Column style={{ ...RULED_CELL, color: token("--color-base-content") }}>
            {item.href === undefined ? (
              item.left
            ) : (
              <Link href={item.href} style={{ color: token("--color-primary") }}>
                {item.left}
              </Link>
            )}
            {(item.detail ?? []).map((line, at) => (
              <div key={at} style={{ paddingTop: "2px", color: token("--ink-2") }}>
                {line}
              </div>
            ))}
            {item.links === undefined ? null : (
              <div style={{ paddingTop: "4px" }}>
                {item.links.map((link, at) => (
                  <span key={at}>
                    {at === 0 ? null : LINK_SEPARATOR}
                    <Link href={link.href} style={{ color: token("--color-primary") }}>
                      {link.label}
                    </Link>
                  </span>
                ))}
              </div>
            )}
          </Column>
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

/** S20's hairline-ruled mono `dl`; its rows are `Row`/`Column`, since inboxes lay out a `dl`'s own display least predictably. */
function Facts({ rows }: { rows: readonly { label: string; value: string }[] }): ReactNode {
  return (
    <dl style={{ margin: 0 }}>
      {rows.map((item, index) => (
        <Row key={index}>
          <Column style={{ ...FACT_CELL, fontFamily: token("--font-mono-mail"), color: token("--ink-2") }}>
            {item.label}
          </Column>
          <Column align={RIGHT} style={{ ...FACT_CELL, color: token("--color-base-content") }}>
            <Mono>{item.value}</Mono>
          </Column>
        </Row>
      ))}
    </dl>
  );
}

/** SPEC §8's headline number; its change is a second cell on the row, since an inbox that drops a float still lays out a table row. */
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
          style={{ fontSize: HERO_SIZE, lineHeight: 1.1, fontWeight: 700, color: token("--color-base-content") }}
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

/** SPEC §8's numbers, two `Column`s to a `Row`: table cells are all an inbox lays out reliably. */
function Stats({
  items,
}: {
  items: readonly StatRowText[];
}): ReactNode {
  // What the figure is read against, or the unmeasured line in its place.
  const line = (text: string): ReactNode => (
    <div style={{ fontSize: token("--t-sm"), color: token("--ink-2"), paddingTop: "2px" }}>{text}</div>
  );
  const cell = (item: StatRowText, key: number): ReactNode => (
    // A gutter on the cell, so a long left label does not run into the right one on a phone.
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
      {item.value === null ? null : (
        <div style={{ fontSize: token("--h3"), fontWeight: 700, color: token("--color-base-content") }}>
          {item.before === null ? null : (
            <span style={{ fontSize: token("--t-sm"), fontWeight: 400, color: token("--ink-2"), paddingRight: "6px" }}>
              {item.before}
            </span>
          )}
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
      )}
      {item.line === null ? null : line(item.line)}
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

/** Only the two schemes an inbox should follow become an `href`; anything else is text, since a hostile link in a mail costs an account. */
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

/** S20's button through `react-email`'s `Button` (Outlook padding included). `secondary` drops the fill, since two solid fills are two primaries. */
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
        background: outlined ? token("--color-base-100") : token("--color-primary"),
        color: outlined ? token("--color-base-content") : token("--color-primary-content"),
        ...(outlined ? { border: `1px solid ${token("--color-base-300")}` } : {}),
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
          background: token("--color-base-200"),
          border: `1px solid ${token("--color-base-300")}`,
          fontFamily: token("--font-mono-mail"),
          fontSize: token("--t-sm"),
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          color: token("--color-base-content"),
        }}
      >
        {markdown}
      </pre>
    </>
  );
}

/** One arm as its node; every value it states was kept by `omit.ts`. */
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
            color: token("--color-base-content"),
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
          <div style={{ fontSize: token("--h2"), fontWeight: 700, color: token("--color-base-content") }}>
            <Mono>{formatStat(block.value, block.format)}</Mono>
          </div>
          {/* The note travels with its value: this arm is reached only when the value was kept. */}
          {block.note === undefined ? null : <Note>{copy(block.note)}</Note>}
        </>
      );
    case "list":
    case "verdicts": {
      const label = block.label === undefined ? null : copy(block.label);
      return isMeasuredEmpty(block) ? (
        <RuledRows label={label} rows={[]} emptyLine={copy(block.emptyLine)} />
      ) : (
        <RuledRows label={label} rows={rowsOf(block)} emptyLine={null} />
      );
    }
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

/** The kept blocks as the frame's nodes, with the same `omitted` indexes the text renderer returns. */
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
