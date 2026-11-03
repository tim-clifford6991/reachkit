// BUILD §2.3 · §12 — how a mail draws its numbers: the inline mono numerals, the tinted tiles and the bars against a whole.
// Cell backgrounds and text only, never an image, so each survives images off; styles are `tokens.ts` names.
import type { ReactNode } from "react";
import { token } from "../shell/tokens";
import type { StatRowText } from "./rows";

/** Layout tokens bound to names, since the string-literal sweep reads a bare JSX attribute literal as voice. */
export const RIGHT = "right" as const;
/** A layout table, which a screen reader reads past. Layout, not voice. */
export const PRESENTATION = "presentation" as const;
/** A no-break space, so an empty spacer cell does not collapse. */
export const GAP = "\u00a0" as const;
export const FULL = "100%";
/** Sizes off the type ladder, each where board MondayMail draws one and no rung is named. */
export const SMALL_SIZE = "14px";
export const BOX_RADIUS = "10px";
const TILE_SIZE = "30px";
const BAR_HEIGHT = "10px";
const TILE_GAP = "2%";
const TILE_WIDTH = "49%";
const TWO = 2;

/** BUILD §2.3's numerals, inline: every number, date, domain and URL in a mail. */
export function Mono({ children }: { children: string }): ReactNode {
  return (
    <span
      style={{ fontFamily: token("--font-mono-mail"), fontVariantNumeric: "tabular-nums" }}
    >
      {children}
    </span>
  );
}

/** Each number in its own tinted box, two to a row; the first takes the accent tint, as board MondayMail draws it. */
export function Tiles({ items }: { items: readonly StatRowText[] }): ReactNode {
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
export function Bars({ items }: { items: readonly StatRowText[] }): ReactNode {
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
