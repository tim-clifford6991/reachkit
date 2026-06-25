import * as React from "react";

export type Cell = boolean | "partial";

export interface ComparisonRow {
  capability: string;
  /** One cell per column in `tools` order. true = ✓, false = ✗, "partial" = ~. */
  cells: Cell[];
}

export interface ComparisonTableProps {
  /** Column headers — the first is highlighted as the featured product. */
  tools: string[];
  rows: ComparisonRow[];
}

function Mark({ cell }: { cell: Cell }) {
  if (cell === "partial") {
    return <span style={{ color: "var(--c-faint)", fontWeight: 700 }}>~</span>;
  }
  return cell ? (
    <span style={{ color: "var(--c-band-findable)", fontWeight: 700, fontSize: 16 }}>✓</span>
  ) : (
    <span style={{ color: "var(--c-faint)", fontWeight: 700, fontSize: 16 }}>✗</span>
  );
}

/**
 * Feature comparison matrix — capabilities down the side, products across the
 * top, with the featured product's column tinted. Powers the /compare pages.
 */
export function ComparisonTable({ tools, rows }: ComparisonTableProps) {
  return (
    <div style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", overflow: "hidden", fontFamily: "var(--font-sans)", color: "var(--c-ink)", maxWidth: 720 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "14px 18px", background: "var(--c-bg2)", fontWeight: 600, color: "var(--c-muted)" }} />
            {tools.map((t, i) => (
              <th
                key={t}
                style={{
                  padding: "14px 18px",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  textAlign: "center",
                  background: i === 0 ? "var(--c-soft)" : "var(--c-bg2)",
                  color: i === 0 ? "var(--c-action)" : "var(--c-ink)",
                }}
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.capability} style={{ borderTop: "1px solid var(--c-line)" }}>
              <td style={{ padding: "13px 18px", color: "var(--c-ink)" }}>{r.capability}</td>
              {r.cells.map((c, ci) => (
                <td key={ci} style={{ padding: "13px 18px", textAlign: "center", background: ci === 0 ? "var(--c-tint-violet)" : "transparent" }}>
                  <Mark cell={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
