import * as React from "react";

/**
 * PositioningMirror — two side-by-side tinted panels: a violet "YOU THINK YOU
 * TARGET" vs an orange "YOUR PAGE ACTUALLY READS AS", each filled with audience
 * tag chips. Renders fully with no props.
 */
export interface PositioningMirrorProps {
  intendedTags?: string[];
  actualTags?: string[];
}

export function PositioningMirror({
  intendedTags = ["solo founders", "early-stage SaaS", "indie hackers"],
  actualTags = ["enterprise teams", "agencies", "developers"],
}: PositioningMirrorProps) {
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 };
  const chips: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
  const chip = (border: string): React.CSSProperties => ({ fontSize: 13, fontWeight: 600, background: "var(--c-surface)", border: `1px solid ${border}`, color: "var(--c-ink)", padding: "6px 12px", borderRadius: "var(--radius-md)" });
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--c-ink)", maxWidth: 680 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ borderRadius: "var(--radius-lg)", padding: 18, border: "1px solid var(--c-tint-violet-line)", background: "var(--c-tint-violet)" }}>
          <div style={{ ...label, color: "var(--c-action)" }}>You think you target</div>
          <div style={chips}>{intendedTags.map((t) => (<span key={t} style={chip("var(--c-tint-violet-line)")}>{t}</span>))}</div>
        </div>
        <div style={{ borderRadius: "var(--radius-lg)", padding: 18, border: "1px solid var(--c-tint-orange-line)", background: "var(--c-tint-orange)" }}>
          <div style={{ ...label, color: "#E0731C" }}>Your page actually reads as</div>
          <div style={chips}>{actualTags.map((t) => (<span key={t} style={chip("var(--c-tint-orange-line)")}>{t}</span>))}</div>
        </div>
      </div>
    </div>
  );
}
