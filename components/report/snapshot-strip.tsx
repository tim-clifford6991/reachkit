/**
 * SnapshotStrip — §23 moment 6 stale-report header (Task 21a).
 *
 * Honest, subtle header strip on the report showing when the snapshot was taken
 * and what changes weekly for paid users. Never nagging — purely informational.
 * Server component (no client JS needed).
 */

interface SnapshotStripProps {
  generatedAt: string; // ISO timestamp from the scan
  isPaid: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function SnapshotStrip({ generatedAt, isPaid }: SnapshotStripProps) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{
        background: "var(--fill-subtle)",
        border: "1px solid var(--hairline)",
      }}
      role="note"
      aria-label="Report snapshot information"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Snapshot · {formatDate(generatedAt)}
          </p>
          <p
            className="mt-0.5 text-xs"
            style={{ color: "var(--color-muted)" }}
          >
            {isPaid
              ? "Your score and action queue update each week as the web shifts."
              : "This is a point-in-time analysis. Rankings, reviews, and positioning change weekly."}
          </p>
        </div>

        {!isPaid && (
          <a
            href="/pricing"
            className="shrink-0 font-mono text-[10px] transition-opacity hover:opacity-70"
            style={{ color: "var(--color-accent-400)" }}
            aria-label="Learn about weekly monitoring"
          >
            Weekly monitoring →
          </a>
        )}
      </div>
    </div>
  );
}
