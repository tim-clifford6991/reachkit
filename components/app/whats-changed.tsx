/**
 * WhatsChanged — the weekly "what changed this week" banner (ChannelIntel UX).
 *
 * Renders the latest refresh digest: market alerts (competitor launches,
 * share-of-voice shifts, keyword opportunities) the weekly cron already emits,
 * plus the per-monitor change summaries. Server-rendered, content-as-props.
 * Renders nothing when there's no digest or a quiet no-op week.
 */

import type { RefreshDigest } from "@/lib/scan/digest";
import type { MarketAlert } from "@/lib/scan/market";

const ALERT_LABEL: Record<MarketAlert["kind"], string> = {
  competitor_launch: "New competitor",
  mention_shift: "Share of voice",
  keyword_opportunity: "Keyword opening",
};

function AlertDot({ kind }: { kind: MarketAlert["kind"] }) {
  const color =
    kind === "competitor_launch"
      ? "var(--color-warning)"
      : kind === "mention_shift"
      ? "var(--color-accent-400)"
      : "var(--color-success)";
  return <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export function WhatsChanged({ digest }: { digest: RefreshDigest | null }) {
  if (!digest) return null;
  const hasAlerts = digest.alerts.length > 0;
  const hasChanges = digest.changes.length > 0;
  if (!hasAlerts && !hasChanges) return null;

  return (
    <section
      className="rounded-xl border"
      style={{ borderColor: "var(--color-accent-900)", background: "var(--color-accent-subtle)" }}
      aria-label="What changed this week"
    >
      <div className="px-6 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
            What changed this week
          </p>
          <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--color-muted)" }}>
            week of {digest.weekOf}
          </span>
        </div>

        {hasAlerts && (
          <ul className="mt-3 space-y-2">
            {digest.alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <AlertDot kind={a.kind} />
                <span className="text-sm leading-snug" style={{ color: "var(--color-fg)" }}>
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    {ALERT_LABEL[a.kind]}
                  </span>{" "}
                  {a.message}
                </span>
              </li>
            ))}
          </ul>
        )}

        {hasChanges && (
          <ul className="mt-3 space-y-1.5">
            {digest.changes.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-snug" style={{ color: "var(--color-muted)" }}>
                <span style={{ color: "var(--color-accent-400)" }}>·</span>
                {c.summary}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
