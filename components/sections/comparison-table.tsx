/**
 * ComparisonTable — §21.1 marketing section
 *
 * "ReachKit vs ChatGPT vs SparkToro"-style capability table.
 * - Rows = capabilities
 * - Columns = tools (first = ReachKit, highlighted)
 * - Cell values: check / cross / partial (text note)
 * - Mono for data values
 *
 * Pure server component — no client JS.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComparisonCellValue =
  | { type: "check" }
  | { type: "cross" }
  | { type: "partial"; note: string }
  | { type: "text"; value: string };

export interface ComparisonRow {
  capability: string;
  /** Values in the same order as `content.tools` */
  cells: readonly ComparisonCellValue[];
}

export interface ComparisonTableContent {
  eyebrow?: string;
  headline: string;
  /** Tool column headers — first entry is ReachKit (highlighted) */
  tools: readonly string[];
  rows: readonly ComparisonRow[];
}

export interface ComparisonTableProps {
  content: ComparisonTableContent;
}

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function Cell({ value, isFirst }: { value: ComparisonCellValue; isFirst: boolean }) {
  if (value.type === "check") {
    return (
      <span aria-label="Yes">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="mx-auto"
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke={isFirst ? "var(--color-accent-400)" : "var(--color-success)"}
            strokeWidth="1.25"
          />
          <path
            d="M5 8l2 2 4-4"
            stroke={isFirst ? "var(--color-accent-400)" : "var(--color-success)"}
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (value.type === "cross") {
    return (
      <span aria-label="No">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="mx-auto"
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke="var(--hairline-strong)"
            strokeWidth="1.25"
          />
          <path
            d="M5.5 5.5l5 5M10.5 5.5l-5 5"
            stroke="var(--color-muted)"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  if (value.type === "partial") {
    return (
      <span
        className="font-mono text-[10px]"
        style={{ color: "var(--color-warning)" }}
        title={value.note}
        aria-label={`Partial: ${value.note}`}
      >
        ~
      </span>
    );
  }

  // text
  return (
    <span
      className="font-mono text-[10px] tabular-nums"
      style={{ color: "var(--color-muted)" }}
    >
      {value.value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function ComparisonTable({ content }: ComparisonTableProps) {
  const { eyebrow, headline, tools, rows } = content;

  return (
    <section
      className="flex flex-col items-center gap-14 px-(--spacing-content-x) py-(--spacing-section-y)"
      aria-label="Tool comparison"
    >
      {/* Header */}
      <div className="flex max-w-lg flex-col items-center gap-3 text-center">
        {eyebrow && (
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-accent-400)" }}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.1 }}
        >
          {headline}
        </h2>
      </div>

      {/* Table wrapper */}
      <div className="w-full max-w-3xl overflow-x-auto">
        <table
          className="w-full border-separate border-spacing-0"
          aria-label="Feature comparison table"
        >
          {/* Column headers */}
          <thead>
            <tr>
              {/* Capability header */}
              <th
                scope="col"
                className="px-4 pb-3 pt-0 text-left font-mono text-[10px] uppercase tracking-widest"
                style={{ color: "var(--color-muted)", minWidth: "10rem" }}
              >
                Capability
              </th>
              {tools.map((tool, i) => (
                <th
                  key={tool}
                  scope="col"
                  className="px-4 pb-3 pt-0 text-center font-mono text-[10px] uppercase tracking-widest"
                  style={{
                    color: i === 0 ? "var(--color-accent-400)" : "var(--color-muted)",
                    minWidth: "7rem",
                  }}
                >
                  {tool}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.capability}>
                {/* Capability label */}
                <td
                  className="border-t px-4 py-3 text-sm"
                  style={{
                    borderColor: "var(--hairline)",
                    color: "var(--color-fg)",
                    borderLeft: "1px solid var(--hairline)",
                    background:
                      ri % 2 === 0 ? "var(--fill-subtle)" : "transparent",
                    borderRadius: ri === 0 ? "0.5rem 0 0 0" : undefined,
                  }}
                >
                  {row.capability}
                </td>

                {/* Cells */}
                {row.cells.map((cell, ci) => {
                  const isFirst = ci === 0;
                  return (
                    <td
                      key={ci}
                      className="border-t px-4 py-3 text-center"
                      style={{
                        borderColor: "var(--hairline)",
                        background: isFirst
                          ? ri % 2 === 0
                            ? "oklch(0.56 0.205 285 / 0.05)"
                            : "oklch(0.56 0.205 285 / 0.03)"
                          : ri % 2 === 0
                          ? "var(--fill-subtle)"
                          : "transparent",
                        borderRight:
                          ci === row.cells.length - 1
                            ? "1px solid var(--hairline)"
                            : undefined,
                      }}
                    >
                      <Cell value={cell} isFirst={isFirst} />
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Bottom border row */}
            <tr aria-hidden="true">
              <td
                className="h-0 border-t"
                style={{ borderColor: "var(--hairline)", borderLeft: "1px solid var(--hairline)" }}
              />
              {tools.map((_, i) => (
                <td
                  key={i}
                  className="h-0 border-t"
                  style={{
                    borderColor: "var(--hairline)",
                    borderRight: i === tools.length - 1 ? "1px solid var(--hairline)" : undefined,
                  }}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
