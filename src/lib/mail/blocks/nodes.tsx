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
/** A layout table, which a screen reader reads past. Layout, not voice. */
const PRESENTATION = "presentation" as const;
/** The gap between two link buttons, held by a no-break space so the cell does not collapse. */
const GAP_PX = 8;
const GAP = "\u00a0" as const;
const HALF = "50%" as const;
/** `h3` by default, because the card's head carries the wordmark (S20); a mail that names its title takes `h1` and `h2`. */
const HEADING_TAG = { 1: "h1", 2: "h2", default: "h3" } as const;

/** Sizes off the type ladder, each where a board draws one and no rung is named: the headline figure, the title, a tile's figure, small text. */
const HERO_SIZE = "36px";
const TITLE_SIZE = "22px";
const TILE_SIZE = "30px";
const SMALL_SIZE = "14px";
const BOX_RADIUS = "10px";
const BAR_HEIGHT = "10px";
const TILE_GAP = "2%";
const TILE_WIDTH = "49%";
const FULL = "100%";
const TWO = 2;

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
          lineHeight: 1.5,
          color: token("--color-base-content"),
        }}
      >
        {children}
      </Column>
    </Row>
  );
}

/** A tinted box as a one-cell table, since inboxes keep a cell's background where they drop a `div`'s. Its 1px line keeps the edge
 *  where a forced-dark inbox strips the fill. */
function TintBox({ tone, children }: { tone: "ok" | "quiet"; children: ReactNode }): ReactNode {
  const ok = tone === "ok";
  return (
    <table role={PRESENTATION} width={FULL} cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td
            data-rk-tone={tone}
            style={{
              padding: "14px 16px",
              background: token(ok ? "--ok-bg" : "--color-base-200"),
              border: `1px solid ${token(ok ? "--ok-line" : "--color-base-300")}`,
              borderRadius: BOX_RADIUS,
              fontSize: SMALL_SIZE,
              lineHeight: 1.5,
              color: token("--color-base-content"),
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
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

/** A row's controls as bordered text buttons in a layout table: no image, so they work with images off, and at least 44px tall. */
function LinkButtons({ links, spaced }: { links: readonly { label: string; href: string }[]; spaced: boolean }): ReactNode {
  return (
    <table role={PRESENTATION} cellPadding={0} cellSpacing={0} border={0} style={{ marginTop: spaced ? "12px" : "4px" }}>
      <tbody>
        <tr>
          {links.flatMap((link, at) => [
            ...(at === 0 ? [] : [<td key={`gap-${at}`} width={GAP_PX} style={{ fontSize: 0 }}>{GAP}</td>]),
            <td key={at}>
              <Button
                href={link.href}
                style={{
                  padding: "12px 16px",
                  border: `1px solid ${token("--accent-line")}`,
                  borderRadius: token("--r-field"),
                  color: token("--color-primary"),
                  fontFamily: token("--font-ui-mail"),
                  fontSize: token("--t-body"),
                  fontWeight: 600,
                  lineHeight: "20px",
                }}
              >
                {link.label}
              </Button>
            </td>,
          ])}
        </tr>
      </tbody>
    </table>
  );
}

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
          <Column style={{ ...RULED_CELL, ...(item.links === undefined ? {} : { padding: "16px 0" }), color: token("--color-base-content") }}>
            {item.lead === undefined ? null : (
              <div style={{ fontSize: SMALL_SIZE, lineHeight: 1.5, color: token("--ink-2"), paddingBottom: "6px" }}>{item.lead}</div>
            )}
            {item.left === undefined ? null : item.href === undefined ? (
              // A row under a lead is a page: its search is the row's title.
              item.lead === undefined ? item.left : <div style={{ fontSize: token("--h4"), fontWeight: 700, lineHeight: 1.35 }}>{item.left}</div>
            ) : (
              <Link href={item.href} style={{ color: token("--color-primary") }}>
                {item.left}
              </Link>
            )}
            {(item.detail ?? []).map((line, at) => (
              <div key={at} style={{ paddingTop: "6px", fontSize: item.lead === undefined ? token("--t-sm") : SMALL_SIZE, lineHeight: 1.5, color: token("--ink-2") }}>
                {line}
              </div>
            ))}
            {item.links === undefined || item.links.length === 0 ? null : <LinkButtons links={item.links} spaced={item.left !== undefined} />}
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
function Facts({ rows, body }: { rows: readonly { label: string; value: string }[]; body: boolean }): ReactNode {
  const face = token(body ? "--font-ui-mail" : "--font-mono-mail");
  return (
    <dl style={{ margin: 0 }}>
      {rows.map((item, index) => (
        <Row key={index}>
          <Column style={{ ...FACT_CELL, fontFamily: face, color: token("--ink-2") }}>
            {item.label}
          </Column>
          <Column align={RIGHT} style={{ ...FACT_CELL, color: token("--color-base-content") }}>
            {body ? <strong>{item.value}</strong> : <Mono>{item.value}</Mono>}
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

/** Each number in its own tinted box, two to a row; the first takes the accent tint, as board MondayMail draws it. */
function Tiles({ items }: { items: readonly StatRowText[] }): ReactNode {
  const tile = (item: StatRowText, at: number): ReactNode => (
    <td
      key={at}
      width={TILE_WIDTH}
      style={{
        width: TILE_WIDTH,
        verticalAlign: "top",
        padding: "14px",
        background: token(at % TWO === 0 ? "--accent-bg" : "--color-base-200"),
        border: `1px solid ${token(at % TWO === 0 ? "--accent-line" : "--color-base-300")}`,
        borderRadius: BOX_RADIUS,
      }}
    >
      {item.value === null ? null : (
        <div style={{ fontSize: TILE_SIZE, fontWeight: 600, lineHeight: 1.1, color: token("--color-base-content") }}>
          <Mono>{item.value}</Mono>
        </div>
      )}
      <div style={{ paddingTop: "4px", fontSize: SMALL_SIZE, lineHeight: 1.3, color: token("--color-base-content") }}>{item.label}</div>
      {item.line === null ? null : <div style={{ paddingTop: "2px", fontSize: token("--t-sm"), color: token("--ink-2") }}>{item.line}</div>}
    </td>
  );
  const rows: ReactNode[] = [];
  for (let at = 0; at < items.length; at += TWO) {
    const pair = items.slice(at, at + TWO);
    rows.push(
      <table key={at} role={PRESENTATION} width={FULL} cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate", marginTop: at === 0 ? 0 : "8px" }}>
        <tbody>
          <tr>
            {tile(pair[0]!, at)}
            <td width={TILE_GAP} style={{ fontSize: 0 }}>{GAP}</td>
            {pair[1] === undefined ? <td width={TILE_WIDTH} /> : tile(pair[1], at + 1)}
          </tr>
        </tbody>
      </table>
    );
  }
  return <>{rows}</>;
}

/** Each number as a bar against its whole: label above, the count at the bar's end. Cell backgrounds, never an image, so images-off keeps it. */
function Bars({ items }: { items: readonly StatRowText[] }): ReactNode {
  const ruled = { borderBottom: `1px solid ${token("--color-base-200")}` } as const;
  const fill = (width: string, colour: string, key: string): ReactNode => (
    <td key={key} width={width} style={{ width, height: BAR_HEIGHT, background: colour, fontSize: 0, lineHeight: 0 }}>{GAP}</td>
  );
  return (
    <table role={PRESENTATION} width={FULL} cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        {items.flatMap((item, at) => {
          const filled = item.share === null ? null : Math.round(item.share * 100);
          return [
            <tr key={`label-${at}`}>
              <td colSpan={TWO} style={{ padding: "8px 0 0", fontSize: SMALL_SIZE, color: token("--color-base-content") }}>{item.label}</td>
            </tr>,
            <tr key={`bar-${at}`}>
              <td width={FULL} style={{ ...ruled, padding: "4px 12px 8px 0" }}>
                {filled === null ? null : (
                  <table role={PRESENTATION} width={FULL} cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate", borderRadius: "5px", overflow: "hidden" }}>
                    <tbody>
                      <tr>
                        {[
                          ...(filled > 0 ? [fill(`${filled}%`, token("--color-primary"), "fill")] : []),
                          ...(filled < 100 ? [fill(`${100 - filled}%`, token("--color-base-200"), "track")] : []),
                        ]}
                      </tr>
                    </tbody>
                  </table>
                )}
                {item.line === null ? null : <div style={{ paddingTop: "4px", fontSize: token("--t-sm"), color: token("--ink-2") }}>{item.line}</div>}
              </td>
              <td align={RIGHT} style={{ ...ruled, padding: "0 0 8px", verticalAlign: "top", fontSize: token("--t-body"), lineHeight: "18px", fontWeight: 700, whiteSpace: "nowrap", color: token("--color-base-content") }}>
                {item.value === null ? null : <Mono>{item.value}</Mono>}
              </td>
            </tr>,
          ];
        })}
      </tbody>
    </table>
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
        // The solid one keeps a border of its own fill, so an inbox that forces dark and strips the fill still draws its edge.
        border: `1px solid ${outlined ? token("--color-base-300") : token("--color-primary")}`,
        // 12px above and below a 20px line: a 44px target.
        padding: "12px 18px",
        borderRadius: token("--r-pill"),
        fontFamily: token("--font-ui-mail"),
        fontSize: token("--t-body"),
        fontWeight: 700,
        lineHeight: "20px",
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
          as={HEADING_TAG[block.level ?? "default"]}
          style={{
            margin: block.level === 2 ? "8px 0 0" : 0,
            fontSize: block.level === 1 ? TITLE_SIZE : block.level === 2 ? token("--h4") : token("--h3"),
            fontWeight: block.level === 1 ? 800 : 700,
            lineHeight: 1.3,
            letterSpacing: block.level === 2 ? "normal" : "-0.02em",
            color: token("--color-base-content"),
          }}
        >
          {copy(block.text, block.vars)}
        </Heading>
      );
    case "paragraph":
      return block.tone === undefined ? (
        <Text style={{ margin: 0, fontSize: token("--t-body"), lineHeight: 1.5 }}>
          {copy(block.text, block.vars)}
        </Text>
      ) : (
        <TintBox tone={block.tone}>{copy(block.text, block.vars)}</TintBox>
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
      return <Facts rows={factRowsOf(block)} body={block.face === "body"} />;
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
      return block.shape === "tiles" ? (
        <Tiles items={statRowsOf(block)} />
      ) : block.shape === "bars" ? (
        <Bars items={statRowsOf(block)} />
      ) : (
        <Stats items={statRowsOf(block)} />
      );
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
