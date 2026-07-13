/* @mirrors components/app/intel/evidence-drawer.tsx */
import * as React from "react";

/**
 * EvidenceDrawer — the universal drill-down surface: one reusable right-side
 * panel that opens for ANY intel data point (keyword / theme / thread /
 * pain) and shows its evidence + context. Honesty rules: a thread with no
 * `activity` shows date + intent only (never a fabricated engagement
 * count); a pain with no `sourceUrl` shows a muted "from N competitor
 * review pages" fallback instead of a fabricated deep link. This preview
 * card renders the panel open with a sample "pain" subject (the live
 * component is a context Provider + `useEvidenceDrawer().open(subject)`
 * hook — this mirror shows the resulting panel content).
 */
export interface EvidenceDrawerProps {
  kind?: "keyword" | "theme" | "thread" | "pain";
}

const fmt = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);

const Badge = ({ tone, children }: { tone: "neutral" | "amber" | "violet" | "blue"; children: React.ReactNode }) => {
  const TINT: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "var(--c-fill)", fg: "var(--c-muted)" },
    amber: { bg: "var(--c-tint-amber)", fg: "#c98a12" },
    violet: { bg: "var(--c-soft)", fg: "var(--c-action)" },
    blue: { bg: "var(--c-tint-blue)", fg: "#3b6fe0" },
  };
  const c = TINT[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.fg, fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: "var(--radius-xs)", lineHeight: 1.2 }}>{children}</span>;
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--c-faint)", marginBottom: 4 }}>{children}</div>
);

const Title = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--c-ink)", margin: "0 0 12px" }}>{children}</h3>
);

const EvidenceLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-action)", textDecoration: "none", fontWeight: 500 }}>{children} <span style={{ fontSize: "0.85em" }}>↗</span></a>
);

/** Sample pain-point evidence panel — the honest "no direct source" fallback path. */
export function EvidenceDrawer({ kind = "pain" }: EvidenceDrawerProps) {
  return (
    <div
      role="dialog"
      aria-label="Evidence for buyer pain point"
      style={{
        width: 380,
        background: "var(--c-surface)",
        border: "1px solid var(--c-line)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--elevation-xl, 0 8px 30px rgba(0,0,0,0.2))",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--c-faint)", textTransform: "uppercase" }}>
          Buyer pain evidence
        </span>
        <span style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-muted)", fontSize: 14 }}>✕</span>
      </div>
      <Title>Onboarding takes too long to see value</Title>
      <div style={{ display: "flex", gap: 8 }}>
        <Badge tone="amber">7 mentions</Badge>
      </div>
      <div>
        <Label>Verbatim quote</Label>
        <blockquote style={{ margin: 0, padding: "10px 12px", borderLeft: "3px solid var(--c-line)", fontFamily: "var(--font-sans)", fontSize: 13, fontStyle: "italic", color: "var(--c-muted)" }}>
          “Took our team almost two weeks before we saw any real signal.”
        </blockquote>
      </div>
      <div>
        <Label>Source</Label>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--c-faint)" }}>
          from 3 competitor review pages — g2.com, capterra.com, trustpilot.com
        </span>
      </div>
      <div style={{ marginTop: 4, paddingTop: 14, borderTop: "1px solid var(--c-line2)" }}>
        <Label>Also opens for</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--c-ink)" }}>ai meeting notes</span>
            <span style={{ display: "flex", gap: 6 }}><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-muted)" }}>{fmt(2400)}/mo</span><Badge tone="violet">commercial</Badge></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <EvidenceLink href="https://reddit.com/r/example">Anyone tried async standups?</EvidenceLink>
            <Badge tone="blue">reddit</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
