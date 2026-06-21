/**
 * EvidenceFooter — the report's closing line: when it was scanned, how many
 * signals were analyzed, and the grounded-not-hallucinated promise. Reinforces
 * the differentiator vs "just a ChatGPT prompt".
 */

import type { BreakdownGroup } from "@/lib/scan/signal-breakdown";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function EvidenceFooter({ generatedAt, groups }: { generatedAt: string; groups: BreakdownGroup[] }) {
  const total = groups.reduce((a, g) => a + g.signals.length, 0);
  const measured = groups.reduce((a, g) => a + g.signals.filter((s) => s.state !== "unmeasured").length, 0);

  return (
    <p
      className="px-1 pt-1 text-center font-mono text-[10px] leading-relaxed tracking-wide"
      style={{ color: "var(--color-muted)" }}
    >
      Scanned {fmtDate(generatedAt)}
      {total > 0 ? ` · ${total} signals analyzed${measured ? ` (${measured} measured)` : ""}` : ""} · grounded in
      your live page — every claim links to a real source.
    </p>
  );
}
