/**
 * ActionBoardSections — the §3.3 status view below the open queue: Verifying /
 * Done / Needs-another-look, with predicted-vs-actual Δ on completed actions
 * (actual measured from the score-history marker). Read-only; the open queue
 * keeps the interactive tick-off.
 */

import type { ActionBoard, BoardAction } from "@/lib/scan/action-board";

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <span className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
        {label} —
      </span>
    );
  }
  const up = value > 0;
  const color = value === 0 ? "var(--color-muted)" : up ? "var(--color-success)" : "var(--color-danger)";
  return (
    <span className="font-mono text-[10px] tabular-nums" style={{ color }}>
      {label} {up ? "+" : ""}
      {value}
    </span>
  );
}

function BoardCard({ action, showActual }: { action: BoardAction; showActual?: boolean }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ border: "1px solid var(--hairline)" }}>
      <p className="text-sm font-medium leading-snug" style={{ color: "var(--color-fg)" }}>
        {action.title}
      </p>
      <div className="mt-1.5 flex items-center gap-3">
        <Delta value={action.predictedDelta} label="predicted" />
        {showActual && <Delta value={action.actualDelta} label="· actual" />}
      </div>
    </div>
  );
}

function Group({
  label,
  sublabel,
  accent,
  actions,
  showActual,
}: {
  label: string;
  sublabel: string;
  accent: string;
  actions: BoardAction[];
  showActual?: boolean;
}) {
  if (actions.length === 0) return null;
  return (
    <section className="rounded-xl border" style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}>
      <div className="px-7 pt-5">
        <div className="mb-3 flex items-baseline gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
            {label}
          </p>
          <p className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
            {sublabel}
          </p>
          <span className="ml-auto font-mono text-[10px] tabular-nums" style={{ color: "var(--color-muted)" }}>
            {actions.length}
          </span>
        </div>
        <div className="space-y-2 pb-5">
          {actions.map((a) => (
            <BoardCard key={a.id} action={a} showActual={showActual} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ActionBoardSections({ board }: { board: ActionBoard }) {
  if (board.verifying.length + board.done.length + board.retry.length === 0) return null;
  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
        Progress
      </p>
      <Group label="Verifying" sublabel="checking your live page" accent="var(--color-accent-500)" actions={board.verifying} />
      <Group label="Done" sublabel="verified — score updated" accent="var(--color-success)" actions={board.done} showActual />
      <Group label="Needs another look" sublabel="we couldn't confirm the change yet" accent="var(--color-warning)" actions={board.retry} />
    </div>
  );
}
