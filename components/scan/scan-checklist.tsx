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
          className="size-4 animate-spin rounded-full border-2 motion-reduce:animate-none"
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
  const active = steps.find((s) => s.state === "active");
  return (
    <>
      <ol className="space-y-4" aria-label="Scan progress">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <Mark state={s.state} />
            <span
              className="font-mono text-base leading-snug transition-colors duration-300"
              style={{
                // done + active read as full ink (resolved / current); pending is faint.
                // (No opacity dimming — it dropped pending text below the WCAG contrast floor.)
                color: s.state === "pending" ? "var(--color-muted)" : "var(--color-fg)",
                fontWeight: s.state === "active" ? 600 : 400,
              }}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      {/* role="log" doesn't announce in-place mutations — a dedicated live region
          announces each step change to screen readers. */}
      <span className="sr-only" role="status" aria-live="polite">
        {active ? active.label : "Scan complete"}
      </span>
    </>
  );
}
