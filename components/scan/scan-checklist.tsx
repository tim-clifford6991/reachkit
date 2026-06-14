import type { ComputedStep } from "./scan-narrative";

function Mark({ state }: { state: ComputedStep["state"] }) {
  if (state === "done") {
    return (
      <span
        className="grid size-5 shrink-0 place-items-center rounded-full"
        style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
        aria-hidden
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
        <span
          className="size-4 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
          style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
        />
      </span>
    );
  }
  return (
    <span
      className="size-5 shrink-0 rounded-full border-2"
      style={{ borderColor: "var(--hairline-strong)" }}
      aria-hidden
    />
  );
}

export function ScanChecklist({ steps }: { steps: ComputedStep[] }) {
  return (
    <ol className="space-y-4" role="log" aria-live="polite" aria-label="Scan progress">
      {steps.map((s) => (
        <li
          key={s.id}
          className="flex items-center gap-3 transition-opacity duration-300"
          style={{ opacity: s.state === "pending" ? 0.45 : 1 }}
        >
          <Mark state={s.state} />
          <span
            className="font-mono text-base leading-snug"
            style={{
              color: s.state === "active" ? "var(--color-fg)" : "var(--color-muted)",
              fontWeight: s.state === "active" ? 600 : 400,
            }}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
