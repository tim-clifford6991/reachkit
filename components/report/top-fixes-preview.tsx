/**
 * TopFixesPreview — "Your top 3 ranked fixes", ported 1:1 from the mockup
 * (ReachKit.dc.html): a vertical stack of rank-tile cards (rank · title + why +
 * effort/pillar chips · Predicted +N), plus a locked card for the rest. Exact
 * hex values from source; wired to the real whatToDoThisWeek actions.
 */

import type { ReportPayload } from "@/lib/scan/report";

type ActionCard = ReportPayload["whatToDoThisWeek"]["quickWins"][number];

function effortLabel(effortMin: number | null): string {
  const m = effortMin ?? 30;
  if (m < 30) return "Quick";
  if (m <= 120) return "Medium";
  return "Deep";
}

// Effort → chip/tile colors (mockup: Quick = blue, else = amber).
function effortColors(label: string): { bg: string; fg: string } {
  return label === "Quick" ? { bg: "var(--c-tint-blue)", fg: "#3B6FE0" } : { bg: "var(--c-tint-amber)", fg: "#C98A12" };
}

const PILLAR_LABEL: Record<string, string> = {
  content: "Content",
  outreach: "Outreach",
  seo_aso: "SEO",
};

function FixRow({ action, rank }: { action: ActionCard; rank: number }) {
  const delta = action.expectedOutcome?.delta ?? 0;
  const effort = effortLabel(action.effortMin);
  const ec = effortColors(effort);
  const pillar = PILLAR_LABEL[action.category] ?? action.category;

  return (
    <div
      style={{
        background: "var(--c-surface)",
        border: "1px solid var(--c-line)",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: ec.bg,
          color: ec.fg,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          flex: "none",
        }}
      >
        {rank}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "15.5px", color: "var(--c-ink)" }}>{action.title}</div>
        <div style={{ fontSize: "13.5px", color: "var(--c-faint)", marginTop: 3 }}>{action.why}</div>
        <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: ec.fg, background: ec.bg, padding: "3px 9px", borderRadius: 6 }}>
            {effort}
          </span>
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--c-muted)", background: "var(--c-fill)", padding: "3px 9px", borderRadius: 6 }}>
            {pillar}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "right", flex: "none" }}>
        <div style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 600 }}>Predicted</div>
        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: "#1F9D5B" }}>
          +{delta}
        </div>
      </div>
    </div>
  );
}

export function TopFixesPreview({ whatToDoThisWeek }: { whatToDoThisWeek: ReportPayload["whatToDoThisWeek"] }) {
  const all: ActionCard[] = [
    ...whatToDoThisWeek.quickWins,
    ...whatToDoThisWeek.medium,
    ...whatToDoThisWeek.longPlay,
  ];
  const ranked = all
    .filter((a) => (a.expectedOutcome?.delta ?? 0) > 0)
    .sort((a, b) => (b.expectedOutcome?.delta ?? 0) - (a.expectedOutcome?.delta ?? 0));
  const top = ranked.slice(0, 3);
  if (top.length === 0) return null;

  const rest = ranked.slice(3);
  const restWorth = rest.reduce((s, a) => s + (a.expectedOutcome?.delta ?? 0), 0);

  return (
    <section aria-label="Your top 3 ranked fixes">
      <h2
        className="text-[20px] font-bold tracking-[-0.01em]"
        style={{ color: "var(--c-ink)", fontFamily: "var(--font-display)", margin: "0 0 6px" }}
      >
        Your top {top.length} ranked fixes
      </h2>
      <p style={{ fontSize: 14, color: "var(--c-faint)", margin: "0 0 14px" }}>
        Ordered by expected score impact. Free scans show {top.length} of {ranked.length}.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {top.map((a, i) => (
          <FixRow key={i} action={a} rank={i + 1} />
        ))}
        {rest.length > 0 && (
          <div
            style={{
              background: "var(--c-surface)",
              border: "1px dashed #D9D6E4",
              borderRadius: 14,
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 14,
              color: "var(--c-faint)",
            }}
          >
            🔒 {rest.length} more ranked fixes{restWorth > 0 ? ` — worth an estimated +${restWorth}` : ""}
          </div>
        )}
      </div>
    </section>
  );
}
