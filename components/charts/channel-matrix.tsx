/**
 * ChannelMatrixHeatmap — you vs rivals across distribution channels
 * (ChannelIntel UX). Your status is a semantic chip (active/dormant/absent); the
 * rival column is an intensity bar (how many rivals are active on that channel).
 * RSC-safe CSS grid — no SVG, no client boundary.
 */

export type ChannelStatus = "active" | "dormant" | "absent";

export interface ChannelMatrixCell {
  kind: string;
  label: string;
  you: ChannelStatus;
  rivalsActive: number;
  total: number;
}

const YOU_COLOR: Record<ChannelStatus, string> = {
  active: "var(--color-success)",
  dormant: "var(--color-warning)",
  absent: "var(--color-danger)",
};

export function ChannelMatrixHeatmap({ rows }: { rows: ChannelMatrixCell[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_5rem_6.5rem] gap-2 px-3 font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
        <span>Channel</span>
        <span className="text-center">You</span>
        <span className="text-right">Rivals</span>
      </div>
      {rows.map((r) => {
        const intensity = r.total > 0 ? r.rivalsActive / r.total : 0;
        return (
          <div key={r.kind} className="grid grid-cols-[1fr_5rem_6.5rem] items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--fill-subtle)" }}>
            <span className="text-sm" style={{ color: "var(--color-fg)" }}>{r.label}</span>
            <span
              className="mx-auto rounded-full px-2 py-0.5 text-center font-mono text-[10px] uppercase tracking-wider"
              style={{ background: `color-mix(in oklch, ${YOU_COLOR[r.you]} 18%, transparent)`, color: YOU_COLOR[r.you] }}
            >
              {r.you}
            </span>
            <span className="flex items-center justify-end gap-2">
              <span className="h-2 w-12 overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
                <span className="block h-full rounded-full" style={{ width: `${Math.round(intensity * 100)}%`, background: "var(--color-accent-400)" }} />
              </span>
              <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>{r.rivalsActive}/{r.total}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
