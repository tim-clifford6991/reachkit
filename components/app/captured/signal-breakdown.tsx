"use client";

/**
 * CapturedSignalBreakdown — the app Report "Q4 · How your score is calculated"
 * accordion, 1:1 with the mockup. All 18 signals across 3 pillars; click a
 * pillar to expand its signals (state dot + contribution + why). Driven by
 * readSignalBreakdown(scanId).
 */

import { useState } from "react";

const SG = "Space Grotesk", JM = "JetBrains Mono", PJ = "Plus Jakarta Sans";

export interface BreakdownSignalView {
  key: string;
  label: string;
  why: string;
  state: string;
  contribution: number | null;
  weight: number;
}
export interface BreakdownGroupView {
  pillar: string;
  label: string;
  signals: BreakdownSignalView[];
}

const PILLAR_TINT: Record<string, { bg: string; fg: string }> = {
  Content: { bg: "#EEF1FF", fg: "#3B6FE0" },
  Outreach: { bg: "#FFF1F0", fg: "#E5484D" },
  SEO: { bg: "#EAF7EF", fg: "#1F9D5B" },
};

function stateColor(state: string): { dot: string; label: string } {
  if (/pass|strong|good|high/i.test(state)) return { dot: "#1F9D5B", label: "Strong" };
  if (/partial|fair|medium|mid/i.test(state)) return { dot: "#C98A12", label: "Fair" };
  if (/fail|weak|low|poor/i.test(state)) return { dot: "#E5484D", label: "Weak" };
  return { dot: "#C4C1CE", label: "Not measured" };
}

export function CapturedSignalBreakdown({ groups }: { groups: BreakdownGroupView[] }) {
  const total = groups.reduce((s, g) => s + g.signals.length, 0);
  const [open, setOpen] = useState<string | null>(groups[0]?.pillar ?? null);

  return (
    <div style={{ marginTop: 18, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "24px 26px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: JM, fontSize: 13, color: "var(--c-action)", fontWeight: 700 }}>Q4</span>
        <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 18, margin: 0, color: "var(--c-ink)" }}>How your score is calculated</h3>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--c-faint)", margin: "6px 0 14px" }}>All {total} signals across {groups.length} pillars. Click a pillar to expand.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {groups.map((g) => {
          const tint = PILLAR_TINT[g.label] ?? { bg: "var(--c-soft)", fg: "var(--c-action)" };
          const pts = g.signals.reduce((s, x) => s + (x.contribution ?? 0), 0);
          const isOpen = open === g.pillar;
          return (
            <div key={g.pillar} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 14, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : g.pillar)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer", width: "100%", background: "transparent", border: "none", textAlign: "left" }}
              >
                <span style={{ width: 34, height: 34, borderRadius: 9, background: tint.bg, color: tint.fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontFamily: JM }}>{g.label.charAt(0)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)" }}>{g.label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--c-faint)" }}>{g.signals.length} signals · +{Math.round(pts)} pts</div>
                </div>
                <span style={{ color: "var(--c-faint)", fontSize: 12, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
              </button>
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--c-line2)", padding: "6px 20px 14px" }}>
                  {g.signals.map((s) => {
                    const sc = stateColor(s.state);
                    return (
                      <div key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--c-line2)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, flex: "0 0 auto", marginTop: 6 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: PJ, fontWeight: 600, fontSize: 13.5, color: "var(--c-ink)" }}>{s.label}</div>
                          <div style={{ fontSize: 12.5, color: "var(--c-faint)", marginTop: 2, lineHeight: 1.45 }}>{s.why}</div>
                        </div>
                        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                          <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 13, color: sc.dot }}>{s.contribution != null ? `+${Math.round(s.contribution)}` : "—"}</div>
                          <div style={{ fontSize: 10.5, color: "var(--c-faint)" }}>{sc.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
